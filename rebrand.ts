#!/usr/bin/env node
/**
 * GSCODER VS Code Rebrand Automation
 *
 * Run from the root of a cloned microsoft/vscode repository:
 *   npm install          # once, in vscode root after copying this toolkit
 *   npx tsx rebrand.ts
 *
 * Options:
 *   --config <path>       Brand config JSON (default: ./brand.config.json)
 *   --root <path>         VS Code repo root (default: cwd)
 *   --dry-run             Preview changes without writing files
 *   --skip-assets         Skip icon / splash copy pipeline
 *   --generate-icons-only Build branding/icons from logo-master.png only
 *   --no-backup           Do not create .rebrand-backup/ snapshots
 *   --force               Overwrite without prompting (non-interactive CI)
 */

import { randomUUID } from 'node:crypto';
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BrandSection {
	nameShort: string;
	nameLong: string;
	applicationName: string;
	dataFolderName: string;
	sharedDataFolderName: string;
	urlProtocol: string;
	companyName: string;
	authorName: string;
	authorEmail: string;
	repositoryUrl: string;
	reportIssueUrl: string;
	licenseUrl: string;
}

interface PlatformSection {
	win32DirName: string;
	win32NameVersion: string;
	win32RegValueName: string;
	win32ShellNameShort: string;
	win32MutexName: string;
	win32TunnelServiceMutex: string;
	win32TunnelMutex: string;
	win32AppUserModelId: string;
	darwinBundleIdentifier: string;
	linuxIconName: string;
	serverApplicationName: string;
	serverDataFolderName: string;
	tunnelApplicationName: string;
	agentsTelemetryAppName: string;
}

interface TelemetrySection {
	enableTelemetry: boolean;
	enabledTelemetryLevels: { error: boolean; usage: boolean };
	removeTelemetryMachineId: boolean;
	showTelemetryOptOut: boolean;
	yourBrandTelemetry: Record<string, unknown>;
}

interface PackageSection {
	name: string;
	displayName: string;
}

interface AssetsSection {
	masterLogo: string;
	monoLogo: string;
	generateFromMaster: boolean;
}

interface BrandConfig {
	brand: BrandSection;
	platform: PlatformSection;
	telemetry: TelemetrySection;
	package: PackageSection;
	assets: AssetsSection;
}

interface CliOptions {
	configPath: string;
	rootPath: string;
	dryRun: boolean;
	skipAssets: boolean;
	generateIconsOnly: boolean;
	noBackup: boolean;
	force: boolean;
}

interface Win32AppIds {
	win32AppId: string;
	win32x64AppId: string;
	win32arm64AppId: string;
	win32UserAppId: string;
	win32x64UserAppId: string;
	win32arm64UserAppId: string;
}

interface AssetMapping {
	source: string;
	destination: string;
	required: boolean;
	description: string;
}

interface PatchResult {
	file: string;
	changed: boolean;
	details: string[];
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): CliOptions {
	const opts: CliOptions = {
		configPath: './brand.config.json',
		rootPath: process.cwd(),
		dryRun: false,
		skipAssets: false,
		generateIconsOnly: false,
		noBackup: false,
		force: false,
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case '--config':
				opts.configPath = argv[++i] ?? opts.configPath;
				break;
			case '--root':
				opts.rootPath = argv[++i] ?? opts.rootPath;
				break;
			case '--dry-run':
				opts.dryRun = true;
				break;
			case '--skip-assets':
				opts.skipAssets = true;
				break;
			case '--generate-icons-only':
				opts.generateIconsOnly = true;
				break;
			case '--no-backup':
				opts.noBackup = true;
				break;
			case '--force':
				opts.force = true;
				break;
			case '--help':
			case '-h':
				printHelp();
				process.exit(0);
			default:
				if (arg.startsWith('-')) {
					throw new Error(`Unknown flag: ${arg}`);
				}
		}
	}

	return opts;
}

function printHelp(): void {
	console.log(`
GSCODER VS Code Rebrand Automation

Usage:
  npx tsx rebrand.ts [options]

Options:
  --config <path>         Brand config (default: ./brand.config.json)
  --root <path>           VS Code repository root (default: cwd)
  --dry-run               Preview without writing
  --skip-assets           Skip asset overwrite pipeline
  --generate-icons-only   Only build branding/icons from master PNG
  --no-backup             Skip .rebrand-backup/ snapshots
  --force                 Non-interactive mode
  -h, --help              Show this help
`);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function log(level: 'info' | 'warn' | 'error' | 'ok', message: string): void {
	const prefix = { info: '→', warn: '⚠', error: '✖', ok: '✔' }[level];
	console.log(`${prefix} ${message}`);
}

function loadJson<T>(filePath: string): T {
	return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function writeJson(filePath: string, data: unknown, dryRun: boolean): void {
	const content = JSON.stringify(data, null, '\t') + '\n';
	if (dryRun) {
		log('info', `[dry-run] Would write ${filePath}`);
		return;
	}
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, content, 'utf8');
}

function backupFile(root: string, relativePath: string, dryRun: boolean, noBackup: boolean): void {
	if (dryRun || noBackup) {
		return;
	}
	const source = join(root, relativePath);
	if (!existsSync(source)) {
		return;
	}
	const stamp = new Date().toISOString().replace(/[:.]/g, '-');
	const backupRoot = join(root, '.rebrand-backup', stamp);
	const dest = join(backupRoot, relativePath);
	mkdirSync(dirname(dest), { recursive: true });
	copyFileSync(source, dest);
}

function copyFileSafe(src: string, dest: string, dryRun: boolean): void {
	if (dryRun) {
		log('info', `[dry-run] Would copy ${src} → ${dest}`);
		return;
	}
	mkdirSync(dirname(dest), { recursive: true });
	copyFileSync(src, dest);
}

function assertVsCodeRoot(root: string): void {
	const markers = ['product.json', 'package.json', 'src', 'resources'];
	for (const marker of markers) {
		if (!existsSync(join(root, marker))) {
			throw new Error(
				`"${root}" does not look like a VS Code repository (missing ${marker}). ` +
					'Clone https://github.com/microsoft/vscode and run rebrand.ts from its root.',
			);
		}
	}
}

function loadConfig(configPath: string, rootPath: string): BrandConfig {
	const resolved = resolve(rootPath, configPath);
	if (!existsSync(resolved)) {
		throw new Error(`Brand config not found: ${resolved}`);
	}
	return loadJson<BrandConfig>(resolved);
}

function generateWin32AppId(): string {
	return `{{${randomUUID().toUpperCase()}}}`;
}

function generateWin32AppIds(existing?: Partial<Win32AppIds>): Win32AppIds {
	return {
		win32AppId: existing?.win32AppId ?? generateWin32AppId(),
		win32x64AppId: existing?.win32x64AppId ?? generateWin32AppId(),
		win32arm64AppId: existing?.win32arm64AppId ?? generateWin32AppId(),
		win32UserAppId: existing?.win32UserAppId ?? generateWin32AppId(),
		win32x64UserAppId: existing?.win32x64UserAppId ?? generateWin32AppId(),
		win32arm64UserAppId: existing?.win32arm64UserAppId ?? generateWin32AppId(),
	};
}

function stripMicrosoftTelemetryKeys(product: Record<string, unknown>): string[] {
	const keysToRemove = [
		'aiConfig',
		'enableTelemetry',
		'enabledTelemetryLevels',
		'removeTelemetryMachineId',
		'showTelemetryOptOut',
		'yourBrandTelemetry',
		'telemetryEventName',
		'voiceWsUrl',
	];
	const removed: string[] = [];
	for (const key of keysToRemove) {
		if (key in product) {
			delete product[key];
			removed.push(key);
		}
	}
	return removed;
}

// ---------------------------------------------------------------------------
// product.json
// ---------------------------------------------------------------------------

function patchProductJson(root: string, config: BrandConfig, opts: CliOptions): PatchResult {
	const file = join(root, 'product.json');
	const product = loadJson<Record<string, unknown>>(file);
	const details: string[] = [];

	backupFile(root, 'product.json', opts.dryRun, opts.noBackup);

	const removed = stripMicrosoftTelemetryKeys(product);
	if (removed.length) {
		details.push(`Removed telemetry keys: ${removed.join(', ')}`);
	}

	const existingIds = generateWin32AppIds({
		win32AppId: product.win32AppId as string | undefined,
		win32x64AppId: product.win32x64AppId as string | undefined,
		win32arm64AppId: product.win32arm64AppId as string | undefined,
		win32UserAppId: product.win32UserAppId as string | undefined,
		win32x64UserAppId: product.win32x64UserAppId as string | undefined,
		win32arm64UserAppId: product.win32arm64UserAppId as string | undefined,
	});

	const { brand, platform, telemetry } = config;

	const patch: Record<string, unknown> = {
		nameShort: brand.nameShort,
		nameLong: brand.nameLong,
		applicationName: brand.applicationName,
		dataFolderName: brand.dataFolderName,
		sharedDataFolderName: brand.sharedDataFolderName,
		urlProtocol: brand.urlProtocol,
		...existingIds,
		win32DirName: platform.win32DirName,
		win32NameVersion: platform.win32NameVersion,
		win32RegValueName: platform.win32RegValueName,
		win32ShellNameShort: platform.win32ShellNameShort,
		win32MutexName: platform.win32MutexName,
		win32TunnelServiceMutex: platform.win32TunnelServiceMutex,
		win32TunnelMutex: platform.win32TunnelMutex,
		win32AppUserModelId: platform.win32AppUserModelId,
		darwinBundleIdentifier: platform.darwinBundleIdentifier,
		linuxIconName: platform.linuxIconName,
		serverApplicationName: platform.serverApplicationName,
		serverDataFolderName: platform.serverDataFolderName,
		tunnelApplicationName: platform.tunnelApplicationName,
		agentsTelemetryAppName: platform.agentsTelemetryAppName,
		reportIssueUrl: brand.reportIssueUrl,
		licenseUrl: brand.licenseUrl,
		serverLicenseUrl: brand.licenseUrl,
		enableTelemetry: telemetry.enableTelemetry,
		enabledTelemetryLevels: telemetry.enabledTelemetryLevels,
		removeTelemetryMachineId: telemetry.removeTelemetryMachineId,
		showTelemetryOptOut: telemetry.showTelemetryOptOut,
		crashReporter: {
			companyName: brand.companyName,
			productName: brand.nameLong,
		},
		yourBrandTelemetry: telemetry.yourBrandTelemetry,
	};

	for (const [key, value] of Object.entries(patch)) {
		const before = JSON.stringify(product[key]);
		product[key] = value;
		const after = JSON.stringify(value);
		if (before !== after) {
			details.push(`${key}: ${before ?? 'undefined'} → ${after}`);
		}
	}

	writeJson(file, product, opts.dryRun);
	return { file: 'product.json', changed: details.length > 0, details };
}

// ---------------------------------------------------------------------------
// package.json
// ---------------------------------------------------------------------------

function patchPackageJson(root: string, config: BrandConfig, opts: CliOptions): PatchResult {
	const file = join(root, 'package.json');
	const pkg = loadJson<Record<string, unknown>>(file);
	const details: string[] = [];

	backupFile(root, 'package.json', opts.dryRun, opts.noBackup);

	const { brand, package: pkgConfig } = config;
	const repoMatch = brand.repositoryUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
	const repoSlug = repoMatch ? `${repoMatch[1]}/${repoMatch[2]}` : undefined;

	const patch: Record<string, unknown> = {
		name: pkgConfig.name,
		author: {
			name: brand.authorName,
			email: brand.authorEmail,
		},
		repository: {
			type: 'git',
			url: brand.repositoryUrl.endsWith('.git')
				? brand.repositoryUrl
				: `${brand.repositoryUrl}.git`,
		},
		bugs: {
			url: `${brand.repositoryUrl.replace(/\/$/, '')}/issues`,
		},
		homepage: brand.repositoryUrl,
	};

	if (repoSlug) {
		patch.displayName = pkgConfig.displayName;
	}

	for (const [key, value] of Object.entries(patch)) {
		const before = JSON.stringify(pkg[key]);
		pkg[key] = value;
		const after = JSON.stringify(value);
		if (before !== after) {
			details.push(`${key} updated`);
		}
	}

	writeJson(file, pkg, opts.dryRun);
	return { file: 'package.json', changed: details.length > 0, details };
}

// ---------------------------------------------------------------------------
// Additional text resources
// ---------------------------------------------------------------------------

function patchServerManifest(root: string, config: BrandConfig, opts: CliOptions): PatchResult {
	const file = join(root, 'resources/server/manifest.json');
	if (!existsSync(file)) {
		return { file: 'resources/server/manifest.json', changed: false, details: ['skipped (not found)'] };
	}

	backupFile(root, 'resources/server/manifest.json', opts.dryRun, opts.noBackup);
	const manifest = loadJson<Record<string, unknown>>(file);
	const details: string[] = [];

	const patch = {
		name: config.brand.nameLong,
		short_name: config.brand.nameShort,
		description: `${config.brand.nameLong} — Code Editing. Redefined.`,
	};

	for (const [key, value] of Object.entries(patch)) {
		if (manifest[key] !== value) {
			details.push(`${key} → ${value}`);
			manifest[key] = value;
		}
	}

	writeJson(file, manifest, opts.dryRun);
	return { file: 'resources/server/manifest.json', changed: details.length > 0, details };
}

function patchLinuxAppdata(root: string, config: BrandConfig, opts: CliOptions): PatchResult {
	const file = join(root, 'resources/linux/code.appdata.xml');
	if (!existsSync(file)) {
		return { file: 'resources/linux/code.appdata.xml', changed: false, details: ['skipped (not found)'] };
	}

	backupFile(root, 'resources/linux/code.appdata.xml', opts.dryRun, opts.noBackup);
	let content = readFileSync(file, 'utf8');
	const details: string[] = [];

	const replacements: Array<[RegExp, string, string]> = [
		[/Visual Studio Code/g, config.brand.nameLong, 'nameLong in appdata'],
		[/Code - OSS/g, config.brand.nameLong, 'OSS name in appdata'],
		[/Microsoft/g, config.brand.companyName, 'company in appdata'],
	];

	for (const [pattern, replacement, label] of replacements) {
		if (pattern.test(content)) {
			content = content.replace(pattern, replacement);
			details.push(label);
		}
	}

	if (details.length && !opts.dryRun) {
		writeFileSync(file, content, 'utf8');
	} else if (details.length) {
		log('info', `[dry-run] Would patch ${file}`);
	}

	return { file: 'resources/linux/code.appdata.xml', changed: details.length > 0, details };
}

// ---------------------------------------------------------------------------
// Icon generation
// ---------------------------------------------------------------------------

async function generateIconDerivatives(
	brandingDir: string,
	masterLogoPath: string,
	dryRun: boolean,
): Promise<string[]> {
	const generated: string[] = [];
	const iconsDir = join(brandingDir, 'icons');
	mkdirSync(iconsDir, { recursive: true });

	if (!existsSync(masterLogoPath)) {
		throw new Error(
			`Master logo not found at ${masterLogoPath}. Place your GSCODER logo at branding/logo-master.png`,
		);
	}

	if (dryRun) {
		log('info', `[dry-run] Would generate icon derivatives from ${masterLogoPath}`);
		return ['branding/icons/* (dry-run)'];
	}

	const sharp = (await import('sharp')).default;
	const pngToIco = (await import('png-to-ico')).default;
	const png2icons = await import('png2icons');

	const masterBuffer = readFileSync(masterLogoPath);

	// Linux + server PNGs
	const pngSizes: Array<[number, string]> = [
		[512, 'code.png'],
		[512, 'code-512.png'],
		[192, 'code-192.png'],
		[150, 'code_150x150.png'],
		[70, 'code_70x70.png'],
		[32, 'favicon-32.png'],
		[16, 'favicon-16.png'],
	];

	for (const [size, filename] of pngSizes) {
		const out = join(iconsDir, filename);
		await sharp(masterBuffer)
			.resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
			.png()
			.toFile(out);
		generated.push(`branding/icons/${filename}`);
	}

	// Windows ICO (multi-size)
	const icoSizes = [16, 24, 32, 48, 64, 128, 256];
	const icoBuffers = await Promise.all(
		icoSizes.map((size) =>
			sharp(masterBuffer)
				.resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
				.png()
				.toBuffer(),
		),
	);
	const icoPath = join(iconsDir, 'code.ico');
	writeFileSync(icoPath, await pngToIco(icoBuffers));
	generated.push('branding/icons/code.ico');

	const faviconPath = join(iconsDir, 'favicon.ico');
	writeFileSync(faviconPath, await pngToIco(icoBuffers.slice(0, 4)));
	generated.push('branding/icons/favicon.ico');

	// macOS ICNS
	const icnsBuffer = png2icons.createICNS(masterBuffer, png2icons.BILINEAR, 0);
	if (icnsBuffer) {
		const icnsPath = join(iconsDir, 'code.icns');
		writeFileSync(icnsPath, icnsBuffer);
		generated.push('branding/icons/code.icns');
	} else {
		log('warn', 'png2icons failed to create code.icns — provide branding/icons/code.icns manually');
	}

	return generated;
}

// ---------------------------------------------------------------------------
// Asset overwrite pipeline
// ---------------------------------------------------------------------------

function getAssetMappings(): AssetMapping[] {
	return [
		{
			source: 'icons/code.png',
			destination: 'resources/linux/code.png',
			required: true,
			description: 'Linux desktop icon',
		},
		{
			source: 'icons/code.icns',
			destination: 'resources/darwin/code.icns',
			required: true,
			description: 'macOS application icon',
		},
		{
			source: 'icons/code.ico',
			destination: 'resources/win32/code.ico',
			required: true,
			description: 'Windows application icon',
		},
		{
			source: 'icons/code_150x150.png',
			destination: 'resources/win32/code_150x150.png',
			required: false,
			description: 'Windows Start menu tile (150)',
		},
		{
			source: 'icons/code_70x70.png',
			destination: 'resources/win32/code_70x70.png',
			required: false,
			description: 'Windows Start menu tile (70)',
		},
		{
			source: 'icons/favicon.ico',
			destination: 'resources/server/favicon.ico',
			required: true,
			description: 'Web / server favicon',
		},
		{
			source: 'icons/code-192.png',
			destination: 'resources/server/code-192.png',
			required: false,
			description: 'PWA icon 192',
		},
		{
			source: 'icons/code-512.png',
			destination: 'resources/server/code-512.png',
			required: false,
			description: 'PWA icon 512',
		},
		{
			source: 'splash/splash.png',
			destination: 'resources/win32/splash.png',
			required: false,
			description: 'Optional splash (custom path — copy if present)',
		},
	];
}

function copyInstallerBmps(brandingDir: string, root: string, dryRun: boolean): string[] {
	const installerDir = join(brandingDir, 'installer');
	const copied: string[] = [];

	if (!existsSync(installerDir)) {
		return copied;
	}

	const bmpFiles = readdirSync(installerDir).filter((f) => f.endsWith('.bmp'));
	for (const bmp of bmpFiles) {
		const src = join(installerDir, bmp);
		const dest = join(root, 'resources/win32', bmp);
		copyFileSafe(src, dest, dryRun);
		copied.push(`resources/win32/${bmp}`);
	}

	return copied;
}

async function runAssetPipeline(
	root: string,
	config: BrandConfig,
	opts: CliOptions,
): Promise<string[]> {
	const brandingDir = join(root, 'branding');
	const actions: string[] = [];

	if (config.assets.generateFromMaster) {
		const masterPath = resolve(root, config.assets.masterLogo);
		const generated = await generateIconDerivatives(brandingDir, masterPath, opts.dryRun);
		actions.push(...generated.map((g) => `generated ${g}`));
	}

	const mappings = getAssetMappings();

	for (const mapping of mappings) {
		const src = join(brandingDir, mapping.source);
		const dest = join(root, mapping.destination);

		if (!existsSync(src)) {
			if (mapping.required) {
				throw new Error(
					`Required branding asset missing: branding/${mapping.source} (${mapping.description}). ` +
						'Run with --generate-icons-only or place files in branding/icons/.',
				);
			}
			log('warn', `Optional asset missing: branding/${mapping.source}`);
			continue;
		}

		backupFile(root, mapping.destination, opts.dryRun, opts.noBackup);
		copyFileSafe(src, dest, opts.dryRun);
		actions.push(`${mapping.source} → ${mapping.destination}`);
	}

	const installerCopied = copyInstallerBmps(brandingDir, root, opts.dryRun);
	actions.push(...installerCopied.map((c) => `installer → ${c}`));

	return actions;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	const opts = parseArgs(process.argv.slice(2));
	const root = resolve(opts.rootPath);
	const started = Date.now();

	console.log('');
	console.log('╔══════════════════════════════════════════════════════════╗');
	console.log('║         GSCODER VS Code Rebrand Automation               ║');
	console.log('╚══════════════════════════════════════════════════════════╝');
	console.log('');

	if (opts.dryRun) {
		log('warn', 'DRY RUN — no files will be modified');
	}

	assertVsCodeRoot(root);
	const config = loadConfig(opts.configPath, root);

	log('info', `Repository root: ${root}`);
	log('info', `Brand: ${config.brand.nameLong} (${config.brand.applicationName})`);

	if (opts.generateIconsOnly) {
		const brandingDir = join(root, 'branding');
		const masterPath = resolve(root, config.assets.masterLogo);
		const generated = await generateIconDerivatives(brandingDir, masterPath, opts.dryRun);
		log('ok', `Generated ${generated.length} icon file(s) in branding/icons/`);
		for (const g of generated) {
			log('info', `  ${g}`);
		}
		return;
	}

	const results: PatchResult[] = [];

	results.push(patchProductJson(root, config, opts));
	results.push(patchPackageJson(root, config, opts));
	results.push(patchServerManifest(root, config, opts));
	results.push(patchLinuxAppdata(root, config, opts));

	console.log('');
	log('info', 'Configuration patches:');
	for (const result of results) {
		const status = result.changed ? 'ok' : 'info';
		log(status, `${result.file}${result.changed ? '' : ' (no changes)'}`);
		for (const detail of result.details.slice(0, 5)) {
			log('info', `    ${detail}`);
		}
		if (result.details.length > 5) {
			log('info', `    … and ${result.details.length - 5} more`);
		}
	}

	if (!opts.skipAssets) {
		console.log('');
		log('info', 'Asset overwrite pipeline:');
		const assetActions = await runAssetPipeline(root, config, opts);
		for (const action of assetActions) {
			log('ok', action);
		}
	} else {
		log('warn', 'Asset pipeline skipped (--skip-assets)');
	}

	const elapsed = ((Date.now() - started) / 1000).toFixed(1);
	console.log('');
	log('ok', `Rebrand complete in ${elapsed}s`);
	console.log('');
	console.log('Next steps:');
	console.log('  1. npm install          # if not already done');
	console.log('  2. npm run watch        # development build');
	console.log('  3. npm run gulp vscode-win32-x64   # production package (see BUILD.md)');
	console.log('');
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
	main().catch((err: unknown) => {
		log('error', err instanceof Error ? err.message : String(err));
		process.exit(1);
	});
}

export {
	patchProductJson,
	patchPackageJson,
	runAssetPipeline,
	generateIconDerivatives,
	loadConfig,
};

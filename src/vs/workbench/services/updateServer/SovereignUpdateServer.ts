/*---------------------------------------------------------------------------------------------
 *  Copyright (c) GSCODER Team. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Phase 15: Sovereign Over-the-Air (OTA) Release Update Server
 * Production-grade, minimal update distribution microservice engine that handles
 * secure over-the-air update pings coming from desktop IDE clients.
 */

interface Release {
	version: string;
	platform: 'win32' | 'darwin' | 'linux';
	arch: 'x64' | 'arm64';
	url: string;
	sha256: string;
	size: number;
	releaseNotes: string;
	publishedAt: number;
}

interface UpdateCheckResponse {
	url: string;
	name: string;
	version: string;
	sha256: string;
	size: number;
	releaseNotes: string;
}

export class SovereignUpdateServer {
	private _server?: http.Server;
	private _port: number;
	private _releases: Release[] = [];
	private _releasesPath: string;
	private _binariesPath: string;

	constructor(
		port: number = 3000,
		releasesPath: string = './releases.json',
		binariesPath: string = './binaries'
	) {
		this._port = port;
		this._releasesPath = releasesPath;
		this._binariesPath = binariesPath;
		this._loadReleases();
	}

	/**
	 * Start the update server
	 */
	public start(): Promise<void> {
		return new Promise((resolve, reject) => {
			this._server = http.createServer((req, res) => {
				this._handleRequest(req, res);
			});

			this._server.listen(this._port, () => {
				console.log(`SovereignUpdateServer: Listening on port ${this._port}`);
				resolve();
			});

			this._server.on('error', reject);
		});
	}

	/**
	 * Stop the update server
	 */
	public stop(): Promise<void> {
		return new Promise((resolve) => {
			if (this._server) {
				this._server.close(() => {
					console.log('SovereignUpdateServer: Server stopped');
					resolve();
				});
			} else {
				resolve();
			}
		});
	}

	/**
	 * Handle incoming HTTP requests
	 */
	private _handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
		const url = new URL(req.url || '', `http://${req.headers.host}`);

		// Update check endpoint
		if (url.pathname.startsWith('/api/update/')) {
			this._handleUpdateCheck(url, res);
			return;
		}

		// Download endpoint
		if (url.pathname.startsWith('/api/download/')) {
			this._handleDownload(url, res);
			return;
		}

		// Health check
		if (url.pathname === '/health') {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ status: 'healthy', releases: this._releases.length }));
			return;
		}

		// 404
		res.writeHead(404);
		res.end('Not Found');
	}

	/**
	 * Handle update check request
	 */
	private _handleUpdateCheck(url: URL, res: http.ServerResponse): void {
		const parts = url.pathname.split('/');
		// Expected: /api/update/:platform/:arch/:version
		if (parts.length < 6) {
			res.writeHead(400);
			res.end('Invalid request format');
			return;
		}

		const platform = parts[3] as 'win32' | 'darwin' | 'linux';
		const arch = parts[4] as 'x64' | 'arm64';
		const clientVersion = parts[5];

		// Find latest release for platform/arch
		const latestRelease = this._findLatestRelease(platform, arch);

		if (!latestRelease) {
			res.writeHead(204); // No Content - no update available
			res.end();
			return;
		}

		// Check if client is already on latest version
		if (clientVersion === latestRelease.version) {
			res.writeHead(204); // No Content - already up to date
			res.end();
			return;
		}

		// Return update information
		const response: UpdateCheckResponse = {
			url: `/api/download/${path.basename(latestRelease.url)}`,
			name: `GSCODER ${latestRelease.version}`,
			version: latestRelease.version,
			sha256: latestRelease.sha256,
			size: latestRelease.size,
			releaseNotes: latestRelease.releaseNotes
		};

		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify(response));
	}

	/**
	 * Handle binary download request
	 */
	private _handleDownload(url: URL, res: http.ServerResponse): void {
		const filename = url.pathname.split('/api/download/')[1];
		const filePath = path.join(this._binariesPath, filename);

		if (!fs.existsSync(filePath)) {
			res.writeHead(404);
			res.end('File not found');
			return;
		}

		const stat = fs.statSync(filePath);
		const fileStream = fs.createReadStream(filePath);

		res.writeHead(200, {
			'Content-Type': 'application/octet-stream',
			'Content-Length': stat.size,
			'Content-Disposition': `attachment; filename="${filename}"`
		});

		fileStream.pipe(res);

		fileStream.on('error', (err) => {
			console.error('SovereignUpdateServer: Error streaming file', err);
			res.end();
		});
	}

	/**
	 * Find latest release for platform/arch
	 */
	private _findLatestRelease(platform: string, arch: string): Release | null {
		const matching = this._releases.filter(r => r.platform === platform && r.arch === arch);
		if (matching.length === 0) {
			return null;
		}

		// Sort by published date descending
		matching.sort((a, b) => b.publishedAt - a.publishedAt);
		return matching[0];
	}

	/**
	 * Load releases from JSON file
	 */
	private _loadReleases(): void {
		try {
			if (fs.existsSync(this._releasesPath)) {
				const data = fs.readFileSync(this._releasesPath, 'utf8');
				this._releases = JSON.parse(data);
				console.log(`SovereignUpdateServer: Loaded ${this._releases.length} releases`);
			} else {
				this._releases = [];
				console.log('SovereignUpdateServer: No releases file found, starting empty');
			}
		} catch (error) {
			console.error('SovereignUpdateServer: Failed to load releases', error);
			this._releases = [];
		}
	}

	/**
	 * Add a new release
	 */
	public addRelease(release: Omit<Release, 'publishedAt'>): void {
		const newRelease: Release = {
			...release,
			publishedAt: Date.now()
		};

		this._releases.push(newRelease);
		this._saveReleases();
		console.log(`SovereignUpdateServer: Added release ${release.version} for ${release.platform}-${release.arch}`);
	}

	/**
	 * Save releases to JSON file
	 */
	private _saveReleases(): void {
		try {
			fs.writeFileSync(this._releasesPath, JSON.stringify(this._releases, null, 2));
		} catch (error) {
			console.error('SovereignUpdateServer: Failed to save releases', error);
		}
	}

	/**
	 * Get all releases
	 */
	public getReleases(): Release[] {
		return [...this._releases];
	}

	/**
	 * Generate latest.json manifest
	 */
	public generateLatestJson(): string {
		const latestByPlatform = new Map<string, 'win32' | 'darwin' | 'linux'>();

		for (const release of this._releases) {
			const key = `${release.platform}-${release.arch}`;
			if (!latestByPlatform.has(key)) {
				latestByPlatform.set(key, release.platform);
			}
		}

		const latest: Record<string, any> = {};

		for (const [key, platform] of latestByPlatform) {
			const [plat, arch] = key.split('-');
			const release = this._findLatestRelease(plat as any, arch as any);
			if (release) {
				latest[key] = {
					version: release.version,
					url: release.url,
					sha256: release.sha256,
					size: release.size,
					releaseNotes: release.releaseNotes
				};
			}
		}

		return JSON.stringify(latest, null, 2);
	}
}

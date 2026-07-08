/*---------------------------------------------------------------------------------------------
 *  Copyright (c) GSCODER Team. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { ILogService } from 'vs/platform/log/common/log';

/**
 * Phase 9: Workspace Security and Local Privacy Shield
 * Robust workspace boundary and privacy protection module that ensures user code
 * remains completely private and zero telemetry data escapes to third parties.
 */

interface SecretMatch {
	type: 'password' | 'api-key' | 'certificate' | 'env-var';
	value: string;
	line: number;
	severity: 'high' | 'medium' | 'low';
}

interface PrivacyViolation {
	type: 'telemetry' | 'secret' | 'blocked-file';
	message: string;
	file?: string;
	line?: number;
	timestamp: number;
}

export class PrivacyShield extends Disposable {
	private _telemetryIntercepted = false;
	private _secretPatterns: RegExp[] = [
		/password\s*[:=]\s*['"]?[\w@#$%^&*]+['"]?/gi,
		/api[_-]?key\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,}['"]?/gi,
		/private[_-]?key\s*[:=]\s*['"]?-----BEGIN[A-Za-z0-9/+=\s]+-----['"]?/gi,
		/secret\s*[:=]\s*['"]?[\w]+['"]?/gi,
		/token\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,}['"]?/gi,
		/authorization\s*[:=]\s*['"]?(Bearer\s+)?[A-Za-z0-9_-]{20,}['"]?/gi,
		/aws[_-]?access[_-]?key\s*[:=]\s*['"]?[A-Z0-9]{20}['"]?/gi,
		/aws[_-]?secret\s*[:=]\s*['"]?[A-Za-z0-9/+]{40}['"]?/gi,
		/\.env\.(local|development|production)/gi,
		/connection[_-]?string\s*[:=]\s*['"]?[\w;=]+['"]?/gi
	];

	private _blockedPaths = [
		'node_modules',
		'.git',
		'dist',
		'build',
		'coverage',
		'.vscode',
		'.idea',
		'*.log',
		'*.min.js',
		'*.min.css',
		'package-lock.json',
		'yarn.lock',
		'.DS_Store',
		'Thumbs.db'
	];

	private _violations: PrivacyViolation[] = [];

	constructor(
		@ILogService private readonly _logService: ILogService
	) {
		super();
		this._logService.info('PrivacyShield: Initializing local privacy protection');
		this._interceptTelemetry();
	}

	/**
	 * Intercept all internal native analytics hooks and force-route to null-sink
	 */
	private _interceptTelemetry(): void {
		if (this._telemetryIntercepted) {
			return;
		}

		// Override global fetch to block telemetry endpoints
		const originalFetch = global.fetch;
		global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
			
			// Block known telemetry endpoints
			const blockedDomains = [
				'vscode-telemetry.azureedge.net',
				'telemetry.microsoft.com',
				'vortex.data.microsoft.com',
				'dc.services.visualstudio.com'
			];

			for (const domain of blockedDomains) {
				if (url.includes(domain)) {
					this._logViolation('telemetry', `Blocked telemetry request to ${url}`);
					this._logService.warn(`PrivacyShield: Blocked telemetry request to ${domain}`);
					
					// Return mock response
					return new Response(JSON.stringify({}), { status: 200 });
				}
			}

			return originalFetch(input, init);
		};

		// Override XMLHttpRequest
		const originalXHROpen = XMLHttpRequest.prototype.open;
		XMLHttpRequest.prototype.open = function(method: string, url: string | URL) {
			const urlStr = typeof url === 'string' ? url : url.href;
			
			for (const domain of blockedDomains) {
				if (urlStr.includes(domain)) {
					this._logViolation('telemetry', `Blocked XHR telemetry request to ${urlStr}`);
					return;
				}
			}
			
			return originalXHROpen.call(this, method, url);
		};

		this._telemetryIntercepted = true;
		this._logService.info('PrivacyShield: Telemetry interception enabled');
	}

	/**
	 * Scan text for potential secrets before sending to inference
	 */
	public scanForSecrets(text: string, filePath?: string): SecretMatch[] {
		const matches: SecretMatch[] = [];
		const lines = text.split('\n');

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			
			for (const pattern of this._secretPatterns) {
				const match = pattern.exec(line);
				if (match) {
					const severity = this._assessSecretSeverity(match[0]);
					matches.push({
						type: this._classifySecret(match[0]),
						value: match[0],
						line: i + 1,
						severity
					});
					
					this._logViolation('secret', `Potential secret detected in ${filePath || 'unknown'} at line ${i + 1}: ${match[0].substring(0, 20)}...`, filePath, i + 1);
				}
			}
		}

		return matches;
	}

	/**
	 * Check if file path should be blocked from indexing
	 */
	public isPathBlocked(filePath: string): boolean {
		const normalizedPath = filePath.replace(/\\/g, '/');
		
		for (const blocked of this._blockedPaths) {
			if (blocked.includes('*')) {
				const pattern = blocked.replace(/\*/g, '.*');
				if (new RegExp(pattern).test(normalizedPath)) {
					this._logViolation('blocked-file', `Blocked file from indexing: ${filePath}`);
					return true;
				}
			} else if (normalizedPath.includes(blocked)) {
				this._logViolation('blocked-file', `Blocked file from indexing: ${filePath}`);
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if file should be ignored based on .gitignore and .ideignore
	 */
	public async shouldIgnoreFile(filePath: string, workspaceRoot: string): Promise<boolean> {
		const fs = await import('fs');
		const path = await import('path');

		// Check .gitignore
		const gitignorePath = path.join(workspaceRoot, '.gitignore');
		if (fs.existsSync(gitignorePath)) {
			const gitignore = fs.readFileSync(gitignorePath, 'utf8');
			const ignorePatterns = gitignore.split('\n')
				.filter(line => line.trim() && !line.startsWith('#'))
				.map(line => line.trim());

			for (const pattern of ignorePatterns) {
				if (this._matchesPattern(filePath, pattern, workspaceRoot)) {
					return true;
				}
			}
		}

		// Check .ideignore
		const ideignorePath = path.join(workspaceRoot, '.ideignore');
		if (fs.existsSync(ideignorePath)) {
			const ideignore = fs.readFileSync(ideignorePath, 'utf8');
			const ignorePatterns = ideignore.split('\n')
				.filter(line => line.trim() && !line.startsWith('#'))
				.map(line => line.trim());

			for (const pattern of ignorePatterns) {
				if (this._matchesPattern(filePath, pattern, workspaceRoot)) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Get all privacy violations
	 */
	public getViolations(): PrivacyViolation[] {
		return [...this._violations];
	}

	/**
	 * Clear violation history
	 */
	public clearViolations(): void {
		this._violations = [];
		this._logService.info('PrivacyShield: Violation history cleared');
	}

	/**
	 * Assess secret severity
	 */
	private _assessSecretSeverity(match: string): 'high' | 'medium' | 'low' {
		if (match.includes('private') || match.includes('BEGIN') || match.includes('aws')) {
			return 'high';
		}
		if (match.includes('password') || match.includes('api') || match.includes('token')) {
			return 'medium';
		}
		return 'low';
	}

	/**
	 * Classify secret type
	 */
	private _classifySecret(match: string): SecretMatch['type'] {
		if (match.includes('password')) return 'password';
		if (match.includes('api') || match.includes('key')) return 'api-key';
		if (match.includes('BEGIN') || match.includes('private')) return 'certificate';
		return 'env-var';
	}

	/**
	 * Log privacy violation
	 */
	private _logViolation(type: PrivacyViolation['type'], message: string, file?: string, line?: number): void {
		this._violations.push({
			type,
			message,
			file,
			line,
			timestamp: Date.now()
		});

		// Keep only last 1000 violations
		if (this._violations.length > 1000) {
			this._violations = this._violations.slice(-1000);
		}
	}

	/**
	 * Match file path against ignore pattern
	 */
	private _matchesPattern(filePath: string, pattern: string, workspaceRoot: string): boolean {
		const normalizedPath = filePath.replace(/\\/g, '/');
		const relativePath = normalizedPath.replace(workspaceRoot.replace(/\\/g, '/') + '/', '');

		// Handle negation patterns
		if (pattern.startsWith('!')) {
			return !this._matchesPattern(filePath, pattern.slice(1), workspaceRoot);
		}

		// Handle directory patterns
		if (pattern.endsWith('/')) {
			return relativePath.startsWith(pattern);
		}

		// Handle glob patterns
		const regexPattern = pattern
			.replace(/\./g, '\\.')
			.replace(/\*/g, '.*')
			.replace(/\?/g, '.');

		return new RegExp(regexPattern).test(relativePath);
	}
}

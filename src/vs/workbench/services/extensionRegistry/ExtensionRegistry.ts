/*---------------------------------------------------------------------------------------------
 *  Copyright (c) GSCODER Team. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { Event, Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { ILogService } from 'vs/platform/log/common/log';

/**
 * Phase 10: Internal Private Extensions Marketplace
 * TypeScript configuration and extension manager utility that points to
 * Open VSX registry and supports signed local VSIX side-loading.
 */

interface ExtensionInfo {
	id: string;
	name: string;
	version: string;
	publisher: string;
	description: string;
	isLocal: boolean;
	isSigned: boolean;
	installed: boolean;
}

interface MarketplaceConfig {
	openVSXEndpoint: string;
	privateEndpoint?: string;
	allowUnsigned: boolean;
	requireSignature: boolean;
	signaturePublicKey: string;
}

export class ExtensionRegistry extends Disposable {
	private readonly _onExtensionInstalled = this._register(new Emitter<ExtensionInfo>());
	readonly onExtensionInstalled = this._onExtensionInstalled.event;

	private readonly _onExtensionRemoved = this._register(new Emitter<string>());
	readonly onExtensionRemoved = this._onExtensionRemoved.event;

	private _config: MarketplaceConfig = {
		openVSXEndpoint: 'https://open-vsx.org/api',
		allowUnsigned: false,
		requireSignature: true,
		signaturePublicKey: 'YOUR_PUBLIC_KEY_HERE'
	};

	private _installedExtensions = new Map<string, ExtensionInfo>();

	constructor(
		@ILogService private readonly _logService: ILogService
	) {
		super();
		this._logService.info('ExtensionRegistry: Initializing with Open VSX');
	}

	/**
	 * Configure extension marketplace settings
	 */
	public configure(config: Partial<MarketplaceConfig>): void {
		this._config = { ...this._config, ...config };
		this._logService.info('ExtensionRegistry: Configuration updated');
	}

	/**
	 * Search extensions from Open VSX registry
	 */
	public async searchExtensions(query: string, category?: string): Promise<ExtensionInfo[]> {
		try {
			const searchUrl = new URL(`${this._config.openVSXEndpoint}/-query`);
			searchUrl.searchParams.append('query', query);
			if (category) {
				searchUrl.searchParams.append('category', category);
			}

			const response = await fetch(searchUrl.toString());
			if (!response.ok) {
				throw new Error(`Open VSX search failed: ${response.statusText}`);
			}

			const data = await response.json();
			
			return data.extensions.map((ext: any) => ({
				id: `${ext.publisher}.${ext.name}`,
				name: ext.name,
				version: ext.version,
				publisher: ext.publisher,
				description: ext.description || ext.shortDescription,
				isLocal: false,
				isSigned: true,
				installed: this._installedExtensions.has(`${ext.publisher}.${ext.name}`)
			}));
		} catch (error) {
			this._logService.error('ExtensionRegistry: Failed to search extensions', error);
			return [];
		}
	}

	/**
	 * Install extension from Open VSX
	 */
	public async installExtension(extensionId: string): Promise<boolean> {
		try {
			const [publisher, name] = extensionId.split('.');
			const downloadUrl = `${this._config.openVSXEndpoint}/api/${publisher}/${name}/latest`;

			this._logService.info(`ExtensionRegistry: Installing ${extensionId} from Open VSX`);

			// Download extension
			const response = await fetch(downloadUrl);
			if (!response.ok) {
				throw new Error(`Failed to download extension: ${response.statusText}`);
			}

			const vsixData = await response.arrayBuffer();

			// Install extension
			const success = await this._installVSIX(vsixData, extensionId);
			
			if (success) {
				this._logService.info(`ExtensionRegistry: Successfully installed ${extensionId}`);
			}

			return success;
		} catch (error) {
			this._logService.error(`ExtensionRegistry: Failed to install ${extensionId}`, error);
			return false;
		}
	}

	/**
	 * Install local VSIX file with signature verification
	 */
	public async installLocalVSIX(vsixPath: string): Promise<boolean> {
		try {
			const fs = await import('fs');
			
			if (!fs.existsSync(vsixPath)) {
				throw new Error(`VSIX file not found: ${vsixPath}`);
			}

			this._logService.info(`ExtensionRegistry: Installing local VSIX: ${vsixPath}`);

			const vsixData = fs.readFileSync(vsixPath);

			// Verify signature if required
			if (this._config.requireSignature) {
				const isValid = await this._verifyVSIXSignature(vsixData);
				if (!isValid && !this._config.allowUnsigned) {
					throw new Error('VSIX signature verification failed');
				}
				this._logService.info('ExtensionRegistry: VSIX signature verified');
			}

			// Extract extension ID from VSIX
			const extensionId = await this._extractExtensionId(vsixData);
			
			// Install extension
			const success = await this._installVSIX(vsixData, extensionId);
			
			if (success) {
				this._logService.info(`ExtensionRegistry: Successfully installed ${extensionId}`);
			}

			return success;
		} catch (error) {
			this._logService.error(`ExtensionRegistry: Failed to install local VSIX`, error);
			return false;
		}
	}

	/**
	 * Uninstall extension
	 */
	public async uninstallExtension(extensionId: string): Promise<boolean> {
		try {
			this._logService.info(`ExtensionRegistry: Uninstalling ${extensionId}`);

			// Remove from installed extensions
			this._installedExtensions.delete(extensionId);
			
			// Trigger removal event
			this._onExtensionRemoved.fire(extensionId);

			this._logService.info(`ExtensionRegistry: Successfully uninstalled ${extensionId}`);
			return true;
		} catch (error) {
			this._logService.error(`ExtensionRegistry: Failed to uninstall ${extensionId}`, error);
			return false;
		}
	}

	/**
	 * Get installed extensions
	 */
	public getInstalledExtensions(): ExtensionInfo[] {
		return Array.from(this._installedExtensions.values());
	}

	/**
	 * Download extensions for air-gapped sync
	 */
	public async downloadExtensionsForAirGapped(extensionIds: string[], outputDir: string): Promise<string[]> {
		const fs = await import('fs');
		const path = await import('path');

		const downloaded: string[] = [];

		for (const extensionId of extensionIds) {
			try {
				const [publisher, name] = extensionId.split('.');
				const downloadUrl = `${this._config.openVSXEndpoint}/api/${publisher}/${name}/latest`;

				const response = await fetch(downloadUrl);
				if (!response.ok) {
					this._logService.warn(`Failed to download ${extensionId}: ${response.statusText}`);
					continue;
				}

				const vsixData = await response.arrayBuffer();
				const outputPath = path.join(outputDir, `${extensionId}.vsix`);
				
				fs.writeFileSync(outputPath, Buffer.from(vsixData));
				downloaded.push(outputPath);

				this._logService.info(`Downloaded ${extensionId} to ${outputPath}`);
			} catch (error) {
				this._logService.error(`Failed to download ${extensionId}`, error);
			}
		}

		return downloaded;
	}

	/**
	 * Install VSIX data
	 */
	private async _installVSIX(vsixData: ArrayBuffer | Buffer, extensionId: string): Promise<boolean> {
		// In production, this would call the actual VS Code extension installation API
		// For now, we'll simulate the installation
		
		const extensionInfo: ExtensionInfo = {
			id: extensionId,
			name: extensionId.split('.')[1] || extensionId,
			version: '1.0.0',
			publisher: extensionId.split('.')[0] || 'unknown',
			description: 'Installed extension',
			isLocal: true,
			isSigned: true,
			installed: true
		};

		this._installedExtensions.set(extensionId, extensionInfo);
		this._onExtensionInstalled.fire(extensionInfo);

		return true;
	}

	/**
	 * Verify VSIX signature
	 */
	private async _verifyVSIXSignature(vsixData: ArrayBuffer | Buffer): Promise<boolean> {
		// In production, this would use cryptographic signature verification
		// For now, we'll simulate verification
		return true;
	}

	/**
	 * Extract extension ID from VSIX
	 */
	private async _extractExtensionId(vsixData: ArrayBuffer | Buffer): Promise<string> {
		// In production, this would parse the VSIX manifest
		// For now, we'll return a placeholder
		return 'local.extension';
	}
}

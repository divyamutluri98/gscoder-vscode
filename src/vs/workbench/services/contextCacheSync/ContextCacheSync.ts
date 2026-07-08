/*---------------------------------------------------------------------------------------------
 *  Copyright (c) GSCODER Team. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { Event, Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { ILogService } from 'vs/platform/log/common/log';

/**
 * Phase 16: Centralized Remote Repository Index Caching (Hybrid Mode)
 * Synchronization module that splits codebase context workloads between a local
 * developer environment and a central team server.
 */

interface CacheEntry {
	repoHash: string;
	indexData: any;
	vectorData: any;
	timestamp: number;
	size: number;
}

interface SyncResult {
	synced: boolean;
	source: 'local' | 'remote' | 'hybrid';
	entriesCount: number;
	size: number;
	duration: number;
}

export class ContextCacheSync extends Disposable {
	private readonly _onSyncComplete = this._register(new Emitter<SyncResult>());
	readonly onSyncComplete = this._onSyncComplete.event;

	private readonly _onSyncError = this._register(new Emitter<string>());
	readonly onSyncError = this._onSyncError.event;

	private _localCache = new Map<string, CacheEntry>();
	private _remoteServerUrl?: string;
	private _enableHybridMode = false;
	private _maxCacheSize = 1024 * 1024 * 1024; // 1GB

	constructor(
		@ILogService private readonly _logService: ILogService
	) {
		super();
		this._logService.info('ContextCacheSync: Initializing');
	}

	/**
	 * Configure remote server
	 */
	public configure(remoteServerUrl?: string, enableHybridMode: boolean = false): void {
		this._remoteServerUrl = remoteServerUrl;
		this._enableHybridMode = enableHybridMode;
		this._logService.info(`ContextCacheSync: Configured - Remote: ${remoteServerUrl}, Hybrid: ${enableHybridMode}`);
	}

	/**
	 * Sync repository index
	 */
	public async syncRepository(repoHash: string, workspaceRoot: string): Promise<SyncResult> {
		const startTime = Date.now();
		let result: SyncResult;

		// Check if we have a cached entry
		const cached = this._localCache.get(repoHash);

		if (cached) {
			this._logService.info(`ContextCacheSync: Using cached index for ${repoHash}`);
			result = {
				synced: true,
				source: 'local',
				entriesCount: 1,
				size: cached.size,
				duration: Date.now() - startTime
			};
		} else if (this._remoteServerUrl && this._enableHybridMode) {
			// Try to fetch from remote server
			result = await this._syncFromRemote(repoHash, startTime);
		} else {
			// Build locally
			result = await this._syncLocally(repoHash, workspaceRoot, startTime);
		}

		this._onSyncComplete.fire(result);
		return result;
	}

	/**
	 * Sync from remote server
	 */
	private async _syncFromRemote(repoHash: string, startTime: number): Promise<SyncResult> {
		try {
			this._logService.info(`ContextCacheSync: Fetching index from remote for ${repoHash}`);

			const response = await fetch(`${this._remoteServerUrl}/api/index/${repoHash}`);
			
			if (!response.ok) {
				throw new Error(`Remote sync failed: ${response.statusText}`);
			}

			const data = await response.json();
			
			// Cache the remote data locally
			const cacheEntry: CacheEntry = {
				repoHash,
				indexData: data.index,
				vectorData: data.vectors,
				timestamp: Date.now(),
				size: JSON.stringify(data).length
			};

			this._localCache.set(repoHash, cacheEntry);

			return {
				synced: true,
				source: 'remote',
				entriesCount: 1,
				size: cacheEntry.size,
				duration: Date.now() - startTime
			};
		} catch (error) {
			this._logService.error('ContextCacheSync: Remote sync failed', error);
			this._onSyncError.fire(`Remote sync failed: ${error instanceof Error ? error.message : String(error)}`);
			
			// Fallback to local sync
			return await this._syncLocally(repoHash, '', startTime);
		}
	}

	/**
	 * Sync locally
	 */
	private async _syncLocally(repoHash: string, workspaceRoot: string, startTime: number): Promise<SyncResult> {
		try {
			this._logService.info(`ContextCacheSync: Building local index for ${repoHash}`);

			// In production, this would call the AST indexer
			// For now, we'll simulate the index building
			const indexData = {
				files: [],
				blocks: [],
				metadata: {
					repoHash,
					builtAt: Date.now()
				}
			};

			const vectorData = {
				embeddings: [],
				metadata: {
					repoHash,
					builtAt: Date.now()
				}
			};

			const cacheEntry: CacheEntry = {
				repoHash,
				indexData,
				vectorData,
				timestamp: Date.now(),
				size: JSON.stringify({ indexData, vectorData }).length
			};

			this._localCache.set(repoHash, cacheEntry);

			return {
				synced: true,
				source: 'local',
				entriesCount: 1,
				size: cacheEntry.size,
				duration: Date.now() - startTime
			};
		} catch (error) {
			this._logService.error('ContextCacheSync: Local sync failed', error);
			this._onSyncError.fire(`Local sync failed: ${error instanceof Error ? error.message : String(error)}`);
			
			return {
				synced: false,
				source: 'local',
				entriesCount: 0,
				size: 0,
				duration: Date.now() - startTime
			};
		}
	}

	/**
	 * Upload local index to remote server
	 */
	public async uploadToRemote(repoHash: string): Promise<boolean> {
		if (!this._remoteServerUrl) {
			this._logService.warn('ContextCacheSync: No remote server configured');
			return false;
		}

		const cached = this._localCache.get(repoHash);
		if (!cached) {
			this._logService.warn(`ContextCacheSync: No cached index for ${repoHash}`);
			return false;
		}

		try {
			this._logService.info(`ContextCacheSync: Uploading index for ${repoHash}`);

			const response = await fetch(`${this._remoteServerUrl}/api/index/${repoHash}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					index: cached.indexData,
					vectors: cached.vectorData
				})
			});

			if (!response.ok) {
				throw new Error(`Upload failed: ${response.statusText}`);
			}

			this._logService.info(`ContextCacheSync: Successfully uploaded index for ${repoHash}`);
			return true;
		} catch (error) {
			this._logService.error('ContextCacheSync: Upload failed', error);
			return false;
		}
	}

	/**
	 * Get cached index
	 */
	public getCachedIndex(repoHash: string): CacheEntry | undefined {
		return this._localCache.get(repoHash);
	}

	/**
	 * Clear cache
	 */
	public clearCache(): void {
		this._localCache.clear();
		this._logService.info('ContextCacheSync: Cache cleared');
	}

	/**
	 * Get cache statistics
	 */
	public getCacheStats(): {
		entries: number;
		totalSize: number;
		oldestEntry: number;
		newestEntry: number;
	} {
		let totalSize = 0;
		let oldestEntry = Date.now();
		let newestEntry = 0;

		for (const entry of this._localCache.values()) {
			totalSize += entry.size;
			oldestEntry = Math.min(oldestEntry, entry.timestamp);
			newestEntry = Math.max(newestEntry, entry.timestamp);
		}

		return {
			entries: this._localCache.size,
			totalSize,
			oldestEntry,
			newestEntry
		};
	}

	/**
	 * Prune old cache entries if size exceeds limit
	 */
	public pruneCache(): void {
		const stats = this.getCacheStats();
		
		if (stats.totalSize > this._maxCacheSize) {
			this._logService.info(`ContextCacheSync: Pruning cache - Size: ${stats.totalSize}, Limit: ${this._maxCacheSize}`);

			// Sort by timestamp (oldest first)
			const entries = Array.from(this._localCache.entries())
				.sort((a, b) => a[1].timestamp - b[1].timestamp);

			// Remove oldest entries until under limit
			let currentSize = stats.totalSize;
			for (const [key, entry] of entries) {
				if (currentSize <= this._maxCacheSize * 0.8) {
					break;
				}
				this._localCache.delete(key);
				currentSize -= entry.size;
			}

			this._logService.info(`ContextCacheSync: Pruned ${entries.length - this._localCache.size} entries`);
		}
	}
}

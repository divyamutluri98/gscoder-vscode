/*---------------------------------------------------------------------------------------------
 *  Copyright (c) GSCODER Team. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { Event, Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { ILogService } from 'vs/platform/log/common/log';
import * as sqlite3 from 'sqlite3';

/**
 * Phase 11: Real-Time Performance Observability Dashboard
 * Internal observability and performance analytics dashboard that tracks AI interaction
 * health without compromising privacy.
 */

interface CompletionMetric {
	id: string;
	timestamp: number;
	ttft: number; // Time to First Token (ms)
	acceptance: 'accepted' | 'partial' | 'rejected';
	contextSize: number;
	modelUsed: string;
	tokensGenerated: number;
}

interface PerformanceSummary {
	totalCompletions: number;
	averageTTFT: number;
	acceptanceRate: number;
	rejectionRate: number;
	averageContextSize: number;
	slowRequests: number; // > 800ms
}

export class MetricsCollector extends Disposable {
	private readonly _onMetricRecorded = this._register(new Emitter<CompletionMetric>());
	readonly onMetricRecorded = this._onMetricRecorded.event;

	private _metrics: CompletionMetric[] = [];
	private _db?: sqlite3.Database;
	private _dbPath: string;

	constructor(
		@ILogService private readonly _logService: ILogService,
		dbPath: string = '.gscoder-metrics.db'
	) {
		super();
		this._dbPath = dbPath;
		this._logService.info('MetricsCollector: Initializing');
		this._initializeDatabase();
	}

	/**
	 * Initialize SQLite database
	 */
	private async _initializeDatabase(): Promise<void> {
		try {
			const sqlite = await import('sqlite3');
			
			this._db = new sqlite.Database(this._dbPath, (err) => {
				if (err) {
					this._logService.error('MetricsCollector: Failed to open database', err);
					return;
				}

				this._db!.run(`
					CREATE TABLE IF NOT EXISTS metrics (
						id TEXT PRIMARY KEY,
						timestamp INTEGER,
						ttft INTEGER,
						acceptance TEXT,
						contextSize INTEGER,
						modelUsed TEXT,
						tokensGenerated INTEGER
					)
				`, (err) => {
					if (err) {
						this._logService.error('MetricsCollector: Failed to create table', err);
					} else {
						this._logService.info('MetricsCollector: Database initialized');
					}
				});
			});
		} catch (error) {
			this._logService.error('MetricsCollector: Failed to initialize database', error);
		}
	}

	/**
	 * Record completion metric
	 */
	public recordCompletion(metric: Omit<CompletionMetric, 'id' | 'timestamp'>): void {
		const fullMetric: CompletionMetric = {
			...metric,
			id: this._generateId(),
			timestamp: Date.now()
		};

		this._metrics.push(fullMetric);

		// Keep only last 10000 metrics in memory
		if (this._metrics.length > 10000) {
			this._metrics = this._metrics.slice(-10000);
		}

		// Save to database
		this._saveToDatabase(fullMetric);

		// Check for slow requests
		if (fullMetric.ttft > 800) {
			this._logService.warn(`MetricsCollector: Slow request detected - TTFT: ${fullMetric.ttft}ms, Context: ${fullMetric.contextSize} tokens`);
		}

		this._onMetricRecorded.fire(fullMetric);
	}

	/**
	 * Get performance summary
	 */
	public getPerformanceSummary(timeRange?: number): PerformanceSummary {
		const now = Date.now();
		const cutoff = timeRange ? now - timeRange : 0;

		const filtered = this._metrics.filter(m => m.timestamp >= cutoff);

		if (filtered.length === 0) {
			return {
				totalCompletions: 0,
				averageTTFT: 0,
				acceptanceRate: 0,
				rejectionRate: 0,
				averageContextSize: 0,
				slowRequests: 0
			};
		}

		const totalTTFT = filtered.reduce((sum, m) => sum + m.ttft, 0);
		const accepted = filtered.filter(m => m.acceptance === 'accepted').length;
		const rejected = filtered.filter(m => m.acceptance === 'rejected').length;
		const totalContext = filtered.reduce((sum, m) => sum + m.contextSize, 0);
		const slowRequests = filtered.filter(m => m.ttft > 800).length;

		return {
			totalCompletions: filtered.length,
			averageTTFT: totalTTFT / filtered.length,
			acceptanceRate: accepted / filtered.length,
			rejectionRate: rejected / filtered.length,
			averageContextSize: totalContext / filtered.length,
			slowRequests
		};
	}

	/**
	 * Get metrics by model
	 */
	public getMetricsByModel(modelName: string): CompletionMetric[] {
		return this._metrics.filter(m => m.modelUsed === modelName);
	}

	/**
	 * Generate performance report as markdown
	 */
	public generateReport(timeRange?: number): string {
		const summary = this.getPerformanceSummary(timeRange);
		const now = new Date();
		const rangeText = timeRange ? `Last ${timeRange / 1000 / 60} minutes` : 'All time';

		let report = `# GSCODER Performance Analytics\n\n`;
		report += `Generated: ${now.toISOString()}\n`;
		report += `Time Range: ${rangeText}\n\n`;

		report += `## Summary\n\n`;
		report += `- **Total Completions:** ${summary.totalCompletions}\n`;
		report += `- **Average TTFT:** ${summary.averageTTFT.toFixed(2)}ms\n`;
		report += `- **Acceptance Rate:** ${(summary.acceptanceRate * 100).toFixed(1)}%\n`;
		report += `- **Rejection Rate:** ${(summary.rejectionRate * 100).toFixed(1)}%\n`;
		report += `- **Average Context Size:** ${Math.round(summary.averageContextSize)} tokens\n`;
		report += `- **Slow Requests (>800ms):** ${summary.slowRequests}\n\n`;

		// Model breakdown
		const modelBreakdown = new Map<string, { count: number; avgTTFT: number }>();
		for (const metric of this._metrics) {
			const existing = modelBreakdown.get(metric.modelUsed) || { count: 0, avgTTFT: 0 };
			existing.count++;
			existing.avgTTFT = (existing.avgTTFT * (existing.count - 1) + metric.ttft) / existing.count;
			modelBreakdown.set(metric.modelUsed, existing);
		}

		if (modelBreakdown.size > 0) {
			report += `## Model Performance\n\n`;
			report += `| Model | Count | Avg TTFT |\n`;
			report += `|-------|-------|----------|\n`;
			
			for (const [model, stats] of modelBreakdown.entries()) {
				report += `| ${model} | ${stats.count} | ${stats.avgTTFT.toFixed(2)}ms |\n`;
			}
			report += '\n';
		}

		// Recent slow requests
		const slowRequests = this._metrics
			.filter(m => m.ttft > 800)
			.sort((a, b) => b.ttft - a.ttft)
			.slice(0, 10);

		if (slowRequests.length > 0) {
			report += `## Slow Requests (Top 10)\n\n`;
			report += `| Time | TTFT | Context | Model |\n`;
			report += `|------|------|---------|-------|\n`;
			
			for (const req of slowRequests) {
				const time = new Date(req.timestamp).toISOString();
				report += `| ${time} | ${req.ttft}ms | ${req.contextSize} | ${req.modelUsed} |\n`;
			}
		}

		return report;
	}

	/**
	 * Clear all metrics
	 */
	public clearMetrics(): void {
		this._metrics = [];
		this._logService.info('MetricsCollector: Metrics cleared');
	}

	/**
	 * Export metrics to JSON
	 */
	public exportMetrics(): string {
		return JSON.stringify(this._metrics, null, 2);
	}

	/**
	 * Save metric to database
	 */
	private _saveToDatabase(metric: CompletionMetric): void {
		if (!this._db) {
			return;
		}

		this._db.run(
			`INSERT INTO metrics (id, timestamp, ttft, acceptance, contextSize, modelUsed, tokensGenerated)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				metric.id,
				metric.timestamp,
				metric.ttft,
				metric.acceptance,
				metric.contextSize,
				metric.modelUsed,
				metric.tokensGenerated
			],
			(err) => {
				if (err) {
					this._logService.error('MetricsCollector: Failed to save metric to database', err);
				}
			}
		);
	}

	/**
	 * Generate unique ID
	 */
	private _generateId(): string {
		return `metric-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) GSCODER Team. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { ILogService } from 'vs/platform/log/common/log';

/**
 * Phase 13: Local Model Fine-Tuning Prep Pipeline
 * Background utility script that converts successful coding sessions into clean
 * training datasets for fine-tuning open-weights models.
 */

interface TrainingPair {
	system: string;
	user: string;
	assistant: string;
	metadata: {
		filePath: string;
		timestamp: number;
		language: string;
		tokens: number;
	};
}

interface SessionData {
	userQuery: string;
	filePath: string;
	fileContent: string;
	timestamp: number;
	success: boolean;
}

export class FinetunePrepPipeline extends Disposable {
	private _trainingData: TrainingPair[] = [];
	private _sessions: SessionData[] = [];
	private _outputDir = '.ide-training-data';

	constructor(
		@ILogService private readonly _logService: ILogService
	) {
		super();
		this._logService.info('FinetunePrepPipeline: Initializing');
		this._ensureOutputDirectory();
	}

	/**
	 * Capture successful session for training data
	 */
	public async captureSession(
		userQuery: string,
		filePath: string,
		fileContent: string
	): Promise<void> {
		const session: SessionData = {
			userQuery,
			filePath,
			fileContent,
			timestamp: Date.now(),
			success: true
		};

		this._sessions.push(session);
		this._logService.info(`FinetunePrepPipeline: Captured session for ${filePath}`);
	}

	/**
	 * Process captured sessions into training pairs
	 */
	public async processSessions(): Promise<TrainingPair[]> {
		const processed: TrainingPair[] = [];

		for (const session of this._sessions) {
			// Apply de-duplication filtering
			if (this._shouldIncludeSession(session)) {
				const trainingPair = this._convertToTrainingPair(session);
				processed.push(trainingPair);
			}
		}

		this._trainingData = [...this._trainingData, ...processed];
		this._sessions = []; // Clear processed sessions

		this._logService.info(`FinetunePrepPipeline: Processed ${processed.length} training pairs`);
		return processed;
	}

	/**
	 * Export training data to JSONL format
	 */
	public async exportToJSONL(outputPath?: string): Promise<string> {
		const fs = await import('fs');
		const path = await import('path');

		const output = outputPath || path.join(this._outputDir, 'training-data.jsonl');
		const jsonlLines = this._trainingData.map(pair => JSON.stringify(pair)).join('\n');

		fs.writeFileSync(output, jsonlLines, 'utf8');
		this._logService.info(`FinetunePrepPipeline: Exported ${this._trainingData.length} training pairs to ${output}`);

		return output;
	}

	/**
	 * Export training data to Alpaca format
	 */
	public async exportToAlpaca(outputPath?: string): Promise<string> {
		const fs = await import('fs');
		const path = await import('path');

		const output = outputPath || path.join(this._outputDir, 'training-data-alpaca.jsonl');
		const alpacaLines = this._trainingData.map(pair => {
			return JSON.stringify({
				instruction: pair.user,
				input: '',
				output: pair.assistant,
				text: `${pair.system}\n\n### Instruction:\n${pair.user}\n\n### Response:\n${pair.assistant}`
			});
		}).join('\n');

		fs.writeFileSync(output, alpacaLines, 'utf8');
		this._logService.info(`FinetunePrepPipeline: Exported to Alpaca format: ${output}`);

		return output;
	}

	/**
	 * Clear all training data
	 */
	public clearTrainingData(): void {
		this._trainingData = [];
		this._sessions = [];
		this._logService.info('FinetunePrepPipeline: Training data cleared');
	}

	/**
	 * Get training statistics
	 */
	public getStatistics(): {
		totalPairs: number;
		totalTokens: number;
		languages: Record<string, number>;
	} {
		const languages: Record<string, number> = {};
		let totalTokens = 0;

		for (const pair of this._trainingData) {
			const lang = pair.metadata.language;
			languages[lang] = (languages[lang] || 0) + 1;
			totalTokens += pair.metadata.tokens;
		}

		return {
			totalPairs: this._trainingData.length,
			totalTokens,
			languages
		};
	}

	/**
	 * Check if session should be included (de-duplication filtering)
	 */
	private _shouldIncludeSession(session: SessionData): boolean {
		const filePath = session.filePath.toLowerCase();

		// Filter out boilerplate and generic files
		const excludedPatterns = [
			'node_modules',
			'package-lock.json',
			'yarn.lock',
			'.min.js',
			'.min.css',
			'bundle.js',
			'chunk.js',
			'vendor',
			'dist',
			'build'
		];

		for (const pattern of excludedPatterns) {
			if (filePath.includes(pattern)) {
				return false;
			}
		}

		// Filter out very small or very large files
		const contentLength = session.fileContent.length;
		if (contentLength < 50 || contentLength > 50000) {
			return false;
		}

		// Filter out configuration files
		const configExtensions = ['.json', '.yaml', '.yml', '.toml', '.ini', '.cfg'];
		for (const ext of configExtensions) {
			if (filePath.endsWith(ext) && !filePath.includes('tsconfig') && !filePath.includes('package')) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Convert session to training pair
	 */
	private _convertToTrainingPair(session: SessionData): TrainingPair {
		const systemPrompt = this._generateSystemPrompt(session.filePath);
		const language = this._detectLanguage(session.filePath);
		const tokens = this._estimateTokens(session.fileContent);

		return {
			system: systemPrompt,
			user: session.userQuery,
			assistant: session.fileContent,
			metadata: {
				filePath: session.filePath,
				timestamp: session.timestamp,
				language,
				tokens
			}
		};
	}

	/**
	 * Generate system prompt based on file context
	 */
	private _generateSystemPrompt(filePath: string): string {
		const language = this._detectLanguage(filePath);
		return `You are an expert ${language} developer. Write clean, efficient, and well-documented code following best practices and design patterns.`;
	}

	/**
	 * Detect programming language from file path
	 */
	private _detectLanguage(filePath: string): string {
		const path = filePath.toLowerCase();
		if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'TypeScript';
		if (path.endsWith('.js') || path.endsWith('.jsx')) return 'JavaScript';
		if (path.endsWith('.py')) return 'Python';
		if (path.endsWith('.rs')) return 'Rust';
		if (path.endsWith('.go')) return 'Go';
		if (path.endsWith('.java')) return 'Java';
		if (path.endsWith('.c') || path.endsWith('.cpp') || path.endsWith('.h')) return 'C/C++';
		if (path.endsWith('.cs')) return 'C#';
		if (path.endsWith('.php')) return 'PHP';
		if (path.endsWith('.rb')) return 'Ruby';
		if (path.endsWith('.swift')) return 'Swift';
		if (path.endsWith('.kt')) return 'Kotlin';
		return 'code';
	}

	/**
	 * Estimate token count
	 */
	private _estimateTokens(text: string): number {
		return Math.ceil(text.length / 4);
	}

	/**
	 * Ensure output directory exists
	 */
	private async _ensureOutputDirectory(): Promise<void> {
		const fs = await import('fs');
		const path = await import('path');

		if (!fs.existsSync(this._outputDir)) {
			fs.mkdirSync(this._outputDir, { recursive: true });
			this._logService.info(`FinetunePrepPipeline: Created output directory ${this._outputDir}`);
		}
	}
}

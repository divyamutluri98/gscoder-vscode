/*---------------------------------------------------------------------------------------------
 *  Copyright (c) GSCODER Team. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { Event, Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { ILogService } from 'vs/platform/log/common/log';

/**
 * Phase 14: Terminal Shell Integration and Automatic Error Interception
 * Automatic terminal diagnostic interception framework that patches into the
 * core integrated terminal manager.
 */

interface TerminalError {
	command: string;
	exitCode: number;
	stdout: string;
	stderr: string;
	timestamp: number;
	workingDirectory: string;
}

interface FixAction {
	type: 'ai-fix' | 'manual';
	description: string;
	context: {
		command: string;
		error: string;
		filePath?: string;
	};
}

export class TerminalInterceptor extends Disposable {
	private readonly _onTerminalError = this._register(new Emitter<TerminalError>());
	readonly onTerminalError = this._onTerminalError.event;

	private readonly _onFixRequested = this._register(new Emitter<FixAction>());
	readonly onFixRequested = this._onFixRequested.event;

	private _commandHistory: Map<string, { command: string; exitCode: number; timestamp: number }> = new Map();
	private _activeFixButtons = new Map<string, HTMLElement>();

	constructor(
		@ILogService private readonly _logService: ILogService
	) {
		super();
		this._logService.info('TerminalInterceptor: Initializing');
	}

	/**
	 * Intercept terminal command execution
	 */
	public interceptCommand(
		command: string,
		workingDirectory: string,
		onComplete: (exitCode: number, stdout: string, stderr: string) => void
	): void {
		const startTime = Date.now();

		// Wrap the original command execution
		const wrappedOnComplete = (exitCode: number, stdout: string, stderr: string) => {
			// Record command history
			this._commandHistory.set(command, {
				command,
				exitCode,
				timestamp: Date.now()
			});

			// Check for non-zero exit code
			if (exitCode !== 0) {
				const error: TerminalError = {
					command,
					exitCode,
					stdout,
					stderr,
					timestamp: Date.now(),
					workingDirectory
				};

				this._logService.warn(`TerminalInterceptor: Command failed with exit code ${exitCode}: ${command}`);
				this._onTerminalError.fire(error);

				// Render fix button
				this._renderFixButton(error);
			}

			// Call original callback
			onComplete(exitCode, stdout, stderr);
		};

		// Store wrapped callback for later use
		// In production, this would integrate with VS Code's terminal API
	}

	/**
	 * Render fix button above failing command
	 */
	private _renderFixButton(error: TerminalError): void {
		// In production, this would create a DOM element in the terminal view
		// For now, we'll simulate the button creation
		
		const buttonId = `fix-btn-${Date.now()}`;
		const button = document.createElement('button');
		button.className = 'terminal-fix-button';
		button.textContent = 'Fix with Local AI';
		button.style.cssText = `
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: 1px solid var(--vscode-button-border);
			padding: 4px 12px;
			margin: 4px 0;
			cursor: pointer;
			border-radius: 2px;
			font-size: 12px;
		`;

		button.onclick = () => {
			this._requestFix(error);
		};

		this._activeFixButtons.set(buttonId, button);
		this._logService.info(`TerminalInterceptor: Rendered fix button for command: ${error.command}`);
	}

	/**
	 * Request AI fix for terminal error
	 */
	private _requestFix(error: TerminalError): void {
		const fixAction: FixAction = {
			type: 'ai-fix',
			description: 'Automatically fix terminal error using local AI',
			context: {
				command: error.command,
				error: error.stderr || error.stdout,
				filePath: this._extractFilePath(error.stderr || error.stdout)
			}
		};

		this._logService.info(`TerminalInterceptor: Requesting AI fix for: ${error.command}`);
		this._onFixRequested.fire(fixAction);
	}

	/**
	 * Extract file path from error output
	 */
	private _extractFilePath(errorOutput: string): string | undefined {
		// Common error patterns with file paths
		const patterns = [
			/([a-zA-Z]:\\[^:\s]+:\d+)/, // Windows: C:\path\to\file.ts:10
			/([^:\s]+\.ts:\d+)/, // TypeScript: file.ts:10
			/([^:\s]+\.js:\d+)/, // JavaScript: file.js:10
			/([^:\s]+\.py:\d+)/, // Python: file.py:10
			/([^:\s]+\.[a-z]+:\d+)/, // Generic: file.ext:10
		];

		for (const pattern of patterns) {
			const match = errorOutput.match(pattern);
			if (match) {
				return match[1];
			}
		}

		return undefined;
	}

	/**
	 * Get command history
	 */
	public getCommandHistory(): Array<{ command: string; exitCode: number; timestamp: number }> {
		return Array.from(this._commandHistory.values());
	}

	/**
	 * Clear command history
	 */
	public clearHistory(): void {
		this._commandHistory.clear();
		this._logService.info('TerminalInterceptor: Command history cleared');
	}

	/**
	 * Remove fix button
	 */
	public removeFixButton(buttonId: string): void {
		const button = this._activeFixButtons.get(buttonId);
		if (button) {
			button.remove();
			this._activeFixButtons.delete(buttonId);
		}
	}

	/**
	 * Clear all fix buttons
	 */
	public clearFixButtons(): void {
		for (const [id, button] of this._activeFixButtons) {
			button.remove();
		}
		this._activeFixButtons.clear();
		this._logService.info('TerminalInterceptor: All fix buttons cleared');
	}
}

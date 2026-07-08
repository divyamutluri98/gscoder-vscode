/*---------------------------------------------------------------------------------------------
 *  Copyright (c) GSCODER Team. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { Event, Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { ILogService } from 'vs/platform/log/common/log';

/**
 * Phase 12: Advanced Local User Personalization & Model Settings UI
 * Interactive settings interface for managing local AI parameters directly.
 */

interface ModelSettings {
	endpoint: string;
	model: string;
	temperature: number;
	topP: number;
	maxTokens: number;
	presencePenalty: number;
	frequencyPenalty: number;
}

interface SystemInstructions {
	enabled: boolean;
	content: string;
}

interface ContextSettings {
	maxIndexTokens: number;
	enableHybridMode: boolean;
	remoteServerUrl?: string;
}

export class AISettingsPanel extends Disposable {
	private readonly _onSettingsChanged = this._register(new Emitter<void>());
	readonly onSettingsChanged = this._onSettingsChanged.event;

	private _modelSettings: ModelSettings = {
		endpoint: 'http://localhost:11434',
		model: 'deepseek-coder:7b',
		temperature: 0.2,
		topP: 0.95,
		maxTokens: 100,
		presencePenalty: 0,
		frequencyPenalty: 0
	};

	private _systemInstructions: SystemInstructions = {
		enabled: false,
		content: ''
	};

	private _contextSettings: ContextSettings = {
		maxIndexTokens: 4000,
		enableHybridMode: false
	};

	constructor(
		@ILogService private readonly _logService: ILogService
	) {
		super();
		this._logService.info('AISettingsPanel: Initializing');
		this._loadSettings();
	}

	/**
	 * Get current model settings
	 */
	public getModelSettings(): ModelSettings {
		return { ...this._modelSettings };
	}

	/**
	 * Update model settings
	 */
	public updateModelSettings(settings: Partial<ModelSettings>): void {
		this._modelSettings = { ...this._modelSettings, ...settings };
		this._saveSettings();
		this._onSettingsChanged.fire();
		this._logService.info('AISettingsPanel: Model settings updated');
	}

	/**
	 * Get system instructions
	 */
	public getSystemInstructions(): SystemInstructions {
		return { ...this._systemInstructions };
	}

	/**
	 * Update system instructions
	 */
	public updateSystemInstructions(instructions: Partial<SystemInstructions>): void {
		this._systemInstructions = { ...this._systemInstructions, ...instructions };
		this._saveSettings();
		this._onSettingsChanged.fire();
		this._logService.info('AISettingsPanel: System instructions updated');
	}

	/**
	 * Get context settings
	 */
	public getContextSettings(): ContextSettings {
		return { ...this._contextSettings };
	}

	/**
	 * Update context settings
	 */
	public updateContextSettings(settings: Partial<ContextSettings>): void {
		this._contextSettings = { ...this._contextSettings, ...settings };
		this._saveSettings();
		this._onSettingsChanged.fire();
		this._logService.info('AISettingsPanel: Context settings updated');
	}

	/**
	 * Reset to defaults
	 */
	public resetToDefaults(): void {
		this._modelSettings = {
			endpoint: 'http://localhost:11434',
			model: 'deepseek-coder:7b',
			temperature: 0.2,
			topP: 0.95,
			maxTokens: 100,
			presencePenalty: 0,
			frequencyPenalty: 0
		};

		this._systemInstructions = {
			enabled: false,
			content: ''
		};

		this._contextSettings = {
			maxIndexTokens: 4000,
			enableHybridMode: false
		};

		this._saveSettings();
		this._onSettingsChanged.fire();
		this._logService.info('AISettingsPanel: Settings reset to defaults');
	}

	/**
	 * Validate settings
	 */
	public validateSettings(): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		// Validate endpoint
		try {
			new URL(this._modelSettings.endpoint);
		} catch {
			errors.push('Invalid endpoint URL');
		}

		// Validate temperature
		if (this._modelSettings.temperature < 0 || this._modelSettings.temperature > 1) {
			errors.push('Temperature must be between 0 and 1');
		}

		// Validate topP
		if (this._modelSettings.topP < 0 || this._modelSettings.topP > 1) {
			errors.push('Top P must be between 0 and 1');
		}

		// Validate maxTokens
		if (this._modelSettings.maxTokens < 1 || this._modelSettings.maxTokens > 32000) {
			errors.push('Max tokens must be between 1 and 32000');
		}

		// Validate context settings
		if (this._contextSettings.maxIndexTokens < 1000 || this._contextSettings.maxIndexTokens > 128000) {
			errors.push('Max index tokens must be between 1000 and 128000');
		}

		// Validate remote server URL if hybrid mode is enabled
		if (this._contextSettings.enableHybridMode && this._contextSettings.remoteServerUrl) {
			try {
				new URL(this._contextSettings.remoteServerUrl);
			} catch {
				errors.push('Invalid remote server URL');
			}
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}

	/**
	 * Export settings as JSON
	 */
	public exportSettings(): string {
		return JSON.stringify({
			modelSettings: this._modelSettings,
			systemInstructions: this._systemInstructions,
			contextSettings: this._contextSettings
		}, null, 2);
	}

	/**
	 * Import settings from JSON
	 */
	public importSettings(json: string): boolean {
		try {
			const data = JSON.parse(json);
			
			if (data.modelSettings) {
				this._modelSettings = { ...this._modelSettings, ...data.modelSettings };
			}
			if (data.systemInstructions) {
				this._systemInstructions = { ...this._systemInstructions, ...data.systemInstructions };
			}
			if (data.contextSettings) {
				this._contextSettings = { ...this._contextSettings, ...data.contextSettings };
			}

			this._saveSettings();
			this._onSettingsChanged.fire();
			this._logService.info('AISettingsPanel: Settings imported');
			return true;
		} catch (error) {
			this._logService.error('AISettingsPanel: Failed to import settings', error);
			return false;
		}
	}

	/**
	 * Load settings from storage
	 */
	private _loadSettings(): void {
		try {
			const fs = require('fs');
			const path = require('path');
			const settingsPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.gscoder', 'settings.json');

			if (fs.existsSync(settingsPath)) {
				const data = fs.readFileSync(settingsPath, 'utf8');
				const parsed = JSON.parse(data);

				if (parsed.modelSettings) {
					this._modelSettings = { ...this._modelSettings, ...parsed.modelSettings };
				}
				if (parsed.systemInstructions) {
					this._systemInstructions = { ...this._systemInstructions, ...parsed.systemInstructions };
				}
				if (parsed.contextSettings) {
					this._contextSettings = { ...this._contextSettings, ...parsed.contextSettings };
				}

				this._logService.info('AISettingsPanel: Settings loaded from disk');
			}
		} catch (error) {
			this._logService.warn('AISettingsPanel: Failed to load settings', error);
		}
	}

	/**
	 * Save settings to storage
	 */
	private _saveSettings(): void {
		try {
			const fs = require('fs');
			const path = require('path');
			const settingsDir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.gscoder');
			const settingsPath = path.join(settingsDir, 'settings.json');

			if (!fs.existsSync(settingsDir)) {
				fs.mkdirSync(settingsDir, { recursive: true });
			}

			const data = JSON.stringify({
				modelSettings: this._modelSettings,
				systemInstructions: this._systemInstructions,
				contextSettings: this._contextSettings
			}, null, 2);

			fs.writeFileSync(settingsPath, data, 'utf8');
		} catch (error) {
			this._logService.error('AISettingsPanel: Failed to save settings', error);
		}
	}
}

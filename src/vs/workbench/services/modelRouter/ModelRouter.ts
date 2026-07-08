/*---------------------------------------------------------------------------------------------
 *  Copyright (c) GSCODER Team. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { Event, Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { ILogService } from 'vs/platform/log/common/log';

/**
 * Phase 8: Local Model Routing and Fallbacks
 * Internal routing layer that connects to open-source models running locally
 * or on a private server via Ollama/vLLM APIs.
 */

type ModelTier = 'tiny' | 'small' | 'medium' | 'large';

interface ModelEndpoint {
	name: string;
	tier: ModelTier;
	url: string;
	maxContextTokens: number;
	latencyTarget: number; // milliseconds
}

interface ModelRequest {
	feature: 'inline-completion' | 'inline-edit' | 'agent-composer';
	contextTokens: number;
	prompt: string;
	options?: {
		temperature?: number;
		maxTokens?: number;
	};
}

interface ModelResponse {
	text: string;
	modelUsed: string;
	latency: number;
	tokensUsed: number;
	error?: string;
}

export class ModelRouter extends Disposable {
	private readonly _onModelChanged = this._register(new Emitter<string>());
	readonly onModelChanged = this._onModelChanged.event;

	private readonly _onModelError = this._register(new Emitter<string>());
	readonly onModelError = this._onModelError.event;

	private _endpoints: ModelEndpoint[] = [
		{
			name: 'deepseek-coder:1.3b',
			tier: 'tiny',
			url: 'http://localhost:11434/api/generate',
			maxContextTokens: 4096,
			latencyTarget: 100
		},
		{
			name: 'qwen2.5-coder:1.5b',
			tier: 'tiny',
			url: 'http://localhost:11434/api/generate',
			maxContextTokens: 4096,
			latencyTarget: 100
		},
		{
			name: 'deepseek-coder:7b',
			tier: 'medium',
			url: 'http://localhost:11434/api/generate',
			maxContextTokens: 8192,
			latencyTarget: 500
		},
		{
			name: 'qwen2.5-coder:7b',
			tier: 'medium',
			url: 'http://localhost:11434/api/generate',
			maxContextTokens: 8192,
			latencyTarget: 500
		},
		{
			name: 'llama3.1:70b',
			tier: 'large',
			url: 'http://localhost:11434/api/generate',
			maxContextTokens: 32768,
			latencyTarget: 2000
		},
		{
			name: 'deepseek-coder:33b',
			tier: 'large',
			url: 'http://localhost:11434/api/generate',
			maxContextTokens: 16384,
			latencyTarget: 1500
		}
	];

	private _customEndpoints: Map<string, ModelEndpoint> = new Map();

	constructor(
		@ILogService private readonly _logService: ILogService
	) {
		super();
		this._logService.info('ModelRouter: Initializing with local model endpoints');
	}

	/**
	 * Route request to appropriate model based on feature and context size
	 */
	public async routeRequest(request: ModelRequest): Promise<ModelResponse> {
		const startTime = Date.now();
		
		// Select appropriate model tier based on feature
		const targetTier = this._selectModelTier(request.feature);
		
		// Find available model in target tier that can handle context
		let endpoint = this._findAvailableEndpoint(targetTier, request.contextTokens);
		
		// If no model can handle context, cascade to higher tier
		if (!endpoint) {
			this._logService.warn(`ModelRouter: No model in tier ${targetTier} can handle ${request.contextTokens} tokens, cascading`);
			endpoint = this._cascadeToHigherTier(request.contextTokens);
		}

		if (!endpoint) {
			return {
				text: '',
				modelUsed: 'none',
				latency: 0,
				tokensUsed: 0,
				error: 'No available model can handle the requested context size'
			};
		}

		try {
			this._logService.debug(`ModelRouter: Routing to ${endpoint.name}`);
			
			const response = await this._callModel(endpoint, request);
			const latency = Date.now() - startTime;

			// Check if latency exceeded target
			if (latency > endpoint.latencyTarget * 2) {
				this._logService.warn(`ModelRouter: ${endpoint.name} latency ${latency}ms exceeded target ${endpoint.latencyTarget}ms`);
			}

			return {
				...response,
				latency,
				modelUsed: endpoint.name
			};
		} catch (error) {
			this._logService.error(`ModelRouter: Failed to call ${endpoint.name}`, error);
			this._onModelError.fire(`Model ${endpoint.name} failed: ${error instanceof Error ? error.message : String(error)}`);

			// Failover to next available model
			return await this._failover(request, endpoint, error);
		}
	}

	/**
	 * Select model tier based on feature
	 */
	private _selectModelTier(feature: ModelRequest['feature']): ModelTier {
		switch (feature) {
			case 'inline-completion':
				return 'tiny'; // Fastest for autocomplete
			case 'inline-edit':
				return 'medium'; // Balance speed and quality
			case 'agent-composer':
				return 'large'; // Highest capability for complex tasks
			default:
				return 'medium';
		}
	}

	/**
	 * Find available endpoint in tier that can handle context
	 */
	private _findAvailableEndpoint(tier: ModelTier, contextTokens: number): ModelEndpoint | null {
		const tierEndpoints = this._endpoints.filter(e => e.tier === tier);
		
		// Sort by latency target (prefer faster models)
		tierEndpoints.sort((a, b) => a.latencyTarget - b.latencyTarget);

		for (const endpoint of tierEndpoints) {
			if (endpoint.maxContextTokens >= contextTokens) {
				return endpoint;
			}
		}

		return null;
	}

	/**
	 * Cascade to higher tier if needed
	 */
	private _cascadeToHigherTier(contextTokens: number): ModelEndpoint | null {
		const tiers: ModelTier[] = ['tiny', 'small', 'medium', 'large'];
		
		for (const tier of tiers) {
			const endpoint = this._findAvailableEndpoint(tier, contextTokens);
			if (endpoint) {
				return endpoint;
			}
		}

		return null;
	}

	/**
	 * Call model endpoint
	 */
	private async _callModel(endpoint: ModelEndpoint, request: ModelRequest): Promise<{ text: string; tokensUsed: number }> {
		const response = await fetch(endpoint.url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: endpoint.name,
				prompt: request.prompt,
				stream: false,
				options: {
					temperature: request.options?.temperature ?? 0.2,
					num_predict: request.options?.maxTokens ?? 100
				}
			})
		});

		if (!response.ok) {
			throw new Error(`Model endpoint returned ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();
		
		return {
			text: data.response || '',
			tokensUsed: data.eval_count || 0
		};
	}

	/**
	 * Failover to next available model
	 */
	private async _failover(request: ModelRequest, failedEndpoint: ModelEndpoint, error: unknown): Promise<ModelResponse> {
		this._logService.info(`ModelRouter: Failing over from ${failedEndpoint.name}`);

		// Find next model in same tier
		const sameTier = this._endpoints.filter(e => 
			e.tier === failedEndpoint.tier && 
			e.name !== failedEndpoint.name &&
			e.maxContextTokens >= request.contextTokens
		);

		if (sameTier.length > 0) {
			try {
				const nextEndpoint = sameTier[0];
				this._logService.info(`ModelRouter: Trying ${nextEndpoint.name}`);
				const response = await this._callModel(nextEndpoint, request);
				return {
					...response,
					modelUsed: nextEndpoint.name,
					latency: 0,
					tokensUsed: response.tokensUsed
				};
			} catch (error) {
				this._logService.error(`ModelRouter: Failover to ${sameTier[0].name} failed`, error);
			}
		}

		// Cascade to lower tier
		const tiers: ModelTier[] = ['large', 'medium', 'small', 'tiny'];
		const currentIndex = tiers.indexOf(failedEndpoint.tier);
		
		for (let i = currentIndex + 1; i < tiers.length; i++) {
			const lowerTier = tiers[i];
			const endpoint = this._findAvailableEndpoint(lowerTier, request.contextTokens);
			
			if (endpoint) {
				try {
					this._logService.info(`ModelRouter: Cascading to lower tier ${endpoint.name}`);
					const response = await this._callModel(endpoint, request);
					return {
						...response,
						modelUsed: endpoint.name,
						latency: 0,
						tokensUsed: response.tokensUsed,
						error: 'Downscaled due to model failure'
					};
				} catch (error) {
					this._logService.error(`ModelRouter: Lower tier ${endpoint.name} also failed`, error);
				}
			}
		}

		return {
			text: '',
			modelUsed: 'none',
			latency: 0,
			tokensUsed: 0,
			error: `All models failed. Original error: ${error instanceof Error ? error.message : String(error)}`
		};
	}

	/**
	 * Add custom endpoint
	 */
	public addCustomEndpoint(endpoint: ModelEndpoint): void {
		this._customEndpoints.set(endpoint.name, endpoint);
		this._endpoints.push(endpoint);
		this._onModelChanged.fire(endpoint.name);
		this._logService.info(`ModelRouter: Added custom endpoint ${endpoint.name}`);
	}

	/**
	 * Get available endpoints
	 */
	public getAvailableEndpoints(): ModelEndpoint[] {
		return [...this._endpoints];
	}

	/**
	 * Remove custom endpoint
	 */
	public removeCustomEndpoint(name: string): void {
		const index = this._endpoints.findIndex(e => e.name === name);
		if (index !== -1) {
			this._endpoints.splice(index, 1);
			this._customEndpoints.delete(name);
			this._logService.info(`ModelRouter: Removed endpoint ${name}`);
		}
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) GSCODER Team. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { Event, Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { ILogService } from 'vs/platform/log/common/log';

/**
 * Phase 5: Fast Inference and Speculative Completion Gateway
 * Enterprise-grade, low-latency API gateway server designed to route real-time
 * inline completion requests between desktop IDE and private backend model instances.
 */

interface CompletionRequest {
	document: string;
	cursorOffset: number;
	prefix: string;
	suffix: string;
	maxTokens?: number;
	temperature?: number;
}

interface CompletionStream {
	id: string;
	controller: AbortController;
	startTime: number;
}

interface CompletionChunk {
	text: string;
	isFinal: boolean;
	error?: string;
}

export class InferenceGateway extends Disposable {
	private readonly _onCompletionStream = this._register(new Emitter<CompletionChunk>());
	readonly onCompletionStream = this._onCompletionStream.event;

	private readonly _onRequestCancelled = this._register(new Emitter<string>());
	readonly onRequestCancelled = this._onRequestCancelled.event;

	private _activeStreams = new Map<string, CompletionStream>();
	private _typingDebounceTimer?: NodeJS.Timeout;
	private _lastTypingTime = 0;

	constructor(
		@ILogService private readonly _logService: ILogService
	) {
		super();
		this._logService.info('InferenceGateway: Initializing');
	}

	/**
	 * Request streaming completion using Server-Sent Events (SSE)
	 */
	public async requestCompletion(request: CompletionRequest): Promise<string> {
		const streamId = this._generateStreamId();
		const controller = new AbortController();
		const startTime = Date.now();

		// Register active stream
		this._activeStreams.set(streamId, {
			id: streamId,
			controller,
			startTime
		});

		try {
			// Structure FIM context with targeted tokens
			const fimContext = this._structureFIMContext(request);

			// Send to local inference endpoint
			const response = await this._sendToInferenceEndpoint(fimContext, controller.signal);

			// Stream tokens
			let fullText = '';
			for await (const chunk of this._streamResponse(response)) {
				fullText += chunk;
				this._onCompletionStream.fire({
					text: chunk,
					isFinal: false
				});
			}

			// Final chunk
			this._onCompletionStream.fire({
				text: '',
				isFinal: true
			});

			const elapsed = Date.now() - startTime;
			this._logService.debug(`InferenceGateway: Completion ${streamId} completed in ${elapsed}ms`);

			return fullText;
		} catch (error) {
			if (error.name === 'AbortError') {
				this._logService.debug(`InferenceGateway: Completion ${streamId} cancelled`);
				this._onRequestCancelled.fire(streamId);
			} else {
				this._logService.error(`InferenceGateway: Completion ${streamId} failed`, error);
				this._onCompletionStream.fire({
					text: '',
					isFinal: true,
					error: error.message
				});
			}
			throw error;
		} finally {
			this._activeStreams.delete(streamId);
		}
	}

	/**
	 * Handle typing event for aggressive request interception
	 */
	public handleTyping(): void {
		this._lastTypingTime = Date.now();

		// Clear existing debounce timer
		if (this._typingDebounceTimer) {
			clearTimeout(this._typingDebounceTimer);
		}

		// Cancel all active streams immediately
		this._cancelAllActiveStreams();

		// Set new debounce timer
		this._typingDebounceTimer = setTimeout(() => {
			// Typing stopped, ready for new completion
			this._logService.debug('InferenceGateway: Typing stopped, ready for completion');
		}, 100); // 100ms debounce
	}

	/**
	 * Cancel all active streams
	 */
	private _cancelAllActiveStreams(): void {
		for (const [streamId, stream] of this._activeStreams) {
			stream.controller.abort();
			this._logService.debug(`InferenceGateway: Cancelled stream ${streamId} due to typing`);
		}
		this._activeStreams.clear();
	}

	/**
	 * Structure FIM context with targeted tokens
	 */
	private _structureFIMContext(request: CompletionRequest): string {
		const { prefix, suffix, maxTokens = 100, temperature = 0.2 } = request;

		// Use standard FIM format optimized for DeepSeek-Coder, StarCoder, etc.
		return `<pre>${prefix}</pre><suf>${suffix}</suf><mid>`;
	}

	/**
	 * Send request to local inference endpoint
	 */
	private async _sendToInferenceEndpoint(context: string, signal: AbortSignal): Promise<Response> {
		const endpoint = this._getInferenceEndpoint();

		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					prompt: context,
					stream: true,
					max_tokens: 100,
					temperature: 0.2,
					stop: ['</mid>']
				}),
				signal
			});

			if (!response.ok) {
				throw new Error(`Inference endpoint returned ${response.status}: ${response.statusText}`);
			}

			return response;
		} catch (error) {
			this._logService.error('InferenceGateway: Failed to send request to endpoint', error);
			throw error;
		}
	}

	/**
	 * Stream response from inference endpoint
	 */
	private async *_streamResponse(response: Response): AsyncGenerator<string> {
		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('Response body is not readable');
		}

		const decoder = new TextDecoder();
		let buffer = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });

			// Process SSE chunks
			const lines = buffer.split('\n');
			buffer = lines.pop() || '';

			for (const line of lines) {
				if (line.startsWith('data: ')) {
					const data = line.slice(6);
					if (data === '[DONE]') continue;

					try {
						const parsed = JSON.parse(data);
						const token = this._normalizeToken(parsed);
						if (token) {
							yield token;
						}
					} catch (error) {
						this._logService.warn('InferenceGateway: Failed to parse SSE chunk', error);
					}
				}
			}
		}
	}

	/**
	 * Normalize token from upstream LLM provider
	 */
	private _normalizeToken(chunk: any): string | null {
		// Handle different response formats from various providers
		if (chunk.choices && chunk.choices[0]) {
			return chunk.choices[0].text || chunk.choices[0].delta?.content || '';
		}
		if (chunk.content) {
			return chunk.content;
		}
		if (chunk.token) {
			return chunk.token;
		}
		return null;
	}

	/**
	 * Get inference endpoint URL
	 */
	private _getInferenceEndpoint(): string {
		// Default to local Ollama endpoint
		return 'http://localhost:11434/api/generate';
	}

	/**
	 * Generate unique stream ID
	 */
	private _generateStreamId(): string {
		return `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Get active stream count
	 */
	public getActiveStreamCount(): number {
		return this._activeStreams.size;
	}

	/**
	 * Check if typing is in progress
	 */
	public isTyping(): boolean {
		return Date.now() - this._lastTypingTime < 100;
	}
}

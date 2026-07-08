/*---------------------------------------------------------------------------------------------
 *  Copyright (c) GSCODER Team. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { p, prel } from '@anysphere/priompt';

/**
 * Phase 4: Token Management & Prompts (Priompt Interface)
 * Advanced Code Query Prompt using JSX layout algorithms to prioritize
 * essential context items dynamically within sliding parameter tokens.
 */

interface CurrentOpenFileState {
	path: string;
	content: string;
	selectionStart: number;
	selectionEnd: number;
}

interface RetrievedCodebaseContext {
	path: string;
	content: string;
	rankingScore: number;
}

interface CompilerDiagnostic {
	message: string;
	severity: string;
	errorLine: number;
}

interface AdvancedCodeQueryPromptProps {
	userIntentText: string;
	currentOpenFileState: CurrentOpenFileState;
	retrievedCodebaseContext: RetrievedCodebaseContext[];
	compilerDiagnostics: CompilerDiagnostic[];
}

/**
 * System persona configuration
 */
const SYSTEM_PERSONA = `
You are GSCODER, an advanced AI coding assistant integrated into a custom IDE.
You specialize in:
- Writing clean, maintainable, and efficient code
- Following best practices and design patterns
- Providing clear explanations and suggestions
- Understanding complex codebases and architectural decisions
- Generating production-ready solutions

Always prioritize code quality, security, and performance.
`;

export const AdvancedCodeQueryPrompt: React.FC<AdvancedCodeQueryPromptProps> = ({
	userIntentText,
	currentOpenFileState,
	retrievedCodebaseContext,
	compilerDiagnostics
}) => {
	return (
		<>
			{/* Critical Priority (p={1000}): System persona and user intent - never culled */}
			<p priority={1000}>
				{SYSTEM_PERSONA}
			</p>

			<p priority={1000}>
				<text>User Request:</text>
				<text>{userIntentText}</text>
			</p>

			{/* High Priority (p={600}): Current file state and compiler diagnostics */}
			<p priority={600}>
				<text>Current File:</text>
				<text>Path: {currentOpenFileState.path}</text>
				<text>Content:</text>
				<text>{currentOpenFileState.content}</text>
				<text>Selection: {currentOpenFileState.selectionStart} - {currentOpenFileState.selectionEnd}</text>
			</p>

			{compilerDiagnostics.length > 0 && (
				<p priority={600}>
					<text>Compiler Diagnostics:</text>
					{compilerDiagnostics.map((diag, index) => (
						<text key={index}>
							[{diag.severity}] Line {diag.errorLine}: {diag.message}
						</text>
					))}
				</p>
			)}

			{/* Dynamic Priority (prel): Retrieved codebase context based on similarity score */}
			{retrievedCodebaseContext
				.sort((a, b) => b.rankingScore - a.rankingScore)
				.map((context, index) => (
					<prel
						key={`${context.path}-${index}`}
						priority={Math.round(context.rankingScore * 500)}
					>
						<text>Context {index + 1} (Score: {context.rankingScore.toFixed(2)}):</text>
						<text>File: {context.path}</text>
						<text>Content:</text>
						<text>{context.content}</text>
					</prel>
				))}

			{/* Truncation boundary for automatic pruning */}
			<p priority={100}>
				<text>End of context window. If truncated, lowest-scoring context items were removed.</text>
			</p>
		</>
	);
};

/**
 * Alternative functional component for non-JSX environments
 */
export function buildAdvancedCodeQueryPrompt(
	userIntentText: string,
	currentOpenFileState: CurrentOpenFileState,
	retrievedCodebaseContext: RetrievedCodebaseContext[],
	compilerDiagnostics: CompilerDiagnostic[]
): string {
	let prompt = '';

	// Critical Priority: System persona
	prompt += SYSTEM_PERSONA + '\n\n';

	// Critical Priority: User intent
	prompt += `User Request:\n${userIntentText}\n\n`;

	// High Priority: Current file state
	prompt += `Current File:\n`;
	prompt += `Path: ${currentOpenFileState.path}\n`;
	prompt += `Content:\n${currentOpenFileState.content}\n`;
	prompt += `Selection: ${currentOpenFileState.selectionStart} - ${currentOpenFileState.selectionEnd}\n\n`;

	// High Priority: Compiler diagnostics
	if (compilerDiagnostics.length > 0) {
		prompt += 'Compiler Diagnostics:\n';
		for (const diag of compilerDiagnostics) {
			prompt += `[${diag.severity}] Line ${diag.errorLine}: ${diag.message}\n`;
		}
		prompt += '\n';
	}

	// Dynamic Priority: Retrieved context sorted by ranking score
	const sortedContext = [...retrievedCodebaseContext].sort((a, b) => b.rankingScore - a.rankingScore);
	for (let i = 0; i < sortedContext.length; i++) {
		const context = sortedContext[i];
		prompt += `Context ${i + 1} (Score: ${context.rankingScore.toFixed(2)}):\n`;
		prompt += `File: ${context.path}\n`;
		prompt += `Content:\n${context.content}\n\n`;
	}

	return prompt;
}

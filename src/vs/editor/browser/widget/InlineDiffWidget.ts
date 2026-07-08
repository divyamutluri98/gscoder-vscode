/*---------------------------------------------------------------------------------------------
 *  Copyright (c) GSCODER Team. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableListener, addStandardDisposableListener } from 'vs/base/browser/dom';
import { Disposable } from 'vs/base/common/lifecycle';
import { Position } from 'vs/editor/common/core/position';
import { Range } from 'vs/editor/common/core/range';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';

/**
 * Inline Diff Widget - Phase 2
 * Implements surgical inline diff component that dynamically tracks active code-patch payload
 * and paints green line highlights for new insertions and red strike-through highlights for deletions
 * directly inside the live editor space.
 */
export class InlineDiffWidget extends Disposable {
	private _container?: HTMLElement;
	private _ghostTextOverlay?: HTMLElement;
	private _diffOverlay?: HTMLElement;
	private _isVisible = false;

	constructor(private readonly _editor: ICodeEditor) {
		super();
		this._register(this._editor.onDidChangeCursorPosition(() => this._onCursorChange()));
		this._register(this._editor.onDidScrollChange(() => this._onScroll()));
	}

	/**
	 * Show inline input container between lines of text
	 */
	public showInlineInput(lineNumber: number, column: number): void {
		this._ensureContainer();
		this._isVisible = true;

		const position = new Position(lineNumber, column);
		const coordinates = this._editor.getScrolledVisiblePosition(position);

		if (coordinates) {
			this._container!.style.top = `${coordinates.top + this._editor.getOption(45 /* lineHeight */)}px`;
			this._container!.style.left = `${coordinates.left}px`;
			this._container!.style.display = 'block';
		}
	}

	/**
	 * Render ghost text overlay with predictive completions
	 */
	public showGhostText(lineNumber: number, text: string): void {
		this._ensureGhostTextOverlay();
		this._isVisible = true;

		const position = new Position(lineNumber, 1);
		const coordinates = this._editor.getScrolledVisiblePosition(position);

		if (coordinates) {
			this._ghostTextOverlay!.style.top = `${coordinates.top}px`;
			this._ghostTextOverlay!.style.left = `${coordinates.left}px`;
			this._ghostTextOverlay!.textContent = text;
			this._ghostTextOverlay!.style.display = 'block';
		}
	}

	/**
	 * Render inline diff highlights
	 */
	public showInlineDiff(insertions: Range[], deletions: Range[]): void {
		this._ensureDiffOverlay();
		this._isVisible = true;

		// Clear previous decorations
		this._diffOverlay!.innerHTML = '';

		// Render green highlights for insertions
		for (const insertion of insertions) {
			const startCoords = this._editor.getScrolledVisiblePosition(insertion.getStartPosition());
			const endCoords = this._editor.getScrolledVisiblePosition(insertion.getEndPosition());

			if (startCoords && endCoords) {
				const highlight = document.createElement('div');
				highlight.className = 'inline-diff-insertion';
				highlight.style.position = 'absolute';
				highlight.style.top = `${startCoords.top}px`;
				highlight.style.left = `${startCoords.left}px`;
				highlight.style.width = `${endCoords.left - startCoords.left}px`;
				highlight.style.height = `${this._editor.getOption(45 /* lineHeight */)}px`;
				highlight.style.backgroundColor = 'rgba(46, 160, 67, 0.2)';
				highlight.style.borderLeft = '2px solid #46a049';
				this._diffOverlay!.appendChild(highlight);
			}
		}

		// Render red strike-through for deletions
		for (const deletion of deletions) {
			const startCoords = this._editor.getScrolledVisiblePosition(deletion.getStartPosition());
			const endCoords = this._editor.getScrolledVisiblePosition(deletion.getEndPosition());

			if (startCoords && endCoords) {
				const highlight = document.createElement('div');
				highlight.className = 'inline-diff-deletion';
				highlight.style.position = 'absolute';
				highlight.style.top = `${startCoords.top}px`;
				highlight.style.left = `${startCoords.left}px`;
				highlight.style.width = `${endCoords.left - startCoords.left}px`;
				highlight.style.height = `${this._editor.getOption(45 /* lineHeight */)}px`;
				highlight.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
				highlight.style.textDecoration = 'line-through';
				highlight.style.textDecorationColor = '#ff0000';
				this._diffOverlay!.appendChild(highlight);
			}
		}

		this._diffOverlay!.style.display = 'block';
	}

	/**
	 * Hide all overlays
	 */
	public hide(): void {
		this._isVisible = false;
		if (this._container) {
			this._container.style.display = 'none';
		}
		if (this._ghostTextOverlay) {
			this._ghostTextOverlay.style.display = 'none';
		}
		if (this._diffOverlay) {
			this._diffOverlay.style.display = 'none';
		}
	}

	/**
	 * Handle cursor position changes
	 */
	private _onCursorChange(): void {
		if (!this._isVisible) {
			return;
		}
		// Re-position overlays based on new cursor position
		this.hide();
	}

	/**
	 * Handle editor scrolling
	 */
	private _onScroll(): void {
		if (!this._isVisible) {
			return;
		}
		// Re-position overlays based on scroll position
		this.hide();
	}

	/**
	 * Ensure container element exists
	 */
	private _ensureContainer(): void {
		if (!this._container) {
			this._container = document.createElement('div');
			this._container.className = 'inline-input-container';
			this._container.style.position = 'absolute';
			this._container.style.zIndex = '1000';
			this._container.style.display = 'none';
			this._container.style.backgroundColor = 'var(--vscode-editor-background)';
			this._container.style.border = '1px solid var(--vscode-editor-selectionBackground)';
			this._container.style.borderRadius = '4px';
			this._container.style.padding = '4px';
			this._container.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';

			const input = document.createElement('input');
			input.type = 'text';
			input.className = 'inline-input';
			input.style.border = 'none';
			input.style.outline = 'none';
			input.style.background = 'transparent';
			input.style.color = 'var(--vscode-editor-foreground)';
			input.style.width = '300px';

			this._container.appendChild(input);
			this._editor.getDomNode()?.appendChild(this._container);

			this._register(addStandardDisposableListener(input, 'keydown', (e) => {
				if (e.keyCode === 13 /* Enter */) {
					// Accept input
					this.hide();
				} else if (e.keyCode === 27 /* Escape */) {
					// Cancel input
					this.hide();
				}
			}));
		}
	}

	/**
	 * Ensure ghost text overlay exists
	 */
	private _ensureGhostTextOverlay(): void {
		if (!this._ghostTextOverlay) {
			this._ghostTextOverlay = document.createElement('div');
			this._ghostTextOverlay.className = 'ghost-text-overlay';
			this._ghostTextOverlay.style.position = 'absolute';
			this._ghostTextOverlay.style.zIndex = '999';
			this._ghostTextOverlay.style.display = 'none';
			this._ghostTextOverlay.style.color = 'var(--vscode-editor-foreground)';
			this._ghostTextOverlay.style.opacity = '0.5';
			this._ghostTextOverlay.style.fontFamily = this._editor.getOption(36 /* fontFamily */);
			this._ghostTextOverlay.style.fontSize = `${this._editor.getOption(43 /* fontSize */)}px`;
			this._ghostTextOverlay.style.lineHeight = `${this._editor.getOption(45 /* lineHeight */)}px`;
			this._editor.getDomNode()?.appendChild(this._ghostTextOverlay);
		}
	}

	/**
	 * Ensure diff overlay exists
	 */
	private _ensureDiffOverlay(): void {
		if (!this._diffOverlay) {
			this._diffOverlay = document.createElement('div');
			this._diffOverlay.className = 'inline-diff-overlay';
			this._diffOverlay.style.position = 'absolute';
			this._diffOverlay.style.zIndex = '998';
			this._diffOverlay.style.display = 'none';
			this._diffOverlay.style.pointerEvents = 'none';
			this._diffOverlay.style.top = '0';
			this._diffOverlay.style.left = '0';
			this._diffOverlay.style.width = '100%';
			this._diffOverlay.style.height = '100%';
			this._editor.getDomNode()?.appendChild(this._diffOverlay);
		}
	}
}

import type { RenderResult } from '@md-view/core';
import { renderToc, trackActiveHeading } from './sidebar.js';

export interface ViewerHandle {
  /** Replace the current document (preserves scroll position when possible). */
  update(result: RenderResult, opts?: { keepScroll?: boolean }): void;
  /** Show the empty state with optional custom message / actions. */
  showEmpty(opts?: { title?: string; hint?: string; actions?: HTMLElement[] }): void;
  /** Show an error state. */
  showError(message: string): void;
}

/**
 * Render the chrome (header, sidebar, content article) into `root`.
 * Returns a handle for subsequent updates.
 *
 * Idempotent: calling mountViewer twice replaces the children.
 */
export function mountViewer(root: HTMLElement): ViewerHandle {
  root.innerHTML = `
    <div class="md-view">
      <aside class="md-view__sidebar" aria-label="Table of contents">
        <div class="md-view__brand">md.view</div>
        <nav class="md-view__toc" id="md-view-toc"></nav>
      </aside>
      <main class="md-view__main">
        <header class="md-view__header">
          <h1 class="md-view__title" id="md-view-title">md.view</h1>
        </header>
        <div class="md-view__scroll" id="md-view-scroll">
          <article class="markdown-body" id="md-view-content"></article>
        </div>
      </main>
    </div>
  `;

  const tocEl = root.querySelector<HTMLElement>('#md-view-toc')!;
  const titleEl = root.querySelector<HTMLElement>('#md-view-title')!;
  const contentEl = root.querySelector<HTMLElement>('#md-view-content')!;
  const scrollEl = root.querySelector<HTMLElement>('#md-view-scroll')!;

  let cleanupObserver: (() => void) | null = null;

  const handle: ViewerHandle = {
    update(result, opts = {}) {
      const prevScroll = opts.keepScroll ? scrollEl.scrollTop : 0;
      titleEl.textContent = result.title;
      document.title = `${result.title} — md.view`;
      contentEl.innerHTML = result.html;
      renderToc(tocEl, result.toc);
      cleanupObserver?.();
      cleanupObserver = trackActiveHeading(tocEl, contentEl);
      // Restore scroll on next frame so layout has settled.
      if (opts.keepScroll) {
        requestAnimationFrame(() => {
          scrollEl.scrollTop = prevScroll;
        });
      } else if (location.hash) {
        const target = document.getElementById(location.hash.slice(1));
        if (target) target.scrollIntoView();
      }
    },
    showEmpty(opts = {}) {
      cleanupObserver?.();
      cleanupObserver = null;
      titleEl.textContent = 'md.view';
      tocEl.innerHTML = '';
      contentEl.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'md-view__empty';
      empty.innerHTML = `
        <img class="md-view__empty-icon" src="/md-view-logo.png" alt="md.view" />
        <h2>${opts.title ?? 'No file open'}</h2>
        <p>${opts.hint ?? 'Drop a <code>.md</code> file here, or open one.'}</p>
        <div class="md-view__empty-actions"></div>
      `;
      const actionsContainer = empty.querySelector<HTMLElement>(
        '.md-view__empty-actions'
      )!;
      (opts.actions ?? []).forEach((el) => actionsContainer.appendChild(el));
      contentEl.appendChild(empty);
    },
    showError(message) {
      cleanupObserver?.();
      cleanupObserver = null;
      tocEl.innerHTML = '';
      contentEl.innerHTML = `
        <div class="md-view__error">
          <h2>Couldn't load file</h2>
          <pre>${message.replace(/</g, '&lt;')}</pre>
        </div>
      `;
    }
  };

  return handle;
}

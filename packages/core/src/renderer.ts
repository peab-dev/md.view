import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';
import type { RenderRule } from 'markdown-it/lib/renderer.mjs';
import taskLists from 'markdown-it-task-lists';
import { createHighlighter, type Highlighter } from 'shiki';
import { extractToc, type TocEntry } from './toc.js';

export interface RenderResult {
  html: string;
  toc: TocEntry[];
  title: string;
}

let highlighterPromise: Promise<Highlighter> | null = null;

/**
 * Lazy-init Shiki highlighter. Shared across calls.
 * Uses both light + dark themes so CSS can swap via `.shiki-dark` / `.shiki-light`.
 */
function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: [
        'typescript', 'javascript', 'tsx', 'jsx',
        'json', 'yaml', 'toml',
        'html', 'css', 'scss',
        'bash', 'shell', 'zsh',
        'python', 'ruby', 'go', 'rust', 'swift',
        'java', 'kotlin', 'c', 'cpp', 'csharp',
        'sql', 'graphql', 'markdown', 'diff', 'dockerfile'
      ]
    });
  }
  return highlighterPromise;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Build a configured markdown-it instance with a Shiki highlighter.
 * Awaited so the highlighter is ready when rendering happens.
 */
async function createMarkdown(): Promise<MarkdownIt> {
  const highlighter = await getHighlighter();

  const md: MarkdownIt = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: false,
    highlight: (code: string, lang: string): string => {
      try {
        if (lang && highlighter.getLoadedLanguages().includes(lang as never)) {
          // Render both themes; CSS picks one based on prefers-color-scheme.
          return highlighter.codeToHtml(code, {
            lang,
            themes: { light: 'github-light', dark: 'github-dark' },
            defaultColor: false
          });
        }
      } catch {
        /* fall through to default escape */
      }
      const escaped: string = md.utils.escapeHtml(code);
      return `<pre class="shiki"><code>${escaped}</code></pre>`;
    }
  });

  md.use(taskLists, { enabled: true, label: true });

  // Add id="" to headings so we can deep-link from the TOC.
  const slugs = new Map<string, number>();
  md.core.ruler.push('heading_ids', (state: StateCore): boolean => {
    slugs.clear();
    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i];
      if (token.type !== 'heading_open') continue;
      const inline = state.tokens[i + 1];
      if (!inline) continue;
      const text =
        inline.children
          ?.filter((c: Token) => c.type === 'text' || c.type === 'code_inline')
          .map((c: Token) => c.content)
          .join('') ?? '';
      let slug = slugify(text);
      const count = slugs.get(slug) ?? 0;
      slugs.set(slug, count + 1);
      if (count > 0) slug = `${slug}-${count}`;
      token.attrSet('id', slug);
    }
    return true;
  });

  // Open external links in a new tab/window (Mac app respects this via shell.openExternal).
  const defaultLinkOpen: RenderRule =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet('href') ?? '';
    if (/^https?:\/\//.test(href)) {
      tokens[idx].attrSet('target', '_blank');
      tokens[idx].attrSet('rel', 'noopener noreferrer');
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  return md;
}

let mdPromise: Promise<MarkdownIt> | null = null;

/**
 * Render Markdown source to HTML + TOC + best-guess title.
 * Safe to call repeatedly — parser + highlighter are cached.
 */
export async function renderMarkdown(source: string): Promise<RenderResult> {
  if (!mdPromise) mdPromise = createMarkdown();
  const md = await mdPromise;
  const html = md.render(source);
  const toc = extractToc(source);
  const title = toc.find((t) => t.level === 1)?.text ?? toc[0]?.text ?? 'Untitled';
  return { html, toc, title };
}

export type { TocEntry } from './toc.js';

export interface TocEntry {
  level: number;
  text: string;
  slug: string;
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
 * Extract headings from raw markdown so the UI can build a TOC sidebar.
 * Uses regex over source (not the rendered AST) — keeps this module
 * dependency-free and matches the slug logic in `renderer.ts`.
 *
 * Skips headings inside fenced code blocks.
 */
export function extractToc(source: string): TocEntry[] {
  const out: TocEntry[] = [];
  const lines = source.split('\n');
  const counts = new Map<string, number>();
  let inFence = false;
  let fenceChar = '';

  for (const line of lines) {
    const fenceMatch = line.match(/^(\s{0,3})(```+|~~~+)/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceChar = fenceMatch[2][0];
      } else if (fenceMatch[2][0] === fenceChar) {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;

    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].trim();
    let slug = slugify(text);
    const n = counts.get(slug) ?? 0;
    counts.set(slug, n + 1);
    if (n > 0) slug = `${slug}-${n}`;
    out.push({ level, text, slug });
  }

  return out;
}

import type { TocEntry } from '@md-view/core';

/**
 * Render the TOC into an existing `<aside>` element.
 * Headings ≥ h4 are indented but kept flat — a real tree would be visually
 * noisy and most docs don't nest that deeply.
 */
export function renderToc(target: HTMLElement, toc: TocEntry[]): void {
  if (toc.length === 0) {
    target.innerHTML = '<div class="toc-empty">No headings</div>';
    return;
  }
  const minLevel = Math.min(...toc.map((t) => t.level));
  const list = document.createElement('ul');
  list.className = 'toc-list';
  for (const entry of toc) {
    const li = document.createElement('li');
    li.className = `toc-item toc-level-${entry.level}`;
    li.style.paddingLeft = `${(entry.level - minLevel) * 0.85}rem`;
    const a = document.createElement('a');
    a.href = `#${entry.slug}`;
    a.textContent = entry.text;
    a.dataset.slug = entry.slug;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const el = document.getElementById(entry.slug);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', `#${entry.slug}`);
    });
    li.appendChild(a);
    list.appendChild(li);
  }
  target.replaceChildren(list);
}

/**
 * Attach an IntersectionObserver that highlights the currently-visible
 * heading in the sidebar. Returns a cleanup function.
 */
export function trackActiveHeading(
  sidebar: HTMLElement,
  scrollContainer: HTMLElement
): () => void {
  const headings = scrollContainer.querySelectorAll<HTMLElement>(
    'h1, h2, h3, h4, h5, h6'
  );
  if (headings.length === 0) return () => {};

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = entry.target.id;
        if (!id) continue;
        const link = sidebar.querySelector<HTMLElement>(`a[data-slug="${id}"]`);
        if (!link) continue;
        if (entry.isIntersecting) {
          sidebar.querySelectorAll('.is-active').forEach((el) =>
            el.classList.remove('is-active')
          );
          link.classList.add('is-active');
        }
      }
    },
    { rootMargin: '0px 0px -70% 0px', threshold: 0 }
  );
  headings.forEach((h) => observer.observe(h));
  return () => observer.disconnect();
}

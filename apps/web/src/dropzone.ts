/**
 * Wire up file-drop handling on `target`. The whole page is the drop
 * surface; we only react to .md/.markdown files and ignore the rest
 * so the browser's default behavior (opening other file types) stays
 * intact for the user.
 */
export function setupDropzone(
  target: HTMLElement,
  onFile: (file: File) => void | Promise<void>
): void {
  const accept = (file: File): boolean =>
    /\.(md|markdown|mdown|mkd|txt)$/i.test(file.name) ||
    file.type === 'text/markdown';

  let dragDepth = 0;

  const setDragState = (active: boolean) => {
    const root = document.querySelector('.md-view');
    if (active) root?.classList.add('is-drag-over');
    else root?.classList.remove('is-drag-over');
  };

  target.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragDepth++;
    setDragState(true);
  });

  target.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });

  target.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) setDragState(false);
  });

  target.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    setDragState(false);
    const file = e.dataTransfer?.files[0];
    if (file && accept(file)) {
      void onFile(file);
    }
  });
}

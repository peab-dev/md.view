import { mountViewer, type ViewerHandle } from '@md-view/ui';
import { renderMarkdown } from '@md-view/core';
import '@md-view/ui/styles.css';
import { setupDropzone } from './dropzone.js';
import { openWithFileSystemAccess, isFileSystemAccessSupported } from './fileAccess.js';

const root = document.getElementById('app')!;
const viewer = mountViewer(root);

let pollHandle: number | null = null;

function stopPolling(): void {
  if (pollHandle !== null) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
}

async function loadText(text: string, opts: { keepScroll?: boolean } = {}): Promise<void> {
  try {
    const result = await renderMarkdown(text);
    viewer.update(result, opts);
  } catch (err) {
    viewer.showError(String(err));
  }
}

async function loadFromUrl(url: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await loadText(await res.text());
  } catch (err) {
    viewer.showError(`Failed to load ${url}\n${err}`);
  }
}

async function loadFile(file: File): Promise<void> {
  stopPolling();
  await loadText(await file.text());
}

function showEmpty(viewer: ViewerHandle): void {
  const openBtn = document.createElement('button');
  openBtn.textContent = isFileSystemAccessSupported()
    ? 'Open file (with live reload)'
    : 'Choose file…';
  openBtn.addEventListener('click', async () => {
    if (isFileSystemAccessSupported()) {
      const handle = await openWithFileSystemAccess();
      if (!handle) return;
      stopPolling();
      const first = await handle.getFile();
      let lastMod = first.lastModified;
      await loadText(await first.text());
      pollHandle = window.setInterval(async () => {
        try {
          const f = await handle.getFile();
          if (f.lastModified === lastMod) return;
          lastMod = f.lastModified;
          await loadText(await f.text(), { keepScroll: true });
        } catch {
          stopPolling();
        }
      }, 500);
    } else {
      pickerInput.click();
    }
  });

  const pasteBtn = document.createElement('button');
  pasteBtn.className = 'is-secondary';
  pasteBtn.textContent = 'Paste from clipboard';
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) await loadText(text);
    } catch (err) {
      viewer.showError(`Could not read clipboard: ${err}`);
    }
  });

  viewer.showEmpty({
    title: 'md.view',
    hint:
      'Drop a <code>.md</code> file anywhere on this page, ' +
      'or pass <code>?url=…</code> in the URL.<br>' +
      '<small>Files stay in your browser — nothing is uploaded.</small>',
    actions: [openBtn, pasteBtn]
  });
}

// Hidden file picker (fallback for browsers without File System Access).
const pickerInput = document.createElement('input');
pickerInput.type = 'file';
pickerInput.accept = '.md,.markdown,.mdown,.mkd,text/markdown';
pickerInput.style.display = 'none';
pickerInput.addEventListener('change', () => {
  const file = pickerInput.files?.[0];
  if (file) void loadFile(file);
});
document.body.appendChild(pickerInput);

// Drag & Drop anywhere on the page.
setupDropzone(document.body, async (file) => {
  await loadFile(file);
});

// Keyboard: ⌘O / Ctrl+O → open dialog.
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
    e.preventDefault();
    if (isFileSystemAccessSupported()) {
      // Trigger the same flow as the button so polling kicks in.
      document.querySelector<HTMLButtonElement>('.md-view__empty-actions button')?.click();
    } else {
      pickerInput.click();
    }
  }
});

// Boot.
const params = new URLSearchParams(location.search);
const urlParam = params.get('url');
if (urlParam) {
  void loadFromUrl(urlParam);
} else {
  showEmpty(viewer);
}

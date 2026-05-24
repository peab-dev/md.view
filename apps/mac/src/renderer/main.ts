import { mountViewer } from '@md-view/ui';
import '@md-view/ui/styles.css';
import type { RenderResult } from '@md-view/core';

declare global {
  interface Window {
    mdView: {
      onFileLoaded(cb: (d: RenderResult & { path: string }) => void): void;
      onFileUpdated(cb: (d: RenderResult) => void): void;
      onFileError(cb: (msg: string) => void): void;
      onFileNone(cb: () => void): void;
      openDialog(): Promise<void>;
    };
  }
}

const root = document.getElementById('app')!;
const viewer = mountViewer(root);

window.mdView.onFileLoaded((data) => viewer.update(data));
window.mdView.onFileUpdated((data) => viewer.update(data, { keepScroll: true }));
window.mdView.onFileError((msg) => viewer.showError(msg));
window.mdView.onFileNone(() => {
  const openBtn = document.createElement('button');
  openBtn.textContent = 'Open file…';
  openBtn.addEventListener('click', () => void window.mdView.openDialog());
  viewer.showEmpty({
    title: 'No file open',
    hint: 'Use <strong>File → Open</strong> (⌘O), or drop a <code>.md</code> file on the app icon.',
    actions: [openBtn]
  });
});

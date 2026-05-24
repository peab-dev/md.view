/**
 * Thin wrapper around the File System Access API (Chromium-only).
 * Lets us re-read a file after the user grants access once — enabling
 * live-reload without re-prompting on every save.
 */

interface FsaFileHandle {
  getFile(): Promise<File>;
  name: string;
}

interface FsaWindow {
  showOpenFilePicker?: (opts: {
    types: { description?: string; accept: Record<string, string[]> }[];
    multiple?: boolean;
  }) => Promise<FsaFileHandle[]>;
}

export function isFileSystemAccessSupported(): boolean {
  return typeof (window as unknown as FsaWindow).showOpenFilePicker === 'function';
}

export async function openWithFileSystemAccess(): Promise<FsaFileHandle | null> {
  const w = window as unknown as FsaWindow;
  if (!w.showOpenFilePicker) return null;
  try {
    const [handle] = await w.showOpenFilePicker({
      types: [
        {
          description: 'Markdown',
          accept: { 'text/markdown': ['.md', '.markdown', '.mdown', '.mkd'] }
        }
      ],
      multiple: false
    });
    return handle ?? null;
  } catch (err) {
    // User cancelled the picker — that's not an error.
    if ((err as DOMException).name === 'AbortError') return null;
    throw err;
  }
}

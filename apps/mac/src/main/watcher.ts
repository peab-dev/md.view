import chokidar, { type FSWatcher } from 'chokidar';

/**
 * Single-file watcher with debouncing. Editors like VS Code save by
 * writing to a temp file and renaming, which fires multiple events —
 * we coalesce them into one update.
 */
export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private currentPath: string | null = null;

  watch(path: string, onChange: () => void | Promise<void>): void {
    if (this.currentPath === path && this.watcher) return;
    this.close();
    this.currentPath = path;
    this.watcher = chokidar.watch(path, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 30 }
    });
    const trigger = () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => void onChange(), 60);
    };
    this.watcher.on('change', trigger);
    this.watcher.on('add', trigger); // VS Code's atomic-rename pattern
  }

  close(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
    void this.watcher?.close();
    this.watcher = null;
    this.currentPath = null;
  }
}

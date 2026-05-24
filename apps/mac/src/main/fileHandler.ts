import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Pull a usable .md path out of argv. Electron passes us:
 *   [electron-binary, app-entry, ...userArgs]
 * so we scan from index 1 onwards and accept the first existing file.
 */
export function resolveOpenTarget(argv: readonly string[]): string | null {
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg || arg.startsWith('--')) continue;
    if (arg.endsWith('.js') || arg.endsWith('.cjs')) continue; // skip entry script
    const abs = resolve(arg);
    try {
      if (existsSync(abs) && statSync(abs).isFile()) {
        if (/\.(md|markdown|mdown|mkd|txt)$/i.test(abs)) return abs;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

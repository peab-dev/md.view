# md.view — Sample Document

This file exists to **smoke-test rendering** in both the Mac app and the browser viewer.

## Features

- Lists
- *italic* and **bold**
- ~~strikethrough~~ (GFM)
- [Links](https://github.com)
- Inline `code`

### Task lists

- [x] Set up monorepo
- [x] Build core + UI packages
- [ ] Ship to friends

## Code blocks

```typescript
import { renderMarkdown } from '@md-view/core';

const { html, toc, title } = await renderMarkdown('# Hello');
console.log(title); // → "Hello"
```

```bash
# Open from the terminal
open -a "md.view" README.md
```

## Tables

| Method        | Mac App | Web |
|---------------|---------|-----|
| Double-click  | ✅      | ❌  |
| Drag & drop   | ✅      | ✅  |
| CLI / URL     | ✅      | ✅  |
| Live reload   | ✅      | ✅* |

\* In Chromium-based browsers via the File System Access API.

## Blockquotes

> "Markdown should look the same everywhere it's rendered."
>
> — That's the whole point of sharing a core package.

## Image

![placeholder](https://via.placeholder.com/600x200)

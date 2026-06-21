# Interview Doc

Google doc to practice for SWE interviews (LeetCode-style), when you have to write code in a Google Doc with no autocomplete and no way to test it.

![A LeetCode problem screenshot pinned in the side panel next to a Python solution in the document](public/Screenshot%202026-06-22%20at%2000.31.39.png)

The interface centers on a blank document with an optional, resizable problem panel. Paste a screenshot of the problem into the panel (Cmd/Ctrl+V) or upload an image, then delete it to move on to the next question. The panel scales with the window and sits beside the document, so the problem stays in view while you write.

Syntax highlighting and local autosave run in the background. The editor does not provide code execution, autocomplete, diagnostics, bracket completion, or formatting.

## Quick start

No installation or build step is required.

### Download

Download the [latest ZIP](https://github.com/rockswe/interviewdoc/archive/refs/heads/main.zip), extract it, then open `index.html` in Chrome. Bookmark the opened page for one-click access later.

### Clone

```bash
git clone https://github.com/rockswe/interviewdoc.git
cd interviewdoc
```

Then open `index.html` directly in your browser.

### Optional local server

```bash
npm run dev
```

No `npm install` is needed. Then open [http://localhost:4173](http://localhost:4173).

Your document and the pasted screenshot are stored only in the browser's local storage.

Use the control in the bottom-right corner to change the document font size. `Cmd/Ctrl +` and `Cmd/Ctrl -` adjust it from the keyboard; `Cmd/Ctrl 0` restores the default.

The language selector supports Python, JavaScript, TypeScript, Java, C++, Go, and plain text highlighting.

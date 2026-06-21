# Interview Doc

Google doc to practice for SWE interviews (LeetCode-style), when you have to write code in a Google Doc with no autocomplete and no way to test it.

![Interview Doc showing a Python solution on a document-style page](public/Screenshot%202026-06-19%20at%2019.34.33.png)

The interface centers on a blank document with an optional, resizable problem panel. Paste a copied problem statement into the panel to preserve its title, difficulty, examples, inline code, and constraints. A source URL can be saved with the problem, but the app does not fetch or scrape the source page.

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

Your document and imported problem are stored only in the browser's local storage.

Use the control in the bottom-right corner to change the document font size. `Cmd/Ctrl +` and `Cmd/Ctrl -` adjust it from the keyboard; `Cmd/Ctrl 0` restores the default.

The language selector supports Python, JavaScript, TypeScript, Java, C++, Go, and plain text highlighting.

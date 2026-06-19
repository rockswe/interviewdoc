# Interview Doc

Google doc to practice for SWE interviews, when you have to write code in a Google Doc with no autocomplete and no way to test it.

![Interview Doc showing a Python solution on a document-style page](public/Screenshot%202026-06-19%20at%2019.34.33.png)

The interface is intentionally just a blank document. Syntax highlighting and local autosave run in the background. It does not provide code execution, autocomplete, diagnostics, bracket completion, or formatting.

## Run locally

```bash
npm run dev
```

Then open [http://localhost:4173](http://localhost:4173).

Your document is stored only in the browser's local storage.

Use the control in the bottom-right corner to change the document font size. `Cmd/Ctrl +` and `Cmd/Ctrl -` adjust it from the keyboard; `Cmd/Ctrl 0` restores the default.

The language selector supports Python, JavaScript, TypeScript, Java, C++, Go, and plain text highlighting.

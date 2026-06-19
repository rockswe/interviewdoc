const STORAGE_KEY = "interview-doc-state-v1";
const TAB = "    ";
const DEFAULT_FONT_SIZE = 15;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 28;

const elements = {
  code: document.querySelector("#code-editor"),
  fontDecrease: document.querySelector("#font-decrease"),
  fontIncrease: document.querySelector("#font-increase"),
  fontSizeDisplay: document.querySelector("#font-size-display"),
};

const PYTHON_KEYWORDS = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break",
  "case", "class", "continue", "def", "del", "elif", "else", "except", "finally",
  "for", "from", "global", "if", "import", "in", "is", "lambda", "match", "nonlocal",
  "not", "or", "pass", "raise", "return", "try", "while", "with", "yield",
]);

const PYTHON_BUILTINS = new Set([
  "abs", "all", "any", "bin", "bool", "bytearray", "bytes", "callable", "chr",
  "classmethod", "complex", "dict", "dir", "divmod", "enumerate", "eval", "filter",
  "float", "format", "frozenset", "getattr", "hasattr", "hash", "help", "hex", "id",
  "input", "int", "isinstance", "issubclass", "iter", "len", "list", "map", "max",
  "memoryview", "min", "next", "object", "oct", "open", "ord", "pow", "print",
  "property", "range", "repr", "reversed", "round", "set", "setattr", "slice",
  "sorted", "staticmethod", "str", "sum", "super", "tuple", "type", "vars", "zip",
]);

let saveTimer = null;
let fontSize = DEFAULT_FONT_SIZE;
let isComposing = false;

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function token(className, value) {
  return `<span class="token-${className}">${escapeHtml(value)}</span>`;
}

function readString(source, start) {
  let cursor = start;
  let prefixLength = 0;

  while (cursor < source.length && "rRuUbBfF".includes(source[cursor]) && prefixLength < 2) {
    cursor += 1;
    prefixLength += 1;
  }

  const quote = source[cursor];
  if (quote !== "\"" && quote !== "'") return null;

  const triple = source.slice(cursor, cursor + 3) === quote.repeat(3);
  const delimiterLength = triple ? 3 : 1;
  cursor += delimiterLength;

  while (cursor < source.length) {
    if (source[cursor] === "\\") {
      cursor += 2;
      continue;
    }

    if (source.slice(cursor, cursor + delimiterLength) === quote.repeat(delimiterLength)) {
      cursor += delimiterLength;
      return source.slice(start, cursor);
    }

    if (!triple && source[cursor] === "\n") return source.slice(start, cursor);
    cursor += 1;
  }

  return source.slice(start);
}

function highlightPython(source) {
  let output = "";
  let cursor = 0;
  let expectedDefinition = null;

  while (cursor < source.length) {
    const rest = source.slice(cursor);
    const character = source[cursor];

    if (character === "#") {
      const end = source.indexOf("\n", cursor);
      const stop = end === -1 ? source.length : end;
      output += token("comment", source.slice(cursor, stop));
      cursor = stop;
      continue;
    }

    const stringValue = readString(source, cursor);
    if (stringValue) {
      output += token("string", stringValue);
      cursor += stringValue.length;
      expectedDefinition = null;
      continue;
    }

    const decorator = rest.match(/^@[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/);
    if (decorator) {
      output += token("decorator", decorator[0]);
      cursor += decorator[0].length;
      continue;
    }

    const number = rest.match(/^(?:0[xX][\dA-Fa-f](?:_?[\dA-Fa-f])*|0[bB][01](?:_?[01])*|0[oO][0-7](?:_?[0-7])*|(?:\d(?:_?\d)*)?(?:\.\d(?:_?\d)*)?(?:[eE][+-]?\d(?:_?\d)*)?j?|\d(?:_?\d)*)/);
    if (number && number[0] && /\d/.test(number[0])) {
      output += token("number", number[0]);
      cursor += number[0].length;
      expectedDefinition = null;
      continue;
    }

    const identifier = rest.match(/^[A-Za-z_]\w*/);
    if (identifier) {
      const value = identifier[0];
      if (expectedDefinition) {
        output += token(expectedDefinition === "class" ? "class-name" : "function-name", value);
        expectedDefinition = null;
      } else if (PYTHON_KEYWORDS.has(value)) {
        output += token("keyword", value);
        expectedDefinition = value === "def" || value === "class" ? value : null;
      } else if (PYTHON_BUILTINS.has(value)) {
        output += token("builtin", value);
      } else {
        output += token("variable", value);
      }
      cursor += value.length;
      continue;
    }

    output += escapeHtml(character);
    if (!/\s/.test(character)) expectedDefinition = null;
    cursor += 1;
  }

  return output;
}

function getEditorText() {
  return elements.code.textContent || "";
}

function getSelectionOffsets() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!elements.code.contains(range.startContainer) || !elements.code.contains(range.endContainer)) {
    return null;
  }

  const startRange = range.cloneRange();
  startRange.selectNodeContents(elements.code);
  startRange.setEnd(range.startContainer, range.startOffset);

  const endRange = range.cloneRange();
  endRange.selectNodeContents(elements.code);
  endRange.setEnd(range.endContainer, range.endOffset);

  return {
    start: startRange.toString().length,
    end: endRange.toString().length,
  };
}

function findTextPosition(offset) {
  const walker = document.createTreeWalker(elements.code, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let remaining = offset;

  while (node) {
    if (remaining <= node.textContent.length) {
      return { node, offset: remaining };
    }
    remaining -= node.textContent.length;
    node = walker.nextNode();
  }

  return { node: elements.code, offset: elements.code.childNodes.length };
}

function restoreSelection(offsets) {
  if (!offsets) return;

  const textLength = getEditorText().length;
  const start = findTextPosition(Math.min(offsets.start, textLength));
  const end = findTextPosition(Math.min(offsets.end, textLength));
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function renderEditor(value, offsets = null) {
  const trailingLine = value === "" || value.endsWith("\n") ? "<br>" : "";
  elements.code.innerHTML = `${highlightPython(value)}${trailingLine}`;
  restoreSelection(offsets);
}

function applyTextChange(value, start, end = start) {
  renderEditor(value, { start, end });
  scheduleSave();
}

function insertTextAtSelection(text) {
  const offsets = getSelectionOffsets() || { start: getEditorText().length, end: getEditorText().length };
  const value = getEditorText();
  const nextValue = value.slice(0, offsets.start) + text + value.slice(offsets.end);
  const nextOffset = offsets.start + text.length;
  applyTextChange(nextValue, nextOffset);
}

function handleEditorInput() {
  if (isComposing) return;
  const offsets = getSelectionOffsets();
  renderEditor(getEditorText(), offsets);
  scheduleSave();
}

function handleEditorKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    insertTextAtSelection("\n");
    return;
  }

  if (event.key !== "Tab") return;
  event.preventDefault();

  const offsets = getSelectionOffsets() || { start: 0, end: 0 };
  const value = getEditorText();
  const lineStart = value.lastIndexOf("\n", offsets.start - 1) + 1;

  if (event.shiftKey) {
    const selectedBlock = value.slice(lineStart, offsets.end);
    const unindented = selectedBlock.replace(/^ {1,4}/gm, "");
    const beforeSelection = value.slice(lineStart, offsets.start);
    const removedBeforeStart = beforeSelection.length - beforeSelection.replace(/^ {1,4}/gm, "").length;
    const removedTotal = selectedBlock.length - unindented.length;
    const nextValue = value.slice(0, lineStart) + unindented + value.slice(offsets.end);

    applyTextChange(
      nextValue,
      Math.max(lineStart, offsets.start - removedBeforeStart),
      offsets.end - removedTotal,
    );
  } else if (offsets.start !== offsets.end && value.slice(offsets.start, offsets.end).includes("\n")) {
    const selectedBlock = value.slice(lineStart, offsets.end);
    const indented = selectedBlock.replace(/^/gm, TAB);
    const nextValue = value.slice(0, lineStart) + indented + value.slice(offsets.end);

    applyTextChange(nextValue, offsets.start + TAB.length, lineStart + indented.length);
  } else {
    insertTextAtSelection(TAB);
  }
}

function handleBeforeInput(event) {
  if (event.inputType !== "insertParagraph" && event.inputType !== "insertLineBreak") return;
  event.preventDefault();
  insertTextAtSelection("\n");
}

function handlePaste(event) {
  event.preventDefault();
  const text = event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
  insertTextAtSelection(text);
}

function applyFontSize(nextSize) {
  fontSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, nextSize));
  document.documentElement.style.setProperty("--font-size", `${fontSize}px`);
  elements.fontSizeDisplay.textContent = `${Math.round((fontSize / DEFAULT_FONT_SIZE) * 100)}%`;
  elements.fontDecrease.disabled = fontSize === MIN_FONT_SIZE;
  elements.fontIncrease.disabled = fontSize === MAX_FONT_SIZE;
}

function changeFontSize(amount) {
  applyFontSize(fontSize + amount);
  scheduleSave();
  elements.code.focus();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: getEditorText(), fontSize }));
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveState, 350);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return "";

    fontSize = Number.isFinite(saved.fontSize) ? saved.fontSize : DEFAULT_FONT_SIZE;
    return saved.code || "";
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return "";
  }
}

function handleFontSizeShortcut(event) {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return;

  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    changeFontSize(1);
  } else if (event.key === "-") {
    event.preventDefault();
    changeFontSize(-1);
  } else if (event.key === "0") {
    event.preventDefault();
    applyFontSize(DEFAULT_FONT_SIZE);
    scheduleSave();
    elements.code.focus();
  }
}

elements.code.addEventListener("input", handleEditorInput);
elements.code.addEventListener("keydown", handleEditorKeydown);
elements.code.addEventListener("beforeinput", handleBeforeInput);
elements.code.addEventListener("paste", handlePaste);
elements.code.addEventListener("drop", (event) => event.preventDefault());
elements.code.addEventListener("compositionstart", () => {
  isComposing = true;
});
elements.code.addEventListener("compositionend", () => {
  isComposing = false;
  handleEditorInput();
});
elements.fontDecrease.addEventListener("click", () => changeFontSize(-1));
elements.fontIncrease.addEventListener("click", () => changeFontSize(1));
document.addEventListener("keydown", handleFontSizeShortcut);
window.addEventListener("beforeunload", saveState);

const initialCode = loadState();
applyFontSize(fontSize);
renderEditor(initialCode);
elements.code.focus();

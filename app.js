const STORAGE_KEY = "interview-doc-state-v1";
const TAB = "    ";

const elements = {
  code: document.querySelector("#code-input"),
  highlight: document.querySelector("#highlight-layer code"),
  highlightScroller: document.querySelector("#highlight-layer"),
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

function updateEditor() {
  const value = elements.code.value;
  elements.highlight.innerHTML = `${highlightPython(value)}${value.endsWith("\n") ? " " : ""}`;
  syncScroll();
}

function syncScroll() {
  elements.highlightScroller.scrollTop = elements.code.scrollTop;
  elements.highlightScroller.scrollLeft = elements.code.scrollLeft;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: elements.code.value }));
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveState, 350);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;

    elements.code.value = saved.code || "";
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function handleCodeKeydown(event) {
  if (event.key !== "Tab") return;
  event.preventDefault();

  const { selectionStart, selectionEnd, value } = elements.code;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;

  if (event.shiftKey) {
    const selectedBlock = value.slice(lineStart, selectionEnd);
    const unindented = selectedBlock.replace(/^ {1,4}/gm, "");
    const removedBeforeStart = value.slice(lineStart, selectionStart).length
      - value.slice(lineStart, selectionStart).replace(/^ {1,4}/gm, "").length;
    const removedTotal = selectedBlock.length - unindented.length;

    elements.code.setRangeText(unindented, lineStart, selectionEnd, "start");
    elements.code.setSelectionRange(
      Math.max(lineStart, selectionStart - removedBeforeStart),
      selectionEnd - removedTotal,
    );
  } else if (selectionStart !== selectionEnd && value.slice(selectionStart, selectionEnd).includes("\n")) {
    const selectedBlock = value.slice(lineStart, selectionEnd);
    const indented = selectedBlock.replace(/^/gm, TAB);
    elements.code.setRangeText(indented, lineStart, selectionEnd, "start");
    elements.code.setSelectionRange(selectionStart + TAB.length, lineStart + indented.length);
  } else {
    elements.code.setRangeText(TAB, selectionStart, selectionEnd, "end");
  }

  updateEditor();
  scheduleSave();
}

elements.code.addEventListener("input", () => {
  updateEditor();
  scheduleSave();
});
elements.code.addEventListener("scroll", syncScroll);
elements.code.addEventListener("keydown", handleCodeKeydown);

window.addEventListener("beforeunload", saveState);

loadState();
updateEditor();

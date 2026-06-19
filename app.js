const STORAGE_KEY = "interview-doc-state-v1";
const TAB = "    ";
const DEFAULT_FONT_SIZE = 15;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 28;
const DEFAULT_LANGUAGE = "python";

const elements = {
  code: document.querySelector("#code-editor"),
  language: document.querySelector("#language-select"),
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

function words(value) {
  return new Set(value.split(/\s+/));
}

const LANGUAGE_CONFIGS = {
  javascript: {
    keywords: words("as async await break case catch class const continue debugger default delete do else export extends false finally for from function get if import in instanceof let new null of return set static super switch this throw true try typeof undefined var void while with yield"),
    builtins: words("Array BigInt Boolean Date Error JSON Map Math Number Object Promise Proxy Reflect RegExp Set String Symbol WeakMap WeakSet console document globalThis window"),
    definitions: { class: "class-name", function: "function-name" },
  },
  typescript: {
    keywords: words("abstract any as asserts async await bigint boolean break case catch class const constructor continue declare default delete do else enum export extends false finally for from function get if implements import in infer instanceof interface is keyof let module namespace never new null number object of override private protected public readonly require return satisfies set static string super switch symbol this throw true try type typeof undefined unique unknown var void while with yield"),
    builtins: words("Array Boolean Date Error JSON Map Math Number Object Promise Record RegExp Set String Symbol WeakMap WeakSet console document globalThis window"),
    definitions: { class: "class-name", enum: "class-name", function: "function-name", interface: "class-name", type: "class-name" },
  },
  java: {
    keywords: words("abstract assert boolean break byte case catch char class const continue default do double else enum extends false final finally float for goto if implements import instanceof int interface long native new null package private protected public record return short static strictfp super switch synchronized this throw throws transient true try var void volatile while"),
    builtins: words("ArrayList Arrays Boolean Character Collections Double Exception HashMap HashSet Integer Iterable List Long Map Math Object Objects Optional Set String StringBuilder System Thread"),
    definitions: { class: "class-name", enum: "class-name", interface: "class-name", record: "class-name" },
  },
  cpp: {
    keywords: words("alignas alignof and and_eq asm auto bitand bitor bool break case catch char char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq"),
    builtins: words("array cin cout deque endl list map pair priority_queue queue set size_t stack string unordered_map unordered_set vector"),
    definitions: { class: "class-name", enum: "class-name", namespace: "class-name", struct: "class-name", union: "class-name" },
    preprocessor: true,
  },
  go: {
    keywords: words("break case chan const continue default defer else fallthrough false for func go goto if import interface map nil package range return select struct switch true type var"),
    builtins: words("any append bool byte cap close complex complex128 complex64 copy delete error float32 float64 imag int int16 int32 int64 int8 len make new panic print println real recover rune string uint uint16 uint32 uint64 uint8 uintptr"),
    definitions: { func: "function-name", type: "class-name" },
  },
};

let saveTimer = null;
let fontSize = DEFAULT_FONT_SIZE;
let language = DEFAULT_LANGUAGE;
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

function readGenericString(source, start) {
  const quote = source[start];
  if (quote !== "\"" && quote !== "'" && quote !== "`") return null;

  let cursor = start + 1;
  while (cursor < source.length) {
    if (source[cursor] === "\\") {
      cursor += 2;
      continue;
    }
    if (source[cursor] === quote) return source.slice(start, cursor + 1);
    if (quote !== "`" && source[cursor] === "\n") return source.slice(start, cursor);
    cursor += 1;
  }

  return source.slice(start);
}

function highlightGeneric(source, config) {
  let output = "";
  let cursor = 0;
  let expectedDefinition = null;

  while (cursor < source.length) {
    const rest = source.slice(cursor);
    const character = source[cursor];

    if (rest.startsWith("//")) {
      const end = source.indexOf("\n", cursor);
      const stop = end === -1 ? source.length : end;
      output += token("comment", source.slice(cursor, stop));
      cursor = stop;
      continue;
    }

    if (rest.startsWith("/*")) {
      const end = source.indexOf("*/", cursor + 2);
      const stop = end === -1 ? source.length : end + 2;
      output += token("comment", source.slice(cursor, stop));
      cursor = stop;
      continue;
    }

    if (config.preprocessor && character === "#") {
      const end = source.indexOf("\n", cursor);
      const stop = end === -1 ? source.length : end;
      output += token("decorator", source.slice(cursor, stop));
      cursor = stop;
      continue;
    }

    const stringValue = readGenericString(source, cursor);
    if (stringValue) {
      output += token("string", stringValue);
      cursor += stringValue.length;
      expectedDefinition = null;
      continue;
    }

    const number = rest.match(/^(?:0[xX][\dA-Fa-f]+|0[bB][01]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
    if (number) {
      output += token("number", number[0]);
      cursor += number[0].length;
      expectedDefinition = null;
      continue;
    }

    const identifier = rest.match(/^[A-Za-z_$][\w$]*/);
    if (identifier) {
      const value = identifier[0];
      if (expectedDefinition) {
        output += token(expectedDefinition, value);
        expectedDefinition = null;
      } else if (config.keywords.has(value)) {
        output += token("keyword", value);
        expectedDefinition = config.definitions[value] || null;
      } else if (config.builtins.has(value)) {
        output += token("builtin", value);
      } else if (/^\s*\(/.test(rest.slice(value.length))) {
        output += token("function-name", value);
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

function highlightCode(source) {
  if (language === "plain") return escapeHtml(source);
  if (language === "python") return highlightPython(source);
  return highlightGeneric(source, LANGUAGE_CONFIGS[language]);
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
  elements.code.innerHTML = `${highlightCode(value)}${trailingLine}`;
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: getEditorText(), fontSize, language }));
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
    language = Object.hasOwn(LANGUAGE_CONFIGS, saved.language) || saved.language === "python" || saved.language === "plain"
      ? saved.language
      : DEFAULT_LANGUAGE;
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

function handleLanguageChange() {
  const offsets = getSelectionOffsets();
  language = elements.language.value;
  renderEditor(getEditorText(), offsets);
  scheduleSave();
  elements.code.focus();
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
elements.language.addEventListener("change", handleLanguageChange);
document.addEventListener("keydown", handleFontSizeShortcut);
window.addEventListener("beforeunload", saveState);

const initialCode = loadState();
applyFontSize(fontSize);
elements.language.value = language;
renderEditor(initialCode);
elements.code.focus();

import { useMemo, useRef } from "react";
import type { TabFile } from "../src/types";

interface Props {
  tab: TabFile;
  onChange: (content: string) => void;
  onSave: () => void;
  onCursorChange: (line: number) => void;
  /** True while the AI is streaming edits into this file */
  aiEditing?: boolean;
}

// Detect language from filename
function getLang(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "TypeScript", tsx: "TSX", js: "JavaScript", jsx: "JSX",
    rs: "Rust", py: "Python", json: "JSON", md: "Markdown",
    html: "HTML", css: "CSS", scss: "SCSS", toml: "TOML",
    yaml: "YAML", yml: "YAML", sh: "Shell", sql: "SQL",
    c: "C", cpp: "C++", go: "Go", java: "Java",
  };
  return map[ext] ?? (ext.toUpperCase() || "Plain Text");
}

/* ──────────────────────────────────────────────────────────────────────────
   Lightweight syntax tokenizer
   ────────────────────────────────────────────────────────────────────────── */

type TokenKind = "keyword" | "string" | "comment" | "number" | "fn" | "type" | "tag" | "prop" | "plain";

interface Token {
  text: string;
  kind: TokenKind;
}

const KEYWORDS = new Set([
  "if", "else", "for", "while", "do", "switch", "case", "default", "break",
  "continue", "return", "function", "const", "let", "var", "class", "extends",
  "new", "this", "super", "import", "from", "export", "default", "async",
  "await", "try", "catch", "finally", "throw", "typeof", "instanceof", "in",
  "of", "null", "undefined", "true", "false", "void", "delete", "yield",
  "static", "public", "private", "protected", "readonly", "interface", "type",
  "enum", "namespace", "declare", "abstract", "implements", "package",
  "as", "is", "keyof", "infer", "satisfies", "unknown", "never", "any",
  "string", "number", "boolean", "object", "symbol", "bigint",
]);

const KNOWN_TYPES = new Set([
  "string", "number", "boolean", "object", "symbol", "bigint",
  "undefined", "null", "void", "any", "unknown", "never", "Function",
  "Promise", "Array", "Map", "Set", "Record", "Date", "Error",
  "JSON", "Math", "console",
]);

function isKeyword(w: string): boolean {
  return KEYWORDS.has(w);
}
function isType(w: string): boolean {
  return KNOWN_TYPES.has(w) || /^[A-Z]/.test(w);
}

const STRING_RE = /^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'|^`(?:[^`\\]|\\.|\\\n)*`/;
const COMMENT_RE = /^\/\/.*|^#.*/;
const NUMBER_RE = /^\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?/;
const WORD_RE = /^[A-Za-z_$][A-Za-z0-9_$]*/;
const WS_RE = /^\s+/;
const OP_RE = /^[^\sA-Za-z0-9_$"'`#]/;

/**
 * Tokenize a block of code into colored spans. Handles:
 *  - keywords / control flow
 *  - strings (single, double, template)
 *  - line comments (// and #)
 *  - numbers
 *  - identifiers (functions & types)
 *  - JSX/HTML tags & attributes
 */
function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = code.length;

  while (i < n) {
    // Whitespace
    const ws = code.slice(i).match(WS_RE);
    if (ws) {
      tokens.push({ text: ws[0], kind: "plain" });
      i += ws[0].length;
      continue;
    }
    // Comments
    const cm = code.slice(i).match(COMMENT_RE);
    if (cm) {
      tokens.push({ text: cm[0], kind: "comment" });
      i += cm[0].length;
      continue;
    }
    // Strings
    const st = code.slice(i).match(STRING_RE);
    if (st) {
      tokens.push({ text: st[0], kind: "string" });
      i += st[0].length;
      continue;
    }
    // Numbers
    const nm = code.slice(i).match(NUMBER_RE);
    if (nm) {
      tokens.push({ text: nm[0], kind: "number" });
      i += nm[0].length;
      continue;
    }
    // JSX tags & attributes
    if (code[i] === "<") {
      // Opening tag
      const tagMatch = code.slice(i).match(/^<(\/?)([A-Za-z][\w.-]*)([^>]*)>/);
      if (tagMatch) {
        const [, slash, tagName, attrs] = tagMatch;
        tokens.push({ text: `<${slash}`, kind: "plain" });
        tokens.push({ text: tagName, kind: "tag" });
        // Parse attributes inside
        const attrRe = /([A-Za-z_][\w.-]*)(\s*=\s*)(["'][^"']*["'])?|([^>\s]+)/g;
        let am: RegExpExecArray | null;
        const attrStr = attrs;
        while ((am = attrRe.exec(attrStr)) !== null) {
          if (am[1] !== undefined) {
            tokens.push({ text: " " + am[1], kind: "prop" });
            tokens.push({ text: am[2] ?? "", kind: "plain" });
            if (am[3]) tokens.push({ text: am[3], kind: "string" });
          } else if (am[4] !== undefined) {
            tokens.push({ text: " " + am[4], kind: "plain" });
          } else {
            tokens.push({ text: " ", kind: "plain" });
          }
        }
        tokens.push({ text: ">", kind: "plain" });
        i += tagMatch[0].length;
        continue;
      }
      // Closing tag
      const closeMatch = code.slice(i).match(/^<\/([A-Za-z][\w.-]*)>/);
      if (closeMatch) {
        tokens.push({ text: "</", kind: "plain" });
        tokens.push({ text: closeMatch[1], kind: "tag" });
        tokens.push({ text: ">", kind: "plain" });
        i += closeMatch[0].length;
        continue;
      }
    }
    // Words
    const wd = code.slice(i).match(WORD_RE);
    if (wd) {
      const word = wd[0];
      if (isKeyword(word)) {
        tokens.push({ text: word, kind: "keyword" });
      } else if (isType(word)) {
        tokens.push({ text: word, kind: "type" });
      } else {
        // Check if followed by ( → function call
        const next = code[i + word.length];
        if (next === "(") {
          tokens.push({ text: word, kind: "fn" });
        } else if (i > 0 && (code[i - 1] === "." || code[i - 1] === "?")) {
          tokens.push({ text: word, kind: "prop" });
        } else {
          tokens.push({ text: word, kind: "plain" });
        }
      }
      i += word.length;
      continue;
    }
    // Symbols / operators
    const op = code.slice(i).match(OP_RE);
    if (op) {
      tokens.push({ text: op[0], kind: "plain" });
      i += op[0].length;
      continue;
    }
    // Fallback: single char
    tokens.push({ text: code[i], kind: "plain" });
    i++;
  }
  return tokens;
}

// Token → CSS color
const TOKEN_COLORS: Record<TokenKind, string> = {
  keyword: "#c678dd",   // purple
  string:  "#98c379",   // green
  comment: "#7f848e",   // gray
  number:  "#d19a66",   // orange
  fn:      "#61afef",   // blue
  type:    "#e5c07b",   // yellow
  tag:     "#e06c75",   // red
  prop:    "#d19a66",   // orange
  plain:   "#d4d4d4",   // light gray
};

function Highlighted({ code }: { code: string }) {
  const tokens = useMemo(() => tokenize(code), [code]);
  const spans = useMemo(() => {
    const out = [];
    for (const t of tokens) {
      out.push(
        <span key={t.text + out.length} style={{ color: TOKEN_COLORS[t.kind] }}>
          {t.text}
        </span>
      );
    }
    return out;
  }, [tokens]);

  return <pre className="highlight-layer">{spans}</pre>;
}

export default function Editor({ tab, onChange, onSave, onCursorChange, aiEditing }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumRef  = useRef<HTMLDivElement>(null);
  const isModified = tab.content !== tab.originalContent;
  const lineCount  = (tab.content.match(/\n/g) ?? []).length + 1;

  // Sync line numbers scroll with textarea
  const syncScroll = () => {
    if (lineNumRef.current && textareaRef.current) {
      lineNumRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Handle special keys in the editor
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;

    // Ctrl/Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      onSave();
      return;
    }

    // Tab → 2 spaces
    if (e.key === "Tab") {
      e.preventDefault();
      const start = ta.selectionStart;
      const end   = ta.selectionEnd;
      const newContent =
        tab.content.substring(0, start) + "  " + tab.content.substring(end);
      onChange(newContent);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
      return;
    }

    // Enter → auto-indent
    if (e.key === "Enter") {
      e.preventDefault();
      const start = ta.selectionStart;
      const lineStart = tab.content.lastIndexOf("\n", start - 1) + 1;
      const lineText  = tab.content.slice(lineStart, start);
      const indent    = lineText.match(/^(\s*)/)?.[1] ?? "";
      // Extra indent after { ( [
      const extraIndent = /[{([]$/.test(lineText.trim()) ? "  " : "";
      const insert = "\n" + indent + extraIndent;
      const newContent =
        tab.content.substring(0, start) + insert + tab.content.substring(ta.selectionEnd);
      onChange(newContent);
      requestAnimationFrame(() => {
        const pos = start + insert.length;
        ta.selectionStart = ta.selectionEnd = pos;
      });
      return;
    }
  };

  const handleCursorChange = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const lineNum = (tab.content.substring(0, ta.selectionStart).match(/\n/g) ?? []).length + 1;
    onCursorChange(lineNum);
  };

  // Build highlighted overlay HTML once per content change
  const highlightedCode = useMemo(() => tab.content, [tab.content]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
      {/* File header */}
      <div className="h-8 shrink-0 border-b border-zinc-800/60 flex items-center px-4 gap-2">
        <span className="text-[12px] text-zinc-500">{tab.name}</span>
        {aiEditing && (
          <span className="flex items-center gap-1.5 text-[10.5px] text-cyan-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            AI editing…
          </span>
        )}
        {isModified && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
        )}
        <span className="ml-auto text-[11px] text-zinc-700">{getLang(tab.name)}</span>
      </div>

      {/* Editor body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Line numbers */}
        <div
          ref={lineNumRef}
          aria-hidden
          className="
            select-none overflow-hidden text-right
            text-zinc-700 pr-3 pt-3 shrink-0
            text-[12px] leading-5.5 min-w14
            border-r border-zinc-800/50
          "
          style={{ overflowY: "hidden", fontFamily: "var(--font-editor)" }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="h-[22px] px-1">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code area with syntax highlighting overlay */}
        <div className="relative flex-1 overflow-hidden">
          {/* Highlighted backdrop */}
          <div
            aria-hidden
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ paddingTop: "0.75rem", paddingLeft: "1rem", fontFamily: "var(--font-editor)", fontSize: "13px", lineHeight: "22px" }}
          >
            <Highlighted code={highlightedCode} />
          </div>

          {/* Actual editable textarea (transparent text) */}
          <textarea
            ref={textareaRef}
            value={tab.content}
            onChange={(e) => onChange(e.target.value)}
            onScroll={syncScroll}
            onKeyDown={handleKeyDown}
            onSelect={handleCursorChange}
            onClick={handleCursorChange}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            className="
              absolute inset-0 bg-transparent outline-none resize-none
              text-[13px] leading-[22px] w-full h-full
            "
            style={{
              fontFamily: "var(--font-editor)",
              color: "transparent",
              caretColor: "#06b6d4",
              paddingTop: "0.75rem",
              paddingLeft: "1rem",
              paddingRight: "1rem",
              paddingBottom: "0.75rem",
              WebkitTextFillColor: "transparent",
            }}
          />
        </div>
      </div>

      <style>{`
        .highlight-layer {
          margin: 0;
          padding: 0;
          font-family: var(--font-editor);
          font-size: 13px;
          line-height: 22px;
          color: #d4d4d4;
          white-space: pre;
          word-wrap: normal;
          overflow: hidden;
        }
        .highlight-layer span {
          white-space: pre;
        }
      `}</style>
    </div>
  );
}
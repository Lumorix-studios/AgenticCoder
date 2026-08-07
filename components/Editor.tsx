import { useState, useRef, useEffect, useCallback } from "react";
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

/* ── Tokenizer ──────────────────────────────────────────────────────────── */

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

function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = code.length;

  while (i < n) {
    const ws = code.slice(i).match(WS_RE);
    if (ws) {
      tokens.push({ text: ws[0], kind: "plain" });
      i += ws[0].length;
      continue;
    }
    const cm = code.slice(i).match(COMMENT_RE);
    if (cm) {
      tokens.push({ text: cm[0], kind: "comment" });
      i += cm[0].length;
      continue;
    }
    const st = code.slice(i).match(STRING_RE);
    if (st) {
      tokens.push({ text: st[0], kind: "string" });
      i += st[0].length;
      continue;
    }
    const nm = code.slice(i).match(NUMBER_RE);
    if (nm) {
      tokens.push({ text: nm[0], kind: "number" });
      i += nm[0].length;
      continue;
    }
    if (code[i] === "<") {
      const tagMatch = code.slice(i).match(/^<(\/?)([A-Za-z][\w.-]*)([^>]*)>/);
      if (tagMatch) {
        const [, slash, tagName, attrs] = tagMatch;
        tokens.push({ text: `<${slash}`, kind: "plain" });
        tokens.push({ text: tagName, kind: "tag" });
        const attrRe = /([A-Za-z_][\w.-]*)(\s*=\s*)(["'][^"']*["'])?|([^>\s]+)/g;
        let am: RegExpExecArray | null;
        while ((am = attrRe.exec(attrs)) !== null) {
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
      const closeMatch = code.slice(i).match(/^<\/([A-Za-z][\w.-]*)>/);
      if (closeMatch) {
        tokens.push({ text: "</", kind: "plain" });
        tokens.push({ text: closeMatch[1], kind: "tag" });
        tokens.push({ text: ">", kind: "plain" });
        i += closeMatch[0].length;
        continue;
      }
    }
    const wd = code.slice(i).match(WORD_RE);
    if (wd) {
      const word = wd[0];
      if (isKeyword(word)) {
        tokens.push({ text: word, kind: "keyword" });
      } else if (isType(word)) {
        tokens.push({ text: word, kind: "type" });
      } else {
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
    const op = code.slice(i).match(OP_RE);
    if (op) {
      tokens.push({ text: op[0], kind: "plain" });
      i += op[0].length;
      continue;
    }
    tokens.push({ text: code[i], kind: "plain" });
    i++;
  }
  return tokens;
}

const TOKEN_COLORS: Record<TokenKind, string> = {
  keyword: "#c678dd",
  string:  "#98c379",
  comment: "#7f848e",
  number:  "#d19a66",
  fn:      "#61afef",
  type:    "#e5c07b",
  tag:     "#e06c75",
  prop:    "#d19a66",
  plain:   "#d4d4d4",
};

const FAM = "var(--font-editor)";
const PAD_TOP = 12;
const PAD_LEFT = 16;

/* ── Component ──────────────────────────────────────────────────────────── */

export default function Editor({ tab, onChange, onSave, onCursorChange, aiEditing }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const isModified = tab.content !== tab.originalContent;
  const lineCount = (tab.content.match(/\n/g) ?? []).length + 1;

  // Memoize handlers to avoid re-creating on every render
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      onSave();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      onChange(tab.content.slice(0, start) + "  " + tab.content.slice(end));
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2; });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const start = ta.selectionStart;
      const lineStart = tab.content.lastIndexOf("\n", start - 1) + 1;
      const lineText = tab.content.slice(lineStart, start);
      const indent = lineText.match(/^(\s*)/)?.[1] ?? "";
      const extra = /[{([]$/.test(lineText.trim()) ? "  " : "";
      const ins = "\n" + indent + extra;
      onChange(tab.content.slice(0, start) + ins + tab.content.slice(ta.selectionEnd));
      requestAnimationFrame(() => {
        const pos = start + ins.length;
        ta.selectionStart = ta.selectionEnd = pos;
      });
      return;
    }
  }, [tab.content, onChange, onSave]);

  const handleCursorChange = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const ln = (tab.content.slice(0, ta.selectionStart).match(/\n/g) ?? []).length + 1;
    onCursorChange(ln);
  }, [tab.content, onCursorChange]);

  // The textarea IS the single scroll element. onScroll keeps the line-number
  // gutter and the (behind) highlight layer aligned.
  const syncScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (lineNumRef.current) lineNumRef.current.scrollTop = ta.scrollTop;
    if (highlightRef.current) highlightRef.current.scrollTop = ta.scrollTop;
  }, []);

  useEffect(() => { syncScroll(); }, [tab.content, syncScroll]);

  // Tokenize on content change with rAF to avoid blocking typing
  const [tokens, setTokens] = useState<Token[]>([]);
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setTokens(tokenize(tab.content));
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [tab.content]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
      {/* Header */}
      <div className="h-8 shrink-0 border-b border-zinc-800/60 flex items-center px-4 gap-2">
        <span className="text-[12px] text-zinc-500 truncate" title={tab.name}>{tab.name}</span>
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

      {/* Body — min-h-0 lets flex children shrink below content height so the
          textarea stays height-bounded and scrolls instead of growing the page. */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Line numbers (scrollTop synced to textarea) */}
        <div
          ref={lineNumRef}
          aria-hidden="true"
          className="select-none text-right text-zinc-700 pr-3 pt-[12px] shrink-0
                     text-[12px] leading-[22px] min-w-[2.25rem] border-r border-zinc-800/50
                     overflow-hidden"
          style={{ height: "100%", fontFamily: FAM, fontSize: "13px", lineHeight: "22px" }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="h-[22px] px-1">{i + 1}</div>
          ))}
        </div>

        {/* Code area. Container is overflow-hidden; the textarea below is the
            ONLY scroll element. */}
        <div className="relative flex-1 overflow-hidden min-h-0">
          {/* Highlighted backdrop — scrollTop synced, never own scrollbar */}
          <div
            ref={highlightRef}
            aria-hidden="true"
            className="absolute inset-0 whitespace-pre overflow-hidden pointer-events-none text-[13px] leading-[22px] text-[#d4d4d4]"
            style={{
              fontFamily: FAM,
              paddingTop: `${PAD_TOP}px`,
              paddingLeft: `${PAD_LEFT}px`,
              paddingRight: "24px",
              boxSizing: "border-box",
            }}
          >
            {tokens.map((t, idx) => (
              <span key={idx} style={{ color: TOKEN_COLORS[t.kind] }}>
                {t.text}
              </span>
            ))}
          </div>

          {/* Editable transparent textarea — THE scroll element */}
          <textarea
            ref={textareaRef}
            value={tab.content}
            onChange={(e) => onChange(e.target.value)}
            onScroll={syncScroll}
            onClick={handleCursorChange}
            onSelect={handleCursorChange}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            readOnly={!!aiEditing}
            className="absolute inset-0 bg-transparent outline-none text-[13px] leading-[22px] resize-none"
            style={{
              fontFamily: FAM,
              fontSize: "13px",
              lineHeight: "22px",
              color: "transparent",
              WebkitTextFillColor: "transparent",
              caretColor: "#06b6d4",
              paddingTop: `${PAD_TOP}px`,
              paddingLeft: `${PAD_LEFT}px`,
              paddingRight: "24px",
              paddingBottom: "0px",
              boxSizing: "border-box",
              height: "100%",
              width: "100%",
              overflow: "auto",
              resize: "none",
            }}
          />
        </div>
      </div>
    </div>
  );
}

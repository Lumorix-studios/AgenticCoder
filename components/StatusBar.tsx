import type { Tab } from "../src/types";

interface Props {
  activeFile: Tab | null;
  isModified: boolean;
  line: number;
  chatOpen: boolean;
  onToggleChat: () => void;
  folderPath: string;
}

function getLang(name: string): string {
  const ext = name?.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "TypeScript", tsx: "TSX", js: "JavaScript", jsx: "JSX",
    rs: "Rust", py: "Python", json: "JSON", md: "Markdown",
    html: "HTML", css: "CSS", scss: "SCSS", toml: "TOML",
    yaml: "YAML", yml: "YAML", sh: "Shell", sql: "SQL",
    c: "C", cpp: "C++", go: "Go",
  };
  return map[ext] ?? (ext ? ext.toUpperCase() : "Plain Text");
}

export default function StatusBar({ activeFile, isModified, line, chatOpen, onToggleChat, folderPath }: Props) {
  const lang = activeFile && "name" in activeFile ? getLang(activeFile.name) : "";
  const lineCount = activeFile && "content" in activeFile ? (activeFile.content.match(/\n/g) ?? []).length + 1 : 0;

  return (
    <div className="h-6 bg-zinc-900 border-t border-zinc-800 flex items-center px-3 gap-3 flex-shrink-0 text-[11px]">

      {/* Left */}
      <div className="flex items-center gap-3 flex-1 overflow-hidden text-zinc-500">
        {activeFile ? (
          <>
            {isModified && (
              <span className="text-amber-400 font-medium flex-shrink-0">●&nbsp;Modified</span>
            )}
            {!isModified && activeFile && (
              <span className="text-green-500 flex-shrink-0">✓&nbsp;Saved</span>
            )}
            {"path" in activeFile && (
              <span className="truncate text-zinc-600">{activeFile.path.replace(/\\/g, "/")}</span>
            )}
          </>
        ) : folderPath ? (
          <span className="text-zinc-600 truncate">{folderPath}</span>
        ) : (
          <span className="text-zinc-700">No folder open</span>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3 shrink-0 text-zinc-500">
        {activeFile && (
          <>
            <span>Ln {line}, {lineCount} lines</span>
            <span className="text-zinc-400 font-medium">{lang}</span>
          </>
        )}
        <button
          onClick={onToggleChat}
          title="Toggle AI Chat (Ctrl+B)"
          className={`
            flex items-center gap-1 px-2 py-0.5 rounded transition-colors
            ${chatOpen
              ? "bg-cyan-500/20 text-cyan-400"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            }
          `}
        >
          ◎ AI
        </button>
      </div>
    </div>
  );
}

import { useState } from "react";
import type { FileEntry } from "../src/types";

interface Props {
  tree: FileEntry[];
  selectedPath: string | null;
  onFileSelect: (path: string) => void;
  onRename:     (path: string) => void;
  onDelete:     (path: string) => void;
}

// Map extension → badge + colour
function fileBadge(ext: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    ts:   { label: "TS",  cls: "text-blue-400 bg-blue-950/60" },
    tsx:  { label: "TX",  cls: "text-blue-400 bg-blue-950/60" },
    js:   { label: "JS",  cls: "text-yellow-400 bg-yellow-950/60" },
    jsx:  { label: "JX",  cls: "text-yellow-400 bg-yellow-950/60" },
    rs:   { label: "RS",  cls: "text-orange-400 bg-orange-950/60" },
    py:   { label: "PY",  cls: "text-sky-400 bg-sky-950/60" },
    json: { label: "{}",  cls: "text-yellow-300 bg-yellow-950/40" },
    md:   { label: "MD",  cls: "text-zinc-400 bg-zinc-800" },
    html: { label: "HT",  cls: "text-orange-400 bg-orange-950/60" },
    css:  { label: "CS",  cls: "text-blue-300 bg-blue-950/40" },
    scss: { label: "SC",  cls: "text-pink-400 bg-pink-950/60" },
    toml: { label: "TM",  cls: "text-orange-300 bg-orange-950/40" },
    yaml: { label: "YM",  cls: "text-green-400 bg-green-950/60" },
    yml:  { label: "YM",  cls: "text-green-400 bg-green-950/60" },
    svg:  { label: "SV",  cls: "text-green-300 bg-green-950/40" },
    env:  { label: "EV",  cls: "text-green-400 bg-green-950/40" },
    lock: { label: "LK",  cls: "text-zinc-600 bg-zinc-800" },
    sh:   { label: "SH",  cls: "text-green-300 bg-green-950/40" },
    sql:  { label: "SQ",  cls: "text-purple-400 bg-purple-950/40" },
  };
  return map[ext] ?? { label: "  ", cls: "text-zinc-600" };
}

interface TreeNodeProps {
  entry: FileEntry;
  depth: number;
  expanded: Set<string>;
  selectedPath: string | null;
  onToggle: (path: string) => void;
  onFileClick: (path: string) => void;
  contextTarget: string | null;
  setContextTarget: (p: string | null) => void;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
}

function TreeNode({
  entry, depth, expanded, selectedPath,
  onToggle, onFileClick,
  contextTarget, setContextTarget, onRename, onDelete,
}: TreeNodeProps) {
  const isOpen = expanded.has(entry.path);
  const isSelected = selectedPath === entry.path;
  const isCtx = contextTarget === entry.path;
  const indent = depth * 12;
  const badge = entry.is_dir ? null : fileBadge(entry.extension);

  return (
    <>
      <div
        className={`
          flex items-center gap-1.5 h-7 cursor-pointer
          hover:bg-zinc-800/80 transition-colors relative
          ${isSelected ? "bg-zinc-800 text-white" : "text-zinc-300"}
          ${isCtx ? "bg-zinc-700" : ""}
        `}
        style={{ paddingLeft: indent + 8 }}
        onClick={() => entry.is_dir ? onToggle(entry.path) : onFileClick(entry.path)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextTarget(entry.path);
        }}
      >
        {/* Folder arrow */}
        {entry.is_dir ? (
          <span className="text-zinc-600 w-3 flex-shrink-0 text-[9px]">
            {isOpen ? "▼" : "▶"}
          </span>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}

        {/* Icon */}
        {entry.is_dir ? (
          <span className="text-base flex-shrink-0 leading-none">
            {isOpen ? "📂" : "📁"}
          </span>
        ) : (
          badge && (
            <span
              className={`
                text-[9px] font-bold w-6 flex-shrink-0 text-center
                rounded px-0.5 leading-4 ${badge.cls}
              `}
            >
              {badge.label}
            </span>
          )
        )}

        <span className="text-[13px] truncate flex-1 leading-none">
          {entry.name}
        </span>
      </div>

      {/* Context menu */}
      {isCtx && (
        <div
          className="absolute left-1/2 z-50 w-40 bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden"
          style={{ marginTop: -4 }}
          onMouseLeave={() => setContextTarget(null)}
        >
          <button
            className="w-full text-left text-[12px] px-3 py-1.5 hover:bg-zinc-700 text-zinc-200"
            onClick={() => { onRename(entry.path); setContextTarget(null); }}
          >
            Rename
          </button>
          <button
            className="w-full text-left text-[12px] px-3 py-1.5 hover:bg-red-900/40 text-red-400"
            onClick={() => { onDelete(entry.path); setContextTarget(null); }}
          >
            Delete
          </button>
        </div>
      )}

      {/* Children */}
      {entry.is_dir && isOpen && entry.children.map((child: FileEntry) => (
        <TreeNode
          key={child.path}
          entry={child}
          depth={depth + 1}
          expanded={expanded}
          selectedPath={selectedPath}
          onToggle={onToggle}
          onFileClick={onFileClick}
          contextTarget={contextTarget}
          setContextTarget={setContextTarget}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

export default function FileExplorer({ tree, selectedPath, onFileSelect, onRename, onDelete }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [contextTarget, setContextTarget] = useState<string | null>(null);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden py-1 relative"
      onClick={() => contextTarget && setContextTarget(null)}
    >
      {tree.length === 0 ? (
        <div className="px-3 py-6 text-[12px] text-zinc-600 text-center">
          Empty folder
        </div>
      ) : (
        tree.map((entry) => (
          <TreeNode
            key={entry.path}
            entry={entry}
            depth={0}
            expanded={expanded}
            selectedPath={selectedPath}
            onToggle={toggle}
            onFileClick={onFileSelect}
            contextTarget={contextTarget}
            setContextTarget={setContextTarget}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );
}

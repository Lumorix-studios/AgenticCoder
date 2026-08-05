import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import TopMenu from "../components/TopMenu";
import FileExplorer from "../components/FileExplorer.tsx";
import Editor from "../components/Editor.tsx";
import ChatSidebar from "../components/ChatSidebar.tsx";
import StatusBar from "../components/StatusBar.tsx";
import type { TabFile, FileEntry, AISettings } from "./types";
import "./editor.css";

const DEFAULT_AI_SETTINGS: AISettings = {
  apiUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
};

function loadAISettings(): AISettings {
  try {
    const raw = localStorage.getItem("tauri-editor-ai");
    if (raw) return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_AI_SETTINGS;
}

export default function App() {
  const [tabs, setTabs] = useState<TabFile[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileEntry[]>([]);
  const [folderPath, setFolderPath] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [aiSettings, setAISettings] = useState<AISettings>(loadAISettings);
  const [cursorLine, setCursorLine] = useState(1);
  const activeTabRef = useRef<TabFile | null>(null);

  const activeTab = tabs.find((t) => t.path === activeTabPath) ?? null;

  // Keep ref in sync with active tab (outside render)
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Persist AI settings
  useEffect(() => {
    localStorage.setItem("tauri-editor-ai", JSON.stringify(aiSettings));
  }, [aiSettings]);

  // ── File operations ──────────────────────────────────────────────────────
  const openTab = useCallback(async (path: string, contentOverride?: string) => {
    // Already open — just activate
    if (tabs.some((t) => t.path === path)) {
      setActiveTabPath(path);
      return;
    }
    const content = contentOverride ?? (await invoke<string>("read_file", { path }));
    const name = path.replace(/\\/g, "/").split("/").pop() ?? path;
    setTabs((prev) => [...prev, { path, name, content, originalContent: content }]);
    setActiveTabPath(path);
  }, [tabs]);

  const closeTab = useCallback((path: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === path);
      const newTabs = prev.filter((t) => t.path !== path);
      if (activeTabPath === path) {
        setActiveTabPath(newTabs[Math.min(idx, newTabs.length - 1)]?.path ?? null);
      }
      return newTabs;
    });
  }, [activeTabPath]);

  const updateContent = (path: string, content: string) => {
    setTabs((prev) => prev.map((t) => (t.path === path ? { ...t, content } : t)));
  };

  const saveActiveFile = useCallback(async () => {
    const tab = activeTabRef.current;
    if (!tab) return;
    try {
      await invoke("save_file", { path: tab.path, content: tab.content });
      setTabs((prev) =>
        prev.map((t) => (t.path === tab.path ? { ...t, originalContent: t.content } : t))
      );
    } catch (e) {
      console.error("Save failed:", e);
    }
  }, []);

  const refreshTree = useCallback(async () => {
    if (!folderPath) return;
    const tree = await invoke<FileEntry[]>("read_folder_tree", { path: folderPath });
    setFileTree(tree);
  }, [folderPath]);

  useEffect(() => {
    if (folderPath) {
      const load = async () => {
        const tree = await invoke<FileEntry[]>("read_folder_tree", { path: folderPath });
        setFileTree(tree);
      };
      load();
    }
  }, [folderPath]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveActiveFile();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setChatOpen((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "w") {
        e.preventDefault();
        if (activeTabRef.current) closeTab(activeTabRef.current.path);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [saveActiveFile, closeTab]);

  const isModified = (tab: TabFile) => tab.content !== tab.originalContent;

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden select-none">
      {/* ── Top menu bar ──────────────────────────────────────────── */}
      <TopMenu
        folderPath={folderPath}
        activeFile={activeTab}
        onFolderOpen={({ path, tree }) => {
          setFolderPath(path);
          setFileTree(tree);
          setTabs([]);
          setActiveTabPath(null);
        }}
        onFileOpen={({ path, content, name }) => {
          if (tabs.some((t) => t.path === path)) {
            setActiveTabPath(path);
            return;
          }
          setTabs((prev) => [...prev, { path, name, content, originalContent: content }]);
          setActiveTabPath(path);
        }}
        onSaveActive={saveActiveFile}
        onSaveAsActive={async () => {
          const tab = activeTabRef.current;
          if (!tab) return;
          const dest = await save({ defaultPath: tab.name });
          if (dest) {
            await invoke("save_file", { path: dest, content: tab.content });
          }
        }}
        onNewFile={async () => {
          if (!folderPath) return;
          const name = window.prompt("New file name:");
          if (!name) return;
          const newPath = `${folderPath}/${name}`;
          try {
            await invoke("create_file", { path: newPath });
            await refreshTree();
            openTab(newPath, "");
          } catch (e) {
            alert(String(e));
          }
        }}
        onNewFolder={async () => {
          if (!folderPath) return;
          const name = window.prompt("New folder name:");
          if (!name) return;
          try {
            await invoke("create_folder", { path: `${folderPath}/${name}` });
            await refreshTree();
          } catch (e) {
            alert(String(e));
          }
        }}
        onRefreshTree={refreshTree}
      />

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* File explorer */}
        {folderPath && (
          <div className="w-56 shrink-0 border-r border-zinc-800 overflow-hidden flex flex-col">
            <div className="h-8 flex items-center px-3 border-b border-zinc-800">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 truncate">
                {folderPath.replace(/\\/g, "/").split("/").pop() ?? folderPath}
              </span>
            </div>
            <FileExplorer
              tree={fileTree}
              selectedPath={activeTabPath}
              onFileSelect={(path) => openTab(path)}
              onRename={async (path) => {
                const name = path.replace(/\\/g, "/").split("/").pop() ?? "";
                const newName = window.prompt("Rename to:", name);
                if (!newName || newName === name) return;
                const dir = path.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
                try {
                  await invoke("rename_path", { oldPath: path, newPath: `${dir}/${newName}` });
                  await refreshTree();
                } catch (e) { alert(String(e)); }
              }}
              onDelete={async (path) => {
                const name = path.replace(/\\/g, "/").split("/").pop();
                if (!window.confirm(`Delete "${name}"?`)) return;
                try {
                  await invoke("delete_path", { path });
                  await refreshTree();
                  closeTab(path);
                } catch (e) { alert(String(e)); }
              }}
            />
          </div>
        )}

        {/* Editor column */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Tab bar */}
          {tabs.length > 0 && (
            <div className="h-9 shrink-0 flex items-end border-b border-zinc-800 bg-zinc-900 overflow-x-auto">
              {tabs.map((tab) => (
                <div
                  key={tab.path}
                  onClick={() => setActiveTabPath(tab.path)}
                  className={`
                    group h-full flex items-center gap-1.5 px-4 text-[12px] font-medium
                    border-r border-zinc-800 cursor-pointer shrink-0 relative
                    ${tab.path === activeTabPath
                      ? "bg-zinc-950 text-zinc-100"
                      : "bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                    }
                  `}
                >
                  {tab.path === activeTabPath && (
                    <span className="absolute top-0 left-0 right-0 h-px bg-cyan-400" />
                  )}
                  <span className="truncate max-w-35">{tab.name}</span>
                  {isModified(tab) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.path); }}
                    className="opacity-0 group-hover:opacity-100 ml-0.5 text-zinc-500 hover:text-zinc-200 w-4 h-4 flex items-center justify-center rounded hover:bg-zinc-700 shrink-0"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Editor or empty state */}
          {activeTab ? (
            <Editor
              tab={activeTab}
              onChange={(content) => updateContent(activeTab.path, content)}
              onSave={saveActiveFile}
              onCursorChange={setCursorLine}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-700 gap-3">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              <div className="text-center">
                <p className="text-sm">No file open</p>
                <p className="text-xs mt-1">Open a folder or file from the menu</p>
              </div>
            </div>
          )}
        </div>

        {/* Chat sidebar */}
        <div
          className={`
            shrink-0 border-l border-zinc-800 overflow-hidden
            transition-all duration-200
            ${chatOpen ? "w-80" : "w-0"}
          `}
        >
          {chatOpen && (
            <ChatSidebar
              activeFile={activeTab}
              settings={aiSettings}
              onSettingsChange={setAISettings}
              onClose={() => setChatOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Status bar */}
      <StatusBar
        activeFile={activeTab}
        isModified={activeTab ? isModified(activeTab) : false}
        line={cursorLine}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((v) => !v)}
        folderPath={folderPath}
      />
    </div>
  );
}

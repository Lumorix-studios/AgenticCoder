import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import TopMenu from "../components/TopMenu";
import FileExplorer from "../components/FileExplorer.tsx";
import Editor from "../components/Editor.tsx";
import ChatSidebar from "../components/ChatSidebar.tsx";
import SplitText from "../components/SplitText.tsx";
import InfoPanel from "../components/InfoPanel";

import StatusBar from "../components/StatusBar.tsx";
import type { FileEntry, AISettings, AIEdit, Tab, TabFile } from "./types";
import { loadAISettings, saveAISettings, resolveEditPath } from "./ai";
import "./editor.css";

const handleAnimationComplete = () => {
  console.log('All letters have animated!');
};

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileEntry[]>([]);
  const [folderPath, setFolderPath] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [aiSettings, setAISettings] = useState<AISettings>({
    provider: "openai",
    apiUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "",
    authMode: "bearer",
    customHeaders: "",
    anthropic: false,
    extraBody: "",
  });
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false);
  const [forceAISettings, setForceAISettings] = useState(false);
  const [cursorLine, setCursorLine] = useState(1);
  const [aiEdits, setAiEdits] = useState<AIEdit[]>([]);
  const [aiEditingPaths, setAiEditingPaths] = useState<Set<string>>(new Set());
  const activeTabRef = useRef<Tab | null>(null);
  const tabsRef = useRef<Tab[]>([]);
  const folderPathRef = useRef(folderPath);

  const activeTab = tabs.find((t) => 
    "path" in t ? t.path === activeTabPath : "id" in t && t.id === activeTabPath
  ) as Tab | null;

  // Keep refs in sync (outside render)
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    folderPathRef.current = folderPath;
  }, [folderPath]);

  // Load AI settings from the per-app JSON config file once on startup
  useEffect(() => {
    let cancelled = false;
    loadAISettings().then((s) => {
      if (!cancelled) {
        setAISettings(s);
        setAiSettingsLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Persist AI settings to the per-app JSON config file
  useEffect(() => {
    if (!aiSettingsLoaded) return;
    saveAISettings(aiSettings);
  }, [aiSettings, aiSettingsLoaded]);

  // ── File operations 
  const openTab = useCallback(async (path: string, contentOverride?: string) => {
    // Already open — just activate
    if (tabsRef.current.some((t) => "path" in t && t.path === path)) {
      setActiveTabPath(path);
      return;
    }
    const content = contentOverride ?? (await invoke<string>("read_file", { path }));
    const name = path.replace(/\\/g, "/").split("/").pop() ?? path;
    setTabs((prev) => [...prev, { path, name, content, originalContent: content }]);
    setActiveTabPath(path);
  }, []);

  const closeTab = useCallback((pathOrId: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => "path" in t ? t.path === pathOrId : "id" in t && t.id === pathOrId);
      const newTabs = prev.filter((t) => "path" in t ? t.path !== pathOrId : "id" in t && t.id !== pathOrId);
      setActiveTabPath((cur) => {
        if (cur === pathOrId) {
          const nextTab = newTabs[Math.min(idx, newTabs.length - 1)];
          return nextTab ? ("path" in nextTab ? nextTab.path : nextTab.id) : null;
        }
        return cur;
      });
      return newTabs;
    });
  }, []);

  const updateContent = useCallback((path: string, content: string) => {
    setTabs((prev) => prev.map((t) => ("path" in t && t.path === path ? { ...t, content } : t)));
  }, []);

  const saveActiveFile = useCallback(async () => {
    const tab = activeTabRef.current;
    if (!tab || !("path" in tab)) return;
    const tabFile = tab as TabFile;
    try {
      await invoke("save_file", { path: tabFile.path, content: tabFile.content });
      setTabs((prev) =>
        prev.map((t) => ("path" in t && t.path === tab.path ? { ...t, originalContent: t.content } : t))
      );
    } catch (e) {
      console.error("Save failed:", e);
    }
  }, []);

  const refreshTree = useCallback(async () => {
    if (!folderPathRef.current) return;
    const tree = await invoke<FileEntry[]>("read_folder_tree", { path: folderPathRef.current });
    setFileTree(tree);
  }, []);

  useEffect(() => {
    if (folderPath) {
      const load = async () => {
        const tree = await invoke<FileEntry[]>("read_folder_tree", { path: folderPath });
        setFileTree(tree);
      };
      load();
    }
  }, [folderPath]);

  // ── Real-time AI edits 
  /**
   * Apply (or update) a file edit produced by the AI. The change is written
   * straight into the open tab so the user sees it live, then saved to disk.
   */
  const applyAIEdit = useCallback(async (edit: AIEdit) => {
    const folder = folderPathRef.current;
    if (!folder) {
      setAiEdits((prev) =>
        prev.map((e) =>
          e.id === edit.id ? { ...e, status: "error", error: "No folder is open" } : e
        )
      );
      return;
    }
    const absPath = resolveEditPath(edit.path, folder);
    if (!absPath) {
      setAiEdits((prev) =>
        prev.map((e) =>
          e.id === edit.id ? { ...e, status: "error", error: "Missing path" } : e
        )
      );
      return;
    }

    // Mark this path as being edited by the AI (live indicator)
    setAiEditingPaths((prev) => new Set(prev).add(absPath));

    // If the file is already open, update it live in the editor
    const existing = tabsRef.current.find((t) => "path" in t && t.path === absPath);
    if (existing) {
      setTabs((prev) =>
        prev.map((t) => ("path" in t && t.path === absPath ? { ...t, content: edit.content } : t))
      );
      setActiveTabPath(absPath);
    } else {
      // Open it so the user sees the AI's work appear in real time
      const name = absPath.replace(/\\/g, "/").split("/").pop() ?? absPath;
      setTabs((prev) => [...prev, { path: absPath, name, content: edit.content, originalContent: edit.content }]);
      setActiveTabPath(absPath);
    }

    // Persist to disk (creates parent dirs automatically)
    try {
      await invoke("save_file", { path: absPath, content: edit.content });
      setTabs((prev) =>
        prev.map((t) => ("path" in t && t.path === absPath ? { ...t, originalContent: t.content } : t))
      );
      setAiEdits((prev) =>
        prev.map((e) => (e.id === edit.id ? { ...e, status: "applied" } : e))
      );
      // Refresh tree so new files appear in the explorer
      refreshTree();
    } catch (e) {
      setAiEdits((prev) =>
        prev.map((ed) =>
          ed.id === edit.id ? { ...ed, status: "error", error: String(e) } : ed
        )
      );
    } finally {
      setAiEditingPaths((prev) => {
        const next = new Set(prev);
        next.delete(absPath);
        return next;
      });
    }
  }, [refreshTree]);

  /**Called by ChatSidebar when the AI emits a new/updated edit block.*/
  const handleAIEditBlocks = useCallback(async (blocks: { path: string; content: string; complete: boolean }[]) => {
    for (const block of blocks) {
      if (!block.path) continue;
      const editId = `ai-${block.path}`;
      // Use functional updates to avoid stale closures on aiEdits
      setAiEdits((prev) => {
        const existing = prev.find((e) => e.id === editId);
        if (existing && existing.status === "applied" && existing.content === block.content) {
          return prev; // no change
        }
        const edit: AIEdit = {
          id: editId,
          path: block.path,
          content: block.content,
          status: "pending",
        };
        const idx = prev.findIndex((e) => e.id === editId);
        if (idx === -1) return [...prev, edit];
        const copy = [...prev];
        copy[idx] = { ...copy[idx], content: block.content, status: "pending" };
        return copy;
      });
      // Apply live (debounced per path to avoid excessive disk writes)
      await applyAIEdit({ id: editId, path: block.path, content: block.content, status: "pending" });
    }
  }, [applyAIEdit]);

  // ── Keyboard shortcuts 
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
        if (activeTabRef.current) {
          if ("path" in activeTabRef.current) {
            closeTab(activeTabRef.current.path);
          } else if ("id" in activeTabRef.current) {
            closeTab(activeTabRef.current.id);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [saveActiveFile, closeTab]);

  const isModified = useCallback((tab: Tab) => "content" in tab ? tab.content !== tab.originalContent : false, []);

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden select-none">
      {/* ── Top menu bar ───── */}
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
          if (tabs.some((t) => "path" in t && t.path === path)) {
            setActiveTabPath(path);
            return;
          }
          setTabs((prev) => [...prev, { path, name, content, originalContent: content }]);
          setActiveTabPath(path);
        }}
        onSaveActive={saveActiveFile}
        onSaveAsActive={async () => {
          const tab = activeTabRef.current;
          if (!tab || !("path" in tab)) return;
          const tabFile = tab as TabFile;
          const dest = await save({ defaultPath: tabFile.name });
          if (dest) {
            await invoke("save_file", { path: dest, content: tabFile.content });
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
        onOpenAISettings={() => {
          setChatOpen(true);
          setForceAISettings(true);
        }}
        onOpenInfoPanel={() => setInfoPanelOpen(true)}
      />

      {/* ── Info Panel Overlay ───── */}
      <InfoPanel isOpen={infoPanelOpen} onClose={() => setInfoPanelOpen(false)} />

      {/* ── Main area ──────── */}
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

        {/* Editor column/ the big text frame thingy lol */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Tab bar */}
          {tabs.length > 0 && (
            <div className="h-9 shrink-0 flex items-end border-b border-zinc-800 bg-zinc-900 overflow-x-auto">
              {tabs.map((tab) => (
                <div
                  key={"path" in tab ? tab.path : tab.id}
                  onClick={() => setActiveTabPath("path" in tab ? tab.path : tab.id)}
                  className={`
                    group h-full flex items-center gap-1.5 px-4 text-[12px] font-medium
                    border-r border-zinc-800 cursor-pointer shrink-0 relative
                    ${("path" in tab ? tab.path : tab.id) === activeTabPath
                      ? "bg-zinc-950 text-zinc-100"
                      : "bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                    }
                  `}
                >
                  {("path" in tab ? tab.path : tab.id) === activeTabPath && (
                    <span className="absolute top-0 left-0 right-0 h-px bg-cyan-400" />
                  )}
                  <span className="truncate max-w-35">{tab.name}</span>
                  {"path" in tab && aiEditingPaths.has(tab.path) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" title="AI is editing this file" />
                  )}
                  {isModified(tab) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  )}
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if ("path" in tab) {
                        closeTab(tab.path);
                      } else if ("id" in tab) {
                        closeTab(tab.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 ml-0.5 text-zinc-500 hover:text-zinc-200 w-4 h-4 flex items-center justify-center rounded hover:bg-zinc-700 shrink-0"
                  >
                    {"path" in tab ? "×" : ""}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Editor or empty state */}
          {activeTab ? (
            "path" in activeTab ? (
              <Editor
                tab={activeTab}
                onChange={(content) => updateContent(activeTab.path, content)}
                onSave={saveActiveFile}
                onCursorChange={setCursorLine}
                aiEditing={aiEditingPaths.has(activeTab.path)}
              />
            ) : (
              /* Special tab content (Information, Settings, etc.) */
              <div className="flex-1 overflow-auto p-6">
                {activeTab.type === "information" && (
                  <div className="max-w-2xl">
                    <h2 className="text-xl font-semibold text-zinc-100 mb-4">Information</h2>
                    <div className="space-y-3 text-sm text-zinc-400">
                      <p>This is an example of a special tab. You can create your own tabs like this!</p>
                      <p>To add more special tabs, follow the pattern in TopMenu.tsx and App.tsx.</p>
                      <div className="mt-4 p-4 bg-zinc-900 rounded border border-zinc-800">
                        <h3 className="text-zinc-200 font-medium mb-2">How it works:</h3>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Add a new type in the SpecialTab interface</li>
                          <li>Create a callback in TopMenuProps</li>
                          <li>Handle the tab opening in App.tsx</li>
                          <li>Add content rendering based on tab type</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
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
                <SplitText
                  text="Welcome !"
                  className="text-2xl font-semibold text-center text-amber-50"
                  delay={50}
                  duration={1.25}
                  ease="power3.out"
                  splitType="chars"
                  from={{ opacity: 0, y: 40 }}
                  to={{ opacity: 1, y: 0 }}
                  threshold={0.1}
                  rootMargin="-100px"
                  repeatInterval={6}
                  textAlign="center"
                  onLetterAnimationComplete={handleAnimationComplete}
                />
                  <p className="font-semibold">
                    Open a file/folder to start
                  </p>
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
              forceSettings={forceAISettings}
              onForceSettingsHandled={() => setForceAISettings(false)}
              folderPath={folderPath}
              aiEdits={aiEdits}
              onAIEditBlocks={handleAIEditBlocks}
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
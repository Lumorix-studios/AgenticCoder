import { useState, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { FileEntry, Tab } from "../src/types";
import FluidGlass from './FluidGlass'

interface TopMenuProps {
  folderPath: string;
  activeFile: Tab | null;
  onFolderOpen: (data: { path: string; tree: FileEntry[] }) => void;
  onFileOpen:   (data: { path: string; content: string; name: string }) => void;
  onSaveActive: () => void;
  onSaveAsActive: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRefreshTree: () => void;
  onOpenAISettings: () => void;
  onOpenInfoPanel: () => void;
}

interface MenuDef {
  label: string;
  items: { label: string; action: () => void; shortcut?: string; disabled?: boolean }[];
}

export default function TopMenu({
  folderPath, activeFile,
  onFolderOpen, onFileOpen,
  onSaveActive, onSaveAsActive,
  onNewFile, onNewFolder, onRefreshTree,
  onOpenAISettings,
  onOpenInfoPanel,
}: TopMenuProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  async function handleOpenFolder() {
    const folder = await open({ directory: true, multiple: false });
    if (!folder) return;
    const tree = await invoke<FileEntry[]>("read_folder_tree", { path: folder as string });
    onFolderOpen({ path: folder as string, tree });
    setOpenMenu(null);
  }

  async function handleOpenFile() {
    const file = await open({ multiple: false, directory: false });
    if (!file) return;
    const path = file as string;
    const content = await invoke<string>("read_file", { path });
    const name = path.replace(/\\/g, "/").split("/").pop() ?? path;
    onFileOpen({ path, content, name });
    setOpenMenu(null);
  }
  const menus: MenuDef[] = [
    {
      label: "File",
      items: [
        { label: "Open Folder…",   action: handleOpenFolder, shortcut: "Ctrl+K" },
        { label: "Open File…",     action: handleOpenFile,   shortcut: "Ctrl+O" },
        { label: "New File",       action: onNewFile,        disabled: !folderPath },
        { label: "New Folder",     action: onNewFolder,      disabled: !folderPath },
        { label: "Save",           action: onSaveActive,     shortcut: "Ctrl+S",  disabled: !activeFile },
        { label: "Save As…",       action: onSaveAsActive,   shortcut: "Ctrl+Shift+S", disabled: !activeFile },
        { label: "Refresh Tree",   action: onRefreshTree,    disabled: !folderPath },
      ],
    },
    {
      label: "Settings",
      items: [
        { label: "Agent config settings", action: onOpenAISettings },
        { label: "Information", action: onOpenInfoPanel },
      ],
    },
   
    {
      label: "Agent",
      items: [
        {
          label: "Toggle AI Chat",
          action: () => { document.dispatchEvent(new KeyboardEvent("keydown", { ctrlKey: true, key: "b", bubbles: true })); },
          shortcut: "Ctrl+B",
        },
      ],
    },
  ];

  // Close on outside click
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <nav
      ref={menuRef}
      className="h-8 bg-zinc-900 border-b border-zinc-800 flex items-center px-2 flex-shrink-0 z-50 relative"
      data-tauri-drag-region
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ height: '32px', overflow: 'hidden' }}>
        <FluidGlass 
            mode="bar"
            barProps={{
              scale: 1.2,
              ior: 1.5,
              thickness: 2,
              chromaticAberration: 0.2,
              transmission: 1,
              roughness: 0,
              anisotropy: 0.01
            }}
        />
      </div>
      <div className="relative flex items-center gap-1">
        {menus.map((menu) => (
          <div className="relative">
            <button
            onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
            className={`
              px-3 py-1 text-[13px] rounded hover:bg-zinc-800 transition-colors
              ${openMenu === menu.label ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-100"}
            `}
          >
            {menu.label}
          </button>

          {openMenu === menu.label && (
            <div className="absolute top-full left-0 mt-px w-52 bg-zinc-900 border border-zinc-700/80 rounded-lg shadow-xl overflow-hidden z-50">
              {menu.items.map((item, i) => (
                <button
                  key={i}
                  disabled={item.disabled}
                  onClick={() => { item.action(); setOpenMenu(null); }}
                  className="
                    w-full flex items-center justify-between
                    px-3 py-1.5 text-[13px]
                    hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed
                    text-left text-zinc-300 hover:text-zinc-100
                    transition-colors
                  "
                >
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <span className="text-[11px] text-zinc-600 ml-4">{item.shortcut}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      </div>

      {/* Breadcrumb */}
      {activeFile && "path" in activeFile && (
        <span className="ml-4 text-[11px] text-zinc-600 truncate max-w-xs">
          {activeFile.path.replace(/\\/g, "/")}
        </span>
      )}
    </nav>
  );
}
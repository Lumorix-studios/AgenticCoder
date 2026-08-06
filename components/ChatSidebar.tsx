import { useState, useRef, useEffect } from "react";
import type { ChatMessage, AISettings, TabFile, AIEdit, AuthMode } from "../src/types";
import { PROVIDER_PRESETS, streamChat, testConnection, getAIConfigPath } from "../src/ai";

interface Props {
  activeFile: TabFile | null;
  settings: AISettings;
  onSettingsChange: (s: AISettings) => void;
  onClose: () => void;
  forceSettings?: boolean;
  onForceSettingsHandled?: () => void;
  folderPath: string;
  aiEdits: AIEdit[];
  onAIEditBlocks: (blocks: { path: string; content: string; complete: boolean }[]) => void;
}

function getLang(name: string): string {
  const ext = name?.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    rs: "rust", py: "python", json: "json", md: "markdown",
    html: "html", css: "css", sh: "bash", toml: "toml",
  };
  return map[ext] ?? (ext || "text");
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  // Render code blocks
  const parts = msg.content.split(/(```[\w]*\n[\s\S]*?```)/g);

  return (
    <div className={`flex flex-col gap-0.5 ${isUser ? "items-end" : "items-start"}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 px-1">
        {isUser ? "You" : "AI"}
      </span>
      <div
        className={`
          max-w-full rounded-xl px-3 py-2 text-[12.5px] leading-relaxed
          ${isUser
            ? "bg-cyan-500/10 border border-cyan-500/20 text-zinc-200"
            : "bg-zinc-800/60 border border-zinc-700/40 text-zinc-200"
          }
        `}
      >
        {parts.map((part: string, i: number) => {
          const codeMatch = part.match(/^```(\w*)\n([\s\S]*?)```$/);
          if (codeMatch) {
            return (
              <pre
                key={i}
                className="
                  bg-zinc-900 border border-zinc-700/60 rounded-lg
                  p-2 mt-2 mb-1 overflow-x-auto text-[11.5px] leading-[1.55]
                  text-zinc-200 whitespace-pre
                "
                style={{ fontFamily: "var(--font-editor)" }}
              >
                <code>{codeMatch[2]}</code>
              </pre>
            );
          }
          return (
            <span key={i} className="whitespace-pre-wrap">
              {part.split(/(`[^`]+`)/g).map((s: string, j: number) => {
                if (s.startsWith("`") && s.endsWith("`")) {
                  return (
                    <code key={j}
                      className="bg-zinc-900 border border-zinc-700/40 rounded px-1 text-[11.5px] text-cyan-300"
                      style={{ fontFamily: "var(--font-editor)" }}
                    >
                      {s.slice(1, -1)}
                    </code>
                  );
                }
                return <span key={j}>{s}</span>;
              })}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Small card showing a file the AI edited */
function EditCard({ edit }: { edit: AIEdit }) {
  const name = edit.path.replace(/\\/g, "/").split("/").pop() ?? edit.path;
  const statusColor =
    edit.status === "applied" ? "text-emerald-400" :
    edit.status === "error" ? "text-red-400" : "text-cyan-400";
  const statusLabel =
    edit.status === "applied" ? "✓ applied" :
    edit.status === "error" ? "✗ error" : "… editing";
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/40">
      <span className={`text-[10.5px] font-semibold ${statusColor} shrink-0`}>{statusLabel}</span>
      <span className="text-[11.5px] text-zinc-300 font-mono truncate" title={edit.path}>{name}</span>
      {edit.error && <span className="text-[10px] text-red-400 truncate ml-auto">{edit.error}</span>}
    </div>
  );
}

export default function ChatSidebar({
  activeFile, settings, onSettingsChange, onClose,
  forceSettings, onForceSettingsHandled,
  folderPath, aiEdits, onAIEditBlocks,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [configPath, setConfigPath] = useState("");
  const [draftSettings, setDraftSettings] = useState<AISettings>(settings);
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [testMsg, setTestMsg] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load where the per-app JSON config file lives (for display in settings)
  useEffect(() => {
    getAIConfigPath().then(setConfigPath).catch(() => {});
  }, []);

  // Open settings panel when triggered from the menu
  useEffect(() => {
    if (forceSettings) {
      setShowSettings(true);
      onForceSettingsHandled?.();
    }
  }, [forceSettings, onForceSettingsHandled]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Keep draft in sync when settings change externally
  useEffect(() => {
    setDraftSettings(settings);
  }, [settings]);

  const saveSettings = () => {
    onSettingsChange(draftSettings);
    setShowSettings(false);
  };

  const clearChat = () => {
    if (!isStreaming) setMessages([]);
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
  };

  const applyPreset = (presetId: string) => {
    const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setDraftSettings((prev) => ({
      ...prev,
      provider: preset.id,
      apiUrl: preset.apiUrl,
      anthropic: preset.anthropic,
      authMode: preset.authMode,
      model: preset.models[0] ?? prev.model,
    }));
  };

  const runTest = async () => {
    setTestState("testing");
    setTestMsg("");
    try {
      const msg = await testConnection(draftSettings);
      setTestState("ok");
      setTestMsg(msg);
    } catch (e) {
      setTestState("fail");
      setTestMsg((e as Error).message);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;
    if (!settings.apiKey && settings.authMode !== "none") { setShowSettings(true); return; }

    const userText = input.trim();
    setInput("");

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: userText };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setIsStreaming(true);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const lang = activeFile ? getLang(activeFile.name) : "";
      const systemContent = activeFile
        ? `You are an expert coding assistant. The user is editing "${activeFile.name}".\n\nCurrent file (${lang}):\n\`\`\`${lang}\n${activeFile.content.slice(0, 8000)}\n\`\`\`\n\nAnswer concisely. Use markdown and code blocks where appropriate.`
        : "You are an expert coding assistant. Answer questions clearly and concisely. Use markdown and code blocks.";

      await streamChat({
        settings,
        messages: newMsgs,
        folderPath,
        activeFileName: activeFile?.name,
        systemPrompt: systemContent,
        signal: controller.signal,
        handlers: {
          onDelta: (delta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + delta } : m
              )
            );
          },
          onEditBlocks: (blocks) => {
            // Forward live edit blocks to App so they appear in the editor in real time
            onAIEditBlocks(blocks.map((b) => ({ path: b.path, content: b.content, complete: b.complete })));
          },
          onError: (err) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: `Error: ${err.message}` }
                  : m
              )
            );
          },
        },
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content + "\n\n_[stopped]_" }
              : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Error: ${(err as Error).message}` }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Settings panel ────────────────────────────────────────────────────────
  if (showSettings) {
    return (
      <div className="w-full h-full flex flex-col bg-zinc-900">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <span className="text-[13px] font-semibold text-zinc-200">AI Settings</span>
          <button
            onClick={() => setShowSettings(false)}
            className="text-zinc-500 hover:text-zinc-200 text-lg leading-none"
          >×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Provider preset */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Provider</label>
            <select
              value={draftSettings.provider}
              onChange={(e) => applyPreset(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-[13px] text-zinc-200 outline-none focus:border-cyan-500"
            >
              {PROVIDER_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* API Key */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              API Key {draftSettings.authMode === "none" && <span className="text-zinc-600 normal-case">(not required for this provider)</span>}
            </label>
            <input
              type="password"
              value={draftSettings.apiKey}
              onChange={(e) => setDraftSettings((p: AISettings) => ({ ...p, apiKey: e.target.value }))}
              placeholder={draftSettings.authMode === "none" ? "optional" : "sk-…"}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-[13px] text-zinc-200 outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          {/* Base URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Base URL</label>
            <input
              value={draftSettings.apiUrl}
              onChange={(e) => setDraftSettings((p: AISettings) => ({ ...p, apiUrl: e.target.value }))}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-[13px] text-zinc-200 outline-none focus:border-cyan-500 font-mono"
            />
            <div className="flex gap-1.5 flex-wrap mt-1">
              {PROVIDER_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className={`text-[10.5px] px-2 py-0.5 rounded-full border transition-colors ${
                    draftSettings.provider === p.id
                      ? "border-cyan-600 text-cyan-400 bg-cyan-500/10"
                      : "border-zinc-700 text-zinc-400 hover:border-cyan-600 hover:text-cyan-400"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Model</label>
            <input
              value={draftSettings.model}
              onChange={(e) => setDraftSettings((p: AISettings) => ({ ...p, model: e.target.value }))}
              list="model-list"
              placeholder={PROVIDER_PRESETS.find((p) => p.id === draftSettings.provider)?.modelPlaceholder ?? "model"}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-[13px] text-zinc-200 outline-none focus:border-cyan-500 font-mono"
            />
            <datalist id="model-list">
              {PROVIDER_PRESETS.find((p) => p.id === draftSettings.provider)?.models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          {/* Auth mode */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Auth Method</label>
            <div className="flex gap-1.5">
              {([
                { id: "bearer", label: "Bearer" },
                { id: "x-api-key", label: "x-api-key" },
                { id: "none", label: "None" },
              ] as { id: AuthMode; label: string }[]).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setDraftSettings((p: AISettings) => ({ ...p, authMode: m.id }))}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                    draftSettings.authMode === m.id
                      ? "border-cyan-600 text-cyan-400 bg-cyan-500/10"
                      : "border-zinc-700 text-zinc-400 hover:border-cyan-600 hover:text-cyan-400"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom headers */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Custom Headers <span className="text-zinc-600 normal-case">(JSON)</span>
            </label>
            <textarea
              value={draftSettings.customHeaders}
              onChange={(e) => setDraftSettings((p: AISettings) => ({ ...p, customHeaders: e.target.value }))}
              placeholder='{ "HTTP-Referer": "https://example.com", "X-Title": "AgenticCoder" }'
              rows={2}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-[12px] text-zinc-200 outline-none focus:border-cyan-500 font-mono resize-none"
            />
          </div>

          {/* Extra body */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Extra Body Fields <span className="text-zinc-600 normal-case">(JSON)</span>
            </label>
            <textarea
              value={draftSettings.extraBody}
              onChange={(e) => setDraftSettings((p: AISettings) => ({ ...p, extraBody: e.target.value }))}
              placeholder='{ "temperature": 0.7 }'
              rows={2}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-[12px] text-zinc-200 outline-none focus:border-cyan-500 font-mono resize-none"
            />
          </div>

          {/* Test connection */}
          <div className="flex flex-col gap-1.5">
            <button
              onClick={runTest}
              disabled={testState === "testing"}
              className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 font-semibold text-[13px] rounded-lg px-4 py-2 transition-colors border border-zinc-700"
            >
              {testState === "testing" ? "Testing…" : "Test Connection"}
            </button>
            {testState === "ok" && (
              <p className="text-[11px] text-emerald-400">{testMsg}</p>
            )}
            {testState === "fail" && (
              <p className="text-[11px] text-red-400 break-words">{testMsg}</p>
            )}
          </div>

          <button
            onClick={saveSettings}
            className="mt-2 bg-amber-300 hover:bg-cyan-400 text-zinc-950 font-semibold text-[13px] rounded-lg px-4 py-2 transition-colors"
          >
            Save Settings
          </button>

          {/* Config file location */}
          {configPath && (
            <div className="flex flex-col gap-1 mt-2">
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Config File <span className="text-zinc-600 normal-case">(stored locally, per app install)</span>
              </label>
              <p className="text-[10.5px] text-zinc-500 font-mono break-all bg-zinc-800/40 border border-zinc-800 rounded-lg px-2 py-1.5">
                {configPath}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Chat panel ───────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col bg-zinc-900">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 flex-shrink-0">
        <span className="text-[13px] font-semibold text-zinc-200 flex-1">AI Chat</span>
        {activeFile && (
          <span className="text-[10.5px] text-zinc-600 truncate max-w-[100px]" title={activeFile.name}>
            {activeFile.name}
          </span>
        )}
        <button
          onClick={() => setShowSettings(true)}
          className="text-zinc-600 hover:text-zinc-300 text-[13px] px-1"
          title="Settings"
        >⚙</button>
        <button
          onClick={clearChat}
          disabled={isStreaming}
          className="text-zinc-600 hover:text-zinc-300 text-[11px] px-1 disabled:opacity-40"
          title="Clear chat"
        >↺</button>
        <button
          onClick={onClose}
          className="text-zinc-600 hover:text-zinc-200 px-1 text-lg leading-none"
        >×</button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-700 gap-2 pt-8">
            <span className="text-2xl">◎</span>
            <p className="text-[12px] text-center">
              {activeFile
                ? `Ask anything about ${activeFile.name}`
                : "Open a file, then ask questions about it"}
            </p>
            <p className="text-[10.5px] text-zinc-800 text-center max-w-[220px]">
              The AI can create & edit files live — just ask it to change something.
            </p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}

        {/* AI edit cards */}
        {aiEdits.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 px-1">
              File edits
            </span>
            {aiEdits.map((edit) => (
              <EditCard key={edit.id} edit={edit} />
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 p-3 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? "Waiting…" : "Ask about this code…"}
            rows={1}
            className="
              flex-1 bg-zinc-800 border border-zinc-700 rounded-lg
              px-3 py-2 text-[13px] text-zinc-200 placeholder-zinc-600
              outline-none focus:border-cyan-500 resize-none leading-relaxed
              max-h-32 overflow-y-auto
            "
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="
                bg-red-500 hover:bg-red-400
                text-zinc-950 font-bold rounded-lg px-3 py-2 text-[13px]
                transition-colors flex-shrink-0 h-9
              "
              title="Stop generating"
            >
              ■
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="
                bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40
                text-zinc-950 font-bold rounded-lg px-3 py-2 text-[13px]
                transition-colors flex-shrink-0 h-9
              "
            >
              ↑
            </button>
          )}
        </div>
        <p className="text-[10.5px] text-zinc-700 mt-1.5">
          Enter to send · Shift+Enter for newline
          {isStreaming && <span className="text-cyan-500"> · streaming…</span>}
        </p>
      </div>
    </div>
  );
}
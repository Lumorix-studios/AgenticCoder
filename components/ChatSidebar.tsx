import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  AIEdit,
  AISettings,
  AuthMode,
  ChatMessage,
  Tab,
} from "../src/types";
import {
  getAIConfigPath,
  PROVIDER_PRESETS,
  streamChat,
  streamAgentChat,
  testConnection,
} from "../src/ai";
import type { ToolCall, ToolResult } from "../src/types";
import type { AgentStreamHandlers } from "../src/ai";
import {
  IoArrowUp,
  IoCheckmark,
  IoChevronDown,
  IoClose,
  IoCodeSlash,
  IoCopyOutline,
  IoRefresh,
  IoSettingsOutline,
  IoSparklesOutline,
  IoStop,
  IoExtensionPuzzle,
} from "react-icons/io5";

interface Props {
  activeFile: Tab | null;
  settings: AISettings;
  onSettingsChange: (settings: AISettings) => void;
  onClose: () => void;
  forceSettings?: boolean;
  onForceSettingsHandled?: () => void;
  folderPath: string;
  aiEdits: AIEdit[];
  onAIEditBlocks: (
    blocks: { path: string; content: string; complete: boolean }[],
  ) => void;
}

function fileName(path = "") {
  return path.replace(/\\/g, "/").split("/").pop() || path;
}

function language(name = "") {
  const extension = name.split(".").pop()?.toLowerCase();

  const languages: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    rs: "rust",
    json: "json",
    css: "css",
    html: "html",
    md: "markdown",
    sh: "bash",
  };

  return languages[extension || ""] || extension || "text";
}

function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-[#777873] transition hover:bg-white/[0.06] hover:text-[#f1f1eb]"
    >
      {children}
    </button>
  );
}

function CodeBlock({
  languageName,
  code,
}: {
  languageName: string;
  code: string;
}) {
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-white/[0.08] bg-[#0c0d0c]">
      <div className="flex h-8 items-center justify-between border-b border-white/[0.07] px-3">
        <span className="font-mono text-[10px] text-[#777873]">
          {languageName || "code"}
        </span>

        <button
          type="button"
          aria-label="Copy code"
          onClick={() => navigator.clipboard?.writeText(code)}
          className="text-[#666761] transition hover:text-[#d8d8d0]"
        >
          <IoCopyOutline size={13} />
        </button>
      </div>

      <pre className="overflow-x-auto px-3 py-3 font-mono text-[11px] leading-5 text-[#d7e7dd]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Message({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const parts = message.content.split(/(```[\w-]*\n[\s\S]*?```)/g);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] text-[13px] leading-6 ${
          isUser
            ? "rounded-xl rounded-br-sm bg-[#d9f5e5] px-3.5 py-2.5 text-[#17201a]"
            : "text-[#d7d8d1]"
        }`}
      >
        {parts.map((part, index) => {
          const match = part.match(/^```([\w-]*)\n([\s\S]*?)```$/);

          if (match) {
            return (
              <CodeBlock
                key={index}
                languageName={match[1]}
                code={match[2]}
              />
            );
          }

          return (
            <span key={index} className="whitespace-pre-wrap">
              {part.split(/(`[^`]+`)/g).map((segment, childIndex) => {
                if (segment.startsWith("`") && segment.endsWith("`")) {
                  return (
                    <code
                      key={childIndex}
                      className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-[11px] text-[#b8e7c9]"
                    >
                      {segment.slice(1, -1)}
                    </code>
                  );
                }

                return <span key={childIndex}>{segment}</span>;
              })}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function EditList({ edits }: { edits: AIEdit[] }) {
  if (!edits.length) return null;

  return (
    <div className="mt-4 space-y-1.5 border-t border-white/[0.07] pt-4">
      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[#777873]">
        <IoCodeSlash size={12} />
        Changed files
      </div>

      {edits.map((edit) => {
        const applied = edit.status === "applied";
        const failed = edit.status === "error";

        return (
          <div
            key={edit.id}
            className="flex items-center gap-2 rounded-md border border-white/[0.07] px-2.5 py-2"
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full ${
                applied
                  ? "bg-[#bdf1ce]/15 text-[#a8e8bc]"
                  : failed
                    ? "bg-red-300/10 text-red-300"
                    : "bg-[#c9f2d6]/10 text-[#c9f2d6]"
              }`}
            >
              {applied ? (
                <IoCheckmark size={12} />
              ) : (
                <IoCodeSlash size={11} />
              )}
            </span>

            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#c6c8c0]">
              {fileName(edit.path)}
            </span>

            <span
              className={`text-[9px] uppercase tracking-wider ${
                applied
                  ? "text-[#9cdbad]"
                  : failed
                    ? "text-red-300"
                    : "text-[#a9dcb7]"
              }`}
            >
              {applied ? "applied" : failed ? "error" : "editing"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ToolCallBubble({ toolCall }: { toolCall: ToolCall }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-white/[0.08] bg-[#1a1b1a] px-3 py-2.5 mb-2">
      <IoExtensionPuzzle size={14} className="text-[#c9f2d6] shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-mono text-[#c9f2d6]">{toolCall.name}</span>
          <span className="text-[#555751]">with args:</span>
        </div>
        <pre className="mt-1 max-h-24 overflow-y-auto font-mono text-[10px] text-[#a0a29c]">
          {toolCall.arguments}
        </pre>
      </div>
    </div>
  );
}

function ToolResultBubble({ result }: { result: ToolResult }) {
  const hasError = !!result.error;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-white/[0.08] bg-[#131412] px-3 py-2.5 mb-2">
      <div className="flex h-4 w-4 items-center justify-center rounded bg-[#bdf1ce]/10 shrink-0 mt-0.5">
        {hasError ? (
          <IoClose size={10} className="text-red-400" />
        ) : (
          <IoCheckmark size={10} className="text-[#a8e8bc]" />
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="font-mono text-[#777873]">
            {result.toolCallId}
          </span>
          {hasError && (
            <span className="text-red-400">error</span>
          )}
        </div>
        <pre className="mt-1 max-h-32 overflow-y-auto font-mono text-[10px] text-[#a0a29c] whitespace-pre-wrap">
          {hasError ? result.error : result.output}
        </pre>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-[#777873]">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function ChatSidebar({
  activeFile,
  settings,
  onSettingsChange,
  onClose,
  forceSettings,
  onForceSettingsHandled,
  folderPath,
  aiEdits,
  onAIEditBlocks,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [draftSettings, setDraftSettings] = useState(settings);
  const [configPath, setConfigPath] = useState("");
  const [testState, setTestState] = useState<
    "idle" | "testing" | "ok" | "fail"
  >("idle");
  const [testMessage, setTestMessage] = useState("");
  const [agentMode, setAgentMode] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [toolResults, setToolResults] = useState<ToolResult[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getAIConfigPath().then(setConfigPath).catch(() => {});
  }, []);

  useEffect(() => {
    if (!forceSettings) return;

    setShowSettings(true);
    onForceSettingsHandled?.();
  }, [forceSettings, onForceSettingsHandled]);

  useEffect(() => {
    setDraftSettings(settings);
  }, [settings]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiEdits, toolCalls, toolResults]);

  const saveSettings = () => {
    onSettingsChange(draftSettings);
    setShowSettings(false);
  };

  const clearChat = () => {
    if (!isStreaming) setMessages([]);
  };

  const applyPreset = (providerId: string) => {
    const preset = PROVIDER_PRESETS.find(
      (provider) => provider.id === providerId,
    );

    if (!preset) return;

    setDraftSettings((previous) => ({
      ...previous,
      provider: preset.id,
      apiUrl: preset.apiUrl,
      anthropic: preset.anthropic,
      authMode: preset.authMode,
      model: preset.models[0] || previous.model,
    }));
  };

  const runConnectionTest = async () => {
    setTestState("testing");
    setTestMessage("");

    try {
      const result = await testConnection(draftSettings);
      setTestState("ok");
      setTestMessage(result);
    } catch (error) {
      setTestState("fail");
      setTestMessage((error as Error).message);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    if (!settings.apiKey && settings.authMode !== "none") {
      setShowSettings(true);
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };

    const assistantId = crypto.randomUUID();
    const nextMessages = [...messages, userMessage];

    setMessages([
      ...nextMessages,
      {
        id: assistantId,
        role: "assistant",
        content: "",
      },
    ]);
    setInput("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const activeLanguage =
      activeFile && "name" in activeFile ? language(activeFile.name) : "";

    const systemPrompt =
      activeFile && "content" in activeFile
        ? `You are an expert coding assistant. The user is editing "${activeFile.name}".

Current file:
\`\`\`${activeLanguage}
${activeFile.content.slice(0, 8000)}
\`\`\`

Be concise. Prefer direct edits and actionable code.`
        : "You are an expert coding assistant. Be concise and practical. Use markdown and code blocks when useful.";

    try {
      if (agentMode) {
        // ── Agent mode with tool calling ──
        const handlers: AgentStreamHandlers = {
          onDelta: (delta) => {
            setMessages((previous) =>
              previous.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + delta }
                  : message,
              ),
            );
          },
          onToolCall: (tc) => {
            setToolCalls((prev) => {
              const exists = prev.find((t) => t.id === tc.id);
              if (exists) {
                return prev.map((t) =>
                  t.id === tc.id
                    ? { ...t, arguments: t.arguments + tc.arguments, name: tc.name || t.name }
                    : t
                );
              }
              return [...prev, tc];
            });
          },
          onToolResult: (result) => {
            setToolResults((prev) => [...prev, result]);
          },
          onFileChange: (path, content) => {
            // Notify parent that a file was changed by the agent
            onAIEditBlocks([{ path, content, complete: true }]);
          },
          onDone: (full) => {
            setMessages((previous) =>
              previous.map((message) =>
                message.id === assistantId
                  ? { ...message, content: full }
                  : message,
              ),
            );
          },
          onError: (error) => {
            setMessages((previous) =>
              previous.map((message) =>
                message.id === assistantId
                  ? { ...message, content: `Error: ${error.message}` }
                  : message,
              ),
            );
          },
        };

        await streamAgentChat({
          settings,
          messages: nextMessages,
          folderPath,
          handlers,
          signal: controller.signal,
        });
      } else {
        // ── Regular chat mode ──
        await streamChat({
          settings,
          messages: nextMessages,
          folderPath,
          activeFileName: activeFile?.name,
          systemPrompt,
          signal: controller.signal,
          handlers: {
            onDelta: (delta) => {
              setMessages((previous) =>
                previous.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: message.content + delta }
                    : message,
                ),
              );
            },
            onEditBlocks: (blocks) => {
              onAIEditBlocks(
                blocks.map((block) => ({
                  path: block.path,
                  content: block.content,
                  complete: block.complete,
                })),
              );
            },
            onError: (error) => {
              setMessages((previous) =>
                previous.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: `Error: ${error.message}` }
                    : message,
                ),
              );
            },
          },
        });
      }
    } catch (error) {
      const message = error as Error;

      setMessages((previous) =>
        previous.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                content:
                  message.name === "AbortError"
                    ? `${item.content}\n\n_generation stopped_`
                    : `Error: ${message.message}`,
              }
            : item,
        ),
      );
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  if (showSettings) {
    return (
      <div className="flex h-full w-full flex-col bg-[#10110f] text-[#f1f1eb]">
        <header className="flex items-center border-b border-white/[0.08] px-4 py-3">
          <div className="flex-1">
            <div className="text-[13px] font-semibold">Settings</div>
            <div className="mt-0.5 text-[10px] text-[#777873]">
              Configure your model connection
            </div>
          </div>

          <IconButton
            label="Close settings"
            onClick={() => setShowSettings(false)}
          >
            <IoClose size={17} />
          </IconButton>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <Field label="Provider">
            <div className="relative">
              <select
                value={draftSettings.provider}
                onChange={(event) => applyPreset(event.target.value)}
                className="w-full appearance-none rounded-lg border border-white/[0.1] bg-white/[0.045] px-3 py-2.5 pr-8 text-[12px] text-[#e3e4dc] outline-none focus:border-[#bdf1ce]/40"
              >
                {PROVIDER_PRESETS.map((provider) => (
                  <option
                    key={provider.id}
                    value={provider.id}
                    className="bg-[#10110f]"
                  >
                    {provider.label}
                  </option>
                ))}
              </select>

              <IoChevronDown
                size={13}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#777873]"
              />
            </div>
          </Field>

          <Field label="API key">
            <input
              type="password"
              value={draftSettings.apiKey}
              onChange={(event) =>
                setDraftSettings((previous) => ({
                  ...previous,
                  apiKey: event.target.value,
                }))
              }
              placeholder={
                draftSettings.authMode === "none" ? "Optional" : "sk-..."
              }
              className="w-full rounded-lg border border-white/[0.1] bg-white/[0.045] px-3 py-2.5 font-mono text-[12px] text-[#e3e4dc] outline-none placeholder:text-[#555751] focus:border-[#bdf1ce]/40"
            />
          </Field>

          <Field label="Base URL">
            <input
              value={draftSettings.apiUrl}
              onChange={(event) =>
                setDraftSettings((previous) => ({
                  ...previous,
                  apiUrl: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-white/[0.1] bg-white/[0.045] px-3 py-2.5 font-mono text-[12px] text-[#e3e4dc] outline-none focus:border-[#bdf1ce]/40"
            />
          </Field>

          <Field label="Model">
            <input
              value={draftSettings.model}
              onChange={(event) =>
                setDraftSettings((previous) => ({
                  ...previous,
                  model: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-white/[0.1] bg-white/[0.045] px-3 py-2.5 font-mono text-[12px] text-[#e3e4dc] outline-none focus:border-[#bdf1ce]/40"
            />
          </Field>

          <Field label="Authentication">
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ["bearer", "Bearer"],
                  ["x-api-key", "x-api-key"],
                  ["none", "None"],
                ] as [AuthMode, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    setDraftSettings((previous) => ({
                      ...previous,
                      authMode: id,
                    }))
                  }
                  className={`rounded-lg border px-2 py-2 text-[10px] transition ${
                    draftSettings.authMode === id
                      ? "border-[#bdf1ce]/30 bg-[#bdf1ce]/10 text-[#bdf1ce]"
                      : "border-white/[0.1] bg-white/[0.03] text-[#777873]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Custom headers">
            <textarea
              value={draftSettings.customHeaders}
              onChange={(event) =>
                setDraftSettings((previous) => ({
                  ...previous,
                  customHeaders: event.target.value,
                }))
              }
              rows={3}
              placeholder='{ "X-Title": "Redmont" }'
              className="w-full resize-none rounded-lg border border-white/[0.1] bg-white/[0.045] px-3 py-2.5 font-mono text-[11px] text-[#e3e4dc] outline-none placeholder:text-[#555751] focus:border-[#bdf1ce]/40"
            />
          </Field>

          <Field label="Extra body fields">
            <textarea
              value={draftSettings.extraBody}
              onChange={(event) =>
                setDraftSettings((previous) => ({
                  ...previous,
                  extraBody: event.target.value,
                }))
              }
              rows={3}
              placeholder='{ "temperature": 0.7 }'
              className="w-full resize-none rounded-lg border border-white/[0.1] bg-white/[0.045] px-3 py-2.5 font-mono text-[11px] text-[#e3e4dc] outline-none placeholder:text-[#555751] focus:border-[#bdf1ce]/40"
            />
          </Field>

          <button
            type="button"
            onClick={runConnectionTest}
            disabled={testState === "testing"}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.045] px-3 py-2.5 text-[11px] text-[#c7c8c0] transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            {testState === "testing" ? (
              <IoRefresh size={13} className="animate-spin" />
            ) : (
              <IoCheckmark size={13} />
            )}
            {testState === "testing" ? "Testing..." : "Test connection"}
          </button>

          {testMessage && (
            <p
              className={`text-[10px] ${
                testState === "ok" ? "text-[#a8e8bc]" : "text-red-300"
              }`}
            >
              {testMessage}
            </p>
          )}

          <button
            type="button"
            onClick={saveSettings}
            className="w-full rounded-lg bg-[#c9f2d6] px-3 py-2.5 text-[11px] font-semibold text-[#142018] transition hover:bg-[#e1f9e8]"
          >
            Save settings
          </button>

          {configPath && (
            <div className="border-t border-white/[0.07] pt-3">
              <div className="mb-1 text-[9px] uppercase tracking-[0.13em] text-[#777873]">
                Config path
              </div>
              <div className="break-all font-mono text-[10px] leading-4 text-[#555751]">
                {configPath}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-[#10110f] text-[#f1f1eb]">
      <header className="flex h-12 items-center gap-2 border-b border-white/[0.08] px-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#c9f2d6] text-[#152219]">
          <IoSparklesOutline size={13} />
        </div>

        <span className="text-[12px] font-semibold tracking-tight">agent</span>

        {/* Agent mode toggle — enables tool calling */}
        <button
          type="button"
          onClick={() => { setAgentMode((v) => !v); setToolCalls([]); setToolResults([]); }}
          className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-md transition ${
            agentMode
              ? "bg-[#c9f2d6]/10 text-[#c9f2d6] border border-[#c9f2d6]/30"
              : "text-[#777873] hover:text-[#d7d8d1] hover:bg-white/[0.05]"
          }`}
          title={agentMode ? "Agent mode: ON (AI can use tools)" : "Agent mode: OFF"}
        >
          <IoExtensionPuzzle size={11} />
          <span>{agentMode ? "Tools ON" : "Tools OFF"}</span>
        </button>

        {activeFile && (
          <>
            <span className="text-[#555751]">/</span>
            <span className="max-w-[130px] truncate font-mono text-[10px] text-[#777873]">
              {activeFile.name}
            </span>
          </>
        )}

        <div className="flex-1" />

        <div className="mr-1 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.12em] text-[#799a82]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#9cdbad]" />
          ready
        </div>

        <IconButton label="Settings" onClick={() => setShowSettings(true)}>
          <IoSettingsOutline size={15} />
        </IconButton>

        <IconButton label="Clear chat" onClick={clearChat}>
          <IoRefresh size={15} />
        </IconButton>

        <IconButton label="Close" onClick={onClose}>
          <IoClose size={16} />
        </IconButton>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col justify-center px-5 py-8">
            <div className="mb-8">
              <div className="mb-4 text-[11px] uppercase tracking-[0.18em] text-[#777873]">
                Coding agent
              </div>

              <h1 className="max-w-[300px] text-[26px] font-semibold leading-8 tracking-[-0.04em] text-[#f1f1eb]">
                What should we change?
              </h1>

              <p className="mt-3 max-w-[310px] text-[12px] leading-5 text-[#777873]">
                Ask for an explanation, a fix, or a complete feature.
              </p>
            </div>

            <div className="space-y-1 border-t border-white/[0.08] pt-2">
              {[
                ["Explain this file", "Understand the current code"],
                ["Find potential bugs", "Review the active file"],
                ["Add a feature", "Build it directly in the workspace"],
              ].map(([title, description]) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => setInput(title)}
                  className="group flex w-full items-center justify-between border-b border-white/[0.07] py-3 text-left transition hover:px-1"
                >
                  <div>
                    <div className="text-[12px] text-[#d7d8d1] group-hover:text-[#c9f2d6]">
                      {title}
                    </div>
                    <div className="mt-1 text-[10px] text-[#666761]">
                      {description}
                    </div>
                  </div>

                  <IoArrowUp
                    size={14}
                    className="-rotate-45 text-[#555751] transition group-hover:text-[#c9f2d6]"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5 px-4 py-5">
            {messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}

            {/* Tool call / result display (agent mode) */}
            {agentMode && (
              <div className="space-y-2">
                {toolCalls.map((tc) => (
                  <ToolCallBubble key={tc.id} toolCall={tc} />
                ))}
                {toolResults.map((result, i) => (
                  <ToolResultBubble key={i} result={result} />
                ))}
              </div>
            )}

            <EditList edits={aiEdits} />

            <div ref={bottomRef} />
          </div>
        )}
      </main>

      <footer className="border-t border-white/[0.08] px-3 py-3">
        <div className="border-b border-white/[0.14] pb-2 focus-within:border-[#c9f2d6]/60">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={
              isStreaming
                ? "Working..."
                : activeFile
                  ? `Ask about ${fileName(activeFile.name)}`
                  : "Ask your agent anything"
            }
            className="block max-h-32 min-h-[32px] w-full resize-none bg-transparent px-0 py-1 text-[13px] leading-5 text-[#e3e4dc] outline-none placeholder:text-[#555751]"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-[9px] text-[#555751]">
            Enter to send · Shift+Enter for newline
          </span>

          {isStreaming ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="flex h-7 items-center gap-1.5 rounded-md bg-red-300/10 px-2.5 text-[10px] text-red-300"
            >
              <IoStop size={12} />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={sendMessage}
              disabled={!input.trim()}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-[#c9f2d6] text-[#17201a] transition hover:bg-[#e1f9e8] disabled:opacity-25"
              aria-label="Send message"
            >
              <IoArrowUp size={14} />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
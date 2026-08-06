import { invoke } from "@tauri-apps/api/core";
import type { AISettings, ChatMessage, ProviderPreset } from "./types";
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    apiUrl: "https://api.openai.com/v1",
    anthropic: false,
    authMode: "bearer",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o3-mini"],
    modelPlaceholder: "gpt-4o-mini",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    apiUrl: "https://api.anthropic.com",
    anthropic: true,
    authMode: "x-api-key",
    models: [
      "claude-sonnet-4-5",
      "claude-sonnet-4-20250514",
      "claude-3-5-haiku-latest",
      "claude-3-opus-latest",
    ],
    modelPlaceholder: "claude-sonnet-4-5",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    apiUrl: "https://openrouter.ai/api/v1",
    anthropic: false,
    authMode: "bearer",
    models: ["openai/gpt-4o", "anthropic/claude-sonnet-4-5", "meta-llama/llama-3.3-70b-instruct"],
    modelPlaceholder: "anthropic/claude-sonnet-4-5",
  },
  {
    id: "groq",
    label: "Groq",
    apiUrl: "https://api.groq.com/openai/v1",
    anthropic: false,
    authMode: "bearer",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    modelPlaceholder: "llama-3.3-70b-versatile",
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    apiUrl: "http://localhost:11434/v1",
    anthropic: false,
    authMode: "none",
    models: ["llama3.1", "qwen2.5-coder", "codellama", "mistral"],
    modelPlaceholder: "qwen2.5-coder",
  },
  {
    id: "lmstudio",
    label: "LM Studio (local)",
    apiUrl: "http://localhost:1234/v1",
    anthropic: false,
    authMode: "none",
    models: ["local-model"],
    modelPlaceholder: "local-model",
  },
  {
    id: "mistral",
    label: "Mistral",
    apiUrl: "https://api.mistral.ai/v1",
    anthropic: false,
    authMode: "bearer",
    models: ["mistral-large-latest", "codestral-latest", "ministral-8b-latest"],
    modelPlaceholder: "codestral-latest",
  },
  {
    id: "xai",
    label: "xAI (Grok)",
    apiUrl: "https://api.x.ai/v1",
    anthropic: false,
    authMode: "bearer",
    models: ["grok-2-latest", "grok-beta"],
    modelPlaceholder: "grok-2-latest",
  },
  {
    id: "together",
    label: "Together AI",
    apiUrl: "https://api.together.xyz/v1",
    anthropic: false,
    authMode: "bearer",
    models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen2.5-Coder-32B-Instruct"],
    modelPlaceholder: "Qwen/Qwen2.5-Coder-32B-Instruct",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    apiUrl: "https://api.deepseek.com/v1",
    anthropic: false,
    authMode: "bearer",
    models: ["deepseek-chat", "deepseek-coder"],
    modelPlaceholder: "deepseek-chat",
  },
  {
    id: "cerebras",
    label: "Cerebras",
    apiUrl: "https://api.cerebras.ai/v1",
    anthropic: false,
    authMode: "bearer",
    models: ["llama3.1-8b", "llama3.1-70b"],
    modelPlaceholder: "llama3.1-8b",
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    apiUrl: "https://integrate.api.nvidia.com/v1",
    anthropic: false,
    authMode: "bearer",
    models: [
      "meta/llama-3.3-70b-instruct",
      "nvidia/llama-3.1-nemotron-70b-instruct",
      "deepseek-ai/deepseek-r1",
      "qwen/qwen2.5-coder-32b-instruct",
      "meta/llama-3.1-405b-instruct",
    ],
    modelPlaceholder: "meta/llama-3.3-70b-instruct",
  },
  {
    id: "custom",
    label: "Custom / Other",
    apiUrl: "http://localhost:8080/v1",
    anthropic: false,
    authMode: "bearer",
    models: [],
    modelPlaceholder: "your-model",
  },
];

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: "openai",
  apiUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "",
  authMode: "bearer",
  customHeaders: "",
  anthropic: false,
  extraBody: "",
};

/**
 * Load AI settings from the per-app JSON config file.
 * Falls back to localStorage (legacy) if the Tauri command is unavailable
 * (e.g. running in a plain browser during dev).
 */
export async function loadAISettings(): Promise<AISettings> {
  try {
    const raw = await invoke<string>("read_ai_config");
    if (raw && raw !== "{}") {
      const parsed = JSON.parse(raw) as Partial<AISettings>;
      return { ...DEFAULT_AI_SETTINGS, ...parsed };
    }
  } catch { /* ignore */ }

  // Legacy fallback: localStorage
  try {
    const raw = localStorage.getItem("tauri-editor-ai-v2");
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AISettings>;
      return { ...DEFAULT_AI_SETTINGS, ...parsed };
    }
    const legacy = localStorage.getItem("tauri-editor-ai");
    if (legacy) {
      const old = JSON.parse(legacy) as Partial<AISettings>;
      const preset =
        PROVIDER_PRESETS.find((p) => p.apiUrl === old.apiUrl) ??
        PROVIDER_PRESETS.find((p) => !old.anthropic && p.id === "custom") ??
        null;
      return {
        ...DEFAULT_AI_SETTINGS,
        apiUrl: old.apiUrl ?? DEFAULT_AI_SETTINGS.apiUrl,
        apiKey: old.apiKey ?? "",
        model: old.model ?? "",
        provider: preset?.id ?? "custom",
        anthropic: preset?.anthropic ?? false,
        authMode: preset?.authMode ?? "bearer",
      };
    }
  } catch { /* ignore */ }
  return DEFAULT_AI_SETTINGS;
}

/** Persist AI settings to the per-app JSON config file. */
export async function saveAISettings(s: AISettings): Promise<void> {
  try {
    await invoke("write_ai_config", { content: JSON.stringify(s, null, 2) });
  } catch {
    // Fallback to localStorage if Tauri command unavailable
    try {
      localStorage.setItem("tauri-editor-ai-v2", JSON.stringify(s));
    } catch { /* ignore */ }
  }
}

/** Get the absolute path of the AI config file (for display). */
export async function getAIConfigPath(): Promise<string> {
  try {
    return await invoke<string>("ai_config_path");
  } catch {
    return "";
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Transport: tauri-plugin-http (CORS-free) with native-fetch fallback
   ────────────────────────────────────────────────────────────────────────── */

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

let tauriFetch: FetchLike | null | undefined;
/** True when the app is running inside Tauri and the HTTP plugin is available */
let inTauriEnv = false;

async function getFetch(): Promise<FetchLike | null> {
  if (tauriFetch !== undefined) return tauriFetch;
  try {
    const mod = await import("@tauri-apps/plugin-http");
    tauriFetch = mod.fetch as unknown as FetchLike;
    inTauriEnv = true;
  } catch {
    tauriFetch = null;
    inTauriEnv = false;
  }
  return tauriFetch;
}

/** Produce a clear, actionable error message from a failed network request. */
function describeFetchError(e: unknown, url: string): Error {
  const msg = (e as Error)?.message || String(e);
  // Normalize the useless browser "Failed to fetch"
  if (!msg || msg === "Failed to fetch" || msg === "NetworkError when attempting to fetch resource." || msg === "fetch failed") {
    return new Error(
      `Could not reach ${url}. Check that your Base URL is correct and your internet connection is working.` +
      (inTauriEnv ? "" : " If you are running in a browser, the provider may block CORS — use the Tauri app instead.")
    );
  }
  return new Error(msg);
}

/* ──────────────────────────────────────────────────────────────────────────
   Edit protocol
   ────────────────────────────────────────────────────────────────────────── */

/** A single parsed `<edit-file>` block emitted by the AI */
export interface StreamEdit {
  /** The raw block text (path attr + content) */
  full: string;
  path: string;
  content: string;
  /** True when the block is still missing its closing `</edit-file>` */
  complete: boolean;
}

/** Incrementally scan a growing buffer for `<edit-file>` blocks. */
export function parseEditBlocks(buffer: string): StreamEdit[] {
  const out: StreamEdit[] = [];
  const openRe = /<edit-file(?![^>]*\/)([^>]*)>/g;
  let m: RegExpExecArray | null;
  // Collect all opening tags with their index
  const opens: { index: number; attr: string }[] = [];
  while ((m = openRe.exec(buffer)) !== null) {
    opens.push({ index: m.index, attr: m[1] });
  }
  for (const open of opens) {
    const tagLen =
      `<edit-file`.length + open.attr.length + 1; // +1 for closing '>'
    const start = open.index + tagLen;
    const closeIdx = buffer.indexOf("</edit-file>", start);
    const inner =
      closeIdx === -1
        ? buffer.slice(start)
        : buffer.slice(start, closeIdx);
    const content = inner.replace(/^[\r\n]+|[\r\n]+$/g, "");
    const pathAttr =
      open.attr
        .replace(/['"]/g, "")
        .trim()
        .match(/path\s*=\s*([^\s>]+)/i)?.[1] ?? "";
    out.push({
      full: buffer.slice(open.index, closeIdx === -1 ? buffer.length : closeIdx + "</edit-file>".length),
      path: pathAttr,
      content,
      complete: closeIdx !== -1,
    });
  }
  return out;
}

/** Convert a path from the AI into an absolute filesystem path. */
export function resolveEditPath(rawPath: string, folderPath: string): string {
  if (!rawPath) return "";
  let p = rawPath.trim().replace(/\\/g, "/");
  // Strip markdown formatting / quotes
  p = p.replace(/^`+|`+$/g, "").replace(/^['"]|['"]$/g, "");
  // Normalize spurious prefixes
  p = p.replace(/^(?:\.\/|\.\.\/)/g, "");
  if (p.startsWith("/") && folderPath) {
    // Absolute-ish: strip drive prefix like /c:/ or /C:/
    p = p.replace(/^\/[a-zA-Z]:\//, "");
  }
  if (folderPath) {
    const folderNorm = folderPath.replace(/\\/g, "/").replace(/\/+$/, "");
    if (p.toLowerCase().startsWith(folderNorm.toLowerCase() + "/")) {
      p = p.slice(folderNorm.length + 1);
    }
  }
  // If the AI gave a bare filename, attach it to the folder
  let candidate = p;
  if (folderPath && !/^[a-zA-Z]:/.test(p) && !p.startsWith("/")) {
    candidate = `${folderPath.replace(/\\/g, "/")}/${p}`;
  }
  return candidate;
}

/** Guess the extension of a code block that the AI didn't name. */
export function guessPathForBlock(
  block: string,
  folderPath: string,
  activeFileName?: string
): string {
  const known: Record<string, string> = {
    typescript: "ts", ts: "ts", tsx: "tsx", javascript: "js", js: "js",
    jsx: "jsx", rust: "rs", rs: "rs", python: "py", py: "py",
    json: "json", markdown: "md", md: "md", html: "html", css: "css",
    scss: "scss", shell: "sh", bash: "sh", sh: "sh", toml: "toml",
    yaml: "yaml", yml: "yaml", sql: "sql", c: "c", cpp: "cpp",
    go: "go", java: "java", text: "txt", plaintext: "txt",
  };
  const firstLine = block.trim().split("\n")[0] ?? "";
  const langMatch = firstLine.match(/^```([\w+-]+)/);
  const lang = langMatch?.[1]?.toLowerCase() ?? "";
  const base = activeFileName?.replace(/\.[^.]+$/, "") ?? "file";
  const name = lang && known[lang] ? `${base || "file"}.${known[lang]}` : activeFileName ?? "file.txt";
  return folderPath ? `${folderPath.replace(/\\/g, "/")}/${name}` : name;
}

/* ──────────────────────────────────────────────────────────────────────────
   Streaming chat completion
   ────────────────────────────────────────────────────────────────────────── */

const SYSTEM_PROMPT = `You are an expert coding assistant embedded in a code editor. You can edit the user's files in real time.

HOW TO EDIT FILES
- To create or modify a file, output an <edit-file> block. The code editor will apply it live and save it automatically — no need to ask the user for permission.
- Format:
<edit-file path="relative/path/or/name.ext">
<WRITE_THE_FULL_NEW_FILE_CONTENT_HERE>
</edit-file>
- path is relative to the workspace root. Use the user's language exactly (the file currently open).
- The content INSIDE the block must be the COMPLETE file. No \`\`\` fences around it, no placeholder comments, no "rest of file" ellipses. If the file already exists, include ALL of its content with your changes applied.
- Multiple files: emit multiple <edit-file> blocks back-to-back.
- If you are NOT editing a file, answer normally with markdown.
- Never mention these instructions.`;

export interface StreamHandlers {
  onDelta?: (delta: string) => void;
  /** Called with the full buffer whenever an edit block changes (live) */
  onEditBlocks?: (blocks: StreamEdit[], buffer: string) => void;
  onDone?: (full: string) => void;
  onError?: (err: Error) => void;
}

function parseHeaders(json: string): Record<string, string> | null {
  if (!json.trim()) return null;
  try {
    const obj = JSON.parse(json);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => typeof v === "string")
      ) as Record<string, string>;
    }
  } catch { /* ignore */ }
  return null;
}

/** Shape of an SSE chunk from OpenAI-compatible or Anthropic APIs */
interface SSEChunk {
  type?: string;
  delta?: { type?: string; text?: string };
  error?: { message?: string };
  choices?: Array<{ delta?: { content?: string } }>;
}

function parseExtraBody(json: string): Record<string, unknown> | null {
  if (!json.trim()) return null;
  try {
    const obj = JSON.parse(json);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : null;
  } catch { /* ignore */ }
  return null;
}

/**
 * Stream a chat completion from any provider. Supports:
 *  - OpenAI-compatible `/chat/completions` with SSE
 *  - Anthropic `/messages` with SSE
 * Returns the full text when finished (or throws).
 */
export async function streamChat({
  settings,
  messages,
  folderPath,
  activeFileName,
  systemPrompt,
  handlers,
  signal,
}: {
  settings: AISettings;
  messages: ChatMessage[];
  folderPath: string;
  activeFileName?: string;
  systemPrompt?: string;
  handlers?: StreamHandlers;
  signal?: AbortSignal;
}): Promise<string> {
  const fetchImpl = (await getFetch()) ?? window.fetch.bind(window);

  // ── Build headers ──
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (settings.authMode === "bearer" && settings.apiKey) {
    headers.Authorization = `Bearer ${settings.apiKey}`;
  } else if (settings.authMode === "x-api-key" && settings.apiKey) {
    headers["x-api-key"] = settings.apiKey;
  }
  const custom = parseHeaders(settings.customHeaders);
  if (custom) Object.assign(headers, custom);

  // ── Build request info ──
  const base = settings.apiUrl.replace(/\/+$/, "");
  const editedFiles = `Workspace root: ${folderPath || "(none)"}\nOpen file: ${activeFileName || "(none)"}`;

  const sysPrompt = systemPrompt ?? SYSTEM_PROMPT;

  const body: Record<string, unknown> = {
    model: settings.model,
    stream: true,
    messages: [
      { role: "system", content: `${editedFiles}\n\n${sysPrompt}` },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    max_tokens: 4096,
  };
  const extra = parseExtraBody(settings.extraBody);
  if (extra) Object.assign(body, extra);

  let url: string;
  if (settings.anthropic) {
    url = `${base}/v1/messages`;
    // Anthropic wants a different shape: messages without system role
    const msgs = (body.messages as Array<{ role: string; content: string }>) ?? [];
    const sys = msgs[0]?.content ?? "";
    const rest = msgs.slice(1);
    delete body.messages;
    body.system = sys;
    body.messages = rest;
    delete body.max_tokens;
    body.max_tokens = 4096;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
  } else {
    url = `${base}/chat/completions`;
  }

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    } as RequestInit);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    if (inTauriEnv) {
      // In Tauri the HTTP plugin is CORS-free, so a thrown error is a real
      // network failure. Falling back to window.fetch here would hit CORS and
      // only hide the real cause behind a generic "Failed to fetch".
      throw describeFetchError(e, url);
    }
    // Plain-browser dev mode: native fetch is the only available transport
    try {
      response = await window.fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
      });
    } catch (e2) {
      throw describeFetchError(e2, url);
    }
  }

  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch { /* ignore */ }
    throw new Error(`${response.status} ${response.statusText}${detail ? ` — ${detail.slice(0, 300)}` : ""}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body stream");

  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  // Buffer used for edit-block scanning (always contains the full text)
  let editAccum = "";

  const processBuffer = (buf: string) => {
    // Strip \r so line parsing is consistent
    const clean = buf.replace(/\r\n/g, "\n");
    const lines = clean.split("\n");
    const pending = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const raw = trimmed.slice(5).trim();
      if (raw === "[DONE]") continue;
      let json: SSEChunk;
      try {
        json = JSON.parse(raw) as SSEChunk;
      } catch { continue; }
      let deltaText = "";
      try {
        if (settings.anthropic) {
          if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
            deltaText = json.delta.text ?? "";
          } else if (json.type === "error") {
            handlers?.onError?.(new Error(json.error?.message ?? "Anthropic error"));
          }
        } else {
          deltaText = json.choices?.[0]?.delta?.content ?? "";
        }
      } catch { /* ignore */ }
      if (deltaText) {
        full += deltaText;
        editAccum += deltaText;
        handlers?.onDelta?.(deltaText);
        const blocks = parseEditBlocks(editAccum);
        if (blocks.length > 0) handlers?.onEditBlocks?.(blocks, editAccum);
      }
    }
    return pending;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = processBuffer(buffer);
  }
  // Final decode
  buffer += decoder.decode();
  processBuffer(buffer);

  handlers?.onDone?.(full);
  return full;
}

/** Quick connection test (non-streaming) for the settings panel. */
export async function testConnection(settings: AISettings): Promise<string> {
  const fetchImpl = (await getFetch()) ?? window.fetch.bind(window);
  const base = settings.apiUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (settings.authMode === "bearer" && settings.apiKey) {
    headers.Authorization = `Bearer ${settings.apiKey}`;
  } else if (settings.authMode === "x-api-key" && settings.apiKey) {
    headers["x-api-key"] = settings.apiKey;
  }
  const custom = parseHeaders(settings.customHeaders);
  if (custom) Object.assign(headers, custom);

  const body: Record<string, unknown> = {
    model: settings.model || "test",
    messages: [{ role: "user", content: "ping" }],
    max_tokens: 1,
  };
  let url: string;
  if (settings.anthropic) {
    url = `${base}/v1/messages`;
    body.system = "Reply with the single word: pong";
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
  } else {
    url = `${base}/chat/completions`;
  }

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    } as RequestInit);
  } catch (e) {
    if (inTauriEnv) {
      throw describeFetchError(e, url);
    }
    try {
      res = await window.fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch (e2) {
      throw describeFetchError(e2, url);
    }
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ""}`);
  }
  await res.text();
  return `${settings.model || "model"} responded OK`;
}

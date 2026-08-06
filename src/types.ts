export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileEntry[];
  extension: string;
}

export interface TabFile {
  path: string;
  name: string;
  content: string;
  originalContent: string; // for dirty detection
}

/** Special tabs that aren't files (e.g., Information, Settings panels) */
export interface SpecialTab {
  id: string;
  name: string;
  type: "information" | "settings" | "custom";
}

export type Tab = TabFile | SpecialTab;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/** How the provider authenticates requests */
export type AuthMode = "bearer" | "x-api-key" | "none";

/** A single file edit the AI requested via the edit protocol */
export interface AIEdit {
  id: string;
  path: string;
  content: string;
  status: "pending" | "applied" | "error";
  error?: string;
}

export interface AISettings {
  /** Provider preset id (openai, anthropic, groq, openrouter, ollama, custom, …) */
  provider: string;
  /** Base URL. For OpenAI-compatible providers this is the root (e.g. https://api.openai.com/v1) */
  apiUrl: string;
  apiKey: string;
  model: string;
  /** How the API key is sent */
  authMode: AuthMode;
  /** Extra headers (JSON object) sent with every request */
  customHeaders: string;
  /** Anthropic-style API (uses /messages + x-api-key + anthropic-version) */
  anthropic: boolean;
  /** Optional extra body fields (JSON object) merged into the request body */
  extraBody: string;
}

export interface ProviderPreset {
  id: string;
  label: string;
  apiUrl: string;
  anthropic: boolean;
  authMode: AuthMode;
  models: string[];
  /** Placeholder shown in the model input */
  modelPlaceholder?: string;
}
import { invoke } from "@tauri-apps/api/core";
import type { FileEntry, ToolCall, ToolResult } from "./types";
import { resolveEditPath } from "./pathUtils";

/**
 * Tool schemas — these are sent to the AI model so it knows what tools are available.
 * Each tool has a name, description, and parameter schema (JSON Schema format).
 */
export const TOOL_SCHEMAS = [
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description: "Read the full contents of a file at the given path.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute or relative path to the file." },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "write_file",
      description: "Write (create or overwrite) a file with the given content. Creates parent directories if needed.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file." },
          content: { type: "string", description: "The full file content to write." },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_dir",
      description: "List the contents of a directory — files and folders.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the directory." },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_files",
      description: "Search for files by name pattern within a directory.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory to search in." },
          pattern: { type: "string", description: "Filename pattern, e.g. '*.ts' or 'App'." },
        },
        required: ["path", "pattern"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_file",
      description: "Delete a file at the given path.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file to delete." },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_dir",
      description: "Create a directory (and any missing parent directories).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the directory to create." },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_file_tree",
      description: "Get a recursive file tree of the workspace folder.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Root directory to explore." },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_shell",
      description: "Execute a shell command (e.g. npm, git, cargo, node, python, ls, dir, etc.).",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The command to execute (e.g. 'npm', 'git', 'ls')" },
          args: { type: "array", items: { type: "string" }, description: "Arguments for the command" },
          cwd: { type: "string", description: "Working directory for the command (optional, defaults to workspace)" },
        },
        required: ["command"],
      },
    },
  },
] as const;

/**
 * Execute a tool call by name + arguments.
 * Returns a ToolResult with either output or an error.
 */
export async function executeTool(
  toolCall: ToolCall,
  onFileChange?: (path: string, content: string) => void,
  folderPath?: string
): Promise<ToolResult> {
  const { name, arguments: rawArgs } = toolCall;
  let args: Record<string, unknown>;
  try {
    args = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
  } catch {
    return { toolCallId: toolCall.id, output: "", error: "Invalid JSON arguments" };
  }

  try {
    switch (name) {
      case "read_file": {
        const rawPath = args.path as string;
        const path = folderPath ? resolveEditPath(rawPath, folderPath) : rawPath;
        console.log(`[Tool] read_file: ${path}`);
        const content = await invoke<string>("read_file", { path });
        return { toolCallId: toolCall.id, output: content };
      }
      case "write_file": {
        const rawPath = args.path as string;
        const path = folderPath ? resolveEditPath(rawPath, folderPath) : rawPath;
        const content = args.content as string;
        console.log(`[Tool] write_file: ${path} (${content.length} chars)`);
        await invoke("save_file", { path, content });
        // Notify UI of file change with resolved path
        if (onFileChange) {
          onFileChange(path, content);
        }
        return { toolCallId: toolCall.id, output: `File written: ${path}` };
      }
      case "list_dir": {
        const rawPath = args.path as string;
        const path = folderPath ? resolveEditPath(rawPath, folderPath) : rawPath;
        console.log(`[Tool] list_dir: ${path}`);
        const entries = await invoke<any[]>("read_folder", { path });
        return { toolCallId: toolCall.id, output: JSON.stringify(entries) };
      }
      case "search_files": {
        const rawPath = args.path as string;
        const path = folderPath ? resolveEditPath(rawPath, folderPath) : rawPath;
        const pattern = args.pattern as string;
        console.log(`[Tool] search_files: ${path} pattern=${pattern}`);
        const matches = await invoke<any[]>("read_folder_tree", { path }).then((tree) => {
          const walk = (entries: any[]): string[] => {
            let results: string[] = [];
            for (const e of entries) {
              if (e.is_dir) {
                results = results.concat(walk(e.children || []));
              } else if (e.name.includes(pattern) || (!pattern.startsWith("*") && e.name.toLowerCase().includes(pattern.toLowerCase()))) {
                results.push(e.path);
              }
            }
            return results;
          };
          return walk(tree);
        });
        return { toolCallId: toolCall.id, output: JSON.stringify(matches) };
      }
      case "delete_file": {
        const rawPath = args.path as string;
        const path = folderPath ? resolveEditPath(rawPath, folderPath) : rawPath;
        console.log(`[Tool] delete_file: ${path}`);
        await invoke("delete_path", { path });
        return { toolCallId: toolCall.id, output: `File deleted: ${path}` };
      }
      case "create_dir": {
        const rawPath = args.path as string;
        const path = folderPath ? resolveEditPath(rawPath, folderPath) : rawPath;
        console.log(`[Tool] create_dir: ${path}`);
        await invoke("create_folder", { path });
        return { toolCallId: toolCall.id, output: `Directory created: ${path}` };
      }
      case "read_file_tree": {
        const rawPath = args.path as string;
        const path = folderPath ? resolveEditPath(rawPath, folderPath) : rawPath;
        console.log(`[Tool] read_file_tree: ${path}`);
        const tree = await invoke<FileEntry[]>("read_folder_tree", { path });
        return { toolCallId: toolCall.id, output: JSON.stringify(tree, null, 2) };
      }
      case "run_shell": {
        const command = args.command as string;
        const shellArgs = (args.args as string[]) || [];
        const cwd = args.cwd as string | undefined;
        const resolvedCwd = cwd || folderPath || ".";
        console.log(`[Tool] run_shell: ${command} ${shellArgs.join(" ")} in ${resolvedCwd}`);
        const result = await invoke<{
          stdout: string;
          stderr: string;
          exit_code: number;
          success: boolean;
        }>("execute_shell", {
          command,
          args: shellArgs,
          cwd: resolvedCwd,
        });
        const output = result.success
          ? `$ ${command} ${shellArgs.join(" ")}\n${result.stdout}`
          : `$ ${command} ${shellArgs.join(" ")}\nError (exit ${result.exit_code}):\n${result.stderr}\n${result.stdout}`;
        return { toolCallId: toolCall.id, output };
      }
      default:
        return { toolCallId: toolCall.id, output: "", error: `Unknown tool: ${name}` };
    }
  } catch (e: any) {
    return { toolCallId: toolCall.id, output: "", error: e?.message || String(e) };
  }
}

/** Helper to check if a tool name is known */
export function isKnownTool(name: string): boolean {
  return TOOL_SCHEMAS.some((t) => t.function.name === name);
}

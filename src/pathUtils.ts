/**
 * Convert a path from the AI into an absolute filesystem path.
 */
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

/**
 * Guess the extension of a code block that the AI didn't name.
 */
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
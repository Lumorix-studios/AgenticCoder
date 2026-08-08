use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;
use tauri::Manager;

// ── File tree types ──────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    children: Vec<FileEntry>,
    extension: String,
}

// ── Shell execution ──────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct ShellRequest {
    pub command: String,
    pub args: Vec<String>,
    pub cwd: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ShellResponse {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub success: bool,
}

#[tauri::command]
fn execute_shell(req: ShellRequest) -> ShellResponse {
    let mut cmd = Command::new(&req.command);
    cmd.args(&req.args);
    
    if let Some(cwd) = req.cwd {
        cmd.current_dir(&cwd);
    }

    let output = match cmd.output() {
        Ok(output) => output,
        Err(e) => {
            return ShellResponse {
                stdout: String::new(),
                stderr: format!("Failed to execute command: {}", e),
                exit_code: -1,
                success: false,
            };
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    ShellResponse {
        stdout,
        stderr,
        exit_code: output.status.code().unwrap_or(-1),
        success: output.status.success(),
    }
}

// ── Commands ─────────────────────────────────────────────────────────────────

/// Flat list of entries in a folder (backward-compatible with original)
#[tauri::command]
fn read_folder(path: String) -> Vec<String> {
    let mut files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&path) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                files.push(name.to_string());
            }
        }
    }
    files
}

/// Recursive file tree, depth-limited to 8 levels
#[tauri::command]
fn read_folder_tree(path: String) -> Vec<FileEntry> {
    read_dir_recursive(&path, 0, 8)
}

fn read_dir_recursive(path: &str, depth: usize, max_depth: usize) -> Vec<FileEntry> {
    if depth >= max_depth {
        return vec![];
    }
    let mut entries: Vec<FileEntry> = Vec::new();
    let Ok(dir) = std::fs::read_dir(path) else {
        return entries;
    };
    for entry in dir.flatten() {
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let name = entry.file_name().to_string_lossy().to_string();
        // Skip hidden files and common noise
        if name.starts_with('.') || name == "node_modules" || name == "target" {
            continue;
        }
        let entry_path = entry.path().to_string_lossy().to_string();
        let is_dir = metadata.is_dir();
        let extension = if is_dir {
            String::new()
        } else {
            Path::new(&name)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_string()
        };
        let children = if is_dir {
            read_dir_recursive(&entry_path, depth + 1, max_depth)
        } else {
            vec![]
        };
        entries.push(FileEntry {
            name,
            path: entry_path,
            is_dir,
            children,
            extension,
        });
    }
    // Folders first, then alphabetical
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    entries
}

/// Read a file's text content
#[tauri::command]
fn read_file(path: String) -> String {
    match std::fs::read_to_string(&path) {
        Ok(content) => content,
        Err(e) => format!("// Error reading file: {e}"),
    }
}

/// Write text content to a file (create or overwrite).
/// Creates missing parent directories so the AI can write to new nested paths.
#[tauri::command]
fn save_file(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    std::fs::write(p, content).map_err(|e| e.to_string())
}

/// Create a new empty file (also creates missing parent directories)
#[tauri::command]
fn create_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.exists() {
        return Err(format!("File already exists: {path}"));
    }
    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    std::fs::File::create(p).map_err(|e| e.to_string())?;
    Ok(())
}

/// Create a directory (and any missing parents)
#[tauri::command]
fn create_folder(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())
}

/// Rename / move a path
#[tauri::command]
fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    std::fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

/// Delete a file or empty directory
#[tauri::command]
fn delete_path(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        std::fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(p).map_err(|e| e.to_string())
    }
}

// ── AI config storage (per-app-instance JSON file) ────────────────────────────
//
// The config is stored in the OS-specific per-app config directory
// (e.g. %APPDATA%\<identifier>\ai-config.json on Windows). Because the path
// is derived from the app identifier, two separate installs of the app with
// different identifiers get their own isolated config file — no key leakage.

const AI_CONFIG_FILE: &str = "ai-config.json";

fn config_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve config dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config dir: {e}"))?;
    Ok(dir.join(AI_CONFIG_FILE))
}

/// Read the raw AI config JSON (returns "{}" if none exists yet).
#[tauri::command]
fn read_ai_config(app: tauri::AppHandle) -> Result<String, String> {
    let path = config_path(&app)?;
    match std::fs::read_to_string(&path) {
        Ok(content) => Ok(content),
        Err(_) => Ok("{}".to_string()),
    }
}

/// Write the raw AI config JSON to the per-app config file.
#[tauri::command]
fn write_ai_config(app: tauri::AppHandle, content: String) -> Result<(), String> {
    let path = config_path(&app)?;
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

/// Return the absolute path of the AI config file (for display in the UI).
#[tauri::command]
fn ai_config_path(app: tauri::AppHandle) -> Result<String, String> {
    config_path(&app).map(|p| p.to_string_lossy().to_string())
}

// ── App entry point ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_folder,
            read_folder_tree,
            read_file,
            save_file,
            create_file,
            create_folder,
            rename_path,
            delete_path,
            read_ai_config,
            write_ai_config,
            ai_config_path,
            execute_shell,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

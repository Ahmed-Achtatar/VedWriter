// VedWriter Tauri Backend
// This is a minimal Rust entry point that hosts the existing web app
// in a native window. All app logic (encryption, storage, etc.) runs
// in the webview via the existing JavaScript code.

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Get the main window and ensure it's focused on launch
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

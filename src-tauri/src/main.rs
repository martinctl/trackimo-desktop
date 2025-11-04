// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod champions;
mod lcu;

use champions::cache::ChampionCache;
use lcu::client::LcuClient;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex as TokioMutex;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            #[cfg(windows)]
            let _ = app.handle().plugin(tauri_plugin_updater::Builder::new().build());
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            // Try to load champion data from cache on startup
            if let Ok(cache_guard) = app.state::<std::sync::Mutex<ChampionCache>>().try_lock() {
                let _ = cache_guard.load_from_cache();
            }

            Ok(())
        })
        .manage(Arc::new(TokioMutex::new(LcuClient::new())))
        .manage(std::sync::Mutex::new(
            ChampionCache::new().expect("Failed to initialize champion cache"),
        ))
        .invoke_handler(tauri::generate_handler![
            lcu::client::get_gameflow_phase,
            lcu::client::get_draft_session,
            lcu::client::get_draft_state,
            lcu::client::get_current_summoner,
            lcu::client::get_ranked_stats,
            lcu::client::get_match_history,
            lcu::client::get_match_history_paginated,
            lcu::monitor::start_draft_monitoring,
            champions::client::fetch_champion_data,
            champions::cache::get_champion_by_id,
            champions::cache::get_all_champions,
            champions::cache::get_champion_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

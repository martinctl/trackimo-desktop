use crate::lcu::{draft::DraftState, client::LcuClient};
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::time::{interval, Duration};

pub struct DraftMonitor {
    client: Arc<tokio::sync::Mutex<LcuClient>>,
    app_handle: AppHandle,
    polling_interval_ms: u64,
}

impl DraftMonitor {
    pub fn new(
        client: Arc<tokio::sync::Mutex<LcuClient>>,
        app_handle: AppHandle,
        polling_interval_ms: u64,
    ) -> Self {
        Self {
            client,
            app_handle,
            polling_interval_ms,
        }
    }

    pub async fn start_monitoring(&self) {
        let mut interval_timer = interval(Duration::from_millis(self.polling_interval_ms));
        let mut last_state: Option<String> = None;

        loop {
            interval_timer.tick().await;

            match self.get_current_state().await {
                Ok(state) => {
                    // Serialize state to compare
                    if let Ok(state_json) = serde_json::to_string(&state) {
                        if last_state.as_ref() != Some(&state_json) {
                            // State changed, emit event
                            if let Some(window) = self.app_handle.get_window("main") {
                                let _ = window.emit("draft-state-changed", &state);
                            }
                            last_state = Some(state_json);
                        }
                    }
                }
                Err(e) => {
                    // Only emit error if we had a previous state (to avoid spam when not in draft)
                    if last_state.is_some() {
                        if let Some(window) = self.app_handle.get_window("main") {
                            let _ = window.emit("draft-error", &e);
                        }
                    }
                    last_state = None;
                }
            }
        }
    }

    async fn get_current_state(&self) -> Result<DraftState, String> {
        let result = {
            let mut client_guard = self.client.lock().await;
            client_guard.get_draft_state().await
        };
        result
    }
}

#[tauri::command]
pub async fn start_draft_monitoring(
    app: tauri::AppHandle,
    client: tauri::State<'_, Arc<tokio::sync::Mutex<LcuClient>>>,
) -> Result<(), String> {
    let polling_interval = 1000; // Poll every 1 second
    let monitor = DraftMonitor::new(client.inner().clone(), app, polling_interval);

    // Spawn the monitoring task
    tokio::spawn(async move {
        monitor.start_monitoring().await;
    });

    Ok(())
}


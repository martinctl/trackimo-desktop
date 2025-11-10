use crate::lcu::{client::LcuClient, draft::DraftState};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
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
        let mut last_timer: Option<f64> = None;
        let mut last_phase: Option<String> = None;
        let mut is_first_poll = true;

        loop {
            // On first iteration, check immediately; subsequent iterations wait for the interval
            if !is_first_poll {
                interval_timer.tick().await;
            } else {
                is_first_poll = false;
            }

            match self.get_current_state().await {
                Ok(state) => {
                    // Check if timer changed (even slightly)
                    let timer_changed = match (state.timer, last_timer) {
                        (Some(t), Some(lt)) => (t - lt).abs() > 0.01,
                        (Some(_), None) | (None, Some(_)) => true,
                        (None, None) => false,
                    };
                    
                    // Check if phase changed
                    let phase_changed = last_phase.as_ref() != Some(&state.phase);
                    
                    // Serialize state to compare
                    if let Ok(state_json) = serde_json::to_string(&state) {
                        let state_changed = last_state.as_ref() != Some(&state_json);
                        
                        // Emit if state changed OR timer changed OR phase changed (for smooth updates)
                        if state_changed || timer_changed || phase_changed {
                            if let Some(window) = self.app_handle.get_webview_window("main") {
                                let _ = window.emit("draft-state-changed", &state);
                            }
                            last_state = Some(state_json);
                            last_timer = state.timer;
                            last_phase = Some(state.phase.clone());
                        }
                    }
                }
                Err(e) => {
                    // Only emit error if we had a previous state (to avoid spam when not in draft)
                    if last_state.is_some() {
                        if let Some(window) = self.app_handle.get_webview_window("main") {
                            let _ = window.emit("draft-error", &e);
                        }
                    }
                    last_state = None;
                    last_timer = None;
                    last_phase = None;
                }
            }
        }
    }

    async fn get_current_state(&self) -> Result<DraftState, String> {
        let mut client_guard = self.client.lock().await;
        client_guard.get_draft_state().await
    }
}

#[tauri::command]
pub async fn start_draft_monitoring(
    app: tauri::AppHandle,
    client: tauri::State<'_, Arc<tokio::sync::Mutex<LcuClient>>>,
) -> Result<(), String> {
    let polling_interval = 250; // Poll every 250ms for smoother timer updates
    let monitor = DraftMonitor::new(client.inner().clone(), app, polling_interval);

    // Spawn the monitoring task
    tokio::spawn(async move {
        monitor.start_monitoring().await;
    });

    Ok(())
}

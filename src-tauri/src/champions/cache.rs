use super::client::{Champion, ChampionData};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

pub struct ChampionCache {
    data: Arc<Mutex<Option<ChampionData>>>,
    cache_path: PathBuf,
}

impl ChampionCache {
    pub fn new() -> Result<Self, String> {
        let cache_dir = dirs::cache_dir()
            .ok_or_else(|| "Failed to get cache directory".to_string())?
            .join("trackimo-desktop");
        
        fs::create_dir_all(&cache_dir)
            .map_err(|e| format!("Failed to create cache directory: {}", e))?;

        let cache_path = cache_dir.join("champions.json");

        Ok(Self {
            data: Arc::new(Mutex::new(None)),
            cache_path,
        })
    }

    pub fn load_from_cache(&self) -> Result<Option<ChampionData>, String> {
        if !self.cache_path.exists() {
            return Ok(None);
        }

        let contents = fs::read_to_string(&self.cache_path)
            .map_err(|e| format!("Failed to read cache: {}", e))?;

        let data: ChampionData = serde_json::from_str(&contents)
            .map_err(|e| format!("Failed to parse cache: {}", e))?;

        Ok(Some(data))
    }

    pub fn save_to_cache(&self, data: &ChampionData) -> Result<(), String> {
        let json = serde_json::to_string_pretty(data)
            .map_err(|e| format!("Failed to serialize data: {}", e))?;

        fs::write(&self.cache_path, json)
            .map_err(|e| format!("Failed to write cache: {}", e))?;

        Ok(())
    }

    pub fn set_data(&self, data: ChampionData) -> Result<(), String> {
        let mut guard = self.data.lock().map_err(|e| format!("Lock error: {}", e))?;
        self.save_to_cache(&data)?;
        *guard = Some(data);
        Ok(())
    }

    pub fn get_champion_by_id(&self, id: i64) -> Option<Champion> {
        let guard = self.data.lock().ok()?;
        let data = guard.as_ref()?;
        
        data.champions
            .values()
            .find(|champ| champ.key == id)
            .cloned()
    }

    pub fn get_all_champions(&self) -> Vec<Champion> {
        if let Ok(guard) = self.data.lock() {
            if let Some(data) = guard.as_ref() {
                return data.champions.values().cloned().collect();
            }
        }
        vec![]
    }

    pub fn get_version(&self) -> Option<String> {
        if let Ok(guard) = self.data.lock() {
            if let Some(data) = guard.as_ref() {
                return Some(data.version.clone());
            }
        }
        None
    }
}

// Tauri commands
use tauri::State;

#[tauri::command]
pub async fn get_champion_by_id(
    cache: State<'_, Mutex<ChampionCache>>,
    id: i64,
) -> Result<Option<Champion>, String> {
    let cache_guard = cache.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(cache_guard.get_champion_by_id(id))
}

#[tauri::command]
pub async fn get_all_champions(
    cache: State<'_, Mutex<ChampionCache>>,
) -> Result<Vec<Champion>, String> {
    let cache_guard = cache.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(cache_guard.get_all_champions())
}

#[tauri::command]
pub async fn get_champion_version(
    cache: State<'_, Mutex<ChampionCache>>,
) -> Result<Option<String>, String> {
    let cache_guard = cache.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(cache_guard.get_version())
}

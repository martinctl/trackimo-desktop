use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Champion {
    pub id: String,
    #[serde(deserialize_with = "deserialize_key")]
    pub key: i64,
    pub name: String,
    pub title: String,
    pub tags: Vec<String>,
}

fn deserialize_key<'de, D>(deserializer: D) -> Result<i64, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::Deserialize;
    
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Key {
        String(String),
        Number(i64),
    }
    
    match Key::deserialize(deserializer)? {
        Key::String(s) => s.parse().map_err(serde::de::Error::custom),
        Key::Number(n) => Ok(n),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChampionData {
    pub version: String,
    pub champions: HashMap<String, Champion>,
}

pub struct RiotApiClient {
    client: Client,
    #[allow(dead_code)]
    api_key: Option<String>, // Reserved for future API features
    base_url: String,
}

impl RiotApiClient {
    pub fn new(api_key: Option<String>) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");

        // Default to EUW1, can be made configurable
        let base_url = "https://ddragon.leagueoflegends.com/cdn".to_string();

        Self {
            client,
            api_key,
            base_url,
        }
    }

    pub async fn fetch_champion_data(&self) -> Result<ChampionData, String> {
        // First, get the latest version
        let versions_url = "https://ddragon.leagueoflegends.com/api/versions.json";
        let versions: Vec<String> = self
            .client
            .get(versions_url)
            .send()
            .await
            .map_err(|e| format!("Failed to fetch versions: {}", e))?
            .json()
            .await
            .map_err(|e| format!("Failed to parse versions: {}", e))?;

        let version = versions
            .first()
            .ok_or_else(|| "No versions available".to_string())?;

        // Fetch champion data
        let champions_url = format!(
            "{}/{}/data/en_US/champion.json",
            self.base_url, version
        );

        // We need to manually deserialize because Champion.key can be string or number
        let json_value: serde_json::Value = self
            .client
            .get(&champions_url)
            .send()
            .await
            .map_err(|e| format!("Failed to fetch champions: {}", e))?
            .json()
            .await
            .map_err(|e| format!("Failed to parse champions JSON: {}", e))?;

        let mut champions = HashMap::new();
        if let Some(data_obj) = json_value.get("data").and_then(|v| v.as_object()) {
            for (champ_id, champ_data) in data_obj {
                if let Ok(champion) = serde_json::from_value::<Champion>(champ_data.clone()) {
                    champions.insert(champ_id.clone(), champion);
                }
            }
        }

        Ok(ChampionData {
            version: version.clone(),
            champions,
        })
    }
}

#[tauri::command]
pub async fn fetch_champion_data(
    api_key: Option<String>,
    cache: tauri::State<'_, std::sync::Mutex<super::cache::ChampionCache>>,
) -> Result<ChampionData, String> {
    let client = RiotApiClient::new(api_key);
    let data = client.fetch_champion_data().await?;
    
    // Save to cache
    let cache_guard = cache.lock().map_err(|e| format!("Lock error: {}", e))?;
    cache_guard.set_data(data.clone())?;
    
    Ok(data)
}


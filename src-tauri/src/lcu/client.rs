use super::lockfile::{read_lockfile, LockfileData};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStatus {
    pub connected: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummonerInfo {
    pub summoner_id: String,
    pub account_id: String,
    pub puuid: String,
    pub display_name: String,
    pub summoner_level: i64,
    pub profile_icon_id: i64,
    pub xp_since_last_level: i64,
    pub xp_until_next_level: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RankedStats {
    pub queue_type: String,
    pub tier: String,
    pub rank: String,
    pub league_points: i32,
    pub wins: i32,
    pub losses: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchHistoryGame {
    pub game_id: i64,
    pub queue_id: i32,
    pub champion_id: i32,
    pub game_mode: String,
    pub game_creation: i64,
    pub game_duration: i32,
    pub win: bool,
    pub kills: i32,
    pub deaths: i32,
    pub assists: i32,
}

pub struct LcuClient {
    client: Client,
    lockfile_data: Option<LockfileData>,
}

impl LcuClient {
    pub fn new() -> Self {
        let client = Client::builder()
            .danger_accept_invalid_certs(true)
            .timeout(Duration::from_secs(5))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            lockfile_data: None,
        }
    }

    /// Get LCU credentials, always tries to fetch fresh credentials if not cached
    pub fn get_lockfile(&mut self) -> Result<&LockfileData, String> {
        if self.lockfile_data.is_none() {
            self.lockfile_data = Some(read_lockfile()?);
        }
        Ok(self.lockfile_data.as_ref().unwrap())
    }

    /// Clear cached credentials (useful when League client restarts)
    pub fn clear_credentials(&mut self) {
        self.lockfile_data = None;
    }

    pub async fn test_connection(&mut self) -> ConnectionStatus {
        // Clear credentials first to force a fresh check
        self.clear_credentials();

        match self.get_lockfile() {
            Ok(_) => match self.get_gameflow_phase().await {
                Ok(_) => ConnectionStatus {
                    connected: true,
                    error: None,
                },
                Err(e) => ConnectionStatus {
                    connected: false,
                    error: Some(format!("Failed to connect to LCU API: {}", e)),
                },
            },
            Err(e) => ConnectionStatus {
                connected: false,
                error: Some(e),
            },
        }
    }

    pub async fn get_gameflow_phase(&mut self) -> Result<String, String> {
        // Try with current credentials, refresh if connection fails
        let result = self.try_get_gameflow_phase().await;

        // If we got a connection error, try refreshing credentials once
        if result.is_err() {
            self.clear_credentials();
            return self.try_get_gameflow_phase().await;
        }

        result
    }

    async fn try_get_gameflow_phase(&mut self) -> Result<String, String> {
        let protocol;
        let port;
        let password;
        {
            let lockfile = self.get_lockfile()?;
            protocol = lockfile.protocol.clone();
            port = lockfile.port;
            password = lockfile.password.clone();
        }
        let base_url = format!("{}://127.0.0.1:{}", protocol, port);
        let url = format!("{}/lol-gameflow/v1/gameflow-phase", base_url);

        let response = self
            .client
            .get(&url)
            .basic_auth("riot", Some(&password))
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("HTTP error: {}", response.status()));
        }

        let phase = response
            .text()
            .await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        Ok(phase.trim_matches('"').to_string())
    }

    pub async fn get_draft_session(&mut self) -> Result<serde_json::Value, String> {
        // Try with current credentials, refresh if connection fails
        let result = self.try_get_draft_session().await;

        // If we got a connection error, try refreshing credentials once
        if result.is_err() {
            self.clear_credentials();
            return self.try_get_draft_session().await;
        }

        result
    }

    async fn try_get_draft_session(&mut self) -> Result<serde_json::Value, String> {
        let protocol;
        let port;
        let password;
        {
            let lockfile = self.get_lockfile()?;
            protocol = lockfile.protocol.clone();
            port = lockfile.port;
            password = lockfile.password.clone();
        }
        let base_url = format!("{}://127.0.0.1:{}", protocol, port);
        let url = format!("{}/lol-champ-select/v1/session", base_url);

        let response = self
            .client
            .get(&url)
            .basic_auth("riot", Some(&password))
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("HTTP error: {}", response.status()));
        }

        let session = response
            .json::<serde_json::Value>()
            .await
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;

        Ok(session)
    }

    pub async fn get_draft_state(&mut self) -> Result<super::draft::DraftState, String> {
        let session = self.get_draft_session().await?;
        super::draft::parse_draft_session(&session)
    }

    pub async fn get_current_summoner(&mut self) -> Result<SummonerInfo, String> {
        // Try with current credentials, refresh if connection fails
        let result = self.try_get_current_summoner().await;

        // If we got a connection error, try refreshing credentials once
        if result.is_err() {
            self.clear_credentials();
            return self.try_get_current_summoner().await;
        }

        result
    }

    async fn try_get_current_summoner(&mut self) -> Result<SummonerInfo, String> {
        let protocol;
        let port;
        let password;
        {
            let lockfile = self.get_lockfile()?;
            protocol = lockfile.protocol.clone();
            port = lockfile.port;
            password = lockfile.password.clone();
        }
        let base_url = format!("{}://127.0.0.1:{}", protocol, port);
        let url = format!("{}/lol-summoner/v1/current-summoner", base_url);

        let response = self
            .client
            .get(&url)
            .basic_auth("riot", Some(&password))
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("HTTP error: {}", response.status()));
        }

        let json_value: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;

        Ok(SummonerInfo {
            summoner_id: json_value["summonerId"].as_str().unwrap_or("").to_string(),
            account_id: json_value["accountId"].as_str().unwrap_or("").to_string(),
            puuid: json_value["puuid"].as_str().unwrap_or("").to_string(),
            display_name: json_value["displayName"]
                .as_str()
                .unwrap_or("Unknown")
                .to_string(),
            summoner_level: json_value["summonerLevel"].as_i64().unwrap_or(0),
            profile_icon_id: json_value["profileIconId"].as_i64().unwrap_or(0),
            xp_since_last_level: json_value["xpSinceLastLevel"].as_i64().unwrap_or(0),
            xp_until_next_level: json_value["xpUntilNextLevel"].as_i64().unwrap_or(0),
        })
    }

    pub async fn get_ranked_stats(&mut self) -> Result<Vec<RankedStats>, String> {
        // Try with current credentials, refresh if connection fails
        let result = self.try_get_ranked_stats().await;

        // If we got a connection error, try refreshing credentials once
        if result.is_err() {
            self.clear_credentials();
            return self.try_get_ranked_stats().await;
        }

        result
    }

    async fn try_get_ranked_stats(&mut self) -> Result<Vec<RankedStats>, String> {
        let protocol;
        let port;
        let password;
        {
            let lockfile = self.get_lockfile()?;
            protocol = lockfile.protocol.clone();
            port = lockfile.port;
            password = lockfile.password.clone();
        }
        let base_url = format!("{}://127.0.0.1:{}", protocol, port);
        let url = format!("{}/lol-ranked/v1/current-ranked-stats", base_url);

        let response = self
            .client
            .get(&url)
            .basic_auth("riot", Some(&password))
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("HTTP error: {}", response.status()));
        }

        let json_value: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;

        let mut ranked_stats = Vec::new();

        if let Some(queues) = json_value["queues"].as_array() {
            for queue in queues {
                if let Some(queue_type) = queue["queueType"].as_str() {
                    let tier = queue["tier"].as_str().unwrap_or("UNRANKED").to_string();
                    if tier != "NONE"
                        && (queue_type == "RANKED_SOLO_5x5" || queue_type == "RANKED_FLEX_SR")
                    {
                        ranked_stats.push(RankedStats {
                            queue_type: queue_type.to_string(),
                            tier,
                            rank: queue["division"].as_str().unwrap_or("").to_string(),
                            league_points: queue["leaguePoints"].as_i64().unwrap_or(0) as i32,
                            wins: queue["wins"].as_i64().unwrap_or(0) as i32,
                            losses: queue["losses"].as_i64().unwrap_or(0) as i32,
                        });
                    }
                }
            }
        }

        Ok(ranked_stats)
    }

    pub async fn get_match_history(&mut self) -> Result<Vec<MatchHistoryGame>, String> {
        // Try with current credentials, refresh if connection fails
        let result = self.try_get_match_history().await;

        // If we got a connection error, try refreshing credentials once
        if result.is_err() {
            self.clear_credentials();
            return self.try_get_match_history().await;
        }

        result
    }

    async fn try_get_match_history(&mut self) -> Result<Vec<MatchHistoryGame>, String> {
        // Get summoner PUUID first
        let summoner = self.get_current_summoner().await?;
        let puuid = summoner.puuid;

        let protocol;
        let port;
        let password;
        {
            let lockfile = self.get_lockfile()?;
            protocol = lockfile.protocol.clone();
            port = lockfile.port;
            password = lockfile.password.clone();
        }

        let base_url = format!("{}://127.0.0.1:{}", protocol, port);
        let url = format!(
            "{}/lol-match-history/v1/products/lol/{}/matches?begIndex=0&endIndex=10",
            base_url, puuid
        );

        let response = self
            .client
            .get(&url)
            .basic_auth("riot", Some(&password))
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("HTTP error: {}", response.status()));
        }

        let json_value: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;

        let mut games = Vec::new();

        // Try different possible structures
        let games_array = json_value["games"]["games"]
            .as_array()
            .or_else(|| json_value["games"].as_array());

        if let Some(games_arr) = games_array {
            for game in games_arr.iter().take(5) {
                let game_id = game["gameId"].as_i64().unwrap_or(0);
                let game_mode = game["gameMode"].as_str().unwrap_or("").to_string();
                let game_creation = game["gameCreation"].as_i64().unwrap_or(0);
                let game_duration = game["gameDuration"].as_i64().unwrap_or(0) as i32;
                let queue_id = game["queueId"].as_i64().unwrap_or(0) as i32;

                if let Some(participant_identities) = game["participantIdentities"].as_array() {
                    let participants_stats = game["participants"].as_array();

                    for identity in participant_identities {
                        let player = &identity["player"];
                        let player_puuid = player["puuid"].as_str();

                        if player_puuid == Some(&puuid) {
                            let participant_id = identity["participantId"].as_i64().unwrap_or(0);

                            if let Some(stats_array) = participants_stats {
                                if let Some(participant_stats) = stats_array.iter().find(|p| {
                                    p["participantId"].as_i64().unwrap_or(0) == participant_id
                                }) {
                                    let stats = &participant_stats["stats"];
                                    let champion_id =
                                        participant_stats["championId"].as_i64().unwrap_or(0)
                                            as i32;
                                    let win_str = stats["win"].as_str().unwrap_or("");
                                    let win = win_str == "Win";

                                    games.push(MatchHistoryGame {
                                        game_id,
                                        queue_id,
                                        champion_id,
                                        game_mode: game_mode.clone(),
                                        game_creation,
                                        game_duration,
                                        win,
                                        kills: stats["kills"].as_i64().unwrap_or(0) as i32,
                                        deaths: stats["deaths"].as_i64().unwrap_or(0) as i32,
                                        assists: stats["assists"].as_i64().unwrap_or(0) as i32,
                                    });
                                }
                            }
                            break;
                        }
                    }
                }
            }
        }

        Ok(games)
    }
}

// Tauri commands
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn test_connection(
    client: State<'_, Arc<tokio::sync::Mutex<LcuClient>>>,
) -> Result<ConnectionStatus, String> {
    let result = {
        let mut client_guard = client.lock().await;
        client_guard.test_connection().await
    };
    Ok(result)
}

#[tauri::command]
pub async fn get_gameflow_phase(
    client: State<'_, Arc<tokio::sync::Mutex<LcuClient>>>,
) -> Result<String, String> {
    let result = {
        let mut client_guard = client.lock().await;
        client_guard.get_gameflow_phase().await
    };
    result
}

#[tauri::command]
pub async fn get_draft_session(
    client: State<'_, Arc<tokio::sync::Mutex<LcuClient>>>,
) -> Result<serde_json::Value, String> {
    let result = {
        let mut client_guard = client.lock().await;
        client_guard.get_draft_session().await
    };
    result
}

#[tauri::command]
pub async fn get_draft_state(
    client: State<'_, Arc<tokio::sync::Mutex<LcuClient>>>,
) -> Result<super::draft::DraftState, String> {
    let result = {
        let mut client_guard = client.lock().await;
        client_guard.get_draft_state().await
    };
    result
}

#[tauri::command]
pub async fn get_current_summoner(
    client: State<'_, Arc<tokio::sync::Mutex<LcuClient>>>,
) -> Result<SummonerInfo, String> {
    let mut client_guard = client.lock().await;
    client_guard.get_current_summoner().await
}

#[tauri::command]
pub async fn get_ranked_stats(
    client: State<'_, Arc<tokio::sync::Mutex<LcuClient>>>,
) -> Result<Vec<RankedStats>, String> {
    let mut client_guard = client.lock().await;
    client_guard.get_ranked_stats().await
}

#[tauri::command]
pub async fn get_match_history(
    client: State<'_, Arc<tokio::sync::Mutex<LcuClient>>>,
) -> Result<Vec<MatchHistoryGame>, String> {
    let mut client_guard = client.lock().await;
    client_guard.get_match_history().await
}

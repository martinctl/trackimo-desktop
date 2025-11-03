use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DraftState {
    pub game_id: Option<i64>,
    pub timer: Option<f64>,
    pub phase: String,
    pub teams: Vec<Team>,
    pub actions: Vec<DraftAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Team {
    pub team_id: i64,
    pub picks: Vec<ChampionPick>,
    pub bans: Vec<ChampionBan>,
    pub cells: Vec<Cell>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cell {
    pub cell_id: i64,
    pub champion_id: Option<i64>, // Locked champion
    pub selected_champion_id: Option<i64>, // Hovered/preselected champion (not locked)
    pub assigned_position: Option<String>,
    pub spell1_id: Option<i64>,
    pub spell2_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChampionPick {
    pub champion_id: i64,
    pub cell_id: Option<i64>,
    pub completed: bool,
    pub is_ally_pick: bool,
    pub position: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChampionBan {
    pub champion_id: i64,
    pub cell_id: Option<i64>,
    pub completed: bool,
    pub is_ally_ban: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DraftAction {
    pub id: i64,
    pub actor_cell_id: Option<i64>,
    pub champion_id: Option<i64>, // For both bans and picks: hovered (when !completed) or locked (when completed)
    pub selected_champion_id: Option<i64>, // Rarely used by LCU, kept for compatibility
    pub completed: bool,
    pub is_in_progress: bool, // Whether this action is currently active
    #[serde(rename = "type")]
    pub action_type: String,
}

pub fn parse_draft_session(session: &serde_json::Value) -> Result<DraftState, String> {
    let game_id = session["gameId"].as_i64();
    
    // Timer can be in milliseconds, convert to seconds if > 1000
    let timer_raw = session["timer"]["adjustedTimeLeftInPhase"]
        .as_f64()
        .or_else(|| session["timer"]["timeLeftInPhase"].as_f64());
    let timer = timer_raw.map(|t| {
        if t > 1000.0 {
            t / 1000.0 // Convert milliseconds to seconds
        } else {
            t
        }
    });

    let phase = session["timer"]["phase"]
        .as_str()
        .unwrap_or("Unknown")
        .to_string();

    let mut teams = Vec::new();
    
    // Parse myTeam (team 100 - Blue side)
    if let Some(my_team_array) = session["myTeam"].as_array() {
        let mut picks = Vec::new();
        let mut cells = Vec::new();
        
        for cell_data in my_team_array {
            let cell_id = cell_data["cellId"].as_i64().unwrap_or(0);
            let champion_id = cell_data["championId"]
                .as_i64()
                .or_else(|| cell_data["championId"].as_str().and_then(|s| s.parse().ok()));
            
            // Try multiple fields for selected champion (LCU API varies)
            let selected_champion_id = cell_data["championPickIntent"]
                .as_i64()
                .or_else(|| cell_data["selectedChampionId"].as_i64())
                .or_else(|| cell_data["championPickIntent"].as_str().and_then(|s| s.parse().ok()))
                .or_else(|| cell_data["selectedChampionId"].as_str().and_then(|s| s.parse().ok()));
            
            cells.push(Cell {
                cell_id,
                champion_id,
                selected_champion_id,
                assigned_position: cell_data["assignedPosition"].as_str().map(|s| s.to_string()),
                spell1_id: cell_data["spell1Id"].as_i64(),
                spell2_id: cell_data["spell2Id"].as_i64(),
            });
            
            // If champion is locked (championId exists), add to picks
            if let Some(champ_id) = champion_id {
                picks.push(ChampionPick {
                    champion_id: champ_id,
                    cell_id: Some(cell_id),
                    completed: true,
                    is_ally_pick: true,
                    position: cell_data["assignedPosition"].as_str().map(|s| s.to_string()),
                });
            }
        }
        
        teams.push(Team {
            team_id: 100,
            picks,
            bans: Vec::new(),
            cells,
        });
    }
    
    // Parse theirTeam (team 200 - Red side)
    if let Some(their_team_array) = session["theirTeam"].as_array() {
        let mut picks = Vec::new();
        let mut cells = Vec::new();
        
        for cell_data in their_team_array {
            let cell_id = cell_data["cellId"].as_i64().unwrap_or(0);
            let champion_id = cell_data["championId"]
                .as_i64()
                .or_else(|| cell_data["championId"].as_str().and_then(|s| s.parse().ok()));
            
            // Try multiple fields for selected champion (LCU API varies)
            let selected_champion_id = cell_data["championPickIntent"]
                .as_i64()
                .or_else(|| cell_data["selectedChampionId"].as_i64())
                .or_else(|| cell_data["championPickIntent"].as_str().and_then(|s| s.parse().ok()))
                .or_else(|| cell_data["selectedChampionId"].as_str().and_then(|s| s.parse().ok()));
            
            cells.push(Cell {
                cell_id,
                champion_id,
                selected_champion_id,
                assigned_position: cell_data["assignedPosition"].as_str().map(|s| s.to_string()),
                spell1_id: cell_data["spell1Id"].as_i64(),
                spell2_id: cell_data["spell2Id"].as_i64(),
            });
            
            if let Some(champ_id) = champion_id {
                picks.push(ChampionPick {
                    champion_id: champ_id,
                    cell_id: Some(cell_id),
                    completed: true,
                    is_ally_pick: false,
                    position: cell_data["assignedPosition"].as_str().map(|s| s.to_string()),
                });
            }
        }
        
        teams.push(Team {
            team_id: 200,
            picks,
            bans: Vec::new(),
            cells,
        });
    }
    
    // Parse bans from actions
    let actions = session["actions"]
        .as_array()
        .map(|actions_array| {
            actions_array
                .iter()
                .flat_map(|action_array| {
                    action_array.as_array().map(|inner_array| {
                        inner_array
                            .iter()
                            .filter_map(|action| {
                                Some(DraftAction {
                                    id: action["id"].as_i64()?,
                                    actor_cell_id: action["actorCellId"].as_i64(),
                                    champion_id: action["championId"]
                                        .as_i64()
                                        .or_else(|| action["championId"].as_str().and_then(|s| s.parse().ok())),
                                    selected_champion_id: action["selectedChampionId"]
                                        .as_i64()
                                        .or_else(|| action["selectedChampionId"].as_str().and_then(|s| s.parse().ok())),
                                    completed: action["completed"].as_bool().unwrap_or(false),
                                    is_in_progress: action["isInProgress"].as_bool().unwrap_or(false),
                                    action_type: action["type"].as_str()?.to_string(),
                                })
                            })
                            .collect::<Vec<_>>()
                    })
                })
                .flatten()
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    
    // Extract bans from actions and assign to correct teams
    // First, collect all cell_ids for each team
    let team_100_cell_ids: HashSet<i64> = teams
        .iter()
        .find(|t| t.team_id == 100)
        .map(|t| t.cells.iter().map(|c| c.cell_id).collect())
        .unwrap_or_default();
    
    let team_200_cell_ids: HashSet<i64> = teams
        .iter()
        .find(|t| t.team_id == 200)
        .map(|t| t.cells.iter().map(|c| c.cell_id).collect())
        .unwrap_or_default();
    
    let mut team_100_bans = Vec::new();
    let mut team_200_bans = Vec::new();
    
    for action in &actions {
        if action.action_type == "ban" {
            if let Some(champ_id) = action.champion_id {
                // Determine which team this ban belongs to based on actor_cell_id
                let belongs_to_team_100 = if let Some(cell_id) = action.actor_cell_id {
                    // Check if the cell_id belongs to team 100's cells
                    if team_100_cell_ids.contains(&cell_id) {
                        true
                    } else if team_200_cell_ids.contains(&cell_id) {
                        false
                    } else {
                        // Fallback: Cells 0-4 are typically team 100, 5-9 are team 200
                        cell_id < 5
                    }
                } else {
                    // If no actor_cell_id, can't determine team - skip this ban
                    continue;
                };
                
                let ban = ChampionBan {
                    champion_id: champ_id,
                    cell_id: action.actor_cell_id,
                    completed: action.completed,
                    is_ally_ban: belongs_to_team_100,
                };
                
                if belongs_to_team_100 {
                    team_100_bans.push(ban);
                } else {
                    team_200_bans.push(ban);
                }
            }
        }
    }
    
    // Assign bans to the correct teams
    for team in teams.iter_mut() {
        if team.team_id == 100 {
            team.bans = team_100_bans.clone();
        } else if team.team_id == 200 {
            team.bans = team_200_bans.clone();
        }
    }
    
    // Process preselection status - normalize and clean up
    // For picks, the cell's selectedChampionId field from the LCU already contains
    // the hovered champion. We just need to normalize 0 values to None.
    // This is different from bans, where we read from actions.
    for team in teams.iter_mut() {
        for cell in team.cells.iter_mut() {
            // Normalize selected_champion_id = 0 to None
            if cell.selected_champion_id == Some(0) {
                cell.selected_champion_id = None;
            }
            // Normalize champion_id = 0 to None
            if cell.champion_id == Some(0) {
                cell.champion_id = None;
            }
        }
    }

    Ok(DraftState {
        game_id,
        timer,
        phase,
        teams,
        actions,
    })
}


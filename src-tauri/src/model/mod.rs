use crate::lcu::draft::DraftState;
use ndarray::{Array, CowArray, IxDyn};
use ort::{Environment, GraphOptimizationLevel, LoggingLevel, Session, SessionBuilder, Value};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;

#[derive(Debug, Deserialize)]
struct Metadata {
    feature_dim: usize,
    num_champions: usize,
    champion_mapping: ChampionMapping,
    #[allow(dead_code)]
    model_config: ModelConfig,
    roles: HashMap<String, u8>,
}

#[derive(Debug, Deserialize)]
struct ChampionMapping {
    #[serde(rename = "idx_to_champion")]
    idx_to_champion: HashMap<String, u32>,
    #[serde(rename = "champion_to_idx")]
    champion_to_idx: HashMap<String, usize>,
}

#[derive(Debug, Deserialize)]
struct ModelConfig {
    #[allow(dead_code)]
    hidden_dim: usize,
    #[allow(dead_code)]
    num_layers: usize,
    #[allow(dead_code)]
    use_lstm: bool,
}

#[derive(Debug, Serialize)]
pub struct ChampionRecommendation {
    pub champion_id: u32,
    pub score: f32,
}

#[derive(Debug, Serialize)]
pub struct Recommendations {
    pub recommendations: Vec<ChampionRecommendation>,
    pub win_probability: f32,
}

pub struct DraftRecommendationModel {
    session: std::sync::Mutex<Session>,
    metadata: Metadata,
}

impl DraftRecommendationModel {
    pub fn new(model_path: &str, metadata_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        // Create ONNX environment
        let environment = Environment::builder()
            .with_name("draft_recommender")
            .with_log_level(LoggingLevel::Warning)
            .build()?
            .into_arc();

        // Load ONNX model
        let session = SessionBuilder::new(&environment)?
            .with_optimization_level(GraphOptimizationLevel::Level3)?
            .with_intra_threads(4)?
            .with_model_from_file(model_path)?;

        // Load metadata
        let metadata_json = std::fs::read_to_string(metadata_path)?;
        let metadata: Metadata = serde_json::from_str(&metadata_json)?;

        Ok(Self { 
            session: std::sync::Mutex::new(session), 
            metadata 
        })
    }

    pub fn get_recommendations(
        &self,
        draft_state: &DraftState,
        top_k: usize,
        player_role: Option<&str>,
    ) -> Result<Recommendations, Box<dyn std::error::Error>> {
        // Extract features
        let features = self.extract_features(draft_state, player_role)?;

        // Get available champions mask
        let available_mask = self.get_available_champions_mask(draft_state);

        // Prepare inputs as ndarray arrays
        // features: [1, 1, feature_dim]
        let features_array = Array::from_shape_vec(
            IxDyn(&[1, 1, self.metadata.feature_dim]),
            features,
        )?;

        // available_champions: [1, num_champions]
        let available_array = Array::from_shape_vec(
            IxDyn(&[1, self.metadata.num_champions]),
            available_mask,
        )?;

        // Run inference
        let session = self.session.lock()
            .map_err(|e| format!("Failed to lock session: {:?}", e))?;
        
        // Convert to CowArray for ort API
        let features_cow: CowArray<f32, _> = CowArray::from(&features_array);
        let available_cow: CowArray<f32, _> = CowArray::from(&available_array);
        
        let outputs = session.run(vec![
            Value::from_array(session.allocator(), &features_cow)?,
            Value::from_array(session.allocator(), &available_cow)?,
        ])?;

        // Extract outputs - ort 1.16 returns tensors directly
        let champion_logits = outputs[0]
            .try_extract()?
            .view()
            .to_owned();
        let win_probability = outputs[1]
            .try_extract()?
            .view()
            .to_owned();

        // Reshape to expected dimensions if needed
        let champion_logits_2d = champion_logits
            .into_shape((1, self.metadata.num_champions))
            .map_err(|e| format!("Failed to reshape champion_logits: {:?}", e))?;

        // Apply softmax to get probabilities
        let logits_1d = champion_logits_2d.row(0);
        let max_logit = logits_1d.iter().fold(f32::NEG_INFINITY, |a, &b| a.max(b));
        let exp_logits: Vec<f32> = logits_1d.iter().map(|&x| (x - max_logit).exp()).collect();
        let sum_exp: f32 = exp_logits.iter().sum();
        let probabilities: Vec<f32> = exp_logits.iter().map(|&x| x / sum_exp).collect();

        // Get top-k recommendations
        let mut indexed_probs: Vec<(usize, f32)> =
            probabilities.iter().enumerate().map(|(i, &p)| (i, p)).collect();
        indexed_probs.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        let recommendations: Vec<ChampionRecommendation> = indexed_probs
            .iter()
            .take(top_k)
            .filter_map(|(idx, prob)| {
                let champion_id_str = idx.to_string();
                let champion_id = self.metadata.champion_mapping.idx_to_champion
                    .get(&champion_id_str)
                    .copied()?;
                Some(ChampionRecommendation {
                    champion_id,
                    score: *prob,
                })
            })
            .collect();

        // Get win probability
        let win_prob_slice = win_probability.as_slice().ok_or("Failed to get win_probability slice")?;
        let win_prob = win_prob_slice[0];
        
        // Determine player's team (not the team currently picking!)
        let player_team = self.get_player_team(draft_state);
        let win_prob_adjusted = if player_team == 200 {
            1.0 - win_prob // Red team - invert blue team prediction
        } else {
            win_prob
        };

        Ok(Recommendations {
            recommendations,
            win_probability: win_prob_adjusted,
        })
    }

    fn extract_features(&self, draft_state: &DraftState, player_role: Option<&str>) -> Result<Vec<f32>, Box<dyn std::error::Error>> {
        let mut features = Vec::with_capacity(self.metadata.feature_dim);

        // Get team data
        let blue_team = draft_state.teams.iter().find(|t| t.team_id == 100);
        let red_team = draft_state.teams.iter().find(|t| t.team_id == 200);

        // Collect locked picks
        let blue_locked: Vec<u32> = blue_team
            .map(|t| t.picks.iter().map(|p| p.champion_id as u32).collect())
            .unwrap_or_default();
        let red_locked: Vec<u32> = red_team
            .map(|t| t.picks.iter().map(|p| p.champion_id as u32).collect())
            .unwrap_or_default();
        
        // Collect pre-selected champions (hovered but not locked) from cells
        let mut blue_preselected: Vec<u32> = Vec::new();
        if let Some(team) = blue_team {
            for cell in &team.cells {
                // Include pre-selected if not already locked
                if let Some(selected_id) = cell.selected_champion_id {
                    if cell.champion_id.is_none() && selected_id > 0 {
                        blue_preselected.push(selected_id as u32);
                    }
                }
            }
        }
        
        let mut red_preselected: Vec<u32> = Vec::new();
        if let Some(team) = red_team {
            for cell in &team.cells {
                // Include pre-selected if not already locked
                if let Some(selected_id) = cell.selected_champion_id {
                    if cell.champion_id.is_none() && selected_id > 0 {
                        red_preselected.push(selected_id as u32);
                    }
                }
            }
        }
        
        // Combine locked and pre-selected for feature encoding
        let mut blue_picks = blue_locked.clone();
        blue_picks.extend_from_slice(&blue_preselected);
        
        let mut red_picks = red_locked.clone();
        red_picks.extend_from_slice(&red_preselected);
        
        let all_bans: Vec<u32> = draft_state
            .teams
            .iter()
            .flat_map(|t| t.bans.iter().map(|b| b.champion_id as u32))
            .collect();

        // Champion encodings (one-hot) - includes both locked and pre-selected
        features.extend(self.encode_champion_list(&blue_picks));
        features.extend(self.encode_champion_list(&red_picks));
        features.extend(self.encode_champion_list(&all_bans));

        // Calculate step (total picks + bans completed) - use locked picks for step count
        let step = blue_locked.len() + red_locked.len() + all_bans.len();

        // Draft progress - use locked picks for progress
        features.push(step as f32 / 10.0); // Step normalized
        features.push(blue_locked.len() as f32 / 5.0); // Blue progress
        features.push(red_locked.len() as f32 / 5.0); // Red progress

        // Determine current team and role (use player_role if provided)
        let (current_team, role) = self.get_current_team_and_role(draft_state, player_role);

        // Team indicator
        features.push(if current_team == 100 { 1.0 } else { 0.0 });

        // Role features
        let pick_number = if current_team == 100 {
            blue_picks.len() + 1
        } else {
            red_picks.len() + 1
        };
        features.push(pick_number as f32 / 5.0); // Pick number normalized

        // Role one-hot (5 dims)
        let role_idx = self.metadata.roles.get(&role).copied().unwrap_or(0) as usize;
        for i in 0..5 {
            features.push(if i == role_idx { 1.0 } else { 0.0 });
        }

        // Pick phase one-hot (3 dims)
        let phase = if pick_number <= 2 {
            [1.0, 0.0, 0.0] // Early
        } else if pick_number <= 4 {
            [0.0, 1.0, 0.0] // Mid
        } else {
            [0.0, 0.0, 1.0] // Late
        };
        features.extend_from_slice(&phase);

        // Available champions mask (duplicate, can be zeros)
        features.extend(vec![0.0; self.metadata.num_champions]);

        // Meta statistics (simplified - set to defaults)
        features.extend_from_slice(&[0.5, 0.5, 0.0, 0.0]); // win rates, pick rates

        // Ensure we have exactly feature_dim features
        if features.len() != self.metadata.feature_dim {
            return Err(format!(
                "Feature dimension mismatch: expected {}, got {}",
                self.metadata.feature_dim,
                features.len()
            ).into());
        }

        Ok(features)
    }

    fn encode_champion_list(&self, champion_ids: &[u32]) -> Vec<f32> {
        let mut vec = vec![0.0; self.metadata.num_champions];
        for &champ_id in champion_ids {
            let champ_id_str = champ_id.to_string();
            if let Some(&idx) = self.metadata.champion_mapping.champion_to_idx.get(&champ_id_str) {
                if idx < vec.len() {
                    vec[idx] = 1.0;
                }
            }
        }
        vec
    }

    fn get_available_champions_mask(&self, draft_state: &DraftState) -> Vec<f32> {
        let mut unavailable: HashSet<u32> = draft_state
            .teams
            .iter()
            .flat_map(|t| {
                t.picks
                    .iter()
                    .map(|p| p.champion_id as u32)
                    .chain(t.bans.iter().map(|b| b.champion_id as u32))
            })
            .collect();
        
        // Also exclude pre-selected champions (hovered but not locked)
        for team in &draft_state.teams {
            for cell in &team.cells {
                // Add locked champions (already included above, but check anyway)
                if let Some(champ_id) = cell.champion_id {
                    unavailable.insert(champ_id as u32);
                }
                // Add pre-selected champions
                if let Some(selected_id) = cell.selected_champion_id {
                    if selected_id > 0 {
                        unavailable.insert(selected_id as u32);
                    }
                }
            }
        }

        (0..self.metadata.num_champions)
            .map(|idx| {
                let champ_id_str = idx.to_string();
                let champ_id = self.metadata.champion_mapping.idx_to_champion
                    .get(&champ_id_str)
                    .copied()
                    .unwrap_or(0);
                if unavailable.contains(&champ_id) {
                    0.0
                } else {
                    1.0
                }
            })
            .collect()
    }

    fn get_current_team_and_role(&self, draft_state: &DraftState, player_role: Option<&str>) -> (i64, String) {
        // Determine the player's actual team from local_player_cell_id
        // This is the team we're generating recommendations FOR, not the team currently picking
        let player_team = self.get_player_team(draft_state);
        
        // If player role is provided by the frontend, use it (highest priority)
        if let Some(role) = player_role {
            return (player_team, role.to_uppercase());
        }
        
        // Try to get role from the player's cell
        if let Some(player_cell_id) = draft_state.local_player_cell_id {
            for team in &draft_state.teams {
                if let Some(cell) = team.cells.iter().find(|c| c.cell_id == player_cell_id) {
                    if let Some(position) = &cell.assigned_position {
                        // Normalize to uppercase for consistency
                        return (player_team, position.to_uppercase());
                    }
                }
            }
        }

        // Fallback: default to TOP
        (player_team, "TOP".to_string())
    }
    
    fn get_player_team(&self, draft_state: &DraftState) -> i64 {
        // Get the player's team from their cell_id
        if let Some(player_cell_id) = draft_state.local_player_cell_id {
            for team in &draft_state.teams {
                if team.cells.iter().any(|c| c.cell_id == player_cell_id) {
                    return team.team_id;
                }
            }
            // Fallback based on cell_id: 0-4 are team 100, 5-9 are team 200
            if player_cell_id < 5 {
                return 100;
            } else {
                return 200;
            }
        }
        
        // Ultimate fallback: assume blue team
        100
    }
}

#[tauri::command]
pub async fn get_draft_recommendations(
    draft_state: DraftState,
    top_k: Option<usize>,
    player_role: Option<String>,
    model: tauri::State<'_, std::sync::Mutex<Option<Arc<DraftRecommendationModel>>>>,
) -> Result<Recommendations, String> {
    let model_guard = model.lock()
        .map_err(|e| format!("Failed to lock model state: {:?}", e))?;
    
    let model = model_guard.as_ref()
        .ok_or_else(|| "Draft recommendation model is not available. Model files may be missing.".to_string())?;
    
    let top_k = top_k.unwrap_or(5);
    model
        .get_recommendations(&draft_state, top_k, player_role.as_deref())
        .map_err(|e| e.to_string())
}

pub fn initialize_model(app_handle: &tauri::AppHandle) -> Result<Arc<DraftRecommendationModel>, Box<dyn std::error::Error>> {
    // Try multiple paths in order of preference
    
    // 1. Try relative to current working directory (development)
    let cwd_model = PathBuf::from("model/model.onnx");
    let cwd_metadata = PathBuf::from("model/metadata.json");
    
    // 2. Try resource directory (production)
    let resource_dir_result = app_handle.path().resource_dir();
    let resource_model = resource_dir_result
        .as_ref()
        .ok()
        .map(|d| d.join("model").join("model.onnx"));
    let resource_metadata = resource_dir_result
        .as_ref()
        .ok()
        .map(|d| d.join("model").join("metadata.json"));
    
    // 3. Try executable directory
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()));
    let exe_model = exe_dir.as_ref().map(|d| d.join("model").join("model.onnx"));
    let exe_metadata = exe_dir.as_ref().map(|d| d.join("model").join("metadata.json"));
    
    // Find the first existing model/metadata pair
    let (model_path, metadata_path) = if cwd_model.exists() && cwd_metadata.exists() {
        (cwd_model, cwd_metadata)
    } else if let (Some(ref rm), Some(ref rm_meta)) = (resource_model, resource_metadata) {
        if rm.exists() && rm_meta.exists() {
            (rm.clone(), rm_meta.clone())
        } else if let (Some(ref em), Some(ref em_meta)) = (exe_model, exe_metadata) {
            if em.exists() && em_meta.exists() {
                (em.clone(), em_meta.clone())
            } else {
                return Err(format!(
                    "Model files not found. Checked:\n  CWD: {:?}\n  Resource: {:?}\n  Exe dir: {:?}",
                    cwd_model, rm, em
                ).into());
            }
        } else {
            return Err(format!(
                "Model files not found. Checked:\n  CWD: {:?}\n  Resource: {:?}",
                cwd_model, rm
            ).into());
        }
    } else if let (Some(ref em), Some(ref em_meta)) = (exe_model, exe_metadata) {
        if em.exists() && em_meta.exists() {
            (em.clone(), em_meta.clone())
        } else {
            return Err(format!(
                "Model files not found. Checked:\n  CWD: {:?}\n  Exe dir: {:?}",
                cwd_model, em
            ).into());
        }
    } else {
        return Err(format!(
            "Model files not found. Checked:\n  CWD: {:?}\n  Resource dir: {:?}",
            cwd_model, resource_dir_result
        ).into());
    };

    let model = DraftRecommendationModel::new(
        model_path.to_str().ok_or("Invalid model path")?,
        metadata_path.to_str().ok_or("Invalid metadata path")?,
    )?;

    Ok(Arc::new(model))
}


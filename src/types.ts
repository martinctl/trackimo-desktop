export interface DraftState {
  game_id?: number;
  timer?: number;
  phase: string;
  teams: Team[];
  actions: DraftAction[];
  local_player_cell_id?: number; // The current player's cell ID from LCU
}

export interface Team {
  team_id: number;
  picks: ChampionPick[];
  bans: ChampionBan[];
  cells: Cell[];
}

export interface Cell {
  cell_id: number;
  champion_id?: number;
  selected_champion_id?: number; // Preselected but not locked
  assigned_position?: string;
  spell1_id?: number;
  spell2_id?: number;
}

export interface ChampionPick {
  champion_id: number;
  cell_id?: number;
  completed: boolean;
  is_ally_pick: boolean;
  position?: string;
}

export interface ChampionBan {
  champion_id: number;
  cell_id?: number;
  completed: boolean;
  is_ally_ban: boolean;
}

export interface DraftAction {
  id: number;
  actor_cell_id?: number;
  champion_id?: number;
  completed: boolean;
  is_in_progress: boolean; // Whether this action is currently active (player's turn)
  type: string; // Will be serialized from action_type in Rust
}

export interface Champion {
  id: string;
  key: number;
  name: string;
  title: string;
  tags: string[];
}

export interface SummonerInfo {
  summoner_id: string;
  account_id: string;
  puuid: string;
  display_name: string;
  game_name?: string;
  tag_line?: string;
  summoner_level: number;
  profile_icon_id: number;
  xp_since_last_level: number;
  xp_until_next_level: number;
}

export interface RankedStats {
  queue_type: string;
  tier: string;
  rank: string;
  league_points: number;
  wins: number;
  losses: number;
}

export interface MatchHistoryGame {
  game_id: number;
  queue_id: number;
  champion_id: number;
  game_mode: string;
  game_creation: number;
  game_duration: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
}

use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockfileData {
    pub process_name: String,
    pub process_id: u32,
    pub port: u16,
    pub password: String,
    pub protocol: String,
}

pub fn get_lockfile_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    
    // Primary location: %LOCALAPPDATA%\Riot Games\League of Legends\lockfile
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        paths.push(
            PathBuf::from(&local_app_data)
                .join("Riot Games")
                .join("League of Legends")
                .join("lockfile")
        );
        
        // Also try with Riot Client subfolder (newer client versions)
        paths.push(
            PathBuf::from(&local_app_data)
                .join("Riot Games")
                .join("Riot Client")
                .join("lockfile")
        );
    }
    
    // Alternative: Check common installation paths
    let program_files_paths = vec![
        "C:\\Riot Games\\League of Legends\\lockfile",
        "C:\\Program Files\\Riot Games\\League of Legends\\lockfile",
        "C:\\Program Files (x86)\\Riot Games\\League of Legends\\lockfile",
    ];
    
    for path_str in program_files_paths {
        paths.push(PathBuf::from(path_str));
    }
    
    paths
}

pub fn read_lockfile() -> Result<LockfileData, String> {
    let paths = get_lockfile_paths();
    let mut errors = Vec::new();
    
    for lockfile_path in paths {
        if lockfile_path.exists() {
            match fs::read_to_string(&lockfile_path) {
                Ok(contents) => return parse_lockfile(&contents),
                Err(e) => {
                    errors.push(format!("Failed to read {}: {}", lockfile_path.display(), e));
                }
            }
        } else {
            errors.push(format!("Not found: {}", lockfile_path.display()));
        }
    }
    
    Err(format!(
        "Lockfile not found in any of the checked locations:\n{}\n\nMake sure League of Legends client is running.",
        errors.join("\n")
    ))
}

pub fn parse_lockfile(contents: &str) -> Result<LockfileData, String> {
    // Lockfile format: "PROCESS_NAME:PROCESS_ID:PORT:PASSWORD:PROTOCOL"
    let parts: Vec<&str> = contents.trim().split(':').collect();
    
    if parts.len() != 5 {
        return Err(format!(
            "Invalid lockfile format. Expected 5 parts, got {}",
            parts.len()
        ));
    }

    let process_name = parts[0].to_string();
    let process_id = parts[1]
        .parse::<u32>()
        .map_err(|e| format!("Failed to parse process ID: {}", e))?;
    let port = parts[2]
        .parse::<u16>()
        .map_err(|e| format!("Failed to parse port: {}", e))?;
    let password = parts[3].to_string();
    let protocol = parts[4].to_string();

    Ok(LockfileData {
        process_name,
        process_id,
        port,
        password,
        protocol,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_lockfile() {
        let contents = "LeagueClient:12345:54321:password:https";
        let result = parse_lockfile(contents).unwrap();
        
        assert_eq!(result.process_name, "LeagueClient");
        assert_eq!(result.process_id, 12345);
        assert_eq!(result.port, 54321);
        assert_eq!(result.password, "password");
        assert_eq!(result.protocol, "https");
    }
}


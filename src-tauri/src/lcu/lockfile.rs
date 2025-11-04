use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockfileData {
    pub process_name: String,
    pub process_id: u32,
    pub port: u16,
    pub password: String,
    pub protocol: String,
}

/// Retrieves LCU credentials, trying lockfile first (fast), then falling back to process list
pub fn read_lockfile() -> Result<LockfileData, String> {
    // First, try to read from lockfile (fastest method)
    if let Ok(data) = read_lockfile_from_path() {
        return Ok(data);
    }

    // Fallback to process list method
    let commandline = get_process_commandline()?;
    extract_credentials(&commandline)
}

/// Try to read lockfile from common installation paths
fn read_lockfile_from_path() -> Result<LockfileData, String> {
    let lockfile_paths = get_lockfile_paths();
    for path in lockfile_paths {
        if let Ok(data) = try_read_lockfile(&path) {
            return Ok(data);
        }
    }
    Err("Lockfile not found in common locations".to_string())
}

/// Get common lockfile paths based on platform
fn get_lockfile_paths() -> Vec<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let mut paths = Vec::new();
        
        // Common Windows installation paths
        if let Ok(program_files) = std::env::var("ProgramFiles") {
            paths.push(PathBuf::from(format!(
                "{}\\Riot Games\\League of Legends\\lockfile",
                program_files
            )));
        }
        if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
            paths.push(PathBuf::from(format!(
                "{}\\Riot Games\\League of Legends\\lockfile",
                program_files_x86
            )));
        }
        
        // User's local app data (for some installations)
        if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
            paths.push(PathBuf::from(format!(
                "{}\\Riot Games\\League of Legends\\lockfile",
                local_appdata
            )));
        }
        
        paths
    }

    #[cfg(target_os = "macos")]
    {
        vec![
            PathBuf::from("/Applications/League of Legends.app/Contents/LoL/lockfile"),
            PathBuf::from("/Applications/League of Legends.app/Contents/LoL/LeagueClient.app/Contents/Lockups/lockfile"),
            PathBuf::from("~/Library/Application Support/League of Legends/lockfile"),
        ]
    }

    #[cfg(target_os = "linux")]
    {
        vec![
            PathBuf::from("~/.wine/drive_c/Riot Games/League of Legends/lockfile"),
            PathBuf::from("~/.local/share/Riot Games/League of Legends/lockfile"),
        ]
    }
}

/// Try to read and parse lockfile from a specific path
fn try_read_lockfile(path: &PathBuf) -> Result<LockfileData, String> {
    let expanded_path = path
        .to_string_lossy()
        .replace("~", &std::env::var("HOME").unwrap_or_default());
    let path_buf = PathBuf::from(&expanded_path);
    if !path_buf.exists() {
        return Err("Path does not exist".to_string());
    }
    let contents = fs::read_to_string(&path_buf)
        .map_err(|e| format!("Failed to read lockfile: {}", e))?;
    parse_lockfile_contents(&contents)
}

/// Parse lockfile contents (format: "Process Name : PID : Port : Password : Protocol")
fn parse_lockfile_contents(contents: &str) -> Result<LockfileData, String> {
    let line = contents.lines().next().ok_or("Lockfile is empty")?;
    let parts: Vec<&str> = line.split(':').collect();
    if parts.len() < 5 {
        return Err("Invalid lockfile format".to_string());
    }
    let process_name = parts[0].to_string();
    let process_id = parts[1]
        .parse::<u32>()
        .map_err(|e| format!("Failed to parse process ID: {}", e))?;
    let port = parts[2]
        .parse::<u16>()
        .map_err(|e| format!("Failed to parse port: {}", e))?;
    let password = parts[3].to_string();
    let protocol = parts[4].trim().to_string();

    Ok(LockfileData {
        process_name,
        process_id,
        port,
        password,
        protocol,
    })
}

#[cfg(target_os = "windows")]
fn get_process_commandline() -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    
    // CREATE_NO_WINDOW flag (0x08000000) to prevent console window from appearing
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    
    let output = Command::new("wmic")
        .args([
            "PROCESS",
            "WHERE",
            "name='LeagueClientUx.exe'",
            "GET",
            "commandline",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to execute wmic command: {}", e))?;

    if !output.status.success() {
        return Err(
            "wmic command failed. Make sure League of Legends client is running.".to_string(),
        );
    }

    let output_str = String::from_utf8_lossy(&output.stdout);
    // Filter out empty lines and the "CommandLine" header
    let lines: Vec<&str> = output_str
        .lines()
        .filter(|line| {
            let trimmed = line.trim();
            !trimmed.is_empty() && trimmed != "CommandLine"
        })
        .collect();

    if lines.is_empty() {
        return Err(
            "LeagueClientUx.exe process not found. Make sure League of Legends client is running."
                .to_string(),
        );
    }

    Ok(lines.join(" "))
}

#[cfg(target_os = "macos")]
fn get_process_commandline() -> Result<String, String> {
    // Use ps with grep to be more efficient - only get LeagueClientUx processes
    // Note: grep returns non-zero exit code when no matches found, so we check stdout instead
    let output = Command::new("sh")
        .args(["-c", "ps -A | grep LeagueClientUx | grep -v grep"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to execute ps command: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    let lines: Vec<&str> = output_str
        .lines()
        .filter(|line| !line.trim().is_empty())
        .collect();

    if lines.is_empty() {
        return Err(
            "LeagueClientUx process not found. Make sure League of Legends client is running."
                .to_string(),
        );
    }

    // Take the first matching line
    Ok(lines[0].to_string())
}

#[cfg(target_os = "linux")]
fn get_process_commandline() -> Result<String, String> {
    // Use ps with grep to be more efficient
    // Note: grep returns non-zero exit code when no matches found, so we check stdout instead
    let output = Command::new("sh")
        .args(["-c", "ps -A -o args= | grep LeagueClientUx | grep -v grep"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to execute ps command: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    let lines: Vec<&str> = output_str
        .lines()
        .filter(|line| !line.trim().is_empty())
        .collect();

    if lines.is_empty() {
        return Err(
            "LeagueClientUx process not found. Make sure League of Legends client is running."
                .to_string(),
        );
    }

    Ok(lines[0].to_string())
}

fn extract_credentials(commandline: &str) -> Result<LockfileData, String> {
    // Regex patterns to extract port and password (auth token)
    let port_regex = Regex::new(r"--app-port=([0-9]+)")
        .map_err(|e| format!("Failed to compile port regex: {}", e))?;
    let password_regex = Regex::new(r"--remoting-auth-token=([\w-]+)")
        .map_err(|e| format!("Failed to compile password regex: {}", e))?;

    // Extract port
    let port = port_regex
        .captures(commandline)
        .and_then(|cap| cap.get(1))
        .ok_or_else(|| "Could not find --app-port in process commandline".to_string())?
        .as_str()
        .parse::<u16>()
        .map_err(|e| format!("Failed to parse port number: {}", e))?;

    // Extract password (auth token)
    let password = password_regex
        .captures(commandline)
        .and_then(|cap| cap.get(1))
        .ok_or_else(|| "Could not find --remoting-auth-token in process commandline".to_string())?
        .as_str()
        .to_string();

    // Protocol is always https for LCU API
    let protocol = "https".to_string();
    let process_name = "LeagueClient".to_string();

    // Try to extract process ID if available (optional)
    let process_id = extract_process_id(commandline).unwrap_or(0);

    Ok(LockfileData {
        process_name,
        process_id,
        port,
        password,
        protocol,
    })
}

#[cfg(target_os = "windows")]
fn extract_process_id(_commandline: &str) -> Option<u32> {
    // On Windows, wmic doesn't include PID in the commandline output by default
    // We could parse it from the output, but it's not critical for functionality
    None
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn extract_process_id(commandline: &str) -> Option<u32> {
    // On macOS/Linux, ps output typically starts with PID
    // Try to extract it from the beginning of the line
    let parts: Vec<&str> = commandline.split_whitespace().collect();
    if !parts.is_empty() {
        parts[0].parse::<u32>().ok()
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_credentials() {
        let commandline = r#"LeagueClientUx.exe --app-port=54321 --remoting-auth-token=abc123def456 --some-other-arg"#;
        let result = extract_credentials(commandline).unwrap();

        assert_eq!(result.port, 54321);
        assert_eq!(result.password, "abc123def456");
        assert_eq!(result.protocol, "https");
        assert_eq!(result.process_name, "LeagueClient");
    }

    #[test]
    fn test_extract_credentials_macos_format() {
        let commandline = r#"12345 ttys000  0:00.00 /Applications/League of Legends.app/Contents/LoL/Riot Games/League of Legends.app/Contents/MacOS/LeagueClientUx --app-port=54321 --remoting-auth-token=xyz789token --other-args"#;
        let result = extract_credentials(commandline).unwrap();

        assert_eq!(result.port, 54321);
        assert_eq!(result.password, "xyz789token");
        assert_eq!(result.protocol, "https");
    }
}

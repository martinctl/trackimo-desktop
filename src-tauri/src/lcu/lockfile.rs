use regex::Regex;
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockfileData {
    pub process_name: String,
    pub process_id: u32,
    pub port: u16,
    pub password: String,
    pub protocol: String,
}

/// Retrieves LCU credentials by querying the process list
/// This method is more reliable than reading the lockfile as it doesn't require
/// knowing the installation directory
pub fn read_lockfile() -> Result<LockfileData, String> {
    let commandline = get_process_commandline()?;
    extract_credentials(&commandline)
}

#[cfg(target_os = "windows")]
fn get_process_commandline() -> Result<String, String> {
    let output = Command::new("wmic")
        .args([
            "PROCESS",
            "WHERE",
            "name='LeagueClientUx.exe'",
            "GET",
            "commandline",
        ])
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
    let output = Command::new("ps")
        .args(["-A"])
        .output()
        .map_err(|e| format!("Failed to execute ps command: {}", e))?;

    if !output.status.success() {
        return Err("ps command failed.".to_string());
    }

    let output_str = String::from_utf8_lossy(&output.stdout);

    // Filter lines containing LeagueClientUx
    let lines: Vec<&str> = output_str
        .lines()
        .filter(|line| line.contains("LeagueClientUx"))
        .collect();

    if lines.is_empty() {
        return Err(
            "LeagueClientUx process not found. Make sure League of Legends client is running."
                .to_string(),
        );
    }

    // Take the first matching line and extract everything after the process name
    // Format is typically: "PID TTY TIME CMD ... full command line ..."
    let line = lines[0];
    Ok(line.to_string())
}

#[cfg(target_os = "linux")]
fn get_process_commandline() -> Result<String, String> {
    let output = Command::new("ps")
        .args(["-A", "-o", "args="])
        .output()
        .map_err(|e| format!("Failed to execute ps command: {}", e))?;

    if !output.status.success() {
        return Err("ps command failed.".to_string());
    }

    let output_str = String::from_utf8_lossy(&output.stdout);

    // Filter lines containing LeagueClientUx
    let lines: Vec<&str> = output_str
        .lines()
        .filter(|line| line.contains("LeagueClientUx"))
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

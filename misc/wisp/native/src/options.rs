use parking_lot::RwLock;
use serde::Deserialize;
use std::collections::HashSet;
use std::sync::LazyLock;

#[derive(Debug, Clone, Deserialize)]
pub struct Options {
    #[serde(default)]
    pub hostname_blacklist: Option<HashSet<String>>,
    #[serde(default)]
    pub hostname_whitelist: Option<HashSet<String>>,
    #[serde(default)]
    pub port_blacklist: Option<Vec<u16>>,
    #[serde(default)]
    pub port_whitelist: Option<Vec<u16>>,
    #[serde(default = "default_true")]
    pub allow_direct_ip: bool,
    #[serde(default)]
    pub allow_private_ips: bool,
    #[serde(default)]
    pub allow_loopback_ips: bool,
    #[serde(default = "default_neg_one")]
    pub stream_limit_per_host: i32,
    #[serde(default = "default_neg_one")]
    pub stream_limit_total: i32,
    #[serde(default = "default_true")]
    pub allow_tcp_streams: bool,
    #[serde(default = "default_true")]
    pub allow_udp_streams: bool,
    #[serde(default = "default_dns_ttl")]
    pub dns_ttl: u32,
    #[serde(default = "default_wisp_version")]
    pub wisp_version: u8,
    #[serde(default)]
    pub wisp_motd: Option<String>,
    #[serde(default = "default_true")]
    pub parse_real_ip: bool,
    #[serde(default = "default_parse_real_ip_from")]
    pub parse_real_ip_from: Vec<String>,

    #[serde(default)]
    pub password_hash: Option<String>,
}

fn default_true() -> bool { true }
fn default_neg_one() -> i32 { -1 }
fn default_dns_ttl() -> u32 { 120 }
fn default_wisp_version() -> u8 { 2 }
fn default_parse_real_ip_from() -> Vec<String> { vec!["127.0.0.1".into()] }

impl Default for Options {
    fn default() -> Self {
        Self {
            hostname_blacklist: None,
            hostname_whitelist: None,
            port_blacklist: None,
            port_whitelist: None,
            allow_direct_ip: true,
            allow_private_ips: false,
            allow_loopback_ips: false,
            stream_limit_per_host: -1,
            stream_limit_total: -1,
            allow_tcp_streams: true,
            allow_udp_streams: true,
            dns_ttl: 120,
            wisp_version: 2,
            wisp_motd: None,
            parse_real_ip: true,
            parse_real_ip_from: vec!["127.0.0.1".into()],
            password_hash: None,
        }
    }
}

static GLOBAL_OPTIONS: LazyLock<RwLock<Options>> =
    LazyLock::new(|| RwLock::new(Options::default()));

pub fn parse_options(json: &str) -> Options {
    if json.is_empty() || json == "{}" || json == "null" {
        return GLOBAL_OPTIONS.read().clone();
    }
    serde_json::from_str(json).unwrap_or_else(|_| GLOBAL_OPTIONS.read().clone())
}

pub fn set_global_options(json: &str) {
    if let Ok(opts) = serde_json::from_str::<Options>(json) {
        *GLOBAL_OPTIONS.write() = opts;
    }
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    use argon2::{Argon2, PasswordHash, PasswordVerifier};
    let Ok(parsed) = PasswordHash::new(hash) else { return false };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

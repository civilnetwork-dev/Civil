use ahash::AHashMap;
use parking_lot::RwLock;
use std::net::IpAddr;
use std::sync::LazyLock;
use std::time::Instant;

struct Entry {
    ip: IpAddr,
    expires: Instant,
}

static CACHE: LazyLock<RwLock<AHashMap<String, Entry>>> =
    LazyLock::new(|| RwLock::new(AHashMap::new()));

pub async fn lookup(hostname: &str, ttl_secs: u32) -> Result<IpAddr, String> {
    if let Ok(ip) = hostname.parse::<IpAddr>() {
        return Ok(ip);
    }

    let now = Instant::now();
    {
        let cache = CACHE.read();
        if let Some(entry) = cache.get(hostname) {
            if entry.expires > now {
                return Ok(entry.ip);
            }
        }
    }

    let addrs_iter = tokio::net::lookup_host(format!("{hostname}:0"))
        .await
        .map_err(|e| e.to_string())?;

    let ip = addrs_iter
        .map(|s| s.ip())
        .next()
        .ok_or_else(|| format!("no address for {hostname}"))?;

    log::debug!("DNS resolved: {hostname} → {ip}");

    let expires = now + std::time::Duration::from_secs(ttl_secs as u64);
    {
        let mut cache = CACHE.write();
        cache.retain(|_, e| e.expires > now);
        cache.insert(hostname.to_string(), Entry { ip, expires });
    }

    Ok(ip)
}

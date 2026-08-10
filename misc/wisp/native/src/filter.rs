use std::net::IpAddr;

use crate::options::Options;
use crate::packet;

fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => v4.is_private() || v4.is_link_local() || v4.is_broadcast(),
        IpAddr::V6(v6) => {
            let segs = v6.segments();
            (segs[0] & 0xfe00) == 0xfc00 || (segs[0] & 0xffc0) == 0xfe80
        }
    }
}

fn is_loopback_or_unspec(ip: IpAddr) -> bool {
    ip.is_loopback() || ip.is_unspecified()
}

fn domain_suffix_match(set: &std::collections::HashSet<String>, hostname: &str) -> bool {
    if set.contains(hostname) {
        return true;
    }
    let mut rest = hostname;
    while let Some(idx) = rest.find('.') {
        rest = &rest[idx + 1..];
        if set.contains(rest) {
            return true;
        }
    }
    false
}

pub fn hostname_blocked(opts: &Options, hostname: &str) -> bool {
    if let Some(ref whitelist) = opts.hostname_whitelist {
        return !domain_suffix_match(whitelist, hostname);
    }
    if let Some(ref blacklist) = opts.hostname_blacklist {
        return domain_suffix_match(blacklist, hostname);
    }
    false
}

fn port_blocked(opts: &Options, port: u16) -> bool {
    if let Some(ref whitelist) = opts.port_whitelist {
        return !whitelist.contains(&port);
    }
    if let Some(ref blacklist) = opts.port_blacklist {
        return blacklist.contains(&port);
    }
    false
}

pub async fn check_stream(
    opts: &Options,
    stream_type: u8,
    hostname: &str,
    port: u16,
    stream_count: usize,
    host_stream_count: usize,
    resolved_ip: Option<IpAddr>,
) -> Option<u8> {
    if stream_type == packet::STREAM_TCP && !opts.allow_tcp_streams {
        return Some(packet::CLOSE_HOST_BLOCKED);
    }
    if stream_type == packet::STREAM_UDP && !opts.allow_udp_streams {
        return Some(packet::CLOSE_HOST_BLOCKED);
    }

    if hostname_blocked(opts, hostname) {
        return Some(packet::CLOSE_HOST_BLOCKED);
    }

    if port_blocked(opts, port) {
        return Some(packet::CLOSE_HOST_BLOCKED);
    }

    let ip: IpAddr = if let Ok(parsed) = hostname.parse() {
        if !opts.allow_direct_ip {
            return Some(packet::CLOSE_HOST_BLOCKED);
        }
        parsed
    } else if let Some(ip) = resolved_ip {
        ip
    } else {
        match crate::dns::lookup(hostname, opts.dns_ttl).await {
            Ok(ip) => ip,
            Err(_) => return Some(packet::CLOSE_UNREACHABLE),
        }
    };

    if !opts.allow_loopback_ips && is_loopback_or_unspec(ip) {
        return Some(packet::CLOSE_HOST_BLOCKED);
    }
    if !opts.allow_private_ips && is_private_ip(ip) {
        return Some(packet::CLOSE_HOST_BLOCKED);
    }

    if opts.stream_limit_total >= 0 && stream_count >= opts.stream_limit_total as usize {
        return Some(packet::CLOSE_THROTTLED);
    }
    if opts.stream_limit_per_host >= 0 && host_stream_count >= opts.stream_limit_per_host as usize {
        return Some(packet::CLOSE_THROTTLED);
    }

    None
}

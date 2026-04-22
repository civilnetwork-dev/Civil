use wasm_bindgen::prelude::*;
use crate::shuffler::shuffler::StrShuffler;

#[wasm_bindgen(js_name = buildProxyHref)]
pub fn build_proxy_href(
    base_url: &str,
    session_id: &str,
    shuffler: &StrShuffler,
    prefix: Option<String>,
) -> String {
    let shuffled = shuffler.shuffle(base_url);
    match prefix {
        Some(p) if !p.is_empty() => {
            format!("{}/{}/{}", p.trim_end_matches('/'), session_id, shuffled)
        }
        _ => format!("{}/{}", session_id, shuffled),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dictionary::constants::BASE_DICTIONARY;

    fn make_shuffler() -> StrShuffler {
        let dict: String = BASE_DICTIONARY.chars().rev().collect();
        StrShuffler::from_dictionary(&dict).unwrap()
    }

    #[test]
    fn build_href_with_prefix() {
        let s = make_shuffler();
        let href = build_proxy_href("https://example.com", "abc123", &s, Some("/proxy".to_owned()));
        assert!(href.starts_with("/proxy/abc123/"));
    }

    #[test]
    fn build_href_no_prefix() {
        let s = make_shuffler();
        let href = build_proxy_href("https://example.com", "abc123", &s, None);
        assert!(href.starts_with("abc123/"));
    }

    #[test]
    fn build_href_trailing_slash_stripped() {
        let s = make_shuffler();
        let href = build_proxy_href("https://example.com", "abc123", &s, Some("/proxy/".to_owned()));
        assert!(href.starts_with("/proxy/abc123/"));
        assert!(!href.starts_with("/proxy//"));
    }
}
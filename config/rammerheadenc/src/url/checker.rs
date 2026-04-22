use wasm_bindgen::prelude::*;
use crate::dictionary::constants::SHUFFLED_INDICATOR;

#[wasm_bindgen(js_name = isShuffled)]
pub fn is_shuffled(s: &str) -> bool {
    s.starts_with(SHUFFLED_INDICATOR)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_shuffled_prefix() {
        assert!(is_shuffled("_rhsABCDEF"));
    }

    #[test]
    fn rejects_plain_string() {
        assert!(!is_shuffled("https://example.com"));
    }

    #[test]
    fn rejects_empty_string() {
        assert!(!is_shuffled(""));
    }
}
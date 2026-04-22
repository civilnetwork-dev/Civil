use wasm_bindgen::prelude::*;
use crate::dictionary::constants::{BASE_DICTIONARY, SHUFFLED_INDICATOR};
use crate::dictionary::generate::generate_dictionary;
use crate::utils::math::modulo;

#[wasm_bindgen]
pub struct StrShuffler {
    dictionary: Vec<char>,
}

#[wasm_bindgen]
impl StrShuffler {
    #[wasm_bindgen(js_name = fromDictionary)]
    pub fn from_dictionary(dictionary: &str) -> Result<StrShuffler, JsValue> {
        if dictionary.chars().count() != BASE_DICTIONARY.chars().count() {
            return Err(JsValue::from_str(&format!(
                "dictionary must be exactly {} chars, got {}",
                BASE_DICTIONARY.chars().count(),
                dictionary.chars().count()
            )));
        }
        Ok(StrShuffler {
            dictionary: dictionary.chars().collect(),
        })
    }

    #[wasm_bindgen(js_name = generate)]
    pub fn generate(seed: u64) -> StrShuffler {
        let dict = generate_dictionary(seed);
        StrShuffler {
            dictionary: dict.chars().collect(),
        }
    }

    #[wasm_bindgen(getter)]
    pub fn dictionary(&self) -> String {
        self.dictionary.iter().collect()
    }

    pub fn shuffle(&self, input: &str) -> String {
        if input.starts_with(SHUFFLED_INDICATOR) {
            return input.to_owned();
        }

        let base_chars: Vec<char> = BASE_DICTIONARY.chars().collect();
        let base_len = base_chars.len() as i64;
        let chars: Vec<char> = input.chars().collect();
        let mut out = String::with_capacity(SHUFFLED_INDICATOR.len() + input.len() + 8);
        out.push_str(SHUFFLED_INDICATOR);

        let mut i = 0usize;
        while i < chars.len() {
            let ch = chars[i];
            if ch == '%' && i + 2 < chars.len() {
                out.push(ch);
                out.push(chars[i + 1]);
                out.push(chars[i + 2]);
                i += 3;
                continue;
            }
            match base_chars.iter().position(|&c| c == ch) {
                None => out.push(ch),
                Some(idx) => {
                    let new_idx = modulo(idx as i64 + i as i64, base_len);
                    out.push(self.dictionary[new_idx]);
                }
            }
            i += 1;
        }

        out
    }

    pub fn unshuffle(&self, input: &str) -> String {
        if !input.starts_with(SHUFFLED_INDICATOR) {
            return input.to_owned();
        }

        let stripped = &input[SHUFFLED_INDICATOR.len()..];
        let base_chars: Vec<char> = BASE_DICTIONARY.chars().collect();
        let base_len = base_chars.len() as i64;
        let chars: Vec<char> = stripped.chars().collect();
        let mut out = String::with_capacity(stripped.len());

        let mut i = 0usize;
        while i < chars.len() {
            let ch = chars[i];
            if ch == '%' && i + 2 < chars.len() {
                out.push(ch);
                out.push(chars[i + 1]);
                out.push(chars[i + 2]);
                i += 3;
                continue;
            }
            match self.dictionary.iter().position(|&c| c == ch) {
                None => out.push(ch),
                Some(idx) => {
                    let orig_idx = modulo(idx as i64 - i as i64, base_len);
                    out.push(base_chars[orig_idx]);
                }
            }
            i += 1;
        }

        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_shuffler() -> StrShuffler {
        let dict: String = BASE_DICTIONARY.chars().rev().collect();
        StrShuffler::from_dictionary(&dict).unwrap()
    }

    #[test]
    fn shuffle_roundtrip_simple() {
        let s = make_shuffler();
        let url = "https://example.com/path?q=hello";
        let shuffled = s.shuffle(url);
        assert!(shuffled.starts_with(SHUFFLED_INDICATOR));
        assert_eq!(s.unshuffle(&shuffled), url);
    }

    #[test]
    fn shuffle_idempotent() {
        let s = make_shuffler();
        let url = "https://example.com";
        let once = s.shuffle(url);
        let twice = s.shuffle(&once);
        assert_eq!(once, twice);
    }

    #[test]
    fn unshuffle_passthrough_plain() {
        let s = make_shuffler();
        let plain = "no-indicator-here";
        assert_eq!(s.unshuffle(plain), plain);
    }

    #[test]
    fn percent_encoding_preserved() {
        let s = make_shuffler();
        let url = "hello%20world";
        let shuffled = s.shuffle(url);
        let without_indicator = &shuffled[SHUFFLED_INDICATOR.len()..];
        assert!(without_indicator.contains("%20"));
        assert_eq!(s.unshuffle(&shuffled), url);
    }
}
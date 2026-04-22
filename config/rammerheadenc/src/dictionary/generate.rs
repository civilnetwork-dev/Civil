use wasm_bindgen::prelude::*;
use super::constants::BASE_DICTIONARY;

#[wasm_bindgen(js_name = generateDictionary)]
pub fn generate_dictionary(seed: u64) -> String {
    let mut chars: Vec<char> = BASE_DICTIONARY.chars().collect();
    let mut rng = seed;
    let n = chars.len();

    for i in (1..n).rev() {
        rng = rng
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1_442_695_040_888_963_407);
        let j = ((rng >> 33) as usize) % (i + 1);
        chars.swap(i, j);
    }

    chars.into_iter().collect()
}
#[inline]
pub fn modulo(n: i64, m: i64) -> usize {
    (((n % m) + m) % m) as usize
}
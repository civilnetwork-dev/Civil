#include "xor_encoder.hpp"
#include <cctype>
#include <unordered_map>
#include <string>
#include <string_view>
#include <vector>
#include <cstdint>
#include <cstring>

namespace xorenc {

static const std::unordered_map<std::string, std::string> engines = {
    { "google", "https://www.google.com/search?q=%s" },
    { "ddg",    "https://duckduckgo.com/?q=%s" },
    { "bing",   "https://www.bing.com/search?q=%s" },
    { "brave",  "https://search.brave.com/search?q=%s" },
    { "searx",  "https://searx.org/search?q=%s" }
};

static std::string search_template = engines.at("google");

static std::vector<uint8_t> in_buf;
static std::vector<char>    out_buf;
static std::vector<char>    stage_a;
static std::vector<char>    stage_b;

static size_t out_len_ = 0;

void set_search_engine(const std::string& name) {
    auto it = engines.find(name);
    if (it != engines.end()) search_template = it->second;
}

void set_search_template(const std::string& tpl) {
    if (tpl.find("%s") != std::string::npos) search_template = tpl;
}

static constexpr char HEX[] = "0123456789ABCDEF";

static constexpr bool is_unreserved(unsigned char c) noexcept {
    return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
           (c >= '0' && c <= '9') ||
           c == '-' || c == '_' || c == '.' || c == '~';
}

static constexpr unsigned char from_hex(char c) noexcept {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    return 0;
}

// Reserve `n` chars in a vector, return data pointer
static char* reserve(std::vector<char>& v, size_t n) {
    if (v.size() < n) v.resize(n);
    return v.data();
}

static size_t percent_encode_into(std::string_view in, char* out) noexcept {
    char* p = out;
    for (unsigned char c : in) {
        if (is_unreserved(c)) {
            *p++ = static_cast<char>(c);
        } else {
            *p++ = '%';
            *p++ = HEX[c >> 4];
            *p++ = HEX[c & 0x0F];
        }
    }
    return static_cast<size_t>(p - out);
}

static size_t percent_decode_into(std::string_view in, char* out) noexcept {
    char* p = out;
    for (size_t i = 0; i < in.size(); ++i) {
        if (in[i] == '%' && i + 2 < in.size()) {
            *p++ = static_cast<char>(
                (from_hex(in[i+1]) << 4) | from_hex(in[i+2])
            );
            i += 2;
        } else {
            *p++ = in[i];
        }
    }
    return static_cast<size_t>(p - out);
}

static void xor_transform_inplace(char* data, size_t len) noexcept {
    for (size_t i = 1; i < len; i += 2) data[i] ^= 0x02;
}

static bool has_scheme(std::string_view s) noexcept {
    return s.starts_with("http://") || s.starts_with("https://");
}

static bool looks_like_domain(std::string_view s) noexcept {
    return s.find('.') != std::string_view::npos &&
           s.find(' ') == std::string_view::npos;
}

static std::string_view normalize_into(std::string_view input) {
    if (input.empty()) return {};

    if (has_scheme(input)) {
        reserve(stage_a, input.size());
        std::memcpy(stage_a.data(), input.data(), input.size());
        return { stage_a.data(), input.size() };
    }

    if (looks_like_domain(input)) {
        const std::string_view prefix = "https://";
        size_t total = prefix.size() + input.size();
        reserve(stage_a, total);
        std::memcpy(stage_a.data(), prefix.data(), prefix.size());
        std::memcpy(stage_a.data() + prefix.size(), input.data(), input.size());
        return { stage_a.data(), total };
    }

    reserve(stage_b, input.size() * 3);
    size_t qlen = percent_encode_into(input, stage_b.data());

    std::string_view tpl = search_template;
    size_t pos = tpl.find("%s");
    size_t total = tpl.size() - 2 + qlen;
    reserve(stage_a, total);
    char* p = stage_a.data();
    std::memcpy(p, tpl.data(), pos);           p += pos;
    std::memcpy(p, stage_b.data(), qlen);      p += qlen;
    std::memcpy(p, tpl.data() + pos + 2, tpl.size() - pos - 2);
    return { stage_a.data(), total };
}

std::string encode(const std::string& input) {
    if (input.empty()) return {};
    std::string_view norm = normalize_into(input);
    reserve(stage_b, norm.size() * 3);
    size_t n1 = percent_encode_into(norm, stage_b.data());
    xor_transform_inplace(stage_b.data(), n1);
    reserve(out_buf, n1 * 3);
    size_t n2 = percent_encode_into({stage_b.data(), n1}, out_buf.data());
    return std::string(out_buf.data(), n2);
}

std::string decode(const std::string& input) {
    if (input.empty()) return {};
    reserve(stage_a, input.size());
    size_t n1 = percent_decode_into(input, stage_a.data());
    xor_transform_inplace(stage_a.data(), n1);
    reserve(out_buf, n1);
    size_t n2 = percent_decode_into({stage_a.data(), n1}, out_buf.data());
    return std::string(out_buf.data(), n2);
}

uint8_t* get_in_buf(size_t capacity) {
    if (in_buf.size() < capacity) in_buf.resize(capacity);
    return in_buf.data();
}

uint8_t* get_out_buf() {
    return reinterpret_cast<uint8_t*>(out_buf.data());
}

size_t out_len() {
    return out_len_;
}

void encode_buf(size_t len) {
    std::string_view input{ reinterpret_cast<char*>(in_buf.data()), len };
    std::string_view norm = normalize_into(input);
    reserve(stage_b, norm.size() * 3);
    size_t n1 = percent_encode_into(norm, stage_b.data());
    xor_transform_inplace(stage_b.data(), n1);
    reserve(out_buf, n1 * 3);
    out_len_ = percent_encode_into({stage_b.data(), n1}, out_buf.data());
}

void decode_buf(size_t len) {
    std::string_view input{ reinterpret_cast<char*>(in_buf.data()), len };
    reserve(stage_a, input.size());
    size_t n1 = percent_decode_into(input, stage_a.data());
    xor_transform_inplace(stage_a.data(), n1);
    reserve(out_buf, n1);
    out_len_ = percent_decode_into({stage_a.data(), n1}, out_buf.data());
}

} // namespace xorenc
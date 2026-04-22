#pragma once
#include <string>
#include <string_view>
#include <cstdint>
 
namespace xorenc {
    void set_search_engine(const std::string& name);
    void set_search_template(const std::string& tpl);
    std::string encode(const std::string& input);
    std::string decode(const std::string& input);
 
    uint8_t* get_in_buf(size_t capacity);
    uint8_t* get_out_buf();
    size_t   out_len();
    void     encode_buf(size_t len);
    void     decode_buf(size_t len);
}

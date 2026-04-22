#include <emscripten/bind.h>
#include "xor_encoder.hpp"
#include <cstdint>

using namespace emscripten;

static int js_get_in_buf(size_t capacity) {
    return static_cast<int>(
        reinterpret_cast<uintptr_t>(xorenc::get_in_buf(capacity))
    );
}

static int js_get_out_buf() {
    return static_cast<int>(
        reinterpret_cast<uintptr_t>(xorenc::get_out_buf())
    );
}

EMSCRIPTEN_BINDINGS(xor_encoder) {
    function("encode",            &xorenc::encode);
    function("decode",            &xorenc::decode);
    function("setSearchEngine",   &xorenc::set_search_engine);
    function("setSearchTemplate", &xorenc::set_search_template);

    function("getInBuf",   &js_get_in_buf);
    function("getOutBuf",  &js_get_out_buf);
    function("outLen",     &xorenc::out_len);
    function("encodeBuf",  &xorenc::encode_buf);
    function("decodeBuf",  &xorenc::decode_buf);
}
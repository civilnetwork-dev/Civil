//! Node.js binding, built with napi-zig (the same library yuku itself uses
//! to publish yuku-parser/yuku-codegen — see its src/parser/ffi/*.zig).
//!
//! Unlike yuku's own bindings, this doesn't hand a serialized AST across the
//! N-API boundary: the whole parse → transform → codegen pipeline runs
//! natively in obfuscate.zig, so JS only ever sees a source string in and a
//! source string out.

const napi = @import("napi-zig");
const obf = @import("obfuscate");

pub fn obfuscate(env: napi.Env, source: []const u8, options: obf.Options) ![]const u8 {
    return obf.obfuscate(env.allocator(), source, options) catch |err| switch (err) {
        error.ParseFailed => return error.ParseFailed,
        error.AnalysisFailed => return error.AnalysisFailed,
        error.OutOfMemory => return error.OutOfMemory,
    };
}

comptime {
    napi.module(@This());
}

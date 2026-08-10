pub const LEVEL_DEBUG: u8 = 0;
pub const LEVEL_INFO: u8 = 1;
pub const LEVEL_WARN: u8 = 2;
pub const LEVEL_ERROR: u8 = 3;

extern fn js_log(level: u8, ptr: [*]const u8, len: usize) void;

pub fn debug(msg: []const u8) void {
    js_log(LEVEL_DEBUG, msg.ptr, msg.len);
}

pub fn info(msg: []const u8) void {
    js_log(LEVEL_INFO, msg.ptr, msg.len);
}

pub fn warn(msg: []const u8) void {
    js_log(LEVEL_WARN, msg.ptr, msg.len);
}

pub fn err(msg: []const u8) void {
    js_log(LEVEL_ERROR, msg.ptr, msg.len);
}

pub fn log_error(msg: []const u8) void {
    js_log(LEVEL_ERROR, msg.ptr, msg.len);
}

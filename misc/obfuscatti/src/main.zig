//! `zig build run` playground — obfuscates a sample and prints the result,
//! the same role yuku's own src/main.zig plays for its parser.

const std = @import("std");
const obfuscate = @import("obfuscate").obfuscate;

pub fn main() !void {
    const gpa = std.heap.smp_allocator;

    const sample =
        \\function greet(name) {
        \\  return "Hello, " + name + "!";
        \\}
        \\console.log(greet("world"));
    ;

    const output = try obfuscate(gpa, sample, .{});
    defer gpa.free(output);

    std.debug.print("{s}\n", .{output});
}

const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const yuku = b.dependency("yuku", .{ .target = target, .optimize = optimize });

    const lib_mod = b.addModule("deobfuscator", .{
        .root_source_file = b.path("src/root.zig"),
        .target = target,
        .optimize = optimize,
    });
    lib_mod.addImport("parser", yuku.module("parser"));

    const exe_mod = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });
    exe_mod.addImport("deobfuscator", lib_mod);

    const exe = b.addExecutable(.{ .name = "deobfuscate", .root_module = exe_mod });
    b.installArtifact(exe);

    const run = b.addRunArtifact(exe);
    run.step.dependOn(b.getInstallStep());
    if (b.args) |args| run.addArgs(args);
    b.step("run", "Run the deobfuscator").dependOn(&run.step);

    const tests = b.addTest(.{ .root_module = lib_mod });
    b.step("test", "Run the pass tests").dependOn(&b.addRunArtifact(tests).step);
}

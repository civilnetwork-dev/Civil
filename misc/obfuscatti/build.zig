const std = @import("std");
const napi_zig = @import("napi_zig");

pub fn build(b: *std.Build) void {
    // No `-Dtarget=` override here on purpose: this defaults to the host,
    // which is the whole point at this phase — "at build time only generate
    // one [binding], for the builder's platform". Cross-compiling the full
    // platform matrix is a later increment, once the port itself is further
    // along; see this directory's README.
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const yuku_dep = b.dependency("yuku", .{ .target = target, .optimize = optimize });
    const parser_module = yuku_dep.module("parser");

    const obfuscatti_module = b.createModule(.{
        .root_source_file = b.path("src/obfuscate.zig"),
        .target = target,
        .optimize = optimize,
    });
    obfuscatti_module.addImport("parser", parser_module);

    // CLI playground: `zig build run`.
    const main_module = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });
    main_module.addImport("obfuscate", obfuscatti_module);
    const exe = b.addExecutable(.{ .name = "obfuscatti", .root_module = main_module });
    b.installArtifact(exe);
    const run_step = b.step("run", "Run the CLI playground");
    run_step.dependOn(&b.addRunArtifact(exe).step);

    // Tests: `zig build test`.
    const test_step = b.step("test", "Run the transform + pipeline tests");
    test_step.dependOn(&b.addRunArtifact(b.addTest(.{ .root_module = obfuscatti_module })).step);

    // Node.js binding: built by the default `zig build` step (addLib below
    // hooks into it directly). Requires the Zig 0.16.0 toolchain specifically
    // (not whatever `zig` resolves to on PATH) — see README.md's "Known
    // blocker" for why napi-zig's build.zig doesn't evaluate under this
    // environment's newer Zig dev snapshot.
    const napi_dep = b.dependency("napi_zig", .{});
    // addLib registers its own build/install steps internally (confirmed:
    // it returns void, not a Step — yuku's own build.zig also never
    // captures its return value), so there's no custom step to wire a
    // dependency onto here; `zig build` (the default step) picks it up.
    napi_zig.addLib(b, napi_dep, .{
        .name = "obfuscatti",
        .root = b.path("src/ffi.zig"),
        .target = target,
        .optimize = optimize,
        .imports = &.{
            .{ .name = "parser", .module = parser_module },
            .{ .name = "obfuscate", .module = obfuscatti_module },
        },
        .npm = .{
            .scope = "@civil",
            .description = "Zig-native JS/TS obfuscator for Civil, built on yuku",
        },
    });
}

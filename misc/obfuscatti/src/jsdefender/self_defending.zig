//! Source-bound guards recovered from JSDefender modules 5044 and 7030.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const scalars = @import("scalars.zig");
const strings = @import("strings.zig");
const literals = @import("literals.zig");
const flow = @import("control_flow.zig");
const declarations = @import("declarations.zig");
const embed = @import("embed_snippet.zig");
const Policy = @import("policy.zig").Policy;
const canonical = @import("render.zig");
const source_map = @import("source_map.zig");
const span: ast.Span = .{ .start = 0, .end = 0 };

pub const Options = struct {
    level: u3 = 1,
    error_script: []const u8 = "console.log('Error: the code has been tampered!')",
    random_seed: f64 = 1,
    id_offset: u32 = 0,
    es5: bool = false,
    standalone: bool = false,
    policy: ?*const Policy = null,
};

pub const Protector = struct {
    salt1: u32,
    salt2: u32,
    radix: u8,

    pub fn init(random: ?*scalars.Random) Protector {
        return if (random) |r| .{
            .salt1 = @intFromFloat(r.getRandomInt(0, 2147483647)),
            .salt2 = @intFromFloat(r.getRandomInt(0, 2147483647)),
            .radix = @intFromFloat(r.getRandomInt(11, 36)),
        } else .{ .salt1 = 2147466840, .salt2 = 1865008398, .radix = 34 };
    }

    pub fn getKey(self: Protector, allocator: std.mem.Allocator, source: []const u8) ![8]u8 {
        const units = try utf16(allocator, source);
        defer allocator.free(units);
        var checksum = self.salt1;
        for (units, 0..) |unit, i| checksum ^= @as(u32, unit) * 2 + units[i >> 4] ^ self.salt2;
        var key: [8]u8 = undefined;
        for (&key) |*item| {
            const remainder = checksum % self.radix;
            checksum /= self.radix;
            item.* = @intCast(if (remainder >= 26) 65 + remainder - 26 else 97 + remainder);
        }
        return key;
    }

    pub fn keyFunction(self: Protector, allocator: std.mem.Allocator, es5: bool) ![]u8 {
        const let = if (es5) "var" else "let";
        return std.fmt.allocPrint(
            allocator,
            "function(source){{{s} checksum={d};for({s} i=0;i<source.length;i++){{checksum^=(source.charCodeAt(i)*2+source.charCodeAt(i>>>4))^{d};}}{s} key=\"\";for({s} i=0;i<8;i++){{{s} remainder=checksum%{d};checksum=Math.floor(checksum/{d});key+=remainder>=26?String.fromCharCode(65+(remainder-26)):String.fromCharCode(97+remainder);}}return key;}}",
            .{ let, self.salt1, let, self.salt2, let, let, if (es5) "var" else "const", self.radix, self.radix },
        );
    }
};

pub const decode_function = "function(source,key){source=decodeURI(source)\nlet keyIndex=0;let encoded=\"\";for(let i=0;i<source.length;i++){encoded+=String.fromCharCode(source.charCodeAt(i)^key.charCodeAt(keyIndex));keyIndex++;if(keyIndex>=key.length){keyIndex=0;}}return encoded;}";
const key_template = "\nfunction getKey(source) {\n  $LET checksum = {{salt1}};\n  for ($LET i = 0; i < source.length; i++) {\n    checksum ^=\n      (source.charCodeAt(i) * 2 + source.charCodeAt(i >>> 4)) ^ {{salt2}};\n  }\n\n  $LET key = \"\";\n  for ($LET i = 0; i < 8; i++) {\n    $CONST remainder = checksum % {{radix}};\n    checksum = Math.floor(checksum / {{radix}});\n    key +=\n      remainder >= 26\n        ? String.fromCharCode(65 + (remainder - 26))\n        : String.fromCharCode(97 + remainder);\n  }\n  return key;\n}\n";
const decode_template = "\nfunction decodeSource(source, key) {\n  source = decodeURI(source)\n  $LET keyIndex = 0;\n  $LET encoded = \"\";\n  for ($LET i = 0; i < source.length; i++) {\n    encoded += String.fromCharCode(\n      source.charCodeAt(i) ^ key.charCodeAt(keyIndex)\n    );\n    keyIndex++;\n    if (keyIndex >= key.length) {\n      keyIndex = 0;\n    }\n  }\n  return encoded;\n}\n";
const decode_function_es5 = "function(source,key){source=decodeURI(source)\nvar keyIndex=0;var encoded=\"\";for(var i=0;i<source.length;i++){encoded+=String.fromCharCode(source.charCodeAt(i)^key.charCodeAt(keyIndex));keyIndex++;if(keyIndex>=key.length){keyIndex=0;}}return encoded;}";

fn utf16(allocator: std.mem.Allocator, text: []const u8) ![]u16 {
    var out: std.ArrayList(u16) = .empty;
    errdefer out.deinit(allocator);
    var i: usize = 0;
    while (i < text.len) {
        const count = std.unicode.utf8ByteSequenceLength(text[i]) catch return error.InvalidUtf8;
        if (i + count > text.len) return error.InvalidUtf8;
        const cp: u21 = switch (count) {
            1 => text[i],
            2 => std.unicode.utf8Decode2(text[i..][0..2].*) catch return error.InvalidUtf8,
            3 => std.unicode.utf8Decode3AllowSurrogateHalf(text[i..][0..3].*) catch return error.InvalidUtf8,
            4 => std.unicode.utf8Decode4(text[i..][0..4].*) catch return error.InvalidUtf8,
            else => return error.InvalidUtf8,
        };
        i += count;
        if (cp > 0xffff) {
            try out.append(allocator, @intCast(0xd800 + ((cp - 0x10000) >> 10)));
            try out.append(allocator, @intCast(0xdc00 + ((cp - 0x10000) & 1023)));
        } else try out.append(allocator, @intCast(cp));
    }
    return out.toOwnedSlice(allocator);
}

/// Repeating XOR followed by JavaScript encodeURI's exact safe character set.
pub fn encrypt(allocator: std.mem.Allocator, source: []const u8, key: [8]u8) ![]u8 {
    const units = try utf16(allocator, source);
    defer allocator.free(units);
    for (units, 0..) |*unit, i| unit.* ^= key[i % key.len];
    var out: std.ArrayList(u8) = .empty;
    errdefer out.deinit(allocator);
    var i: usize = 0;
    const digits = "0123456789ABCDEF";
    while (i < units.len) : (i += 1) {
        var cp: u21 = units[i];
        if (cp >= 0xd800 and cp <= 0xdbff) {
            if (i + 1 >= units.len or units[i + 1] < 0xdc00 or units[i + 1] > 0xdfff) return error.InvalidUri;
            cp = 0x10000 + (cp - 0xd800) * 1024 + units[i + 1] - 0xdc00;
            i += 1;
        } else if (cp >= 0xdc00 and cp <= 0xdfff) return error.InvalidUri;
        var bytes: [4]u8 = undefined;
        const length = std.unicode.utf8Encode(cp, &bytes) catch return error.InvalidUri;
        for (bytes[0..length]) |byte| {
            if (std.ascii.isAlphanumeric(byte) or std.mem.indexOfScalar(u8, ";,/?:@&=+$#-_.!~*'()", byte) != null)
                try out.append(allocator, byte)
            else
                try out.appendSlice(allocator, &.{ '%', digits[byte >> 4], digits[byte & 15] });
        }
    }
    return out.toOwnedSlice(allocator);
}

fn renderFunction(allocator: std.mem.Allocator, tree: *ast.Tree, original: ast.NodeIndex) ![]u8 {
    const source = try canonical.renderNode(allocator, tree, original);
    defer allocator.free(source);
    return std.fmt.allocPrint(allocator, "({s})", .{source});
}

/// Candidates are once-executed IIFEs or functions selected by inline policy,
/// matching module 7030 rather than encrypting every function indiscriminately.
pub fn apply(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    candidates: []const ast.NodeIndex,
    random: *scalars.Random,
    options: Options,
    runtime: anytype,
) !void {
    if (candidates.len == 0 or (options.policy == null and options.level == 0)) return;
    var total_level: usize = 0;
    for (candidates) |candidate| total_level += if (options.policy) |rules|
        if (rules.settingsFor(candidate).self_defending.get()) |value| @as(usize, value.level) else 0
    else
        @as(usize, options.level);
    if (total_level == 0) return;
    const pool_count: usize = if (total_level >= 100)
        5
    else if (total_level >= 50) 4 else if (total_level >= 10) 3 else if (total_level >= 5) 2 else 1;
    var protectors: [5]Protector = undefined;
    var key_names: [5][]const u8 = undefined;
    var decoder_names: [5][]const u8 = undefined;
    const decoder = if (options.es5) decode_function_es5 else decode_function;
    for (0..pool_count) |i| {
        protectors[i] = Protector.init(random);
        const key_name = try std.fmt.allocPrint(allocator, "getKey{d}", .{i});
        defer allocator.free(key_name);
        const decoder_name = try std.fmt.allocPrint(allocator, "decodeSource{d}", .{i});
        defer allocator.free(decoder_name);
        const key_function = try protectors[i].keyFunction(allocator, options.es5);
        defer allocator.free(key_function);
        const key_expression = try std.fmt.allocPrint(allocator, "({s})", .{key_function});
        defer allocator.free(key_expression);
        const decoder_expression = try std.fmt.allocPrint(allocator, "({s})", .{decoder});
        defer allocator.free(decoder_expression);
        if (options.standalone) {
            key_names[i] = "getKey";
            decoder_names[i] = "decodeSource";
        } else {
            const salt1 = try std.fmt.allocPrint(allocator, "{d}", .{protectors[i].salt1});
            defer allocator.free(salt1);
            const salt2 = try std.fmt.allocPrint(allocator, "{d}", .{protectors[i].salt2});
            defer allocator.free(salt2);
            const radix = try std.fmt.allocPrint(allocator, "{d}", .{protectors[i].radix});
            defer allocator.free(radix);
            const key_origin = try runtime.template(
                key_template,
                &.{
                    .{ .key = "salt1", .value = salt1 },
                    .{ .key = "salt2", .value = salt2 },
                    .{ .key = "radix", .value = radix },
                },
                false,
            );
            const decoder_origin = try runtime.template(decode_template, &.{}, false);
            key_names[i] = try runtime.initPropertyTemplate(key_name, key_expression, key_origin);
            decoder_names[i] = try runtime.initPropertyTemplate(decoder_name, decoder_expression, decoder_origin);
        }
    }
    for (candidates, 0..) |candidate, i| {
        const selection = if (options.policy) |rules| rules.settingsFor(candidate).self_defending.get() orelse continue else null;
        const level = if (selection) |value| value.level else options.level;
        const error_script = if (selection) |value| value.error_script orelse options.error_script else options.error_script;
        for (0..@min(@as(usize, level), 4)) |_| {
            const original = tree.data(candidate);
            if (original != .function) return error.InvalidSelfDefendingCandidate;
            const args_name = try runtime.generateGlobalName();
            const inline_key = try protectors[i % pool_count].keyFunction(allocator, options.es5);
            defer allocator.free(inline_key);
            const guard_source = if (options.standalone) try std.fmt.allocPrint(
                allocator,
                "function guarded(encryptedBody){{{s} decodedBody=decodeSource(encryptedBody,getKey(guarded.toString()));try{{{s} inner=eval(decodedBody);return inner.apply(null,{s});}}catch(err){{if(err instanceof SyntaxError){{{s}\nreturn\n}}throw err;}}function getKey{s}function decodeSource{s}}}",
                .{
                    if (options.es5) "var" else "const",
                    if (options.es5) "var" else "let",
                    args_name,
                    error_script,
                    inline_key[8..],
                    decoder[8..],
                },
            ) else try std.fmt.allocPrint(
                allocator,
                "function guarded(encryptedBody){{{s} decodedBody={s}.{s}(encryptedBody,{s}.{s}(guarded.toString()));try{{{s} inner=eval(decodedBody);return inner.apply(null,{s});}}catch(err){{if(err instanceof SyntaxError){{{{{s}}}return\n}}throw err;}}}}",
                .{
                    if (options.es5) "var" else "const",
                    runtime.protector_name.?,
                    decoder_names[i % pool_count],
                    runtime.protector_name.?,
                    key_names[i % pool_count],
                    if (options.es5) "var" else "let",
                    args_name,
                    error_script,
                },
            );
            defer allocator.free(guard_source);
            var guard = try parser.parse(allocator, guard_source, .{});
            defer guard.deinit();
            if (guard.hasErrors()) return error.InvalidErrorScript;
            var guard_random = scalars.Random.init(if (options.random_seed == 0) 1 else options.random_seed);
            try literals.applyBooleans(allocator, &guard, &guard_random, false);
            try flow.apply(allocator, &guard, &guard_random, .{ .randomize = true, .skip_runtime = true }, runtime);
            try literals.applyIntegers(allocator, &guard, &guard_random, .{ .randomize = true, .lower = 0, .upper = 65535 });
            try declarations.applyLocal(
                allocator,
                &guard,
                .{
                    .mode = .base62,
                    .id_base = 11000000,
                    .id_offset = options.id_offset,
                    .protector_name = runtime.protector_name,
                    .preserve_root_ids = true,
                    .ignore_unsafe_constructs = true,
                },
                &guard_random,
            );
            const guarded_text = try canonical.render(allocator, &guard);
            defer allocator.free(guarded_text);
            const key = try protectors[i % pool_count].getKey(allocator, guarded_text);
            const original_source = try renderFunction(allocator, tree, candidate);
            defer allocator.free(original_source);
            const encrypted = try encrypt(allocator, original_source, key);
            defer allocator.free(encrypted);
            const call = try std.fmt.allocPrint(allocator, "({s})(\"{s}\")", .{ guarded_text, encrypted });
            defer allocator.free(call);
            const quoted = try strings.quote(allocator, call);
            defer allocator.free(quoted);
            const wrapper = try std.fmt.allocPrint(
                allocator,
                "(function(){{{s} {s}=Array.prototype.slice.call(arguments);return eval({s});}})",
                .{ if (options.es5) "var" else "const", args_name, quoted },
            );
            defer allocator.free(wrapper);
            const first_node = tree.nodes.len;
            const replacement = try embed.embedExpression(allocator, tree, wrapper);
            const function_index = tree.data(replacement).parenthesized_expression.expression;
            var new_function = original.function;
            new_function.body = tree.data(function_index).function.body;
            tree.setData(candidate, .{ .function = new_function });
            try source_map.registerEmbedded(allocator, tree, first_node, null, false);
            try source_map.registerBuilder(tree, candidate);
        }
        if (!options.standalone and level != 0 and tree.data(candidate).function.type == .function_expression) {
            const function = try tree.addNode(tree.data(candidate), span);
            tree.setData(candidate, .{ .parenthesized_expression = .{ .expression = function } });
            tree.setSpan(candidate, @import("nodes.zig").explicit_parentheses_span);
        }
    }
}

test "source checksum and URI encryption agree with recovered algorithms" {
    const allocator = std.testing.allocator;
    const protector = Protector.init(null);
    const key = try protector.getKey(allocator, "function(){}");
    const encrypted = try encrypt(allocator, "hello world", "abcdefgh".*);
    defer allocator.free(encrypted);
    try std.testing.expectEqualStrings("qhmHinba", &key);
    try std.testing.expectEqualStrings("%09%07%0F%08%0AF%10%07%13%0E%07", encrypted);
}

test "standalone source-bound guard executes its original closure" {
    const allocator = std.testing.allocator;
    var random = scalars.Random.init(1);
    var runtime = @import("runtime.zig").Manager.init(allocator, .{}, &random);
    defer runtime.deinit();
    var tree = try parser.parse(
        allocator,
        "let captured=17;(function(){console.log(captured+6);})();",
        .{ .source_type = .script },
    );
    defer tree.deinit();
    const statement = tree.extra(tree.data(tree.root).program.body)[1];
    const call = tree.data(statement).expression_statement.expression;
    const candidate = tree.data(tree.data(call).call_expression.callee).parenthesized_expression.expression;
    try apply(allocator, &tree, &.{candidate}, &random, .{ .standalone = true }, &runtime);
    const generated = try parser.codegen.generate(allocator, &tree, .{});
    defer generated.deinit(allocator);
    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const io = threaded.io();
    var temporary = std.testing.tmpDir(.{});
    defer temporary.cleanup();
    var file = try temporary.dir.createFile(io, "guard.js", .{});
    try file.writeStreamingAll(io, generated.code);
    file.close(io);
    const path = try temporary.dir.realPathFileAlloc(io, "guard.js", allocator);
    defer allocator.free(path);
    const result = try std.process.run(allocator, io, .{ .argv = &.{ "bun", path } });
    defer allocator.free(result.stdout);
    defer allocator.free(result.stderr);
    try std.testing.expectEqualStrings("23\n", result.stdout);
    try std.testing.expectEqualStrings("", result.stderr);
}

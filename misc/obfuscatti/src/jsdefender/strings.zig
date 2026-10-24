//! String extraction recovered from JSDefender 2.12.0, bundle module 8676.
//! Deduplicates in discovery order, XORs UTF-16 units, eagerly decodes one
//! collection, and assigns its entries to eight accessor aliases round-robin.
//!
//! applyWithRuntime uses the shared recovered runtime manager, including its
//! string Lego accessor names, builtin lookup, and console trap lifecycle.
//! The isolated apply helper remains for algorithm tests; its prefix-based
//! standalone helpers omit that shared indirection.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const transform = parser.traverser.transform;
const Action = parser.traverser.Action;
const embed = @import("embed_snippet.zig");
const Runtime = @import("runtime.zig").Manager;
const Policy = @import("policy.zig").Policy;
const nodes = @import("nodes.zig");

const no_span: ast.Span = .{ .start = 0, .end = 0 };

pub const Config = struct {
    /// A valid identifier prefix unique throughout the input program.
    prefix: []const u8,
    /// JSDefender uses 3 without randomness, or 3 + randomInt(3, 16).
    offset: u16 = 3,
};

pub const Stats = struct {
    literals_transformed: usize = 0,
    unique_strings: usize = 0,
};

/// Quoted ASCII JavaScript literal containing the XOR of each UTF-16 unit.
/// The input is yuku's decoded UTF-8/WTF-8 value; lone surrogates are retained.
pub fn encodeLiteral(allocator: std.mem.Allocator, value: []const u8, offset: u16) ![]u8 {
    var out: std.ArrayList(u8) = .empty;
    errdefer out.deinit(allocator);
    try out.append(allocator, '"');
    var pos: usize = 0;
    while (pos < value.len) {
        const len = std.unicode.utf8ByteSequenceLength(value[pos]) catch unreachable;
        const cp: u21 = switch (len) {
            1 => value[pos],
            2 => std.unicode.utf8Decode2(value[pos..][0..2].*) catch unreachable,
            3 => std.unicode.utf8Decode3AllowSurrogateHalf(value[pos..][0..3].*) catch unreachable,
            4 => std.unicode.utf8Decode4(value[pos..][0..4].*) catch unreachable,
            else => unreachable,
        };
        pos += len;
        if (cp > 0xffff) {
            const adjusted = cp - 0x10000;
            try appendUnit(allocator, &out, (0xd800 + @as(u16, @intCast(adjusted >> 10))) ^ offset);
            try appendUnit(allocator, &out, (0xdc00 + @as(u16, @intCast(adjusted & 0x3ff))) ^ offset);
        } else {
            try appendUnit(allocator, &out, @as(u16, @intCast(cp)) ^ offset);
        }
    }
    try out.append(allocator, '"');
    return out.toOwnedSlice(allocator);
}

fn appendUnit(allocator: std.mem.Allocator, out: *std.ArrayList(u8), unit: u16) !void {
    const digits = "0123456789abcdef";
    try out.appendSlice(
        allocator,
        &.{ '\\', 'u', digits[unit >> 12], digits[(unit >> 8) & 15], digits[(unit >> 4) & 15], digits[unit & 15] },
    );
}

// Module 8538 escapes UTF-16 units, including paired surrogates, with
// uppercase hexadecimal and two-digit hex escapes below 256.
fn outputLiteral(allocator: std.mem.Allocator, escaped: []const u8) ![]u8 {
    var out: std.ArrayList(u8) = .empty;
    errdefer out.deinit(allocator);
    try out.append(allocator, '"');
    var offset: usize = 1;
    while (offset + 6 <= escaped.len) : (offset += 6) {
        const unit = std.fmt.parseInt(u16, escaped[offset + 2 .. offset + 6], 16) catch unreachable;
        switch (unit) {
            '"' => try out.appendSlice(allocator, "\\\""),
            '\'' => try out.appendSlice(allocator, "\\'"),
            '\\' => try out.appendSlice(allocator, "\\\\"),
            8 => try out.appendSlice(allocator, "\\b"),
            9 => try out.appendSlice(allocator, "\\t"),
            10 => try out.appendSlice(allocator, "\\n"),
            11 => try out.appendSlice(allocator, "\\v"),
            12 => try out.appendSlice(allocator, "\\f"),
            13 => try out.appendSlice(allocator, "\\r"),
            else => {
                const hex = "0123456789ABCDEF";
                if (unit >= 32 and unit <= 127) try out.append(allocator, @intCast(unit)) else if (unit <= 255) try out.appendSlice(allocator, &.{ '\\', 'x', hex[unit >> 4], hex[unit & 15] }) else try out.appendSlice(
                    allocator,
                    &.{ '\\', 'u', hex[unit >> 12], hex[(unit >> 8) & 15], hex[(unit >> 4) & 15], hex[unit & 15] },
                );
            },
        }
    }
    try out.append(allocator, '"');
    return out.toOwnedSlice(allocator);
}

pub fn quote(allocator: std.mem.Allocator, value: []const u8) ![]u8 {
    const escaped = try encodeLiteral(allocator, value, 0);
    defer allocator.free(escaped);
    return outputLiteral(allocator, escaped);
}

const Visitor = struct {
    allocator: std.mem.Allocator,
    config: Config,
    runtime: ?*Runtime = null,
    policy: ?*const Policy = null,
    tree_id: u32 = 0,
    collection: ?[]const u8 = null,
    aliases: [8][]const u8 = undefined,
    runtime_error: bool = false,
    // Keys are canonical escaped UTF-16, so literal astral characters and
    // escaped surrogate pairs deduplicate even if their WTF-8 differs.
    entries: std.StringHashMapUnmanaged(u32) = .empty,
    ordered: std.ArrayList([]const u8) = .empty,
    stats: Stats = .{},

    fn deinit(self: *Visitor) void {
        self.entries.deinit(self.allocator);
        for (self.ordered.items) |entry| self.allocator.free(entry);
        self.ordered.deinit(self.allocator);
    }

    fn prepareRuntime(self: *Visitor) @import("runtime.zig").Error!void {
        if (self.runtime == null or self.collection != null) return;
        const runtime = self.runtime.?;
        try runtime.initializeProtector();
        const key = try std.fmt.allocPrint(self.allocator, "stringColl{d}", .{self.tree_id});
        defer self.allocator.free(key);
        self.collection = try runtime.addSetupVar(key, null, false);
        for (0..8) |i| {
            const alias = try runtime.generateRuntimeName();
            self.aliases[i] = alias;
            const accessor_name = try runtime.stringGetter(alias, false);
            const source = try runtime.template(
                "\n  $PROT[{{accessPropLego}}()] = {{accessProp}};\n  function {{accessProp}}(id) { return {{stringColl}}[id]; }\n",
                &.{
                    .{ .key = "accessPropLego", .value = accessor_name },
                    .{ .key = "accessProp", .value = alias },
                    .{ .key = "stringColl", .value = self.collection.? },
                },
                false,
            );
            try runtime.addSetup(source);
        }
        self.config.offset = 3 + if (runtime.random) |random| @as(u16, @intFromFloat(random.getRandomInt(3, 16))) else @as(u16, 0);
    }

    fn intern(self: *Visitor, value: []const u8) @import("runtime.zig").Error!u32 {
        try self.prepareRuntime();
        const encoded = try encodeLiteral(self.allocator, value, self.config.offset);
        if (self.entries.get(encoded)) |index| {
            self.allocator.free(encoded);
            return index;
        }
        errdefer self.allocator.free(encoded);
        const index: u32 = @intCast(self.ordered.items.len);
        try self.ordered.ensureUnusedCapacity(self.allocator, 1);
        try self.entries.put(self.allocator, encoded, index);
        self.ordered.appendAssumeCapacity(encoded);
        return index;
    }

    fn accessor(self: *Visitor, tree: *ast.Tree, index: u32) !ast.NodeIndex {
        const source = if (self.runtime) |runtime|
            try std.fmt.allocPrint(
                self.allocator,
                "{s}.{s}({d})",
                .{ runtime.protector_name.?, self.aliases[index % 8], index },
            )
        else
            try std.fmt.allocPrint(
                self.allocator,
                "{s}_p.{s}_a{d}({d})",
                .{ self.config.prefix, self.config.prefix, index % 8, index },
            );
        defer self.allocator.free(source);
        return embed.embedExpression(self.allocator, tree, source);
    }

    pub fn enter_string_literal(
        self: *Visitor,
        literal: ast.StringLiteral,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) std.mem.Allocator.Error!Action {
        if (nodes.isDetached(ctx.tree, index)) return .skip;
        if (self.runtime_error) return .skip;
        if (self.policy) |rules| if (!rules.isEnabled(index, "string_literals")) return .skip;
        return self.visitString(literal, index, ctx) catch |err| switch (err) {
            error.OutOfMemory => error.OutOfMemory,
            error.RuntimeUnavailable => blk: {
                self.runtime_error = true;
                break :blk .skip;
            },
        };
    }

    fn visitString(
        self: *Visitor,
        literal: ast.StringLiteral,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) @import("runtime.zig").Error!Action {
        if (ctx.path.parent()) |parent| {
            switch (ctx.tree.data(parent)) {
                .directive,
                .import_specifier,
                .export_specifier,
                .import_attribute,
                .ts_literal_type,
                .ts_module_declaration,
                => return .proceed,
                inline .import_declaration, .export_named_declaration, .export_all_declaration => |node| if (node.source == index) {
                    if (self.runtime == null) return .proceed;
                    _ = try self.intern(ctx.tree.string(literal.value));
                    self.stats.literals_transformed += 1;
                    return .proceed;
                },
                .method_definition => |node| {
                    if (node.key == index and !node.computed) {
                        // A constructor must keep its special definition form.
                        if (node.kind == .constructor and self.runtime == null) return .proceed;
                        var updated = node;
                        updated.computed = true;
                        ctx.tree.setData(parent, .{ .method_definition = updated });
                    }
                },
                .property_definition => |node| {
                    if (node.key == index and !node.computed) {
                        var updated = node;
                        updated.computed = true;
                        ctx.tree.setData(parent, .{ .property_definition = updated });
                    }
                },
                .binding_property => |node| {
                    if (node.key == index and !node.computed) {
                        var updated = node;
                        updated.computed = true;
                        ctx.tree.setData(parent, .{ .binding_property = updated });
                    }
                },
                .object_property => |node| {
                    if (node.key == index and !node.computed) {
                        // Computed __proto__ defines a property; the static
                        // colon form sets the prototype. Preserve that form.
                        if (self.runtime == null and !node.method and !node.shorthand and node.kind == .init and
                            std.mem.eql(u8, ctx.tree.string(literal.value), "__proto__")) return .proceed;
                        var updated = node;
                        updated.computed = true;
                        ctx.tree.setData(parent, .{ .object_property = updated });
                    }
                },
                else => {},
            }
        }
        const slot = try self.intern(ctx.tree.string(literal.value));
        const replacement = try self.accessor(ctx.tree, slot);
        ctx.tree.setData(index, ctx.tree.data(replacement));
        self.stats.literals_transformed += 1;
        return .proceed;
    }

    pub fn enter_template_literal(
        self: *Visitor,
        node: ast.TemplateLiteral,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) std.mem.Allocator.Error!Action {
        if (self.runtime_error) return .skip;
        if (self.policy) |rules| if (!rules.isEnabled(index, "string_literals")) return .proceed;
        return self.visitTemplate(node, index, ctx) catch |err| switch (err) {
            error.OutOfMemory => error.OutOfMemory,
            error.RuntimeUnavailable => blk: {
                self.runtime_error = true;
                break :blk .skip;
            },
        };
    }

    fn visitTemplate(
        self: *Visitor,
        node: ast.TemplateLiteral,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) @import("runtime.zig").Error!Action {
        if (ctx.path.parent()) |parent| switch (ctx.tree.data(parent)) {
            // Tagged templates expose raw/cooked strings and a cached object
            // identity. Altering their quasis changes observable behavior.
            .tagged_template_expression, .ts_literal_type => return .proceed,
            else => {},
        };
        const original_quasis = ctx.tree.extra(node.quasis);
        const original_expressions = ctx.tree.extra(node.expressions);
        var expressions: std.ArrayList(ast.NodeIndex) = .empty;
        defer expressions.deinit(self.allocator);
        var quasis: std.ArrayList(ast.NodeIndex) = .empty;
        defer quasis.deinit(self.allocator);
        var changed = false;
        var stopped = false;
        for (original_quasis, 0..) |quasi, i| {
            const element = ctx.tree.data(quasi).template_element;
            const raw = ctx.tree.string(element.raw);
            const value = ctx.tree.string(if (element.is_cooked_undefined) element.raw else element.cooked);
            // Preserve the recovered module's early-stop case, including
            // previously collected quasis and the remaining original text.
            if (std.mem.eql(u8, value, "\\r\\n")) stopped = true;
            if (!stopped and (raw.len != 0 or value.len != 0 or (!element.tail and i != 0))) {
                const slot = try self.intern(value);
                try quasis.append(self.allocator, try ctx.tree.addNode(.{ .template_element = .{ .tail = false } }, no_span));
                try expressions.append(self.allocator, try self.accessor(ctx.tree, slot));
                try quasis.append(
                    self.allocator,
                    try ctx.tree.addNode(.{ .template_element = .{ .tail = element.tail } }, no_span),
                );
                self.stats.literals_transformed += 1;
                changed = true;
            } else {
                try quasis.append(self.allocator, quasi);
            }
            if (i < original_expressions.len) try expressions.append(self.allocator, original_expressions[i]);
        }
        if (!changed) return .proceed;
        ctx.tree.setData(index, .{ .template_literal = .{
            .quasis = try ctx.tree.addExtra(quasis.items),
            .expressions = try ctx.tree.addExtra(expressions.items),
        } });
        return .proceed;
    }
};

/// Builds the isolated string runtime used by apply's algorithm tests.
/// Production integration uses applyWithRuntime and the shared manager.
pub fn runtimeSource(allocator: std.mem.Allocator, config: Config, encoded: []const []const u8) ![]u8 {
    var source: std.ArrayList(u8) = .empty;
    errdefer source.deinit(allocator);
    const header = try std.fmt.allocPrint(allocator, "var {s}_p={{}},{s}_c,{s}_e=[", .{ config.prefix, config.prefix, config.prefix });
    defer allocator.free(header);
    try source.appendSlice(allocator, header);
    for (encoded, 0..) |entry, i| {
        if (i != 0) try source.append(allocator, ',');
        try source.appendSlice(allocator, entry);
    }
    try source.appendSlice(allocator, "];\n");
    for (0..8) |i| {
        const accessor_source = try std.fmt.allocPrint(
            allocator,
            "{s}_p.{s}_a{d}={s}_a{d};function {s}_a{d}(id){{return {s}_c[id];}}\n",
            .{ config.prefix, config.prefix, i, config.prefix, i, config.prefix, i, config.prefix },
        );
        defer allocator.free(accessor_source);
        try source.appendSlice(allocator, accessor_source);
    }
    const decoder = try std.fmt.allocPrint(allocator, "function {s}_d(){{{s}_c=[];var stringObj=''.constructor;var _fromCharCode='fromCharCode',_charCodeAt='charCodeAt',_length='length',_push='push';" ++
        "for(var i=0;i<{s}_e[_length];i++){{var result='',input={s}_e[i];for(var j=0;j<input[_length];j++){{result+=stringObj[_fromCharCode](input[_charCodeAt](j)^{d});}}{s}_c[_push](result);}}}}{s}_d();", .{ config.prefix, config.prefix, config.prefix, config.prefix, config.offset, config.prefix, config.prefix });
    defer allocator.free(decoder);
    try source.appendSlice(allocator, decoder);
    return source.toOwnedSlice(allocator);
}

pub fn apply(allocator: std.mem.Allocator, tree: *ast.Tree, config: Config) !Stats {
    var visitor = Visitor{ .allocator = allocator, .config = config };
    defer visitor.deinit();
    try transform.traverse(Visitor, tree, &visitor);
    if (visitor.runtime_error) return error.RuntimeUnavailable;
    visitor.stats.unique_strings = visitor.ordered.items.len;
    if (visitor.ordered.items.len == 0) return visitor.stats;
    const source = try runtimeSource(allocator, config, visitor.ordered.items);
    defer allocator.free(source);
    const runtime = try embed.embedProgram(allocator, tree, source);
    const program = tree.data(tree.root).program;
    const original = tree.extra(program.body);
    var directive_count: usize = 0;
    while (directive_count < original.len and tree.data(original[directive_count]) == .directive) : (directive_count += 1) {}
    var body: std.ArrayList(ast.NodeIndex) = .empty;
    defer body.deinit(allocator);
    try body.appendSlice(allocator, original[0..directive_count]);
    try body.appendSlice(allocator, tree.extra(runtime));
    try body.appendSlice(allocator, original[directive_count..]);
    var updated = program;
    updated.body = try tree.addExtra(body.items);
    tree.setData(tree.root, .{ .program = updated });
    return visitor.stats;
}

/// Adds the recovered eight accessor aliases and decoder to the caller's
/// shared runtime. The caller finalizes that manager once after all passes.
pub fn applyWithRuntime(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    runtime: *Runtime,
    tree_id: u32,
) !Stats {
    return applyWithRuntimeSelected(allocator, tree, runtime, tree_id, null);
}

pub fn applyWithRuntimeAndPolicy(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    runtime: *Runtime,
    tree_id: u32,
    policy: *const Policy,
) !Stats {
    return applyWithRuntimeSelected(allocator, tree, runtime, tree_id, policy);
}

fn applyWithRuntimeSelected(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    runtime: *Runtime,
    tree_id: u32,
    selection: ?*const Policy,
) !Stats {
    var visitor = Visitor{
        .allocator = allocator,
        .config = .{ .prefix = "" },
        .runtime = runtime,
        .tree_id = tree_id,
        .policy = selection,
    };
    defer visitor.deinit();
    try transform.traverse(Visitor, tree, &visitor);
    if (visitor.runtime_error) return error.RuntimeUnavailable;
    visitor.stats.unique_strings = visitor.ordered.items.len;
    if (visitor.ordered.items.len == 0) return visitor.stats;
    var array: std.ArrayList(u8) = .empty;
    defer array.deinit(allocator);
    try array.append(allocator, '[');
    for (visitor.ordered.items, 0..) |entry, i| {
        if (i != 0) try array.append(allocator, ',');
        const literal = try outputLiteral(allocator, entry);
        defer allocator.free(literal);
        try array.appendSlice(allocator, literal);
    }
    try array.append(allocator, ']');
    const get_string = try runtime.addBuiltin("getString");
    const key = try std.fmt.allocPrint(allocator, "encodedStrings{d}", .{tree_id});
    defer allocator.free(key);
    const encoded = try runtime.addSetupVar(key, array.items, false);
    const decode = try std.fmt.allocPrint(allocator, "decodeStrings{d}", .{tree_id});
    defer allocator.free(decode);
    var offset_buf: [5]u8 = undefined;
    const offset = try std.fmt.bufPrint(&offset_buf, "{d}", .{visitor.config.offset});
    const source = try runtime.template("\n  function {{decodeStrings}}() {\n    {{stringColl}} = [];\n    $CONST stringObj = {{getString}}();\n    $CONST _fromCharCode = $fromCharCode$;\n    $CONST _charCodeAt = $charCodeAt$;\n    $CONST _length = $length$;\n    $CONST _push = $push$;\n    for (let i = 0; i < {{encodedStrings}}[_length]; i++) {\n      let result = \"\";\n      const input = {{encodedStrings}}[i];\n      for (let i = 0; i < input[_length]; i++) {\n        result += stringObj[_fromCharCode](input[_charCodeAt](i) ^ {{offset}});\n      }\n      {{stringColl}}[_push](result);\n    }\n  }\n  {{decodeStrings}}();\n", &.{
        .{ .key = "decodeStrings", .value = decode }, .{ .key = "stringColl", .value = visitor.collection.? },
        .{ .key = "getString", .value = get_string }, .{ .key = "encodedStrings", .value = encoded },
        .{ .key = "offset", .value = offset },
    }, true);
    try runtime.addSetup(source);
    return visitor.stats;
}

test "scoped string policy excludes disabled literals before runtime preparation" {
    const allocator = std.testing.allocator;
    const configuration_module = @import("config.zig");
    const json = try std.json.parseFromSlice(
        std.json.Value,
        allocator,
        "{\"settings\":{\"stringLiterals\":true,\"localDeclarations\":false}}",
        .{},
    );
    defer json.deinit();
    var configuration = try configuration_module.parse(allocator, json.value);
    defer configuration.deinit();
    var tree = try parser.parse(
        allocator,
        "function plain(){'@pjsd {stringLiterals:false}';return 'visible'}function hidden(){return 'secret'}console.log(plain(),hidden());",
        .{},
    );
    defer tree.deinit();
    var selection = try Policy.init(allocator, &tree, &configuration, 0);
    defer selection.deinit();
    var random = @import("scalars.zig").Random.init(1);
    var runtime = Runtime.init(allocator, .{}, &random);
    defer runtime.deinit();
    const stats = try applyWithRuntimeAndPolicy(allocator, &tree, &runtime, 0, &selection);
    try std.testing.expectEqual(@as(usize, 1), stats.literals_transformed);
    try std.testing.expectEqual(@as(usize, 1), stats.unique_strings);
    try runtime.finalize(&tree);
    const generated = try parser.codegen.generate(allocator, &tree, .{});
    defer generated.deinit(allocator);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "visible") != null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "secret") == null);
    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const run = try std.process.run(allocator, threaded.io(), .{ .argv = &.{ "bun", "-e", generated.code } });
    defer allocator.free(run.stdout);
    defer allocator.free(run.stderr);
    try std.testing.expectEqualStrings("", run.stderr);
    try std.testing.expectEqualStrings("visible secret\n", run.stdout);
}

test "disabled templates still traverse nested functions with enabled inline string protection" {
    const allocator = std.testing.allocator;
    const json = try std.json.parseFromSlice(
        std.json.Value,
        allocator,
        "{\"settings\":{\"stringLiterals\":false,\"localDeclarations\":false}}",
        .{},
    );
    defer json.deinit();
    var configuration = try @import("config.zig").parse(allocator, json.value);
    defer configuration.deinit();
    var tree = try parser.parse(
        allocator,
        "console.log(`visible ${function(){'@pjsd {stringLiterals:true}';return 'nestedSecret'}()}`);",
        .{},
    );
    defer tree.deinit();
    var selection = try Policy.init(allocator, &tree, &configuration, 0);
    defer selection.deinit();
    var random = @import("scalars.zig").Random.init(1);
    var runtime = Runtime.init(allocator, .{}, &random);
    defer runtime.deinit();
    const stats = try applyWithRuntimeAndPolicy(allocator, &tree, &runtime, 0, &selection);
    try std.testing.expectEqual(@as(usize, 1), stats.literals_transformed);
    try runtime.finalize(&tree);
    const generated = try parser.codegen.generate(allocator, &tree, .{});
    defer generated.deinit(allocator);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "visible ") != null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "nestedSecret") == null);
    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const run = try std.process.run(allocator, threaded.io(), .{ .argv = &.{ "bun", "-e", generated.code } });
    defer allocator.free(run.stdout);
    defer allocator.free(run.stderr);
    try std.testing.expectEqualStrings("", run.stderr);
    try std.testing.expectEqualStrings("visible nestedSecret\n", run.stdout);
}

test "shared runtime strings preserve values and restore console after traps" {
    const allocator = std.testing.allocator;
    const source =
        "'use strict';const object={'__proto__':null,'label':'repeat'};" ++
        "const value={ [Symbol.toPrimitive](hint){return hint} };" ++
        "console.log(object.label,`prefix${value}suffix`,'😀','\\\\ud800'.charCodeAt(0),'repeat');";
    var tree = try parser.parse(allocator, source, .{ .source_type = .script });
    defer tree.deinit();
    var random = @import("scalars.zig").Random.init(1);
    var runtime = Runtime.init(allocator, .{}, &random);
    defer runtime.deinit();
    const stats = try applyWithRuntime(allocator, &tree, &runtime, 0);
    try std.testing.expect(stats.unique_strings >= 5);
    try runtime.finalize(&tree);
    const generated = try parser.codegen.generate(allocator, &tree, .{});
    defer generated.deinit(allocator);
    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const original = try std.process.run(allocator, threaded.io(), .{ .argv = &.{ "bun", "-e", source } });
    defer allocator.free(original.stdout);
    defer allocator.free(original.stderr);
    const transformed = try std.process.run(allocator, threaded.io(), .{ .argv = &.{ "bun", "-e", generated.code } });
    defer allocator.free(transformed.stdout);
    defer allocator.free(transformed.stderr);
    try std.testing.expectEqualStrings("", transformed.stderr);
    try std.testing.expectEqualStrings(original.stdout, transformed.stdout);
}

test "JSDefender encoding XORs UTF-16 units including astral and lone surrogate values" {
    const allocator = std.testing.allocator;
    const encoded = try encodeLiteral(allocator, "A\u{1f600}\xed\xa0\x80", 19);
    defer allocator.free(encoded);
    try std.testing.expectEqualStrings("\"\\u0052\\ud82e\\ude13\\ud813\"", encoded);
    const empty = try encodeLiteral(allocator, "", 3);
    defer allocator.free(empty);
    try std.testing.expectEqualStrings("\"\"", empty);
}

test "string extraction preserves static syntax and deduplicates ordered values" {
    const allocator = std.testing.allocator;
    var tree = try parser.parse(allocator, "'use strict';import {'external name' as imported} from './dep.js';" ++
        "export {imported as 'public name'};const x={'__proto__':null,'key':'repeat'};" ++
        "console.log('repeat','x');", .{});
    defer tree.deinit();
    const stats = try apply(allocator, &tree, .{ .prefix = "testStrings", .offset = 19 });
    try std.testing.expectEqual(@as(usize, 4), stats.literals_transformed);
    try std.testing.expectEqual(@as(usize, 3), stats.unique_strings);
    const generated = try parser.codegen.generate(allocator, &tree, .{});
    defer generated.deinit(allocator);
    var reparsed = try parser.parse(allocator, generated.code, .{});
    defer reparsed.deinit();
    try std.testing.expect(!reparsed.hasErrors());
    try std.testing.expectEqual(
        .directive,
        std.meta.activeTag(tree.data(tree.extra(tree.data(tree.root).program.body)[0])),
    );
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "__proto__") != null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "external name") != null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "public name") != null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "repeat") == null);
}

test "extracted strings preserve prototypes template coercion and tagged template identity at runtime" {
    const allocator = std.testing.allocator;
    const source =
        \\"use strict";
        \\const proto={value:17};
        \\const object={"__proto__":proto,"label":"label"};
        \\class Box { "constructor"(){this["value"]=9} "read"(){return this["value"]} }
        \\const trace=[];
        \\const value={ [Symbol.toPrimitive](hint){trace.push(hint);return "V"} };
        \\const message=`a${value}b${(trace.push("next"),3)}c`;
        \\let first;
        \\function tag(parts,x){const same=first===undefined||first===parts;first=parts;return same+":"+parts.raw[0]+":"+parts[0]+":"+x}
        \\function call(){return tag`raw\n${"inside"}`}
        \\console.log(object.value,Object.hasOwn(object,"__proto__"),object.label,new Box().read());
        \\console.log(message,trace.join(","),call(),call());
        \\console.log("\ud800".charCodeAt(0),"😀".length,"".length);
        \\try { missingGlobal=1 } catch(error) {console.log(error.name)}
    ;
    var tree = try parser.parse(allocator, source, .{ .source_type = .script });
    defer tree.deinit();
    _ = try apply(allocator, &tree, .{ .prefix = "testStrings", .offset = 19 });
    const generated = try parser.codegen.generate(allocator, &tree, .{});
    defer generated.deinit(allocator);
    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const io = threaded.io();
    const original = try std.process.run(allocator, io, .{ .argv = &.{ "bun", "-e", source } });
    defer allocator.free(original.stdout);
    defer allocator.free(original.stderr);
    const transformed = try std.process.run(allocator, io, .{ .argv = &.{ "bun", "-e", generated.code } });
    defer allocator.free(transformed.stdout);
    defer allocator.free(transformed.stderr);
    try std.testing.expectEqualStrings("", original.stderr);
    try std.testing.expectEqualStrings("", transformed.stderr);
    try std.testing.expectEqualStrings(original.stdout, transformed.stdout);
}

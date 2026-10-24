//! Inline directive parsing and lexical protection sets recovered from
//! SourceTree.refreshSyntaxInfo/buildProtectionSets (module 7500).
//! Directives are string prologue statements, not comments:
//! "@pjsd { stringLiterals: false }"; or "@jsdefender namedSet";.

const std = @import("std");
const parser = @import("parser");
const config = @import("config.zig");
const ast = parser.ast;
const Allocator = std.mem.Allocator;
pub const Error = config.Error || error{InvalidInlineConfiguration};
pub const Warning = struct {
    kind: enum {
        invalid_inline_configuration,
        unknown_named_set,
        global_option_on_inline,
    },
    node: ast.NodeIndex,
    name: ?[]const u8 = null,
};

pub const Policy = struct {
    child_allocator: Allocator,
    arena: std.heap.ArenaAllocator,
    /// Entries belong to Program or the function/method owning a directive.
    entries: std.AutoHashMapUnmanaged(ast.NodeIndex, config.Settings) = .empty,
    parents: std.ArrayList(ast.NodeIndex) = .empty,
    warnings: std.ArrayList(Warning) = .empty,
    root_settings: config.Settings,
    tree: ?*const ast.Tree = null,

    /// Config must outlive Policy. Inline settings and names are Policy-owned.
    pub fn init(
        allocator: Allocator,
        tree: *ast.Tree,
        configuration: *const config.Config,
        source_index: usize,
    ) Error!Policy {
        const source = configuration.forSource(source_index) catch |err| switch (err) {
            error.UnknownNamedSet => config.SourceSettings{ .settings = configuration.settings, .disable_inline = configuration.disable_inline },
            else => return err,
        };
        var self = Policy{
            .child_allocator = allocator,
            .arena = std.heap.ArenaAllocator.init(allocator),
            .root_settings = source.settings,
        };
        errdefer self.deinit();
        const owned = self.arena.allocator();
        try self.entries.put(owned, tree.root, source.settings);
        if (source_index < configuration.source_sets.len and configuration.lookupSet(configuration.source_sets[source_index]) == null) {
            try self.warnings.append(
                allocator,
                .{
                    .kind = .unknown_named_set,
                    .node = tree.root,
                    .name = try owned.dupe(u8, configuration.source_sets[source_index]),
                },
            );
        }
        var collector = Collector{ .allocator = allocator };
        defer collector.nodes.deinit(allocator);
        try parser.traverser.basic.traverse(Collector, tree, &collector);
        try self.refresh(tree);

        for (collector.nodes.items) |index| {
            if (tree.data(index) == .static_block or privateMember(tree, tree.data(index))) {
                try self.entries.put(owned, index, config.Settings.allOff());
                continue;
            }
            const range = switch (tree.data(index)) {
                .program => |program| program.body,
                .function_body => |body| body.body,
                else => continue,
            };
            const owner = self.directiveOwner(tree, index);
            const statements = try allocator.dupe(ast.NodeIndex, tree.extra(range));
            defer allocator.free(statements);
            var body: std.ArrayList(ast.NodeIndex) = .empty;
            defer body.deinit(allocator);
            var fragments: std.ArrayList(u8) = .empty;
            defer fragments.deinit(allocator);
            var first_directive: ?ast.NodeIndex = null;
            for (statements) |statement| {
                if (tree.data(statement) == .directive) {
                    const directive = tree.data(statement).directive;
                    // Babel DirectiveLiteral.value retains raw escapes.
                    const text = tree.string(directive.value);
                    if (directivePayload(text)) |payload| {
                        if (first_directive == null) first_directive = statement;
                        if (fragments.items.len != 0) try fragments.append(allocator, ' ');
                        try fragments.appendSlice(allocator, payload);
                        continue;
                    }
                }
                try body.append(allocator, statement);
            }
            if (first_directive == null) continue;
            // SourceTree removes recognized directives even when parsing fails
            // or global disableInline suppresses their protection settings.
            const new_range = try tree.addExtra(body.items);
            var data = tree.data(index);
            switch (data) {
                .program => |*program| program.body = new_range,
                .function_body => |*function_body| function_body.body = new_range,
                else => unreachable,
            }
            tree.setData(index, data);
            const directive = parseDirective(owned, fragments.items) catch |err| switch (err) {
                error.OutOfMemory => return error.OutOfMemory,
                else => {
                    try self.warnings.append(allocator, .{ .kind = .invalid_inline_configuration, .node = first_directive.? });
                    continue;
                },
            };
            var overrides: config.Settings = switch (directive) {
                .settings => |settings| settings,
                .name => |name| blk: {
                    if (config.isDisableInline(name)) break :blk config.Settings.off();
                    if (configuration.lookupSet(name)) |settings| break :blk settings;
                    try self.warnings.append(allocator, .{ .kind = .unknown_named_set, .node = owner, .name = name });
                    break :blk .{};
                },
            };
            if (directive == .settings) {
                inline for (.{ "date_lock", "domain_lock", "console_cloaking", "dev_tools_blocking", "global_object_hiding" }) |name| {
                    if (@field(overrides, name).isEnabled())
                        try self.warnings.append(allocator, .{ .kind = .global_option_on_inline, .node = owner, .name = name });
                }
            }
            if (!source.disable_inline) {
                overrides = config.Settings.merge(self.settingsFor(owner), overrides);
                try self.entries.put(owned, owner, overrides);
                if (owner == tree.root) self.root_settings = overrides;
            }
        }
        try self.refresh(tree);
        return self;
    }

    pub fn deinit(self: *Policy) void {
        self.parents.deinit(self.child_allocator);
        self.warnings.deinit(self.child_allocator);
        self.arena.deinit();
    }

    /// Refresh after structural mutations, before consulting new node indices.
    pub fn refresh(self: *Policy, tree: *const ast.Tree) Allocator.Error!void {
        self.tree = tree;
        const previous = self.parents.items.len;
        try self.parents.resize(self.child_allocator, tree.nodes.len);
        @memset(self.parents.items[previous..], .null);
        var visitor = Parents{ .parents = self.parents.items };
        try parser.traverser.basic.traverse(Parents, tree, &visitor);
    }

    pub fn settingsFor(self: *const Policy, node: ast.NodeIndex) config.Settings {
        var current = node;
        while (current != .null) {
            if (self.tree) |tree|
                if (@backingInt(current) < tree.nodes.len and @import("nodes.zig").isOrphan(tree, current))
                    return config.Settings.allOff();
            if (self.entries.get(current)) |settings| return settings;
            const number = @backingInt(current);
            if (number >= self.parents.items.len) break;
            current = self.parents.items[number];
        }
        return config.Settings.allOff();
    }

    pub fn isEnabled(self: *const Policy, node: ast.NodeIndex, comptime setting: []const u8) bool {
        return @field(self.settingsFor(node), setting).isEnabled();
    }

    pub fn anyEnabled(self: *const Policy, comptime setting: []const u8) bool {
        var iterator = self.entries.valueIterator();
        while (iterator.next()) |settings| {
            if (@field(settings.*, setting).isEnabled()) return true;
        }
        return false;
    }

    /// Preserve method/function policy when a pass clones its owning node.
    pub fn associate(self: *Policy, node: ast.NodeIndex, origin: ast.NodeIndex) Allocator.Error!void {
        try self.entries.put(self.arena.allocator(), node, self.settingsFor(origin));
    }

    fn directiveOwner(self: *const Policy, tree: *const ast.Tree, body: ast.NodeIndex) ast.NodeIndex {
        if (tree.data(body) == .program) return body;
        const parent = self.parents.items[@backingInt(body)];
        if (parent == .null) return body;
        if (tree.data(parent) == .function) {
            const grandparent = self.parents.items[@backingInt(parent)];
            if (grandparent != .null) {
                switch (tree.data(grandparent)) {
                    .method_definition => return grandparent,
                    .object_property => |property| if (property.method or property.kind != .init) return grandparent,
                    else => {},
                }
            }
        }
        return parent;
    }
};

const Collector = struct {
    allocator: Allocator,
    nodes: std.ArrayList(ast.NodeIndex) = .empty,

    pub fn enter_node(
        self: *Collector,
        data: ast.NodeData,
        index: ast.NodeIndex,
        ctx: *parser.traverser.basic.Ctx,
    ) Allocator.Error!parser.traverser.Action {
        try self.nodes.append(self.allocator, index);
        return if (data == .static_block or privateMember(ctx.tree, data)) .skip else .proceed;
    }
};

pub fn privateMember(tree: *const ast.Tree, data: ast.NodeData) bool {
    return switch (data) {
        inline .property_definition, .method_definition => |value| tree.data(value.key) == .private_identifier,
        else => false,
    };
}
const Parents = struct {
    parents: []ast.NodeIndex,

    pub fn enter_node(
        self: *Parents,
        _: ast.NodeData,
        index: ast.NodeIndex,
        ctx: *parser.traverser.basic.Ctx,
    ) parser.traverser.Action {
        self.parents[@backingInt(index)] = ctx.path.parent() orelse .null;
        return .proceed;
    }
};

fn directivePayload(text: []const u8) ?[]const u8 {
    const trimmed = std.mem.trim(u8, text, " \t\r\n\x0b\x0c");
    for ([_][]const u8{ "@pjsd", "@jsdefender" }) |prefix| {
        if (trimmed.len > prefix.len and std.mem.startsWith(u8, trimmed, prefix)) {
            // Preserve SourceTree's distinct recognition/extraction rules:
            // recognition trims, extraction uses the original text.
            const length = if (std.mem.startsWith(u8, text, "@pjsd")) "@pjsd".len else "@jsdefender".len;
            return text[@min(length, text.len)..];
        }
    }
    return null;
}

const Directive = union(enum) {
    settings: config.Settings,
    name: []const u8,
};

fn parseDirective(allocator: Allocator, source: []const u8) Error!Directive {
    if (std.mem.eql(u8, std.mem.trim(u8, source, " \t\r\n"), "default")) return .{ .name = "default" };
    const program = try std.fmt.allocPrint(allocator, "const config={s}", .{source});
    var tree = try parser.parse(allocator, program, .{ .source_type = .script });
    defer tree.deinit();
    if (tree.hasErrors()) return error.InvalidInlineConfiguration;
    const statements = tree.extra(tree.data(tree.root).program.body);
    if (statements.len == 0 or tree.data(statements[0]) != .variable_declaration) return error.InvalidInlineConfiguration;
    const declarations = tree.extra(tree.data(statements[0]).variable_declaration.declarators);
    if (declarations.len == 0) return error.InvalidInlineConfiguration;
    const value = unwrap(&tree, tree.data(declarations[0]).variable_declarator.init);
    if (value == .null) return error.InvalidInlineConfiguration;
    switch (tree.data(value)) {
        .identifier_reference => |name| return .{ .name = try allocator.dupe(u8, tree.string(name.name)) },
        .string_literal => |literal| return .{ .name = try allocator.dupe(u8, tree.string(literal.value)) },
        .object_expression => {
            const object = (try literalValue(allocator, &tree, value, true)).?;
            return .{ .settings = try config.parseSettings(allocator, object) };
        },
        else => return error.InvalidInlineConfiguration,
    }
}

fn unwrap(tree: *const ast.Tree, value: ast.NodeIndex) ast.NodeIndex {
    var current = value;
    while (current != .null and tree.data(current) == .parenthesized_expression) current = tree.data(current).parenthesized_expression.expression;
    return current;
}

/// null optional result represents JS undefined; JSON null is Value.null.
fn literalValue(
    allocator: Allocator,
    tree: *const ast.Tree,
    index: ast.NodeIndex,
    containers: bool,
) Error!?std.json.Value {
    const current = unwrap(tree, index);
    if (current == .null) return error.InvalidInlineConfiguration;
    return switch (tree.data(current)) {
        .boolean_literal => |boolean| .{ .bool = boolean.value },
        .string_literal => |literal| .{ .string = try allocator.dupe(u8, tree.string(literal.value)) },
        .numeric_literal => |literal| .{ .float = literal.value(tree) },
        .null_literal => .null,
        .identifier_reference => |identifier| if (std.mem.eql(u8, tree.string(identifier.name), "undefined")) null else error.InvalidInlineConfiguration,
        .object_expression => |object| blk: {
            if (!containers) return error.InvalidInlineConfiguration;
            var values: std.json.ObjectMap = .{};
            for (tree.extra(object.properties)) |property_index| {
                const property = switch (tree.data(property_index)) {
                    .object_property => |property| property,
                    else => return error.InvalidInlineConfiguration,
                };
                if (property.computed or property.shorthand or property.method or property.kind != .init) return error.InvalidInlineConfiguration;
                const key = switch (tree.data(property.key)) {
                    .identifier_name => |identifier| tree.string(identifier.name),
                    .string_literal => |literal| tree.string(literal.value),
                    else => return error.InvalidInlineConfiguration,
                };
                if (try literalValue(allocator, tree, property.value, true)) |value|
                    try values.put(allocator, try allocator.dupe(u8, key), value);
            }
            break :blk .{ .object = values };
        },
        .array_expression => |array| blk: {
            if (!containers) return error.InvalidInlineConfiguration;
            var values: std.array_list.Managed(std.json.Value) = .init(allocator);
            for (tree.extra(array.elements)) |element| try values.append((try literalValue(allocator, tree, element, false)) orelse .null);
            break :blk .{ .array = values };
        },
        else => error.InvalidInlineConfiguration,
    };
}

test "inline protection settings inherit through nested functions and methods" {
    const allocator = std.testing.allocator;
    const json = try std.json.parseFromSlice(
        std.json.Value,
        allocator,
        "{\"settings\":{\"stringLiterals\":true},\"namedSets\":{\"rename\":{\"localDeclarations\":true}}}",
        .{},
    );
    defer json.deinit();
    var configuration = try config.parse(allocator, json.value);
    defer configuration.deinit();
    var tree = try parser.parse(allocator,
        \\"use strict";"@jsdefender {booleanLiterals:true}";
        \\function outer(){"@pjsd {stringLiterals:false}";function nested(){return "hidden"}return nested()}
        \\const object={method(){"@pjsd rename";return "text"}};
    , .{});
    defer tree.deinit();
    var policy = try Policy.init(allocator, &tree, &configuration, 0);
    defer policy.deinit();
    const body = tree.extra(tree.data(tree.root).program.body);
    try std.testing.expect(tree.data(body[0]) == .directive);
    try std.testing.expect(tree.data(body[1]) == .function);
    const outer = body[1];
    const outer_body = tree.extra(tree.data(tree.data(outer).function.body).function_body.body);
    const nested = outer_body[0];
    try std.testing.expect(policy.isEnabled(tree.root, "boolean_literals"));
    try std.testing.expect(!policy.isEnabled(outer, "string_literals"));
    try std.testing.expect(!policy.isEnabled(nested, "string_literals"));
    try std.testing.expect(policy.isEnabled(nested, "boolean_literals"));
    const output = try parser.codegen.generate(allocator, &tree, .{});
    defer output.deinit(allocator);
    try std.testing.expect(std.mem.indexOf(u8, output.code, "@pjsd") == null);
    try std.testing.expect(std.mem.indexOf(u8, output.code, "@jsdefender") == null);
    try std.testing.expectEqual(@as(usize, 0), policy.warnings.items.len);
}

test "disabled inline settings still strip directives and malformed values warn" {
    const allocator = std.testing.allocator;
    const json = try std.json.parseFromSlice(
        std.json.Value,
        allocator,
        "{\"disableInline\":true,\"settings\":{\"stringLiterals\":false}}",
        .{},
    );
    defer json.deinit();
    var configuration = try config.parse(allocator, json.value);
    defer configuration.deinit();
    var tree = try parser.parse(
        allocator,
        "\"@pjsd {stringLiterals:true}\";function f(){\"@pjsd {stringLiterals:other}\";return \"text\"}",
        .{},
    );
    defer tree.deinit();
    var policy = try Policy.init(allocator, &tree, &configuration, 0);
    defer policy.deinit();
    try std.testing.expect(!policy.isEnabled(tree.root, "string_literals"));
    try std.testing.expectEqual(@as(usize, 1), policy.warnings.items.len);
    try std.testing.expect(policy.warnings.items[0].kind == .invalid_inline_configuration);
    const output = try parser.codegen.generate(allocator, &tree, .{});
    defer output.deinit(allocator);
    try std.testing.expect(std.mem.indexOf(u8, output.code, "@pjsd") == null);
}

test "inline directive recognition preserves raw escapes and leading-space failures" {
    const allocator = std.testing.allocator;
    var configuration = config.defaults(allocator);
    defer configuration.deinit();
    var tree = try parser.parse(
        allocator,
        "function escaped(){\"@pjsd\\x20off\";return 1}function spaced(){\" @pjsd off\";return 2}",
        .{},
    );
    defer tree.deinit();
    var policy = try Policy.init(allocator, &tree, &configuration, 0);
    defer policy.deinit();
    try std.testing.expectEqual(@as(usize, 2), policy.warnings.items.len);
    for (policy.warnings.items) |warning| try std.testing.expect(warning.kind == .invalid_inline_configuration);
    try std.testing.expect(policy.anyEnabled("string_literals"));
}

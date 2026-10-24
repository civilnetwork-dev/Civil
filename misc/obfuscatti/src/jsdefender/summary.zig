//! Syntax statistics and protection log schema from modules 7500/9219.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const A = std.mem.Allocator;
pub const LogSink = struct {
    context: *anyopaque,
    emit: *const fn (*anyopaque, []const u8, []const u8) anyerror!void,
};

pub const settings = [_][]const u8{
    "debugger_removal",
    "domain_lock",
    "date_lock",
    "dev_tools_blocking",
    "console_cloaking",
    "function_reorder",
    "control_flow",
    "expr_sequence",
    "boolean_literals",
    "constant_argument",
    "property_sparsing",
    "variable_grouping",
    "property_indirection",
    "integer_literals",
    "global_object_hiding",
    "string_literals",
    "local_declarations",
    "self_defending",
};

pub const Counter = struct {
    pass: usize,
    value: usize = 0,
};

threadlocal var counter: ?*Counter = null;

pub fn activate(value: ?*Counter) ?*Counter {
    const old = counter;
    counter = value;
    return old;
}

pub fn count(pass: usize, amount: usize) void {
    if (counter) |value| if (value.pass == pass) {
        value.value += amount;
    };
}

pub fn units(source: []const u8) usize {
    var total: usize = 0;
    for (source) |byte| if (byte < 0x80 or byte >= 0xc0) {
        total += if (byte >= 0xf0) @as(usize, 2) else 1;
    };
    return total;
}

pub const Statistics = struct {
    sourceCodeLength: usize = 0,
    isBundle: bool = false,
    numSyntaxNodes: usize = 0,
    numFunctions: usize = 0,
    maxFunctionDepths: usize = 0,
    numStatements: i64 = 0,
    numClasses: usize = 0,
    numModules: usize = 0,
    numLoops: usize = 0,
    numConditions: usize = 0,
    numFlowBreaking: usize = 0,
    esVersion: []const u8 = "es5",
};
const Visitor = struct {
    stats: Statistics = .{},
    depth: usize = 0,

    fn version(self: *@This(), value: []const u8) void {
        const current = self.stats.esVersion;
        if (std.mem.eql(u8, value, "es2015") and !std.mem.eql(u8, current, "es5")) return;
        if (std.mem.eql(u8, value, "es2016") and (std.mem.eql(u8, current, "es2017") or std.mem.eql(u8, current, "es2018")))
            return;
        if (std.mem.eql(u8, current, "es2018")) return;
        self.stats.esVersion = value;
    }

    fn method(ctx: *parser.traverser.basic.Ctx) bool {
        const parent = ctx.path.parent() orelse return false;
        return switch (ctx.tree.data(parent)) {
            .method_definition => true,
            .object_property => |v| v.method or v.kind != .init,
            else => false,
        };
    }

    pub fn enter_node(
        self: *@This(),
        data: ast.NodeData,
        index: ast.NodeIndex,
        ctx: *parser.traverser.basic.Ctx,
    ) parser.traverser.Action {
        const tree = ctx.tree;
        if (data == .import_attribute) return .skip;
        if (ctx.path.parent()) |parent| switch (tree.data(parent)) {
            .import_specifier => |value| if (index == value.imported and tree.span(value.imported).start == tree.span(value.local).start) {
                return .skip;
            },
            .export_specifier => |value| if (index == value.exported and tree.span(value.local).start == tree.span(value.exported).start) {
                return .skip;
            },
            else => {},
        };
        const transparent = switch (data) {
            .program, .formal_parameters, .formal_parameter, .parenthesized_expression, .chain_expression => true,
            .function => method(ctx),
            else => false,
        };
        if (!transparent) self.stats.numSyntaxNodes += 1;
        if (data == .static_block or data == .meta_property or data == .import_expression or @import("policy.zig").privateMember(tree, data))
            return .skip;
        switch (data) {
            .block_statement, .function_body => self.stats.numStatements += 1,
            .for_of_statement => {
                self.version("es2015");
                self.stats.numStatements += 1;
                self.stats.numLoops += 1;
            },
            .for_statement, .for_in_statement, .while_statement, .do_while_statement => {
                self.stats.numStatements += 1;
                self.stats.numLoops += 1;
            },
            .return_statement, .throw_statement, .break_statement, .continue_statement => {
                self.stats.numStatements += 1;
                self.stats.numFlowBreaking += 1;
            },
            .if_statement, .switch_statement => {
                self.stats.numStatements += 1;
                self.stats.numConditions += 1;
            },
            .function => |value| {
                if (method(ctx)) return .proceed;
                if (value.type == .function_declaration) self.stats.numStatements += 1;
                self.stats.numFunctions += 1;
                self.depth += 1;
                self.stats.maxFunctionDepths = @max(self.stats.maxFunctionDepths, self.depth);
                self.stats.numStatements -= 1;
                if (value.async)
                    self.version(if (value.generator) "es2018" else "es2017")
                else if (value.generator) self.version("es2015");
                const parameters = tree.data(value.params).formal_parameters;
                if (parameters.rest != .null) self.version("es2015");
                for (tree.extra(parameters.items)) |item| if (tree.data(tree.data(item).formal_parameter.pattern) != .binding_identifier) {
                    self.version("es2015");
                };
                const span = tree.span(value.params);
                if (span.end > span.start and span.end <= tree.source.len) {
                    const text = std.mem.trimEnd(u8, tree.source[span.start .. span.end - 1], " \r\n\t");
                    if (text.len != 0 and text[text.len - 1] == ',') self.version("es2017");
                }
            },
            .arrow_function_expression => {
                self.version("es2015");
                self.stats.numFunctions += 1;
            },
            .class => |value| {
                self.version("es2015");
                self.stats.numClasses += 1;
                if (value.type == .class_declaration) self.stats.numStatements += 1;
            },
            .variable_declaration => |value| {
                self.stats.numStatements += 1;
                if (value.kind != .@"var") self.version("es2015");
                for (tree.extra(value.declarators)) |item| if (tree.data(tree.data(item).variable_declarator.id) != .binding_identifier) {
                    self.version("es2015");
                };
            },
            .debugger_statement, .empty_statement, .expression_statement, .labeled_statement, .with_statement => self.stats.numStatements += 1,
            .try_statement => |value| self.stats.numStatements -= if (value.finalizer != .null) @as(i64, 2) else 1,
            .catch_clause => |value| if (value.param == .null) {
                self.version("es2018");
            },
            .template_literal, .yield_expression => self.version("es2015"),
            .method_definition => |value| {
                self.version(if (tree.data(value.value).function.async) "es2017" else "es2015");
                self.stats.numStatements -= 1;
            },
            .object_property => |value| {
                if (value.method or value.kind != .init) {
                    self.version(if (tree.data(value.value).function.async) "es2017" else "es2015");
                    self.stats.numStatements -= 1;
                }
                if (value.shorthand or value.computed) self.version("es2015");
            },
            .binding_property => |value| if (value.shorthand or value.computed) {
                self.version("es2015");
            },
            .import_declaration, .export_all_declaration, .export_default_declaration, .export_named_declaration => {
                self.version("es2015");
                self.stats.numStatements += 1;
                if (data == .export_all_declaration and data.export_all_declaration.exported != .null)
                    self.stats.numSyntaxNodes += 1;
            },
            .binary_expression => |value| if (value.operator == .exponent) {
                self.version("es2016");
            },
            else => {},
        }
        return .proceed;
    }

    pub fn exit_node(
        self: *@This(),
        data: ast.NodeData,
        _: ast.NodeIndex,
        ctx: *parser.traverser.basic.Ctx,
    ) void {
        if (data == .function and !method(ctx)) self.depth -= 1;
    }
};

test "initial syntax statistics preserve the SDK visitor quirks" {
    const allocator = std.testing.allocator;
    const samples = [_]struct {
        source: []const u8,
        nodes: usize,
        functions: usize,
        depth: usize,
        statements: i64,
        flow: usize,
        version: []const u8,
    }{
        .{
            .source = "var a=1;function f(x){return x+a;}console.log(f(1));",
            .nodes = 20,
            .functions = 1,
            .depth = 1,
            .statements = 4,
            .flow = 1,
            .version = "es5",
        },

        .{
            .source = "const f=()=>{function g(){return 1;}return g();};class A{m(){return 1;}#p(){return 2;}static{let x=3;}}",

            .nodes = 23,

            .functions = 2,

            .depth = 1,

            .statements = 7,

            .flow = 3,

            .version = "es2015",
        },

        .{
            .source = "import {x,y as z} from \"m\";export {x,z as out};export const a=1;",
            .nodes = 18,
            .functions = 0,
            .depth = 0,
            .statements = 4,
            .flow = 0,
            .version = "es2015",
        },

        .{
            .source = "try{for(let x of xs){if(x)break;}}catch{}",
            .nodes = 13,
            .functions = 0,
            .depth = 0,
            .statements = 6,
            .flow = 1,
            .version = "es2018",
        },

        .{
            .source = "async function* f(a,){yield a**2;}",
            .nodes = 9,
            .functions = 1,
            .depth = 1,
            .statements = 2,
            .flow = 0,
            .version = "es2018",
        },
    };
    for (samples) |sample| {
        var tree = try parser.parse(allocator, sample.source, .{ .source_type = .module });
        defer tree.deinit();
        const stats = try inspect(&tree, sample.source);
        try std.testing.expectEqual(sample.nodes, stats.numSyntaxNodes);
        try std.testing.expectEqual(sample.functions, stats.numFunctions);
        try std.testing.expectEqual(sample.depth, stats.maxFunctionDepths);
        try std.testing.expectEqual(sample.statements, stats.numStatements);
        try std.testing.expectEqual(sample.flow, stats.numFlowBreaking);
        try std.testing.expectEqualStrings(sample.version, stats.esVersion);
    }
}

pub fn inspect(tree: *ast.Tree, source: []const u8) !Statistics {
    var visitor = Visitor{};
    try parser.traverser.basic.traverse(Visitor, tree, &visitor);
    visitor.stats.sourceCodeLength = units(source);
    return visitor.stats;
}

const names = [_][]const u8{
    "Debugger removal transformation",
    "Domain lock transformation",
    "Date lock transformation",
    "DevTools blocking transformation",
    "Console cloaking transformation",
    "Function reordering transformation",
    "Control flow transformation",
    "Expression sequence transformation",
    "Boolean literal transformation",
    "Constant argument transformation",
    "Object property sparsing transformation",
    "Variable grouping transformation",
    "Property indirection transformation",
    "Integer literal transformation",
    "global object hiding transformation",
    "String literal transformation",
    "Local declaration transformation",
    "Self-defending function transformation",
};

const labels = [_]?[]const u8{
    "Number of debugger statements removed",
    null,
    null,
    null,
    null,
    "Number of functions reordered",
    "Number of control flow nodes transformed",
    "Number of expressions transformed",
    "Number of boolean literals replaced",
    "Number of constant arguments replaced",
    "Number of object expressions transformed",
    "Number of variables grouped",
    "Number of properties extracted",
    "Number of integer literals replaced",
    "Number of global references replaced",
    "Number of string literals extracted",
    "Number of declarations replaced",
    "Number of functions defended",
};

pub const State = struct {
    arena: std.heap.ArenaAllocator,
    sink: ?LogSink = null,
    statistics: std.ArrayList(Statistics) = .empty,
    valid: std.ArrayList(bool) = .empty,
    unsafe_sources: std.ArrayList(bool) = .empty,
    applied: std.ArrayList(bool) = .empty,
    logs: std.ArrayList(std.json.Value) = .empty,

    pub fn init(allocator: A) State {
        return .{ .arena = std.heap.ArenaAllocator.init(allocator) };
    }

    pub fn deinit(self: *State) void {
        self.arena.deinit();
    }

    fn alloc(self: *State) A {
        return self.arena.allocator();
    }

    pub fn log(self: *State, message: []const u8) !void {
        return self.logType("Info", message);
    }

    pub fn logType(self: *State, kind: []const u8, message: []const u8) !void {
        var object: std.json.ObjectMap = .empty;
        try object.put(self.alloc(), "type", .{ .string = kind });
        try object.put(self.alloc(), "message", .{ .string = try self.alloc().dupe(u8, message) });
        try self.logs.append(self.alloc(), .{ .object = object });
        if (self.sink) |sink| try sink.emit(sink.context, kind, message);
    }

    pub fn start(self: *State) !void {
        try self.log("JSDefender version 2.12.0");
        try self.log("Source tree building in progress...");
    }

    pub fn add(self: *State, stats: Statistics) !void {
        try self.statistics.append(self.alloc(), stats);
        try self.valid.append(self.alloc(), true);
        try self.unsafe_sources.append(self.alloc(), false);
        try self.applied.append(self.alloc(), false);
    }

    pub fn parseFailed(self: *State, source: []const u8) !void {
        try self.add(.{ .sourceCodeLength = units(source) });
        self.valid.items[self.valid.items.len - 1] = false;
    }

    pub fn built(self: *State) !void {
        return self.builtFor(self.statistics.items);
    }

    pub fn builtFor(self: *State, statistics: []const Statistics) !void {
        try self.log("Source tree successfully built.");
        var length: usize = 0;
        var nodes: usize = 0;
        var version: []const u8 = "es5";
        for (statistics) |value| {
            length += value.sourceCodeLength;
            nodes += value.numSyntaxNodes;
            if (value.esVersion.len > version.len or std.mem.order(u8, value.esVersion, version) == .gt and value.esVersion.len == version.len)
                version = value.esVersion;
        }
        try self.log(try std.fmt.allocPrint(self.alloc(), "Total length: {d}", .{length}));
        try self.log(try std.fmt.allocPrint(self.alloc(), "#of scripts: {d}", .{statistics.len}));
        try self.log(try std.fmt.allocPrint(self.alloc(), "#of syntax nodes: {d}", .{nodes}));
        try self.log(try std.fmt.allocPrint(self.alloc(), "Highest ES version: ES{s}", .{version[2..]}));
    }

    pub fn lexical(self: *State) !void {
        try self.log("Lexical tree building in progress...");
        try self.log("Lexical tree successfully built.");
    }

    pub fn transformed(self: *State, source: usize, pass: usize, amount: usize) !void {
        self.applied.items[source] = true;
        try self.log(try std.fmt.allocPrint(self.alloc(), "{s} applied.", .{names[pass]}));
        if (amount != 0)
            if (labels[pass]) |label| try self.log(try std.fmt.allocPrint(self.alloc(), "{s}: {d}", .{ label, amount }));
    }

    pub fn json(self: *State, allocator: A, protected: []const []const u8, seed: f64, elapsed: i64) ![]u8 {
        var object: std.json.ObjectMap = .empty;
        inline for (@typeInfo(Statistics).@"struct".field_names) |field| {
            var array = std.json.Array.init(self.alloc());
            var last: usize = if (comptime std.mem.eql(u8, field, "sourceCodeLength")) self.statistics.items.len else 0;
            if (comptime !std.mem.eql(u8, field, "sourceCodeLength")) for (self.valid.items, 0..) |valid, i| if (valid) {
                last = i + 1;
            };
            for (self.statistics.items[0..last], self.valid.items[0..last]) |stats, valid| {
                if (comptime !std.mem.eql(u8, field, "sourceCodeLength")) if (!valid) {
                    try array.append(.null);
                    continue;
                };
                const value = @field(stats, field);
                try array.append(switch (@typeInfo(@TypeOf(value))) {
                    .bool => .{ .bool = value },
                    .int => .{ .integer = @intCast(value) },
                    else => .{ .string = value },
                });
            }
            try object.put(self.alloc(), field, .{ .array = array });
        }
        var lengths = std.json.Array.init(self.alloc());
        for (protected) |source| try lengths.append(.{ .integer = @intCast(units(source)) });
        try object.put(self.alloc(), "protectedSourceLength", .{ .array = lengths });
        var transforms = std.json.Array.init(self.alloc());
        var last: usize = 0;
        for (self.applied.items, 0..) |value, i| if (value) {
            last = i + 1;
        };
        for (self.applied.items[0..last]) |value| try transforms.append(if (value) .{ .object = .empty } else .null);
        try object.put(self.alloc(), "transformSummary", .{ .array = transforms });
        try object.put(self.alloc(), "executionTime", .{ .integer = elapsed });
        var parse_errors = std.json.Array.init(self.alloc());
        var last_error: usize = 0;
        for (self.valid.items, 0..) |valid, i| if (!valid) {
            last_error = i + 1;
        };
        for (self.valid.items[0..last_error]) |valid| try parse_errors.append(if (valid) .null else .{ .bool = true });
        try object.put(self.alloc(), "hasParseError", .{ .array = parse_errors });
        var unsafe_sources = std.json.Array.init(self.alloc());
        var last_unsafe: usize = 0;
        for (self.unsafe_sources.items, 0..) |unsafe, i| if (unsafe) {
            last_unsafe = i + 1;
        };
        for (self.unsafe_sources.items[0..last_unsafe]) |unsafe| try unsafe_sources.append(if (unsafe) .{ .bool = true } else .null);
        try object.put(self.alloc(), "unsafeConstructs", .{ .array = unsafe_sources });
        try object.put(
            self.alloc(),
            "protectionLog",
            .{ .array = .{ .items = self.logs.items, .capacity = self.logs.capacity, .allocator = self.alloc() } },
        );
        try object.put(self.alloc(), "randomSeed", .{ .float = seed });
        return std.json.Stringify.valueAlloc(allocator, std.json.Value{ .object = object }, .{});
    }
};

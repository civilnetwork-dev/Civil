//! Metro recognition and factory ranges recovered from module 6979.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const A = std.mem.Allocator;
pub const Range = struct {
    start: usize,
    end: usize,
};

pub const Detection = struct {
    kind: []const u8,
    owned_kind: bool = false,
    modules: []ast.NodeIndex,

    pub fn deinit(self: Detection, allocator: A) void {
        allocator.free(self.modules);
        if (self.owned_kind) allocator.free(self.kind);
    }
};

pub const Module = struct {
    node: ast.NodeIndex,
    range: Range,
    key: Key,
    user: bool,
};
const Key = union(enum) {
    number: f64,
    string: []const u8,
    boolean: bool,
};

pub const Metro = struct {
    modules: []Module,
    total_modules: usize = 0,
    owned_keys: [][]u8 = &.{},

    pub fn deinit(self: Metro, allocator: A) void {
        allocator.free(self.modules);
        for (self.owned_keys) |key| allocator.free(key);
        if (self.owned_keys.len != 0) allocator.free(self.owned_keys);
    }
};

pub fn utf16Offset(source: []const u8, offset: usize) usize {
    var result: usize = 0;
    for (source[0..@min(offset, source.len)]) |byte| if (byte < 0x80 or byte >= 0xc0) {
        result += if (byte >= 0xf0) @as(usize, 2) else 1;
    };
    return result;
}

fn unwrap(tree: *const ast.Tree, value: ast.NodeIndex) ast.NodeIndex {
    if (value == .null) return .null;
    var index = value;
    while (tree.data(index) == .parenthesized_expression) index = tree.data(index).parenthesized_expression.expression;
    return index;
}

fn named(tree: *const ast.Tree, value: ast.NodeIndex, name: []const u8) bool {
    const data = tree.data(value);
    const text = switch (data) {
        .binding_identifier => |v| tree.string(v.name),
        .identifier_reference => |v| tree.string(v.name),
        else => return false,
    };
    return std.mem.eql(u8, text, name);
}

fn topCall(tree: *const ast.Tree, statement: ast.NodeIndex, name: []const u8) ?ast.CallExpression {
    if (tree.data(statement) != .expression_statement) return null;
    const index = unwrap(tree, tree.data(statement).expression_statement.expression);
    if (tree.data(index) != .call_expression) return null;
    const call = tree.data(index).call_expression;
    return if (named(tree, call.callee, name)) call else null;
}

fn equal(a: Key, b: Key) bool {
    return switch (a) {
        .number => |v| b == .number and b.number == v,
        .string => |v| b == .string and std.mem.eql(u8, b.string, v),
        .boolean => |v| b == .boolean and b.boolean == v,
    };
}

fn isFunction(tree: *const ast.Tree, node: ast.NodeIndex) bool {
    if (node == .null) return false;
    const index = unwrap(tree, node);
    return tree.data(index) == .function and tree.data(index).function.type == .function_expression;
}

fn callAt(tree: *const ast.Tree, node: ast.NodeIndex) ?ast.CallExpression {
    if (node == .null) return null;
    const index = unwrap(tree, node);
    return if (tree.data(index) == .call_expression) tree.data(index).call_expression else null;
}

fn functionStatements(tree: *const ast.Tree, node: ast.NodeIndex) ?[]const ast.NodeIndex {
    if (!isFunction(tree, node)) return null;
    return tree.extra(tree.data(tree.data(unwrap(tree, node)).function.body).function_body.body);
}

fn returned(tree: *const ast.Tree, node: ast.NodeIndex, only: bool) ?ast.NodeIndex {
    const statements = functionStatements(tree, node) orelse return null;
    var first: usize = 0;
    while (first < statements.len and tree.data(statements[first]) == .directive) : (first += 1) {}
    if (first == statements.len or (only and statements.len - first != 1) or tree.data(statements[first]) != .return_statement)
        return null;
    const value = tree.data(statements[first]).return_statement.argument;
    return if (value == .null) null else unwrap(tree, value);
}

fn loosePack(allocator: A, tree: *const ast.Tree, node: ast.NodeIndex, prefix: []const u8) !?Detection {
    const call = callAt(tree, node) orelse return null;
    const arguments = tree.extra(call.arguments);
    if (arguments.len != 1) return null;
    const data = tree.data(unwrap(tree, arguments[0]));
    const range = switch (data) {
        .array_expression => |v| v.elements,
        .object_expression => |v| v.properties,
        else => return null,
    };
    const items = tree.extra(range);
    if (items.len == 0) return null;
    const modules = try allocator.alloc(ast.NodeIndex, items.len);
    errdefer allocator.free(modules);
    for (items, modules) |item, *module| module.* = if (data == .object_expression) switch (tree.data(item)) {
        // Babel ObjectMethod has no .value field, including get/set methods.
        // Its permissive recognizer still keeps an undefined map entry.
        .object_property => |v| if (v.method or v.kind != .init) .null else unwrap(tree, v.value),
        else => .null,
    } else unwrap(tree, item);
    // The SDK's array forEach and object some callbacks discard their checks.
    // Preserve that permissive recognition instead of tightening validation.
    return .{
        .kind = try std.fmt.allocPrint(allocator, "{s}/{s}", .{ prefix, if (data == .array_expression) "prod" else "dev" }),

        .owned_kind = true,

        .modules = modules,
    };
}

fn strictObject(
    allocator: A,
    tree: *const ast.Tree,
    node: ast.NodeIndex,
    browserify: bool,
    chunk: bool,
) !?Detection {
    if (node == .null) return null;
    if (tree.data(node) != .object_expression) return null;
    var values: std.ArrayList(ast.NodeIndex) = .empty;
    defer values.deinit(allocator);
    var keys: std.ArrayList(Key) = .empty;
    defer keys.deinit(allocator);
    var numeric = false;
    for (tree.extra(tree.data(node).object_expression.properties)) |item| {
        if (tree.data(item) != .object_property) return null;
        const property = tree.data(item).object_property;
        if (property.method or property.kind != .init) return null;
        const key: Key = switch (tree.data(property.key)) {
            .numeric_literal => |v| .{ .number = v.value(tree) },
            .string_literal => |v| if (browserify) return null else .{ .string = tree.string(v.value) },
            else => return null,
        };
        numeric = numeric or key == .number;
        var module = unwrap(tree, property.value);
        if (browserify) {
            if (tree.data(module) != .array_expression) return null;
            const elements = tree.extra(tree.data(module).array_expression.elements);
            if (elements.len == 0) return null;
            module = unwrap(tree, elements[0]);
        }
        if (!isFunction(tree, module)) return null;
        var existing: ?usize = null;
        for (keys.items, 0..) |old, i| if (equal(old, key)) {
            existing = i;
            break;
        };
        if (existing) |i| values.items[i] = module else {
            try keys.append(allocator, key);
            try values.append(allocator, module);
        }
    }
    return .{
        .kind = if (browserify)
            "browserify-bundle"
        else if (chunk) (if (numeric) "webpack4-chunk/prod" else "webpack4-chunk/dev") else "webpack4-bundle/dev",

        .modules = try values.toOwnedSlice(allocator),
    };
}

fn chunkAt(allocator: A, tree: *const ast.Tree, node: ast.NodeIndex, push_only: bool) !?Detection {
    const call = callAt(tree, node) orelse return null;
    const callee = unwrap(tree, call.callee);
    if (tree.data(callee) != .member_expression) return null;
    const property = tree.data(callee).member_expression.property;
    if (tree.data(property) != .identifier_name and tree.data(property) != .identifier_reference) return null;
    if (push_only and !namedName(tree, property, "push")) return null;
    const arguments = tree.extra(call.arguments);
    if (arguments.len == 0 or tree.data(unwrap(tree, arguments[0])) != .array_expression) return null;
    const elements = tree.extra(tree.data(unwrap(tree, arguments[0])).array_expression.elements);
    if (elements.len < 2) return null;
    return strictObject(allocator, tree, unwrap(tree, elements[1]), false, true);
}

fn namedName(tree: *const ast.Tree, node: ast.NodeIndex, value: []const u8) bool {
    return switch (tree.data(node)) {
        .identifier_name => |v| std.mem.eql(u8, tree.string(v.name), value),
        else => named(tree, node, value),
    };
}

fn wrapperPack(
    allocator: A,
    tree: *const ast.Tree,
    expression: ast.NodeIndex,
    name: []const u8,
    kind: []const u8,
) !?Detection {
    const data = tree.data(expression);
    if (data == .assignment_expression) {
        const left = unwrap(tree, data.assignment_expression.left);
        if (tree.data(left) != .member_expression) return null;
        const object = tree.data(left).member_expression.object;
        if (std.mem.eql(u8, name, "this")) {
            if (tree.data(object) != .this_expression) return null;
        } else if (!named(tree, object, name)) return null;
        return loosePack(allocator, tree, data.assignment_expression.right, kind);
    }
    const call = callAt(tree, expression) orelse return null;
    const arguments = tree.extra(call.arguments);
    if (arguments.len != 2) return null;
    if (std.mem.eql(u8, name, "this")) {
        if (tree.data(unwrap(tree, arguments[0])) != .this_expression) return null;
    } else if (!named(tree, unwrap(tree, arguments[0]), name)) return null;
    return loosePack(allocator, tree, arguments[1], kind);
}
/// Module candidates used by SelfDefendingTransform. Recognition order is 3306.
pub fn detect(allocator: A, tree: *const ast.Tree) !?Detection {
    const body = tree.extra(tree.data(tree.root).program.body);
    var first: usize = 0;
    while (first < body.len and tree.data(body[first]) == .directive) : (first += 1) {}
    if (first == body.len or tree.data(body[first]) != .expression_statement) return null;
    const expression = unwrap(tree, tree.data(body[first]).expression_statement.expression);
    const data = tree.data(expression);
    const unary = data == .unary_expression;
    const effective = if (unary) unwrap(tree, data.unary_expression.argument) else expression;
    const call = callAt(tree, effective);
    if (call) |value| {
        if (!unary) if (try chunkAt(allocator, tree, effective, true)) |result| return result;
        const args = tree.extra(value.arguments);
        if ((unary or isFunction(tree, value.callee)) and args.len > 0 and tree.data(unwrap(tree, args[0])) == .array_expression) {
            const items = tree.extra(tree.data(unwrap(tree, args[0])).array_expression.elements);
            var valid = true;
            for (items) |item| if (!isFunction(tree, item)) {
                valid = false;
                break;
            };
            if (valid) {
                const modules = try allocator.alloc(ast.NodeIndex, items.len);
                for (items, modules) |item, *module| module.* = unwrap(tree, item);
                return .{ .kind = if (unary) "webpack4-bundle/prod" else "webpack4-bundle/dev", .modules = modules };
            }
        }
        // Global/this/window recognizers also invoke the permissive chunk
        // parser for unary calls, after Webpack4's stricter first attempt.
        if (try chunkAt(allocator, tree, effective, false)) |result| return result;
        if (!unary) {
            if (named(tree, value.callee, "define") and args.len > 0) {
                const factory = if (args.len == 3 and tree.data(args[0]) == .string_literal and tree.data(args[1]) == .array_expression)
                    args[2]
                else
                    args[0];
                if (returned(tree, factory, true)) |returned_node|
                    if (try loosePack(allocator, tree, returned_node, "webpack-bundle-amd-mod")) |result| return result;
            }
            if (named(tree, value.callee, "require") and args.len >= 2 and tree.data(args[0]) == .array_expression) {
                if (returned(tree, args[1], false)) |returned_node|
                    if (try loosePack(allocator, tree, returned_node, "webpack-bundle-amd-require-mod")) |result| return result;
            }
        }
    }
    if (data == .assignment_expression) {
        const assignment = data.assignment_expression;
        if (tree.data(assignment.left) == .identifier_reference)
            if (try loosePack(allocator, tree, assignment.right, "webpack-bundle-assign-mod")) |result| return result;
        if (tree.data(assignment.left) == .member_expression) {
            const member = tree.data(assignment.left).member_expression;
            if (named(tree, member.object, "module") and (tree.data(member.property) == .identifier_name or tree.data(member.property) == .identifier_reference))
                if (try loosePack(allocator, tree, assignment.right, "webpack-bundle-commonjs2-mod")) |result| return result;
        }
    }
    inline for (.{
        .{ "exports", "webpack-bundle-commonjs-mod" },
        .{ "window", "webpack-bundle-global-mod" },
        .{ "global", "webpack-bundle-global-mod" },
    }) |spec| {
        if (try wrapperPack(allocator, tree, effective, spec[0], spec[1])) |result| return result;
    }
    if (call) |value| {
        var candidate: ast.NodeIndex = .null;
        const args = tree.extra(value.arguments);
        if (isFunction(tree, value.callee)) candidate = effective else if (namedAnyIdentifier(tree, value.callee) and args.len == 1) {
            if (callAt(tree, args[0])) |inner| if (isFunction(tree, inner.callee)) {
                candidate = args[0];
            };
        }
        if (candidate != .null)
            if (try loosePack(allocator, tree, candidate, "webpack-bundle-jsonp-mod")) |result| return result;
        const callee = unwrap(tree, value.callee);
        if (tree.data(callee) == .member_expression) {
            const member = tree.data(callee).member_expression;
            if (named(tree, member.object, "System") and namedName(tree, member.property, "register")) {
                const factory = if (args.len == 3 and tree.data(args[0]) == .string_literal and tree.data(args[1]) == .array_expression)
                    args[2]
                else if (args.len == 2 and tree.data(args[0]) == .array_expression) args[1] else .null;
                if (factory != .null) if (returned(tree, factory, false)) |object| if (tree.data(object) == .object_expression) {
                    const properties = tree.extra(tree.data(object).object_expression.properties);
                    if (properties.len == 1 and tree.data(properties[0]) == .object_property) if (functionStatements(tree, tree.data(properties[0]).object_property.value)) |statements| {
                        if (statements.len > 0 and tree.data(statements[0]) == .expression_statement) if (callAt(tree, tree.data(statements[0]).expression_statement.expression)) |outer| {
                            const arguments = tree.extra(outer.arguments);
                            if (arguments.len > 0)
                                if (try loosePack(allocator, tree, arguments[0], "webpack-bundle-system-mod")) |result| return result;
                        };
                    };
                };
            }
        }
    }
    if (try wrapperPack(allocator, tree, effective, "this", "webpack-bundle-this-mod")) |result| return result;
    if (call) |value| {
        const args = tree.extra(value.arguments);
        if (args.len >= 2 and namedAnyIdentifier(tree, args[0]))
            if (returned(tree, args[1], false)) |returned_node|
                if (try loosePack(allocator, tree, returned_node, "webpack-bundle-umd-mod")) |result| return result;
        if (!unary and callAt(tree, value.callee) != null and args.len > 0)
            if (try strictObject(allocator, tree, unwrap(tree, args[0]), true, false)) |result| return result;
    }
    return null;
}

fn namedAnyIdentifier(tree: *const ast.Tree, node: ast.NodeIndex) bool {
    return tree.data(node) == .identifier_reference or tree.data(node) == .binding_identifier;
}

fn userModule(mapping: std.json.Value, ordinal: usize) !bool {
    const item = switch (mapping) {
        .null => return true,
        .array => |array| if (ordinal < array.items.len) array.items[ordinal] else return error.InvalidFilenameMap,
        .object => |object| blk: {
            var buffer: [32]u8 = undefined;
            const key = std.fmt.bufPrint(&buffer, "{d}", .{ordinal}) catch unreachable;
            break :blk object.get(key) orelse return error.InvalidFilenameMap;
        },
        else => return error.InvalidFilenameMap,
    };
    return switch (item) {
        .string => |text| std.mem.indexOf(u8, text, "node_modules") == null,
        // JavaScript's Array.indexOf compares whole elements, unlike the
        // String.indexOf substring check used by ordinary filename values.
        .array => |array| blk: {
            for (array.items) |element| if (element == .string and std.mem.eql(u8, element.string, "node_modules")) break :blk false;
            break :blk true;
        },
        .null => error.NullFilenameMap,
        else => error.InvalidFilenameMapType,
    };
}

pub fn detectMetro(
    allocator: A,
    tree: *const ast.Tree,
    mapping: std.json.Value,
    user_only: bool,
) !?Metro {
    const body = tree.extra(tree.data(tree.root).program.body);
    var first: usize = 0;
    while (first < body.len and tree.data(body[first]) == .directive) : (first += 1) {}
    if (first == body.len or tree.data(body[first]) != .variable_declaration) return null;
    const declarations = tree.extra(tree.data(body[first]).variable_declaration.declarators);
    for ([_][]const u8{ "__BUNDLE_START_TIME__", "__DEV__", "process" }, 0..) |name, i| {
        // The original destructures three entries, then short-circuits the
        // identifier tests. Missing later entries throw only after a matching
        // prefix, rather than rejecting all short declarations immediately.
        if (i >= declarations.len) return error.MissingMetroHeaderDeclarator;
        if (!named(tree, tree.data(declarations[i]).variable_declarator.id, name)) return null;
    }
    var require_count: usize = 0;
    var define_count: usize = 0;
    for (body) |statement| {
        if (topCall(tree, statement, "__r") != null) require_count += 1;
        if (topCall(tree, statement, "__d") != null) define_count += 1;
    }
    if (require_count < 2 or define_count < 2) return null;
    var modules: std.ArrayList(Module) = .empty;
    errdefer modules.deinit(allocator);
    var owned_keys: std.ArrayList([]u8) = .empty;
    errdefer {
        for (owned_keys.items) |key| allocator.free(key);
        owned_keys.deinit(allocator);
    }
    var ordinal: usize = 0;
    var all_keys: std.ArrayList(Key) = .empty;
    defer all_keys.deinit(allocator);
    for (body) |statement| {
        const call = topCall(tree, statement, "__d") orelse continue;
        const arguments = tree.extra(call.arguments);
        const node = if (arguments.len == 0) ast.NodeIndex.null else unwrap(tree, arguments[0]);
        var key = Key{ .number = @floatFromInt(ordinal) };
        if (arguments.len > 3) switch (tree.data(arguments[3])) {
            .string_literal => |v| if (tree.string(v.value).len != 0) {
                key = .{ .string = tree.string(v.value) };
            },
            .numeric_literal => |v| if (v.value(tree) != 0) {
                key = .{ .number = v.value(tree) };
            },
            .boolean_literal => |v| if (v.value) {
                key = .{ .boolean = true };
            },
            .bigint_literal => |v| {
                // Babel stores BigIntLiteral.value as separator-free text;
                // Map therefore compares it with string keys, not numbers.
                const raw = tree.string(v.raw);
                if (std.mem.indexOfScalar(u8, raw, '_') == null) {
                    key = .{ .string = raw };
                } else {
                    var normalized: std.ArrayList(u8) = .empty;
                    errdefer normalized.deinit(allocator);
                    for (raw) |character| if (character != '_') {
                        try normalized.append(allocator, character);
                    };
                    const text = try normalized.toOwnedSlice(allocator);
                    owned_keys.append(allocator, text) catch |err| {
                        allocator.free(text);
                        return err;
                    };
                    key = .{ .string = text };
                }
            },
            else => {},
        };
        const user = if (key == .string)
            std.mem.indexOf(u8, key.string, "node_modules") == null
        else
            try userModule(mapping, ordinal);
        const span = if (node == .null) ast.Span{ .start = 0, .end = 0 } else tree.span(node);
        const module = Module{
            .node = node,

            .key = key,

            .user = user,

            .range = .{ .start = utf16Offset(tree.source, span.start), .end = utf16Offset(tree.source, span.end) },
        };
        ordinal += 1;
        var found_key = false;
        for (all_keys.items) |item| if (equal(item, key)) {
            found_key = true;
            break;
        };
        if (!found_key) try all_keys.append(allocator, key);
        if (user_only and !module.user) continue;
        var existing: ?usize = null;
        for (modules.items, 0..) |item, i| if (equal(item.key, key)) {
            existing = i;
            break;
        };
        if (existing) |i| modules.items[i] = module else try modules.append(allocator, module);
    }
    const result_modules = try modules.toOwnedSlice(allocator);
    errdefer allocator.free(result_modules);
    return .{
        .modules = result_modules,
        .total_modules = all_keys.items.len,
        .owned_keys = try owned_keys.toOwnedSlice(allocator),
    };
}

test "bundle recognition accepts negated chunks through later recognizers" {
    const allocator = std.testing.allocator;
    var tree = try parser.parse(allocator, "!queue.push([[0],{a:function(){}}]);", .{});
    defer tree.deinit();
    // Identifier object keys are rejected by the shared chunk recognizer.
    try std.testing.expect((try detect(allocator, &tree)) == null);
    var quoted = try parser.parse(allocator, "!queue.push([[0],{'a':function(){}}]);", .{});
    defer quoted.deinit();
    const result = (try detect(allocator, &quoted)).?;
    defer result.deinit(allocator);
    try std.testing.expectEqualStrings("webpack4-chunk/dev", result.kind);
    try std.testing.expectEqual(@as(usize, 1), result.modules.len);
}

test "permissive webpack object recognizers retain undefined method entries" {
    const allocator = std.testing.allocator;
    var tree = try parser.parse(
        allocator,
        "(function(modules){return modules;})({a(){},get b(){return 1;},c:function(){}});",
        .{},
    );
    defer tree.deinit();
    const result = (try detect(allocator, &tree)).?;
    defer result.deinit(allocator);
    try std.testing.expectEqualStrings("webpack-bundle-jsonp-mod/dev", result.kind);
    try std.testing.expectEqual(@as(usize, 3), result.modules.len);
    try std.testing.expect(result.modules[0] == .null and result.modules[1] == .null);
    try std.testing.expect(tree.data(result.modules[2]) == .function);
}

test "Metro keys follow Boolean and BigInt literal Map identity" {
    const allocator = std.testing.allocator;
    var tree = try parser.parse(
        allocator,
        "var __BUNDLE_START_TIME__=0,__DEV__=false,process={};" ++
            "__d(function(){},0,[],true);__d(x=>x,1,[],true);" ++
            "__d(function(){},2,[],1_0n);__d(function last(){},3,[],'10');__r(0);__r(1);",
        .{},
    );
    defer tree.deinit();
    const result = (try detectMetro(allocator, &tree, .null, false)).?;
    defer result.deinit(allocator);
    try std.testing.expectEqual(@as(usize, 2), result.total_modules);
    try std.testing.expectEqual(@as(usize, 2), result.modules.len);
    try std.testing.expect(tree.data(result.modules[0].node) == .arrow_function_expression);
    try std.testing.expectEqualStrings(
        "last",
        tree.string(tree.data(tree.data(result.modules[1].node).function.id).binding_identifier.name),
    );
}

test "Metro short header throws only for matching identifier prefixes" {
    const allocator = std.testing.allocator;
    var matched = try parser.parse(allocator, "var __BUNDLE_START_TIME__=0;", .{});
    defer matched.deinit();
    try std.testing.expectError(error.MissingMetroHeaderDeclarator, detectMetro(allocator, &matched, .null, false));
    var other = try parser.parse(allocator, "var different=0;", .{});
    defer other.deinit();
    try std.testing.expect((try detectMetro(allocator, &other, .null, false)) == null);
}

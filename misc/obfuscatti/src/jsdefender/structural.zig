//! Structural passes recovered from JSDefender 2.12.0 modules 2619, 837,
//! 2407, 7853, 9537, 8808 and 9923. Constant arguments use the shared
//! validation runtime through applyConstantArgument.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const Random = @import("scalars.zig").Random;
const Policy = @import("policy.zig").Policy;
const no_span: ast.Span = .{ .start = 0, .end = 0 };

pub const Pass = enum {
    debugger_removal,
    function_reorder,
    expr_sequence,
    variable_grouping,
    property_indirection,
    property_sparsing,
    constant_argument,
};

pub const Options = struct {
    randomize: bool = true,
    es5: bool = false,
    policy: ?*Policy = null,
    name_source: ?@import("runtime.zig").NameSource = null,
};

const Collector = struct {
    allocator: std.mem.Allocator,
    nodes: std.ArrayList(ast.NodeIndex) = .empty,

    pub fn enter_node(
        self: *Collector,
        data: ast.NodeData,
        index: ast.NodeIndex,
        ctx: *parser.traverser.basic.Ctx,
    ) !parser.traverser.Action {
        if (data == .static_block or @import("policy.zig").privateMember(ctx.tree, data)) return .skip;
        try self.nodes.append(self.allocator, index);
        return .proceed;
    }
};

/// One pass per call, so the caller preserves the recovered pipeline order.
pub fn apply(allocator: std.mem.Allocator, tree: *ast.Tree, pass: Pass, random: *Random) !void {
    return applyConfigured(allocator, tree, pass, random, .{});
}

pub fn applyConfigured(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    pass: Pass,
    random: *Random,
    options: Options,
) !void {
    if (pass == .constant_argument) return error.UnsupportedConstantArgument;
    var collector = Collector{ .allocator = allocator };
    defer collector.nodes.deinit(allocator);
    try parser.traverser.basic.traverse(Collector, tree, &collector);
    switch (pass) {
        .debugger_removal => try removeDebuggers(allocator, tree, collector.nodes.items, options.policy),
        .function_reorder => for (collector.nodes.items) |index| {
            if (options.policy) |policy| {
                if (!policy.isEnabled(index, "function_reorder")) continue;
            }
            if (statementRange(tree.data(index))) |range| {
                const randomized = if (options.policy) |policy| policy.settingsFor(index).function_reorder.get().?.isRandomized() else options.randomize;
                try reorder(allocator, tree, index, range, random, randomized);
            }
        },
        .expr_sequence => for (collector.nodes.items) |index| {
            if (tree.data(index) != .switch_case) {
                if (statementRange(tree.data(index))) |range| {
                    if (options.policy) |policy| {
                        const statements = tree.extra(range);
                        if (statements.len == 0 or !policy.isEnabled(statements[0], "expr_sequence")) continue;
                    }
                    try sequence(allocator, tree, index, range, options.policy);
                }
            }
        },
        .variable_grouping => try groupVariables(allocator, tree, collector.nodes.items, options.policy),
        .property_indirection => try indirectProperties(allocator, tree, collector.nodes.items, options.es5, options.policy),
        .property_sparsing => try sparseProperties(allocator, tree, collector.nodes.items, random, options.policy, options.name_source),
        .constant_argument => unreachable,
    }
}

fn statementRange(data: ast.NodeData) ?ast.IndexRange {
    return switch (data) {
        .program => |v| v.body,
        .block_statement => |v| v.body,
        .function_body => |v| v.body,
        .switch_case => |v| v.consequent,
        else => null,
    };
}

fn setStatements(tree: *ast.Tree, index: ast.NodeIndex, body: []const ast.NodeIndex) !void {
    const range = try tree.addExtra(body);
    var data = tree.data(index);
    switch (data) {
        .program => |*v| v.body = range,
        .block_statement => |*v| v.body = range,
        .function_body => |*v| v.body = range,
        .switch_case => |*v| v.consequent = range,
        else => unreachable,
    }
    tree.setData(index, data);
}

fn removeDebuggers(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    nodes: []const ast.NodeIndex,
    policy: ?*Policy,
) !void {
    // Filter lists before changing debugger tags; required single statement
    // positions retain an empty statement, e.g. `if (test) debugger;`.
    for (nodes) |index| {
        if (statementRange(tree.data(index))) |range| {
            var body: std.ArrayList(ast.NodeIndex) = .empty;
            defer body.deinit(allocator);
            for (tree.extra(range)) |child| {
                const removed = tree.data(child) == .debugger_statement and (if (policy) |rules| rules.isEnabled(child, "debugger_removal") else true);
                if (!removed) try body.append(allocator, child);
            }
            try setStatements(tree, index, body.items);
        }
    }
    for (nodes) |index| {
        if (tree.data(index) == .debugger_statement and (if (policy) |rules| rules.isEnabled(index, "debugger_removal") else true)) {
            tree.setData(index, .{ .empty_statement = .{} });
            @import("summary.zig").count(0, 1);
        }
    }
}

fn isFunctionDeclaration(tree: *const ast.Tree, index: ast.NodeIndex) bool {
    return switch (tree.data(index)) {
        .function => |v| v.type == .function_declaration,
        else => false,
    };
}

fn reorder(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    index: ast.NodeIndex,
    range: ast.IndexRange,
    random: *Random,
    randomized: bool,
) !void {
    var declarations: std.ArrayList(ast.NodeIndex) = .empty;
    defer declarations.deinit(allocator);
    var rest: std.ArrayList(ast.NodeIndex) = .empty;
    defer rest.deinit(allocator);
    const statements = tree.extra(range);
    // Babel stores directives outside body. Yuku stores them inside it;
    // preserve the prologue while spacing function declarations through body.
    var directive_count: usize = 0;
    while (directive_count < statements.len and tree.data(statements[directive_count]) == .directive) : (directive_count += 1) {}
    for (statements[directive_count..]) |child| {
        if (isFunctionDeclaration(tree, child))
            try declarations.append(allocator, child)
        else
            try rest.append(allocator, child);
    }
    if (declarations.items.len == 0) return;
    @import("summary.zig").count(5, declarations.items.len);
    if (randomized) {
        for (0..declarations.items.len) |_| {
            const a = random.index(declarations.items.len);
            const b = random.index(declarations.items.len);
            std.mem.swap(ast.NodeIndex, &declarations.items[a], &declarations.items[b]);
        }
    }
    const total = statements.len - directive_count;
    for (declarations.items, 0..) |declaration, i| {
        const location = @min(rest.items.len, ((2 * i + 1) * total) / (2 * declarations.items.len));
        try rest.insert(allocator, location, declaration);
    }
    var output: std.ArrayList(ast.NodeIndex) = .empty;
    defer output.deinit(allocator);
    try output.appendSlice(allocator, statements[0..directive_count]);
    try output.appendSlice(allocator, rest.items);
    try setStatements(tree, index, output.items);
}

fn sequence(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    index: ast.NodeIndex,
    range: ast.IndexRange,
    policy: ?*Policy,
) !void {
    const statements = try allocator.dupe(ast.NodeIndex, tree.extra(range));
    defer allocator.free(statements);
    var output: std.ArrayList(ast.NodeIndex) = .empty;
    defer output.deinit(allocator);
    var i: usize = 0;
    while (i < statements.len) {
        const start = i;
        while (i < statements.len and tree.data(statements[i]) == .expression_statement) : (i += 1) {}
        if (i - start < 2) {
            const end = @min(statements.len, i + 1);
            try output.appendSlice(allocator, statements[start..end]);
            i = end;
            continue;
        }
        var expressions: std.ArrayList(ast.NodeIndex) = .empty;
        defer expressions.deinit(allocator);
        // Module 2407 keeps the first expression, but cloneDeep copies every
        // following expression before the collected source statements detach.
        // Nested body lists collected before this pass still refer to those
        // detached originals, not the newly owned expression copies.
        for (statements[start..i], 0..) |statement, offset| {
            const original = tree.data(statement).expression_statement.expression;
            try expressions.append(
                allocator,
                if (offset == 0) original else try @import("nodes.zig").cloneSource(tree, tree, original),
            );
        }
        const has_return = i < statements.len and tree.data(statements[i]) == .return_statement and tree.data(statements[i]).return_statement.argument != .null;
        if (has_return) {
            try expressions.append(
                allocator,
                try @import("nodes.zig").cloneSource(tree, tree, tree.data(statements[i]).return_statement.argument),
            );
            i += 1;
        }
        const expression = try tree.addNode(.{ .sequence_expression = .{ .expressions = try tree.addExtra(expressions.items) } }, no_span);
        @import("summary.zig").count(7, 1);
        const emitted = if (!has_return and try containsFunctionExpression(tree, expression)) try tree.addNode(
            .{ .parenthesized_expression = .{ .expression = expression } },
            @import("nodes.zig").explicit_parentheses_span,
        ) else expression;
        const data: ast.NodeData = if (has_return)
            .{ .return_statement = .{ .argument = expression } }
        else
            .{ .expression_statement = .{ .expression = emitted } };
        const statement = try tree.addNode(data, no_span);
        for (statements[start..i]) |removed| tree.setSpan(removed, @import("nodes.zig").orphan_span);
        // takeOwnership repairs cloned parent links, including a previously
        // orphaned generated block. Retain the old detached ancestry for the
        // remaining pass-local worklist instead of refreshing the whole tree.
        try bindSequenceOwnership(tree, policy, statement, index);
        try output.append(allocator, statement);
    }
    try setStatements(tree, index, output.items);
}

fn containsFunctionExpression(tree: *ast.Tree, expression: ast.NodeIndex) !bool {
    const Finder = struct {
        found: bool = false,

        pub fn enter_node(
            self: *@This(),
            data: ast.NodeData,
            _: ast.NodeIndex,
            _: *parser.traverser.basic.Ctx,
        ) parser.traverser.Action {
            if (data == .function and data.function.type == .function_expression) self.found = true;
            return if (self.found) .skip else .proceed;
        }
    };
    const previous = tree.root;
    defer tree.root = previous;
    tree.root = expression;
    var finder = Finder{};
    try parser.traverser.basic.traverse(Finder, tree, &finder);
    return finder.found;
}

fn bindSequenceOwnership(
    tree: *ast.Tree,
    policy: ?*Policy,
    statement: ast.NodeIndex,
    owner: ast.NodeIndex,
) !void {
    if (policy) |rules| {
        const previous_count = rules.parents.items.len;
        try rules.parents.resize(rules.child_allocator, tree.nodes.len);
        @memset(rules.parents.items[previous_count..], .null);
    }
    const Parents = struct {
        parents: ?[]ast.NodeIndex,
        owner: ast.NodeIndex,

        pub fn enter_node(
            self: *@This(),
            _: ast.NodeData,
            index: ast.NodeIndex,
            ctx: *parser.traverser.basic.Ctx,
        ) parser.traverser.Action {
            if (@import("nodes.zig").isOrphan(ctx.tree, index)) @constCast(ctx.tree).setSpan(index, no_span);
            if (self.parents) |parents| parents[@backingInt(index)] = ctx.path.parent() orelse self.owner;
            return .proceed;
        }
    };
    const original_root = tree.root;
    defer tree.root = original_root;
    tree.root = statement;
    var visitor = Parents{ .parents = if (policy) |rules| rules.parents.items else null, .owner = owner };
    try parser.traverser.basic.traverse(Parents, tree, &visitor);
}

fn replaceStatements(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    semantic: parser.semantic.Semantic,
    index: ast.NodeIndex,
    statements: []const ast.NodeIndex,
) !void {
    if (semantic.parentOf(index)) |parent| {
        if (statementRange(tree.data(parent))) |range| {
            const old = try allocator.dupe(ast.NodeIndex, tree.extra(range));
            defer allocator.free(old);
            var body: std.ArrayList(ast.NodeIndex) = .empty;
            defer body.deinit(allocator);
            for (old) |child| {
                if (child == index) try body.appendSlice(allocator, statements) else try body.append(allocator, child);
            }
            try setStatements(tree, parent, body.items);
            tree.setSpan(index, @import("nodes.zig").orphan_span);
            return;
        }
    }
    switch (statements.len) {
        0 => tree.setData(index, .{ .empty_statement = .{} }),
        1 => tree.setData(index, tree.data(statements[0])),
        else => tree.setData(index, .{ .block_statement = .{ .body = try tree.addExtra(statements) } }),
    }
}

/// Use current ownership after earlier control-flow replacements have moved
/// nested statements into new switch cases.
pub fn replaceStatementList(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    index: ast.NodeIndex,
    statements: []const ast.NodeIndex,
) !void {
    const Finder = struct {
        target: ast.NodeIndex,
        parent: ?ast.NodeIndex = null,

        pub fn enter_node(
            self: *@This(),
            _: ast.NodeData,
            current: ast.NodeIndex,
            ctx: *parser.traverser.basic.Ctx,
        ) parser.traverser.Action {
            if (current == self.target) {
                self.parent = ctx.path.parent();
                return .skip;
            }
            return if (self.parent != null) .skip else .proceed;
        }
    };
    var finder = Finder{ .target = index };
    try parser.traverser.basic.traverse(Finder, tree, &finder);
    if (finder.parent) |parent| {
        if (statementRange(tree.data(parent))) |range| {
            const old = try allocator.dupe(ast.NodeIndex, tree.extra(range));
            defer allocator.free(old);
            var body: std.ArrayList(ast.NodeIndex) = .empty;
            defer body.deinit(allocator);
            for (old) |child| {
                if (child == index) try body.appendSlice(allocator, statements) else try body.append(allocator, child);
            }
            try setStatements(tree, parent, body.items);
            return;
        }
    }
    tree.setData(index, .{ .block_statement = .{ .body = try tree.addExtra(statements) } });
    // SourceTree.replaceStatements builds this fallback block without a
    // Babel parent; later policy lookup therefore stops at this boundary.
    tree.setSpan(index, @import("nodes.zig").orphan_span);
}

/// Module 1443 removes dead tails and consecutive numeric assignments from
/// each generated control-flow statement list before subsequent passes.
pub fn optimizeFlowTree(allocator: std.mem.Allocator, tree: *ast.Tree) !void {
    var collector = Collector{ .allocator = allocator };
    defer collector.nodes.deinit(allocator);
    try parser.traverser.basic.traverse(Collector, tree, &collector);
    for (collector.nodes.items) |index| {
        const range = statementRange(tree.data(index)) orelse continue;
        const original = try allocator.dupe(ast.NodeIndex, tree.extra(range));
        defer allocator.free(original);
        var output: std.ArrayList(ast.NodeIndex) = .empty;
        defer output.deinit(allocator);
        var terminated = false;
        var assigned: ?ast.String = null;
        for (original) |statement| {
            const data = tree.data(statement);
            const hoisted = data == .variable_declaration or (data == .function and data.function.type == .function_declaration);
            if (terminated and !hoisted) continue;
            switch (data) {
                .return_statement, .break_statement, .continue_statement, .throw_statement => terminated = true,
                .expression_statement => |expression| {
                    if (tree.data(expression.expression) == .assignment_expression) {
                        const assignment = tree.data(expression.expression).assignment_expression;
                        if (assignment.operator == .assign and tree.data(assignment.left) == .identifier_reference and tree.data(assignment.right) == .numeric_literal) {
                            const name = tree.data(assignment.left).identifier_reference.name;
                            if (assigned != null and std.mem.eql(u8, tree.string(assigned.?), tree.string(name)) and output.items.len != 0)
                                _ = output.pop();
                            assigned = name;
                        } else assigned = null;
                    } else assigned = null;
                },
                .block_statement => {},
                else => assigned = null,
            }
            try output.append(allocator, statement);
        }
        try setStatements(tree, index, output.items);
    }
}

fn isExportedDeclaration(
    tree: *const ast.Tree,
    semantic: parser.semantic.Semantic,
    index: ast.NodeIndex,
) bool {
    const parent = semantic.parentOf(index) orelse return false;
    return tree.data(parent) == .export_named_declaration;
}

fn hasForParent(tree: *const ast.Tree, semantic: parser.semantic.Semantic, index: ast.NodeIndex) bool {
    const parent = semantic.parentOf(index) orelse return false;
    return switch (tree.data(parent)) {
        .for_statement, .for_in_statement, .for_of_statement => true,
        else => false,
    };
}

const Group = struct {
    body: ast.NodeIndex,
    bindings: std.ArrayList(ast.NodeIndex) = .empty,
};

fn groupVariables(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    nodes: []const ast.NodeIndex,
    policy: ?*Policy,
) !void {
    const semantic = try parser.semantic.analyze(tree, .{ .check = true });
    var groups: std.ArrayList(Group) = .empty;
    defer {
        for (groups.items) |*group| group.bindings.deinit(allocator);
        groups.deinit(allocator);
    }
    for (nodes) |index| {
        if (policy) |rules| {
            if (!rules.isEnabled(index, "variable_grouping")) continue;
        }
        const declaration = switch (tree.data(index)) {
            .variable_declaration => |v| v,
            else => continue,
        };
        if (declaration.kind != .@"var" or hasForParent(tree, semantic, index) or isExportedDeclaration(tree, semantic, index))
            continue;
        const declarators = try allocator.dupe(ast.NodeIndex, tree.extra(declaration.declarators));
        defer allocator.free(declarators);
        var simple = true;
        for (declarators) |child| {
            if (tree.data(tree.data(child).variable_declarator.id) != .binding_identifier) simple = false;
        }
        if (!simple) continue;
        @import("summary.zig").count(11, 1);
        const scope = semantic.scopes.get(semantic.scopeOf(index));
        const target = semantic.scopes.get(scope.hoist_target).node;
        const body = switch (tree.data(target)) {
            .program, .function_body => target,
            .function => |v| v.body,
            .arrow_function_expression => |v| if (v.expression) continue else v.body,
            // JSDefender's grouping does not append declarations for class
            // static blocks; preserve them rather than deleting bindings.
            else => continue,
        };
        var group_index: usize = 0;
        while (group_index < groups.items.len and groups.items[group_index].body != body) : (group_index += 1) {}
        if (group_index == groups.items.len) try groups.append(allocator, .{ .body = body });
        var replacements: std.ArrayList(ast.NodeIndex) = .empty;
        defer replacements.deinit(allocator);
        for (declarators) |child| {
            const v = tree.data(child).variable_declarator;
            const name = tree.data(v.id).binding_identifier.name;
            const binding = try tree.addNode(.{ .binding_identifier = .{ .name = name } }, no_span);
            try groups.items[group_index].bindings.append(
                allocator,
                try tree.addNode(.{ .variable_declarator = .{ .id = binding, .init = .null } }, no_span),
            );
            if (v.init != .null) {
                const left = try tree.addNode(.{ .identifier_reference = .{ .name = name } }, no_span);
                const assignment = try tree.addNode(.{ .assignment_expression = .{ .left = left, .right = v.init, .operator = .assign } }, no_span);
                try replacements.append(
                    allocator,
                    try tree.addNode(.{ .expression_statement = .{ .expression = assignment } }, no_span),
                );
            }
        }
        try replaceStatements(allocator, tree, semantic, index, replacements.items);
    }
    for (groups.items) |group| {
        const declaration = try tree.addNode(
            .{ .variable_declaration = .{ .kind = .@"var", .declarators = try tree.addExtra(group.bindings.items) } },
            no_span,
        );
        const original = try allocator.dupe(ast.NodeIndex, tree.extra(statementRange(tree.data(group.body)).?));
        defer allocator.free(original);
        var body: std.ArrayList(ast.NodeIndex) = .empty;
        defer body.deinit(allocator);
        try body.appendSlice(allocator, original);
        try body.append(allocator, declaration);
        try setStatements(tree, group.body, body.items);
    }
}

fn indirectKey(allocator: std.mem.Allocator, tree: *ast.Tree, key: ast.NodeIndex) !?ast.NodeIndex {
    return switch (tree.data(key)) {
        .identifier_name => |v| blk: {
            const name = try allocator.dupe(u8, tree.string(v.name));
            defer allocator.free(name);
            break :blk try tree.addNode(.{ .string_literal = .{ .value = try tree.addString(name) } }, no_span);
        },
        .string_literal => key,
        else => null,
    };
}

fn indirectProperties(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    nodes: []const ast.NodeIndex,
    es5: bool,
    policy: ?*Policy,
) !void {
    for (nodes) |index| {
        if (policy) |rules| {
            if (!rules.isEnabled(index, "property_indirection")) continue;
        }
        var data = tree.data(index);
        switch (data) {
            .member_expression => |*v| {
                if (v.computed or tree.data(v.property) != .identifier_name) continue;
                v.property = (try indirectKey(allocator, tree, v.property)).?;
                v.computed = true;
            },
            .object_property => |*v| {
                if (v.computed or (es5 and !v.method and v.kind == .init)) continue;
                v.key = (try indirectKey(allocator, tree, v.key)) orelse continue;
                v.computed = true;
                v.shorthand = false;
            },
            .binding_property => |*v| {
                if (v.computed or es5) continue;
                v.key = (try indirectKey(allocator, tree, v.key)) orelse continue;
                v.computed = true;
                v.shorthand = false;
            },
            .method_definition => |*v| {
                if (v.computed or v.kind == .constructor) continue;
                v.key = (try indirectKey(allocator, tree, v.key)) orelse continue;
                v.computed = true;
            },
            else => continue,
        }
        tree.setData(index, data);
        @import("summary.zig").count(12, 1);
    }
}

fn sparseEligible(tree: *const ast.Tree, object: ast.NodeIndex) bool {
    for (tree.extra(tree.data(object).object_expression.properties)) |index| {
        const property = switch (tree.data(index)) {
            .object_property => |v| v,
            else => return false,
        };
        if (property.kind != .init) return false;
        if (tree.data(property.value) == .object_expression and !sparseEligible(tree, property.value)) return false;
    }
    return true;
}

fn sparseSubtreeExcluded(
    tree: *const ast.Tree,
    semantic: parser.semantic.Semantic,
    root: ast.NodeIndex,
    nodes: []const ast.NodeIndex,
) !bool {
    for (nodes) |index| {
        const excluded = switch (tree.data(index)) {
            .spread_element => true,
            .object_property => |v| v.kind != .init or sparseBindingValue(tree, v.value),
            .binding_property => |v| sparseBindingValue(tree, v.value),
            else => false,
        };
        if (!excluded) continue;
        var ancestor: ?ast.NodeIndex = index;
        while (ancestor) |current| : (ancestor = semantic.parentOf(current)) {
            if (current == root) {
                return true;
            }
        }
    }
    return false;
}

fn sparseBindingValue(tree: *const ast.Tree, value: ast.NodeIndex) bool {
    return switch (tree.data(value)) {
        .binding_rest_element, .assignment_pattern, .array_pattern, .object_pattern => true,
        else => false,
    };
}

/// Babel's memberExpression builder rejects a non-Identifier property when
/// computed is false. Object methods deliberately use false in module8808.
fn sparsePropertyError(tree: *const ast.Tree, node: ast.NodeIndex) anyerror {
    var index = node;
    while (tree.data(index) == .parenthesized_expression) index = tree.data(index).parenthesized_expression.expression;
    const data = tree.data(index);
    return switch (data) {
        .string_literal => error.PropertySparsingStringLiteral,
        .numeric_literal => error.PropertySparsingNumericLiteral,
        .bigint_literal => error.PropertySparsingBigIntLiteral,
        .boolean_literal => error.PropertySparsingBooleanLiteral,
        .null_literal => error.PropertySparsingNullLiteral,
        .binary_expression => error.PropertySparsingBinaryExpression,
        .logical_expression => error.PropertySparsingLogicalExpression,
        .chain_expression => |value| if (tree.data(value.expression) == .call_expression) error.PropertySparsingOptionalCallExpression else error.PropertySparsingOptionalMemberExpression,
        .call_expression => error.PropertySparsingCallExpression,
        .member_expression => error.PropertySparsingMemberExpression,
        .template_literal => error.PropertySparsingTemplateLiteral,
        .object_expression => error.PropertySparsingObjectExpression,
        .array_expression => error.PropertySparsingArrayExpression,
        .unary_expression => error.PropertySparsingUnaryExpression,
        .assignment_expression => error.PropertySparsingAssignmentExpression,
        .conditional_expression => error.PropertySparsingConditionalExpression,
        .arrow_function_expression => error.PropertySparsingArrowFunctionExpression,
        .function => error.PropertySparsingFunctionExpression,
        .update_expression => error.PropertySparsingUpdateExpression,
        .sequence_expression => error.PropertySparsingSequenceExpression,
        .regexp_literal => error.PropertySparsingRegExpLiteral,
        .new_expression => error.PropertySparsingNewExpression,
        .this_expression => error.PropertySparsingThisExpression,
        .meta_property => error.PropertySparsingMetaProperty,
        .await_expression => error.PropertySparsingAwaitExpression,
        .yield_expression => error.PropertySparsingYieldExpression,
        else => error.PropertySparsingExpression,
    };
}

pub fn failureMessage(allocator: std.mem.Allocator, failure: anyerror) !?[]const u8 {
    const name = @errorName(failure);
    const prefix = "PropertySparsing";
    if (!std.mem.startsWith(u8, name, prefix)) return null;
    return try std.fmt.allocPrint(
        allocator,
        "Property property of MemberExpression expected node to be of a type [\"Identifier\",\"PrivateName\"] but instead got \"{s}\"",
        .{name[prefix.len..]},
    );
}

fn freshName(allocator: std.mem.Allocator, tree: *const ast.Tree, random: *Random) ![]const u8 {
    while (true) {
        const candidate = try std.fmt.allocPrint(allocator, "_jsd{d}", .{random.index(0x10000000)});
        var collision = false;
        for (0..tree.nodes.len) |number| {
            const index: ast.NodeIndex = @fromBackingInt(@intCast(number));
            const name = switch (tree.data(index)) {
                .binding_identifier => |v| tree.string(v.name),
                .identifier_reference => |v| tree.string(v.name),
                else => continue,
            };
            if (std.mem.eql(u8, candidate, name)) {
                collision = true;
                break;
            }
        }
        if (!collision) return candidate;
        allocator.free(candidate);
    }
}

fn sparseObject(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    object: ast.NodeIndex,
    base: ast.NodeIndex,
    statements: *std.ArrayList(ast.NodeIndex),
    depth: usize,
) anyerror!void {
    const properties = try allocator.dupe(ast.NodeIndex, tree.extra(tree.data(object).object_expression.properties));
    defer allocator.free(properties);
    for (properties) |index| {
        const property = tree.data(index).object_property;
        var key_node = property.key;
        while (tree.data(key_node) == .parenthesized_expression) key_node = tree.data(key_node).parenthesized_expression.expression;
        const key = tree.data(key_node);
        const empty_key = key == .string_literal and tree.string(key.string_literal.value).len == 0;
        var computed = if (property.method) false else property.computed or switch (key) {
            .string_literal => !empty_key,
            .numeric_literal, .bigint_literal => true,
            else => false,
        };
        if (empty_key and depth == 1) computed = true;
        if (!computed and key != .identifier_name and key != .identifier_reference)
            return sparsePropertyError(tree, property.key);
        const left = try tree.addNode(
            .{
                .member_expression = .{
                    .object = try @import("nodes.zig").cloneSource(tree, tree, base),

                    .property = try @import("nodes.zig").cloneSource(tree, tree, if (computed) property.key else key_node),

                    .computed = computed,

                    .optional = false,
                },
            },
            no_span,
        );
        const nested = tree.data(property.value) == .object_expression;
        var right = if (nested)
            try tree.addNode(.{ .object_expression = .{ .properties = try tree.addExtra(&.{}) } }, no_span)
        else
            try @import("nodes.zig").cloneSource(tree, tree, property.value);
        if (property.method) {
            var function = tree.data(right).function;
            function.type = .function_expression;
            function.async = false;
            function.generator = false;
            right = try tree.addNode(.{ .function = function }, no_span);
        }
        const assignment = try tree.addNode(.{ .assignment_expression = .{ .left = left, .right = right, .operator = .assign } }, no_span);
        try statements.append(
            allocator,
            try tree.addNode(.{ .expression_statement = .{ .expression = assignment } }, no_span),
        );
        if (nested) try sparseObject(allocator, tree, property.value, left, statements, depth + 1);
    }
}

fn sparseProperties(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    nodes: []const ast.NodeIndex,
    random: *Random,
    policy: ?*Policy,
    name_source: ?@import("runtime.zig").NameSource,
) !void {
    const semantic = try parser.semantic.analyze(tree, .{ .check = true });
    for (nodes) |index| {
        const declaration = switch (tree.data(index)) {
            .variable_declaration => |v| v,
            else => continue,
        };
        const declarators = tree.extra(declaration.declarators);
        if (declarators.len == 0) continue;
        const first_index = declarators[0];
        if (policy) |rules| {
            if (!rules.isEnabled(first_index, "property_sparsing")) continue;
        }
        var first = tree.data(first_index).variable_declarator;
        if (first.init == .null or tree.data(first.init) != .object_expression or tree.extra(tree.data(first.init).object_expression.properties).len == 0)
            continue;
        if (!sparseEligible(tree, first.init)) continue;
        if (try sparseSubtreeExcluded(tree, semantic, first_index, nodes)) continue;
        @import("summary.zig").count(10, 1);
        const name = if (name_source) |source|
            try source.generate(source.context, null, allocator)
        else
            try freshName(allocator, tree, random);
        defer allocator.free(name);
        const symbol = try tree.addString(name);
        const reference = try tree.addNode(.{ .identifier_reference = .{ .name = symbol } }, no_span);
        const binding = try tree.addNode(.{ .binding_identifier = .{ .name = symbol } }, no_span);
        const empty = try tree.addNode(.{ .object_expression = .{ .properties = try tree.addExtra(&.{}) } }, no_span);
        const temp = try tree.addNode(.{ .variable_declarator = .{ .id = binding, .init = empty } }, no_span);
        var statements: std.ArrayList(ast.NodeIndex) = .empty;
        defer statements.deinit(allocator);
        try statements.append(
            allocator,
            try tree.addNode(
                .{ .variable_declaration = .{ .kind = declaration.kind, .declarators = try tree.addExtra(&.{temp}) } },
                no_span,
            ),
        );
        try sparseObject(allocator, tree, first.init, reference, &statements, 1);
        first.init = reference;
        tree.setData(first_index, .{ .variable_declarator = first });
        const original = try tree.addNode(.{ .variable_declaration = declaration }, tree.span(index));
        if (semantic.parentOf(index)) |parent| if (statementRange(tree.data(parent)) == null) tree.setSpan(
            original,
            if (@import("nodes.zig").hasSemicolon(tree, original))
                @import("nodes.zig").orphan_semicolon_span
            else
                @import("nodes.zig").orphan_span,
        );
        try statements.append(allocator, original);
        if (semantic.parentOf(index)) |parent| {
            var parent_data = tree.data(parent);
            switch (parent_data) {
                inline .for_statement, .for_in_statement, .for_of_statement => |*loop| {
                    loop.body = try tree.addNode(.{ .block_statement = .{ .body = try tree.addExtra(statements.items) } }, no_span);
                    tree.setData(parent, parent_data);
                    continue;
                },
                .export_named_declaration, .static_block => continue,
                else => {},
            }
        }
        try replaceStatements(allocator, tree, semantic, index, statements.items);
    }
}

const Guard = struct {
    id: u32,
    truth: bool,
};

/// Module 9923's per-tree RuntimeInjection.All lifecycle. Use the stateful
/// interface for FirstNonModule and SeparateSource injection across trees.
pub fn applyConstantArgument(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    random: *Random,
    runtime: anytype,
    es5: bool,
) !void {
    var state = ConstantArgumentState.init(allocator);
    defer state.deinit();
    try state.apply(tree, random, runtime);
    try state.finish(random, runtime, es5);
}

pub fn applyConstantArgumentWithPolicy(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    random: *Random,
    runtime: anytype,
    es5: bool,
    policy: *Policy,
) !void {
    var state = ConstantArgumentState.init(allocator);
    defer state.deinit();
    try state.applyWithPolicy(tree, random, runtime, policy);
    try state.finish(random, runtime, es5);
}

pub const ConstantArgumentState = struct {
    date_enabled: bool = false,
    domain_enabled: bool = false,
    allocator: std.mem.Allocator,
    true_ids: std.ArrayList(u32) = .empty,
    false_ids: std.ArrayList(u32) = .empty,
    guards: std.ArrayList(Guard) = .empty,
    cursor: u32 = 11,
    maximum: usize = 3,
    guards_name: ?[]const u8 = null,
    guards_argument: ?[]const u8 = null,
    guard_property: ?[]const u8 = null,
    validation_property: ?[]const u8 = null,

    pub fn init(allocator: std.mem.Allocator) ConstantArgumentState {
        return .{ .allocator = allocator };
    }

    pub fn deinit(self: *ConstantArgumentState) void {
        self.true_ids.deinit(self.allocator);
        self.false_ids.deinit(self.allocator);
        self.guards.deinit(self.allocator);
    }

    pub fn apply(self: *ConstantArgumentState, tree: *ast.Tree, random: *Random, runtime: anytype) !void {
        return self.applyWithPolicy(tree, random, runtime, null);
    }

    pub fn applyWithPolicy(
        self: *ConstantArgumentState,
        tree: *ast.Tree,
        random: *Random,
        runtime: anytype,
        policy: ?*Policy,
    ) !void {
        const allocator = self.allocator;
        var collector = Collector{ .allocator = allocator };
        defer collector.nodes.deinit(allocator);
        try parser.traverser.basic.traverse(Collector, tree, &collector);
        const semantic = try parser.semantic.analyze(tree, .{ .check = true });
        var literals: std.ArrayList(ast.NodeIndex) = .empty;
        defer literals.deinit(allocator);
        for (collector.nodes.items) |index| {
            if (tree.data(index) != .numeric_literal) continue;
            if (policy) |rules| {
                if (!rules.isEnabled(index, "constant_argument")) continue;
            }
            const parent = semantic.parentOf(index) orelse continue;
            if (tree.data(parent) == .call_expression) try literals.append(allocator, index);
        }
        if (literals.items.len == 0) return;

        const sentinel = try runtime.injectSentinel(self.date_enabled, self.domain_enabled);
        if (self.guards_name == null) {
            self.guards_name = try runtime.addSetupVar("guards", null, false);
            self.guards_argument = try runtime.reserveSetupVar("guardsArg");
            self.guard_property = try runtime.reserveProperty("getGuard");
            self.validation_property = sentinel.validation_property;
        }
        const guard_property = self.guard_property.?;
        const protector_name = runtime.protector_name.?;
        self.maximum += @as(
            usize,
            if (literals.items.len > 1000)
                20
            else if (literals.items.len > 500) 10 else if (literals.items.len > 100) 5 else 0,
        );
        for (literals.items) |index| {
            @import("summary.zig").count(9, 1);
            const first_new_node = tree.nodes.len;
            const original_data = tree.data(index);
            const value = original_data.numeric_literal.value(tree);
            const truth = random.index(2) == 0;
            const step: u32 = @intFromFloat(random.getRandomInt(1, 8));
            var id = self.cursor + step;
            const ids = if (truth) &self.true_ids else &self.false_ids;
            if (ids.items.len >= self.maximum) {
                id = ids.items[random.index(ids.items.len)];
            } else {
                try ids.append(allocator, id);
                try self.guards.append(allocator, .{ .id = id, .truth = truth });
                self.cursor = id;
            }
            const decoy_value = value + @as(f64, @floatFromInt(random.index(23))) - 11;
            const original = try tree.addNode(original_data, @import("nodes.zig").detached_span);
            var decoy = original;
            if (std.math.isFinite(decoy_value)) {
                const raw = try std.fmt.allocPrint(allocator, "{d}", .{if (decoy_value == 0) @as(f64, 1) else @abs(decoy_value)});
                defer allocator.free(raw);
                decoy = try tree.addNode(
                    .{ .numeric_literal = .{ .kind = .decimal, .raw = try tree.addString(raw) } },
                    @import("nodes.zig").detached_span,
                );
                if (decoy_value < 0)
                    decoy = try tree.addNode(.{ .unary_expression = .{ .operator = .negate, .argument = decoy } }, no_span);
            }
            const raw_id = try std.fmt.allocPrint(allocator, "{d}", .{id});
            defer allocator.free(raw_id);
            const argument = try tree.addNode(
                .{ .numeric_literal = .{ .kind = .decimal, .raw = try tree.addString(raw_id) } },
                @import("nodes.zig").detached_span,
            );
            const object = try tree.addNode(.{ .identifier_reference = .{ .name = try tree.addString(protector_name) } }, no_span);
            const property = try tree.addNode(.{ .identifier_name = .{ .name = try tree.addString(guard_property) } }, no_span);
            const callee = try tree.addNode(
                .{ .member_expression = .{ .object = object, .property = property, .computed = false, .optional = false } },
                no_span,
            );
            const test_call = try tree.addNode(
                .{ .call_expression = .{ .callee = callee, .arguments = try tree.addExtra(&.{argument}), .optional = false } },
                no_span,
            );
            tree.setData(
                index,
                .{
                    .conditional_expression = .{
                        .@"test" = test_call,
                        .consequent = if (truth) original else decoy,
                        .alternate = if (truth) decoy else original,
                    },
                },
            );
            for (first_new_node..tree.nodes.len) |number| tree.setSpan(@fromBackingInt(@intCast(number)), @import("nodes.zig").orphan_span);
        }
    }

    pub fn finish(self: *ConstantArgumentState, random: *Random, runtime: anytype, es5: bool) !void {
        if (self.guards.items.len == 0) return;
        const allocator = self.allocator;
        const guards_name = self.guards_name.?;
        const guards_argument = self.guards_argument.?;
        const guard_property = self.guard_property.?;
        const protector_name = runtime.protector_name.?;
        var properties: std.ArrayList(u8) = .empty;
        defer properties.deinit(allocator);
        try properties.append(allocator, '{');
        for (self.guards.items, 0..) |guard, index| {
            const id_getter = (try runtime.integerGetter(guard.id)) orelse return error.ExpectedIntegerGetter;
            const lower: u16 = @intFromFloat(random.getRandomInt(13, 59));
            const low_getter = (try runtime.integerGetter(lower)) orelse return error.ExpectedIntegerGetter;
            const upper: u16 = lower + @as(u16, @intFromFloat(random.getRandomInt(7, 23)));
            const high_getter = (try runtime.integerGetter(upper)) orelse return error.ExpectedIntegerGetter;
            const use_less_than = @as(u16, @intFromFloat(random.getRandomInt(13, 59))) % 2 != 0;
            const left = if (guard.truth == use_less_than) low_getter else high_getter;
            const right = if (guard.truth == use_less_than) high_getter else low_getter;
            const piece = try std.fmt.allocPrint(
                allocator,
                "{s}[{s}()]:{s}(){s}{s}()",
                .{ if (index == 0) "" else ",", id_getter, left, if (use_less_than) "<" else ">", right },
            );
            defer allocator.free(piece);
            try properties.appendSlice(allocator, piece);
        }
        try properties.append(allocator, '}');
        const declaration = try std.fmt.allocPrint(
            allocator,
            "{s} {s}={s};",
            .{ if (es5) "var" else "let", guards_argument, properties.items },
        );
        defer allocator.free(declaration);
        try runtime.addSetup(declaration);
        const mirror_name = try runtime.addSetupVar("mirror", null, false);
        const function_source = try runtime.template(
            "\n(function(id) {\n  if (!{{guards}}) {\n    (function(arg) {\n      {{guards}} = arg;\n    })({{guardsArg}})\n  }\n  return {{guards}}[id] ^ ({{mirror}}.{{validationFlat}}[counter] < (#12#));\n})\n",
            &.{
                .{ .key = "guards", .value = guards_name },
                .{ .key = "guardsArg", .value = guards_argument },
                .{ .key = "mirror", .value = mirror_name },
                .{ .key = "validationFlat", .value = self.validation_property.? },
            },
            false,
        );
        const setup = try std.fmt.allocPrint(allocator, "{s}.{s}={s};", .{ protector_name, guard_property, function_source });
        defer allocator.free(setup);
        try runtime.addSetupTemplate(setup, function_source);
    }
};

test "structural passes preserve directives, scope, loop headers and computed optional members" {
    const allocator = std.testing.allocator;
    const source = "\"use strict\";var outer=7;function f(){\"use strict\"; debugger;var a=1,b=2;{var c=3;}if(a)var d=4;for(var i=0;i<1;i++){} a++;b++;return a+b+c+d;} const obj={x:f()};console.log(obj?.x,outer);";
    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    var random = Random.init(17);
    for ([_]Pass{ .debugger_removal, .function_reorder, .expr_sequence, .variable_grouping, .property_indirection }) |pass| try apply(allocator, &tree, pass, &random);
    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "debugger") == null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "?.[") != null);
    try checkExecution(allocator, result.code, "12 7\n");
}

test "property sparsing expands nested objects and preserves excluded object syntax" {
    const allocator = std.testing.allocator;
    const source = "var obj={a:1,nested:{b:2},[\"c\"]:3,m(){return this.c}};const proto={p:4};const special={__proto__:proto};const getter={get x(){return 3}};console.log(obj.a+obj.nested.b,special.p,getter.x,obj.m());";
    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    var random = Random.init(19);
    try apply(allocator, &tree, .property_sparsing, &random);
    try apply(allocator, &tree, .property_indirection, &random);
    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "_jsd") != null);
    try checkExecution(allocator, result.code, "3 4 3 3\n");
}

test "configured function reordering preserves relative order without drawing random values" {
    const allocator = std.testing.allocator;
    var tree = try parser.parse(allocator, "\"use strict\";function a(){}var x=0;function b(){}x++;function c(){}", .{});
    defer tree.deinit();
    var random = Random.init(17);
    try applyConfigured(allocator, &tree, .function_reorder, &random, .{ .randomize = false });
    try std.testing.expectEqual(@as(f64, 17), random.state);
    const body = tree.extra(tree.data(tree.root).program.body);
    try std.testing.expect(tree.data(body[0]) == .directive);
    try std.testing.expectEqualStrings(
        "a",
        tree.string(tree.data(tree.data(body[1]).function.id).binding_identifier.name),
    );
    try std.testing.expect(tree.data(body[2]) == .variable_declaration);
    try std.testing.expectEqualStrings(
        "b",
        tree.string(tree.data(tree.data(body[3]).function.id).binding_identifier.name),
    );
    try std.testing.expect(tree.data(body[4]) == .expression_statement);
    try std.testing.expectEqualStrings(
        "c",
        tree.string(tree.data(tree.data(body[5]).function.id).binding_identifier.name),
    );
}

test "expression sequence clones later callbacks and detaches their pending bodies" {
    const allocator = std.testing.allocator;
    var configuration = @import("config.zig").defaults(allocator);
    defer configuration.deinit();
    configuration.settings = .{ .expr_sequence = .{ .enabled = {} } };
    var tree = try parser.parse(allocator, "first(function(){a();b();});second(function(){c();d();});", .{});
    defer tree.deinit();
    var policy = try Policy.init(allocator, &tree, &configuration, 0);
    defer policy.deinit();
    const original = tree.extra(tree.data(tree.root).program.body);
    const first = tree.data(original[0]).expression_statement.expression;
    const second = tree.data(original[1]).expression_statement.expression;
    const first_function = tree.extra(tree.data(first).call_expression.arguments)[0];
    const second_function = tree.extra(tree.data(second).call_expression.arguments)[0];
    const second_body = tree.data(second_function).function.body;
    var random = Random.init(42);
    try applyConfigured(allocator, &tree, .expr_sequence, &random, .{ .policy = &policy });
    const body = tree.extra(tree.data(tree.root).program.body);
    try std.testing.expectEqual(@as(usize, 1), body.len);
    const wrapper = tree.data(body[0]).expression_statement.expression;
    const expressions = tree.extra(tree.data(tree.data(wrapper).parenthesized_expression.expression).sequence_expression.expressions);
    try std.testing.expectEqual(first, expressions[0]);
    try std.testing.expect(second != expressions[1]);
    const copied_function = tree.extra(tree.data(expressions[1]).call_expression.arguments)[0];
    try std.testing.expect(second_function != copied_function);
    try std.testing.expectEqual(
        @as(usize, 1),
        tree.extra(tree.data(tree.data(first_function).function.body).function_body.body).len,
    );
    try std.testing.expectEqual(
        @as(usize, 2),
        tree.extra(tree.data(tree.data(copied_function).function.body).function_body.body).len,
    );
    try std.testing.expect(
        !policy.isEnabled(tree.extra(tree.data(second_body).function_body.body)[0], "expr_sequence"),
    );
    try std.testing.expectEqual(@as(f64, 42), random.state);
}

test "constant argument requires the shared integrity runtime" {
    var tree = try parser.parse(std.testing.allocator, "f(42)", .{});
    defer tree.deinit();
    var random = Random.init(1);
    try std.testing.expectError(
        error.UnsupportedConstantArgument,
        apply(std.testing.allocator, &tree, .constant_argument, &random),
    );
}

test "constant argument guards share the integrity runtime across source trees beyond sixteen-bit IDs" {
    const allocator = std.testing.allocator;
    const runtime_module = @import("runtime.zig");
    const config_module = @import("config.zig");
    const json = try std.json.parseFromSlice(std.json.Value, allocator, "{\"settings\":{\"constantArgument\":true}}", .{});
    defer json.deinit();
    var configuration = try config_module.parse(allocator, json.value);
    defer configuration.deinit();
    var random = Random.init(17);
    var runtime = runtime_module.Manager.init(allocator, .{}, &random);
    defer runtime.deinit();
    var first = try parser.parse(allocator, "function sum(a,b){return a+b}console.log(sum(40,2));", .{});
    defer first.deinit();
    var second = try parser.parse(
        allocator,
        "function untouched(){\"@pjsd {constantArgument:false}\";return sum(20,3)}console.log(untouched(),sum(1,2));",
        .{},
    );
    defer second.deinit();
    var first_policy = try Policy.init(allocator, &first, &configuration, 0);
    defer first_policy.deinit();
    var second_policy = try Policy.init(allocator, &second, &configuration, 1);
    defer second_policy.deinit();
    var state = ConstantArgumentState.init(allocator);
    defer state.deinit();
    state.cursor = 65534;
    try state.applyWithPolicy(&first, &random, &runtime, &first_policy);
    try state.applyWithPolicy(&second, &random, &runtime, &second_policy);
    try std.testing.expect(state.cursor > 65535);
    try state.finish(&random, &runtime, false);
    try runtime.finalize(&first);
    const first_result = try parser.codegen.generate(allocator, &first, .{});
    defer first_result.deinit(allocator);
    const second_result = try parser.codegen.generate(allocator, &second, .{});
    defer second_result.deinit(allocator);
    try std.testing.expect(std.mem.indexOf(u8, second_result.code, "sum(20, 3)") != null);
    const source = try std.fmt.allocPrint(allocator, "{s}\n{s}", .{ first_result.code, second_result.code });
    defer allocator.free(source);
    try checkExecution(allocator, source, "42\n23 3\n");
}

test "structural filters honor inline off without mutating protected siblings" {
    const allocator = std.testing.allocator;
    const configuration_module = @import("config.zig");
    const json = try std.json.parseFromSlice(
        std.json.Value,
        allocator,
        "{\"settings\":{\"debuggerRemoval\":true,\"propertyIndirection\":true,\"variableGrouping\":true}}",
        .{},
    );
    defer json.deinit();
    var configuration = try configuration_module.parse(allocator, json.value);
    defer configuration.deinit();
    var tree = try parser.parse(
        allocator,
        "function off(){\"@pjsd off\";debugger;var value={a:1};return value.a}function on(){debugger;var value={a:2};return value.a}console.log(off(),on());",
        .{},
    );
    defer tree.deinit();
    var policy = try Policy.init(allocator, &tree, &configuration, 0);
    defer policy.deinit();
    var random = Random.init(17);
    for ([_]Pass{ .debugger_removal, .variable_grouping, .property_indirection }) |pass| {
        try applyConfigured(allocator, &tree, pass, &random, .{ .policy = &policy });
        try policy.refresh(&tree);
    }
    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);
    try std.testing.expectEqual(@as(usize, 1), std.mem.count(u8, result.code, "debugger"));
    try std.testing.expect(std.mem.indexOf(u8, result.code, "return value.a") != null);
    try std.testing.expect(std.mem.indexOf(u8, result.code, "return value[\"a\"]") != null);
    try checkExecution(allocator, result.code, "1 2\n");
}

fn checkExecution(allocator: std.mem.Allocator, source: []const u8, expected: []const u8) !void {
    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const run = try std.process.run(allocator, threaded.io(), .{ .argv = &.{ "bun", "-e", source } });
    defer allocator.free(run.stdout);
    defer allocator.free(run.stderr);
    try std.testing.expectEqualStrings("", run.stderr);
    try std.testing.expectEqualStrings(expected, run.stdout);
}

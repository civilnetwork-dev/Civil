//! State-machine layouts recovered from JSDefender 2.12 module 3935.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const scalars = @import("scalars.zig");
const embed = @import("embed_snippet.zig");
const Policy = @import("policy.zig").Policy;
const span: ast.Span = .{ .start = 0, .end = 0 };

pub const Options = struct {
    randomize: bool = false,
    inject_fake_code: bool = false,
    skip_runtime: bool = false,
    policy: ?*const Policy = null,
};
const Collector = struct {
    allocator: std.mem.Allocator,
    nodes: std.ArrayList(ast.NodeIndex) = .empty,
    labels: std.AutoHashMapUnmanaged(ast.NodeIndex, ast.NodeIndex) = .empty,

    pub fn enter_node(
        self: *Collector,
        data: ast.NodeData,
        index: ast.NodeIndex,
        ctx: *parser.traverser.basic.Ctx,
    ) !parser.traverser.Action {
        if (data != .if_statement and data != .for_statement and data != .do_while_statement) return .proceed;
        try self.nodes.append(self.allocator, index);
        if (ctx.path.parent()) |parent|
            if (ctx.tree.data(parent) == .labeled_statement) try self.labels.put(self.allocator, index, parent);
        return .proceed;
    }
};

fn node(tree: *ast.Tree, data: ast.NodeData) !ast.NodeIndex {
    return tree.addNode(data, span);
}

fn reference(tree: *ast.Tree, name: []const u8) !ast.NodeIndex {
    return node(tree, .{ .identifier_reference = .{ .name = try tree.addString(name) } });
}

fn number(tree: *ast.Tree, value: u32) !ast.NodeIndex {
    var buffer: [16]u8 = undefined;
    const raw = std.fmt.bufPrint(&buffer, "{d}", .{value}) catch unreachable;
    return node(tree, .{ .numeric_literal = .{ .kind = .decimal, .raw = try tree.addString(raw) } });
}

fn block(tree: *ast.Tree, statements: []const ast.NodeIndex) !ast.NodeIndex {
    return node(tree, .{ .block_statement = .{ .body = try tree.addExtra(statements) } });
}

fn expression(tree: *ast.Tree, value: ast.NodeIndex) !ast.NodeIndex {
    return node(tree, .{ .expression_statement = .{ .expression = value } });
}

fn assign(tree: *ast.Tree, name: []const u8, value: ast.NodeIndex) !ast.NodeIndex {
    return expression(
        tree,
        try node(
            tree,
            .{ .assignment_expression = .{ .operator = .assign, .left = try reference(tree, name), .right = value } },
        ),
    );
}

fn conditional(tree: *ast.Tree, test_node: ast.NodeIndex, yes: ast.NodeIndex, no: ast.NodeIndex) !ast.NodeIndex {
    return node(tree, .{ .conditional_expression = .{ .@"test" = test_node, .consequent = yes, .alternate = no } });
}

fn stateValue(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    runtime: anytype,
    value: u32,
    skip: bool,
) !ast.NodeIndex {
    const code = try runtime.stateAccessor(value);
    return if (skip) number(tree, value) else embed.embedExpression(allocator, tree, code);
}

fn caseNode(tree: *ast.Tree, state: u32, statements: []const ast.NodeIndex) !ast.NodeIndex {
    return node(
        tree,
        .{ .switch_case = .{ .@"test" = try number(tree, state), .consequent = try tree.addExtra(statements) } },
    );
}

fn declaration(tree: *ast.Tree, name: []const u8, value: ast.NodeIndex) !ast.NodeIndex {
    const binding = try node(tree, .{ .binding_identifier = .{ .name = try tree.addString(name) } });
    const decl = try node(tree, .{ .variable_declarator = .{ .id = binding, .init = value } });
    return node(tree, .{ .variable_declaration = .{ .kind = .@"var", .declarators = try tree.addExtra(&.{decl}) } });
}

/// The runtime owns generated names and accessor source until deinit.
/// One call corresponds to one original ControlFlowTransform application.
pub fn apply(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    random: *scalars.Random,
    options: Options,
    runtime: anytype,
) !void {
    const first_new_node = tree.nodes.len;
    var collector = Collector{ .allocator = allocator };
    defer collector.nodes.deinit(allocator);
    defer collector.labels.deinit(allocator);
    try parser.traverser.basic.traverse(Collector, tree, &collector);
    const selections = try allocator.alloc(?Options, collector.nodes.items.len);
    defer allocator.free(selections);
    const fake = if (options.policy) |rules|
        if (rules.root_settings.control_flow.get()) |setting| setting.injectFakeCode() else false
    else
        options.inject_fake_code;
    for (collector.nodes.items, selections) |index, *selection| {
        selection.* = if (options.policy) |rules|
            if (rules.settingsFor(index).control_flow.get()) |setting|
                .{ .randomize = setting.isRandomized(), .inject_fake_code = fake, .skip_runtime = options.skip_runtime }
            else
                null
        else
            options;
    }
    try runtime.initializeProtector();
    if (runtime.control_flow_states == null) {
        var pool: [32]u32 = undefined;
        for (&pool, 0..) |*value, i| value.* = @intCast(i + 7);
        for (0..64) |_| {
            const a = random.index(pool.len);
            const b = random.index(pool.len);
            std.mem.swap(u32, &pool[a], &pool[b]);
        }
        runtime.control_flow_states = pool;
    }
    const pool = runtime.control_flow_states.?;
    // Explicit jump labels keep newly inserted switches from intercepting
    // an original break/continue aimed at an enclosing construct.
    var jumps = JumpBinder(@TypeOf(runtime)){ .allocator = allocator, .runtime = runtime, .policy = options.policy };
    defer jumps.labels.deinit(allocator);
    defer jumps.counts.deinit(allocator);
    defer jumps.switch_breaks.deinit(allocator);
    try parser.traverser.transform.traverse(@TypeOf(jumps), tree, &jumps);
    var labels = jumps.labels.iterator();
    while (labels.next()) |entry| {
        const index = entry.key_ptr.*;
        const inner = try node(tree, tree.data(index));
        tree.setData(index, .{ .labeled_statement = .{ .label = entry.value_ptr.*, .body = inner } });
    }
    for (collector.nodes.items, selections) |original, selection| {
        const index = if (tree.data(original) == .labeled_statement) tree.data(original).labeled_statement.body else original;
        const data = tree.data(index);
        if (data != .if_statement and data != .for_statement and data != .do_while_statement) continue;
        const selected_options = selection orelse continue;
        const choice = random.index(24);
        var states: [5]u32 = .{ 0, 1, 2, 3, 4 };
        if (selected_options.randomize) @memcpy(&states, pool[choice..][0..5]);
        const used: usize = if (data == .if_statement) 4 else if (data == .do_while_statement) 3 else 5;
        var end: u32 = 65535;
        if (selected_options.randomize) {
            end = 0;
            for (states[0..used]) |value| end = @max(end, value + 1);
        }
        // Original q6nO prepares these accessors even for literal-only guards.
        const accessor_count: usize = if (data == .if_statement) 3 else if (data == .do_while_statement) 2 else 4;
        for (states[0..accessor_count]) |value| _ = try runtime.stateAccessor(value);
        _ = try runtime.stateAccessor(end);
        _ = try runtime.stateAccessor(end + 1);
        const name = try runtime.generateGlobalName();
        const switch_break = data == .if_statement and try rewriteSwitchBreaks(
            tree,
            index,
            &jumps.switch_breaks,
            allocator,
            runtime,
            name,
            end + 1,
            selected_options.skip_runtime,
        );
        const stop = try node(tree, .{ .break_statement = .{ .label = .null } });
        var cases: std.ArrayList(ast.NodeIndex) = .empty;
        defer cases.deinit(allocator);
        var initial = states[0];
        var lexical: ast.NodeIndex = .null;
        switch (data) {
            .if_statement => |value| {
                const branch = try conditional(
                    tree,
                    value.@"test",
                    try stateValue(allocator, tree, runtime, states[1], selected_options.skip_runtime),
                    try stateValue(
                        allocator,
                        tree,
                        runtime,
                        if (value.alternate != .null) states[2] else end,
                        selected_options.skip_runtime,
                    ),
                );
                try cases.append(allocator, try caseNode(tree, states[0], &.{ try assign(tree, name, branch), stop }));
                try cases.append(
                    allocator,
                    try caseNode(
                        tree,
                        states[1],
                        &.{
                            try assign(tree, name, try stateValue(allocator, tree, runtime, end, selected_options.skip_runtime)),

                            value.consequent,

                            stop,
                        },
                    ),
                );
                if (value.alternate != .null) try cases.append(
                    allocator,
                    try caseNode(
                        tree,
                        states[2],
                        &.{
                            try assign(tree, name, try stateValue(allocator, tree, runtime, end, selected_options.skip_runtime)),

                            value.alternate,

                            stop,
                        },
                    ),
                );
                if (selected_options.inject_fake_code) try appendFake(
                    allocator,
                    tree,
                    random,
                    runtime,
                    &cases,
                    name,
                    states[3],
                    value.@"test",
                    states[1],
                    if (value.alternate != .null) states[2] else end,
                    selected_options.skip_runtime,
                );
            },
            .do_while_statement => |value| {
                try cases.append(
                    allocator,
                    try caseNode(
                        tree,
                        states[1],
                        &.{
                            try assign(
                                tree,
                                name,
                                try conditional(
                                    tree,
                                    value.@"test",
                                    try stateValue(allocator, tree, runtime, states[0], selected_options.skip_runtime),
                                    try stateValue(allocator, tree, runtime, end, selected_options.skip_runtime),
                                ),
                            ),

                            stop,
                        },
                    ),
                );
                try cases.append(
                    allocator,
                    try caseNode(
                        tree,
                        states[0],
                        &.{
                            try assign(tree, name, try stateValue(allocator, tree, runtime, states[1], selected_options.skip_runtime)),

                            value.body,

                            stop,
                        },
                    ),
                );
                if (selected_options.inject_fake_code) try appendFake(
                    allocator,
                    tree,
                    random,
                    runtime,
                    &cases,
                    name,
                    states[2],
                    value.@"test",
                    states[0],
                    end,
                    selected_options.skip_runtime,
                );
            },
            .for_statement => |value| {
                initial = if (value.init != .null) states[0] else if (value.@"test" != .null) states[1] else states[2];
                if (value.init != .null) {
                    var body: std.ArrayList(ast.NodeIndex) = .empty;
                    defer body.deinit(allocator);
                    try body.append(
                        allocator,
                        try assign(
                            tree,
                            name,
                            try stateValue(
                                allocator,
                                tree,
                                runtime,
                                if (value.@"test" != .null) states[1] else states[2],
                                selected_options.skip_runtime,
                            ),
                        ),
                    );
                    const init_data = tree.data(value.init);
                    if (init_data == .variable_declaration and init_data.variable_declaration.kind == .let) {
                        const declarations = try allocator.dupe(ast.NodeIndex, tree.extra(init_data.variable_declaration.declarators));
                        defer allocator.free(declarations);
                        var bare: std.ArrayList(ast.NodeIndex) = .empty;
                        defer bare.deinit(allocator);
                        for (declarations) |item| {
                            const binding = tree.data(item).variable_declarator;
                            if (tree.data(binding.id) != .binding_identifier) return error.UnsupportedControlFlowBinding;
                            const binding_name = try allocator.dupe(u8, tree.string(tree.data(binding.id).binding_identifier.name));
                            defer allocator.free(binding_name);
                            try bare.append(allocator, try node(tree, .{ .variable_declarator = .{ .id = binding.id, .init = .null } }));
                            if (binding.init != .null) try body.append(allocator, try assign(tree, binding_name, binding.init));
                        }
                        lexical = try node(tree, .{ .variable_declaration = .{ .kind = .let, .declarators = try tree.addExtra(bare.items) } });
                    } else try body.append(
                        allocator,
                        if (init_data == .variable_declaration) value.init else try expression(tree, value.init),
                    );
                    try body.append(allocator, stop);
                    try cases.append(allocator, try caseNode(tree, states[0], body.items));
                }
                if (value.@"test" != .null) {
                    try cases.append(
                        allocator,
                        try caseNode(
                            tree,
                            states[1],
                            &.{
                                try assign(
                                    tree,
                                    name,
                                    try conditional(
                                        tree,
                                        value.@"test",
                                        try stateValue(allocator, tree, runtime, states[2], selected_options.skip_runtime),
                                        try stateValue(allocator, tree, runtime, end, selected_options.skip_runtime),
                                    ),
                                ),

                                stop,
                            },
                        ),
                    );
                    if (selected_options.inject_fake_code) try appendFake(
                        allocator,
                        tree,
                        random,
                        runtime,
                        &cases,
                        name,
                        states[4],
                        value.@"test",
                        states[2],
                        end,
                        selected_options.skip_runtime,
                    );
                }
                try cases.append(
                    allocator,
                    try caseNode(
                        tree,
                        states[2],
                        &.{
                            try assign(
                                tree,
                                name,
                                try stateValue(
                                    allocator,
                                    tree,
                                    runtime,
                                    if (value.update != .null) states[3] else if (value.@"test" != .null) states[1] else states[2],
                                    selected_options.skip_runtime,
                                ),
                            ),

                            value.body,

                            stop,
                        },
                    ),
                );
                if (value.update != .null) try cases.append(
                    allocator,
                    try caseNode(
                        tree,
                        states[3],
                        &.{
                            try assign(
                                tree,
                                name,
                                try stateValue(
                                    allocator,
                                    tree,
                                    runtime,
                                    if (value.@"test" != .null) states[1] else states[2],
                                    selected_options.skip_runtime,
                                ),
                            ),
                            try expression(tree, value.update),
                            stop,
                        },
                    ),
                );
            },
            else => unreachable,
        }
        if (selected_options.randomize) for (0..3) |_| {
            const a = random.index(cases.items.len);
            const b = random.index(cases.items.len);
            std.mem.swap(ast.NodeIndex, &cases.items[a], &cases.items[b]);
        };
        if (data == .if_statement) try allocateJumpLabels(tree, original, runtime);
        const machine = try node(
            tree,
            .{
                .switch_statement = .{ .discriminant = try reference(tree, name), .cases = try tree.addExtra(cases.items) },
            },
        );
        const loop = try node(
            tree,
            .{
                .while_statement = .{
                    .@"test" = try node(
                        tree,
                        .{
                            .binary_expression = .{
                                .operator = .less_than,

                                .left = try reference(tree, name),

                                .right = try stateValue(allocator, tree, runtime, end, selected_options.skip_runtime),
                            },
                        },
                    ),

                    .body = if (data == .for_statement) try block(tree, &.{machine}) else machine,
                },
            },
        );
        // Keep jump labels attached to the generated loop, not its containing
        // declaration block; continue may target only an iteration statement.
        var loop_statement = loop;
        var replacement_target = original;
        if (data != .if_statement) if (collector.labels.get(original)) |parent| {
            replacement_target = parent;
            loop_statement = try node(tree, .{ .labeled_statement = .{ .label = tree.data(parent).labeled_statement.label, .body = loop } });
            for (0..jumps.counts.get(original) orelse 0) |_| _ = try runtime.generateGlobalName();
        };
        if (tree.data(original) == .labeled_statement) {
            const label = tree.data(original).labeled_statement.label;
            if (tree.string(tree.data(label).label_identifier.name).len == 0)
                tree.setData(label, .{ .label_identifier = .{ .name = try tree.addString(try runtime.generateGlobalName()) } });
            loop_statement = try node(tree, .{ .labeled_statement = .{ .label = label, .body = loop } });
            if (data != .if_statement) {
                const count = jumps.counts.get(original) orelse 1;
                for (1..count) |_| _ = try runtime.generateGlobalName();
            }
        }
        const first = try declaration(tree, name, try stateValue(allocator, tree, runtime, initial, selected_options.skip_runtime));
        const remainder = if (lexical == .null) loop_statement else try block(tree, &.{ lexical, loop_statement });
        const saved_root = tree.root;
        tree.root = try node(tree, .{ .program = .{ .source_type = .script, .body = try tree.addExtra(&.{ first, remainder }) } });
        try @import("structural.zig").optimizeFlowTree(allocator, tree);
        var replacements_list: std.ArrayList(ast.NodeIndex) = .empty;
        defer replacements_list.deinit(allocator);
        try replacements_list.appendSlice(allocator, tree.extra(tree.data(tree.root).program.body));
        if (switch_break) try replacements_list.append(allocator, try node(tree, .{ .if_statement = .{
            .@"test" = try node(
                tree,
                .{
                    .binary_expression = .{ .operator = .strict_equal, .left = try reference(tree, name), .right = try number(tree, end + 1) },
                },
            ),

            .consequent = try node(tree, .{ .break_statement = .{ .label = .null } }),

            .alternate = .null,
        } }));
        const replacements = try allocator.dupe(ast.NodeIndex, replacements_list.items);
        defer allocator.free(replacements);
        tree.root = saved_root;
        try @import("structural.zig").replaceStatementList(allocator, tree, replacement_target, replacements);
        @import("summary.zig").count(6, 1);
    }
    try @import("source_map.zig").registerRefreshed(allocator, tree, first_new_node);
    if (options.skip_runtime) {
        for (0..tree.nodes.len) |i| {
            const index: ast.NodeIndex = @fromBackingInt(@intCast(i));
            if (@import("nodes.zig").isOrphan(tree, index)) tree.setSpan(index, span);
        }
    }
}

fn allocateJumpLabels(tree: *ast.Tree, root: ast.NodeIndex, runtime: anytype) !void {
    const Visitor = struct {
        runtime: @TypeOf(runtime),

        pub fn enter_node(
            self: *@This(),
            data: ast.NodeData,
            _: ast.NodeIndex,
            ctx: *parser.traverser.transform.Ctx,
        ) !parser.traverser.Action {
            switch (data) {
                .function, .arrow_function_expression, .for_statement, .for_in_statement, .for_of_statement, .while_statement, .do_while_statement => return .skip,
                .break_statement, .continue_statement => {
                    const label = if (data == .break_statement) data.break_statement.label else data.continue_statement.label;
                    if (label != .null and ctx.tree.string(ctx.tree.data(label).label_identifier.name).len == 0) ctx.tree.setData(
                        label,
                        .{ .label_identifier = .{ .name = try ctx.tree.addString(try self.runtime.generateGlobalName()) } },
                    );
                },
                else => {},
            }
            return .proceed;
        }
    };
    const saved_root = tree.root;
    tree.root = root;
    defer tree.root = saved_root;
    var visitor = Visitor{ .runtime = runtime };
    try parser.traverser.transform.traverse(Visitor, tree, &visitor);
}

const FakeCandidates = struct {
    allocator: std.mem.Allocator,
    groups: [5]std.ArrayList(ast.NodeIndex) = .{ .empty, .empty, .empty, .empty, .empty },

    pub fn enter_node(
        self: *@This(),
        data: ast.NodeData,
        index: ast.NodeIndex,
        _: *parser.traverser.basic.Ctx,
    ) !parser.traverser.Action {
        const category: ?usize = switch (data) {
            .conditional_expression => 0,
            .binary_expression => |value| switch (value.operator) {
                .equal, .not_equal, .strict_equal, .strict_not_equal, .less_than, .less_than_or_equal, .greater_than, .greater_than_or_equal => 1,
                .bitwise_and, .bitwise_or, .bitwise_xor => 4,
                else => null,
            },
            .logical_expression => |value| if (value.operator == .nullish_coalescing) null else 2,
            .unary_expression => |value| if (value.operator == .logical_not) 3 else null,
            else => null,
        };
        if (category) |group| try self.groups[group].append(self.allocator, index);
        return .proceed;
    }
};

/// Module 3935's ud0O prioritizes conditional, comparison, logical, unary
/// and bitwise mutations. Unsupported tests produce no unreachable case.
fn fakeTest(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    random: *scalars.Random,
    test_node: ast.NodeIndex,
) !?ast.NodeIndex {
    var test_index = test_node;
    while (tree.data(test_index) == .parenthesized_expression) test_index = tree.data(test_index).parenthesized_expression.expression;
    switch (tree.data(test_index)) {
        .boolean_literal => |value| return try node(tree, .{ .boolean_literal = .{ .value = !value.value } }),
        .numeric_literal => |value| return try number(tree, if (value.value(tree) == 0) 1 else 0),
        else => {},
    }
    const saved_root = tree.root;
    defer tree.root = saved_root;
    tree.root = test_index;
    var collected = FakeCandidates{ .allocator = allocator };
    defer for (&collected.groups) |*group| group.deinit(allocator);
    try parser.traverser.basic.traverse(FakeCandidates, tree, &collected);
    for (collected.groups, 0..) |group, category| {
        if (group.items.len == 0) continue;
        const selected = tree.data(group.items[random.index(group.items.len)]);
        const changed = switch (category) {
            0 => blk: {
                const value = selected.conditional_expression;
                break :blk try conditional(tree, value.@"test", value.alternate, value.consequent);
            },
            1, 4 => blk: {
                var value = selected.binary_expression;
                switch (value.operator) {
                    .equal => value.operator = .not_equal,
                    .not_equal => value.operator = .equal,
                    .strict_equal => value.operator = .strict_not_equal,
                    .strict_not_equal => value.operator = .strict_equal,
                    .bitwise_and => value.operator = .bitwise_or,
                    .bitwise_xor => value.operator = .bitwise_and,
                    .bitwise_or => value.operator = .bitwise_xor,
                    else => std.mem.swap(ast.NodeIndex, &value.left, &value.right),
                }
                break :blk try node(tree, .{ .binary_expression = value });
            },
            2 => blk: {
                var value = selected.logical_expression;
                value.operator = if (value.operator == .@"and") .@"or" else .@"and";
                break :blk try node(tree, .{ .logical_expression = value });
            },
            3 => selected.unary_expression.argument,
            else => unreachable,
        };
        return try @import("nodes.zig").cloneSource(tree, tree, changed);
    }
    return null;
}

fn appendFake(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    random: *scalars.Random,
    runtime: anytype,
    cases: *std.ArrayList(ast.NodeIndex),
    name: []const u8,
    state: u32,
    test_node: ast.NodeIndex,
    yes: u32,
    no: u32,
    skip: bool,
) !void {
    const fake_test = try fakeTest(allocator, tree, random, test_node) orelse return;
    try cases.append(
        allocator,
        try caseNode(
            tree,
            state,
            &.{
                try assign(
                    tree,
                    name,
                    try conditional(
                        tree,
                        fake_test,
                        try stateValue(allocator, tree, runtime, yes, skip),
                        try stateValue(allocator, tree, runtime, no, skip),
                    ),
                ),
                try node(tree, .{ .break_statement = .{ .label = .null } }),
            },
        ),
    );
}

fn rewriteSwitchBreaks(
    tree: *ast.Tree,
    root: ast.NodeIndex,
    selected: *std.AutoHashMapUnmanaged(ast.NodeIndex, void),
    allocator: std.mem.Allocator,
    runtime: anytype,
    name: []const u8,
    state: u32,
    skip: bool,
) !bool {
    const Visitor = struct {
        selected: *std.AutoHashMapUnmanaged(ast.NodeIndex, void),
        allocator: std.mem.Allocator,
        value: ast.NodeIndex,
        name: []const u8,
        found: bool = false,

        pub fn enter_node(
            self: *@This(),
            data: ast.NodeData,
            index: ast.NodeIndex,
            ctx: *parser.traverser.transform.Ctx,
        ) !parser.traverser.Action {
            switch (data) {
                .function, .arrow_function_expression, .for_statement, .for_in_statement, .for_of_statement, .while_statement, .do_while_statement, .switch_statement => return .skip,
                .break_statement => if (self.selected.contains(index)) {
                    const replacement = try assign(ctx.tree, self.name, try @import("nodes.zig").cloneSource(ctx.tree, ctx.tree, self.value));
                    ctx.tree.setData(index, ctx.tree.data(replacement));
                    ctx.tree.setSpan(index, span);
                    try @import("source_map.zig").registerSynthetic(ctx.tree, index);
                    self.found = true;
                    return .skip;
                },
                else => {},
            }
            return .proceed;
        }
    };
    const saved_root = tree.root;
    defer tree.root = saved_root;
    tree.root = root;
    var visitor = Visitor{
        .selected = selected,
        .allocator = allocator,
        .value = try stateValue(allocator, tree, runtime, state, skip),
        .name = name,
    };
    try parser.traverser.transform.traverse(Visitor, tree, &visitor);
    return visitor.found;
}

fn JumpBinder(comptime Runtime: type) type {
    return struct {
        allocator: std.mem.Allocator,
        runtime: Runtime,
        policy: ?*const Policy = null,
        labels: std.AutoHashMapUnmanaged(ast.NodeIndex, ast.NodeIndex) = .empty,
        counts: std.AutoHashMapUnmanaged(ast.NodeIndex, usize) = .empty,
        switch_breaks: std.AutoHashMapUnmanaged(ast.NodeIndex, void) = .empty,

        pub fn enter_node(
            self: *@This(),
            data: ast.NodeData,
            index: ast.NodeIndex,
            ctx: *parser.traverser.transform.Ctx,
        ) !parser.traverser.Action {
            const is_continue = data == .continue_statement;
            if (data != .break_statement and !is_continue) return .proceed;
            if (self.policy) |rules| if (!rules.isEnabled(index, "control_flow")) return .proceed;
            const current_label = if (is_continue) data.continue_statement.label else data.break_statement.label;
            if (current_label != .null) return .proceed;
            var depth = ctx.path.len - 1;
            while (depth > 0) {
                depth -= 1;
                const candidate = ctx.path.items[depth];
                const target_data = ctx.tree.data(candidate);
                if (target_data == .function or target_data == .arrow_function_expression) break;
                if (!is_continue and target_data == .switch_statement) {
                    try self.switch_breaks.put(self.allocator, index, {});
                    break;
                }
                const loop = target_data == .for_statement or target_data == .for_in_statement or target_data == .for_of_statement or target_data == .while_statement or target_data == .do_while_statement;
                if (!loop and (is_continue or target_data != .switch_statement)) continue;
                var transformed = target_data == .for_statement or target_data == .do_while_statement;
                if (self.policy) |rules| transformed = transformed and rules.isEnabled(candidate, "control_flow");
                var selected_if = false;
                for (ctx.path.items[depth + 1 .. ctx.path.len - 1]) |ancestor| {
                    if (ctx.tree.data(ancestor) == .if_statement and (if (self.policy) |rules| rules.isEnabled(ancestor, "control_flow") else true))
                        selected_if = true;
                }
                if (!transformed and !selected_if) break;
                const existing = if (depth > 0 and ctx.tree.data(ctx.path.items[depth - 1]) == .labeled_statement)
                    ctx.tree.data(ctx.path.items[depth - 1]).labeled_statement.label
                else
                    ast.NodeIndex.null;
                const count = try self.counts.getOrPut(self.allocator, candidate);
                if (!count.found_existing) count.value_ptr.* = 0;
                count.value_ptr.* += 1;
                var label: ast.NodeIndex = undefined;
                if (existing != .null) label = existing else {
                    const entry = try self.labels.getOrPut(self.allocator, candidate);
                    if (!entry.found_existing)
                        entry.value_ptr.* = try node(ctx.tree, .{ .label_identifier = .{ .name = try ctx.tree.addString("") } });
                    label = entry.value_ptr.*;
                }
                ctx.tree.setData(
                    index,
                    if (is_continue)
                        .{ .continue_statement = .{ .label = label } }
                    else
                        .{ .break_statement = .{ .label = label } },
                );
                break;
            }
            return .proceed;
        }
    };
}

test "fake branch mutation follows recovered priority and supported shapes" {
    const allocator = std.testing.allocator;
    var tree = try parser.parse(allocator, "a===b; a&&b; a&b; flag; true; 7;", .{});
    defer tree.deinit();
    const statements = try allocator.dupe(ast.NodeIndex, tree.extra(tree.data(tree.root).program.body));
    defer allocator.free(statements);
    var random = scalars.Random.init(1);
    const comparison = (try fakeTest(allocator, &tree, &random, tree.data(statements[0]).expression_statement.expression)).?;
    try std.testing.expect(tree.data(comparison).binary_expression.operator == .strict_not_equal);
    const logical = (try fakeTest(allocator, &tree, &random, tree.data(statements[1]).expression_statement.expression)).?;
    try std.testing.expect(tree.data(logical).logical_expression.operator == .@"or");
    const bitwise = (try fakeTest(allocator, &tree, &random, tree.data(statements[2]).expression_statement.expression)).?;
    try std.testing.expect(tree.data(bitwise).binary_expression.operator == .bitwise_or);
    try std.testing.expect(
        try fakeTest(allocator, &tree, &random, tree.data(statements[3]).expression_statement.expression) == null,
    );
    // A leading true expression is an ordinary expression here, not a directive.
    const boolean = (try fakeTest(allocator, &tree, &random, tree.data(statements[4]).expression_statement.expression)).?;
    try std.testing.expect(!tree.data(boolean).boolean_literal.value);
    const numeric = (try fakeTest(allocator, &tree, &random, tree.data(statements[5]).expression_statement.expression)).?;
    try std.testing.expectEqual(@as(f64, 0), tree.data(numeric).numeric_literal.value(&tree));
}

test "control flow state pool is initialized once per shared runtime" {
    const allocator = std.testing.allocator;
    var random = scalars.Random.init(17);
    var manager = @import("runtime.zig").Manager.init(allocator, .{}, &random);
    defer manager.deinit();
    var first = try parser.parse(allocator, "if(true){console.log(1);}", .{});
    defer first.deinit();
    try apply(allocator, &first, &random, .{}, &manager);
    const state = random.state;
    var second = try parser.parse(allocator, "console.log(2);", .{});
    defer second.deinit();
    try apply(allocator, &second, &random, .{}, &manager);
    try std.testing.expectEqual(state, random.state);
}

test "state machines preserve nested loop jumps and branch side effects" {
    const allocator = std.testing.allocator;
    var arena = std.heap.ArenaAllocator.init(allocator);
    defer arena.deinit();
    const memory = arena.allocator();
    const MockRuntime = struct {
        allocator: std.mem.Allocator,
        control_flow_states: ?[32]u32 = null,
        count: u32 = 0,

        pub fn initializeProtector(_: *@This()) !void {}

        pub fn generateGlobalName(self: *@This()) ![]const u8 {
            self.count += 1;
            return std.fmt.allocPrint(self.allocator, "_state{d}", .{self.count});
        }

        pub fn stateAccessor(self: *@This(), value: u32) ![]const u8 {
            return std.fmt.allocPrint(self.allocator, "{d}", .{value});
        }
    };
    const source =
        \\let result=[];
        \\for(let i=0;i<5;i++){if(i===1)continue;if(i===4)break;result.push(i);}
        \\let n=0;do{n++;if(n<3)continue;result.push(n);}while(n<4);
        \\let x=0;for(;;){if(++x===3)break;result.push(x);}
        \\console.log(JSON.stringify(result));
    ;
    var tree = try parser.parse(memory, source, .{});
    defer tree.deinit();
    var random = scalars.Random.init(1);
    var runtime = MockRuntime{ .allocator = memory };
    try apply(memory, &tree, &random, .{ .randomize = true, .inject_fake_code = true, .skip_runtime = true }, &runtime);
    const generated = try parser.codegen.generate(memory, &tree, .{});
    defer generated.deinit(memory);
    var threaded: std.Io.Threaded = .init(memory, .{});
    defer threaded.deinit();
    const io = threaded.io();
    var temporary = std.testing.tmpDir(.{});
    defer temporary.cleanup();
    var file = try temporary.dir.createFile(io, "control.js", .{});
    try file.writeStreamingAll(io, generated.code);
    file.close(io);
    const path = try temporary.dir.realPathFileAlloc(io, "control.js", memory);
    const result = try std.process.run(memory, io, .{ .argv = &.{ "bun", path } });
    try std.testing.expectEqualStrings("[0,2,3,3,4,1,2]\n", result.stdout);
    try std.testing.expectEqualStrings("", result.stderr);
}

//! Native JSDefender protection pipeline. All emitted helpers run in the
//! protected program; protection itself uses no JavaScript engine.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
pub const config = @import("config.zig");
pub const failureMessage = @import("structural.zig").failureMessage;
const scalars = @import("scalars.zig");
const structural = @import("structural.zig");
const literals = @import("literals.zig");
const flow = @import("control_flow.zig");
const declarations = @import("declarations.zig");
const cross_source = @import("cross_source.zig");
const strings = @import("strings.zig");
const runtime = @import("runtime.zig");
const protections = @import("protections.zig");
const self_defending = @import("self_defending.zig");
const embed = @import("embed_snippet.zig");
const Policy = @import("policy.zig").Policy;
const span: ast.Span = .{ .start = 0, .end = 0 };
const canonical = @import("render.zig");
const source_map = @import("source_map.zig");
const bundle = @import("bundle.zig");
const lexical = @import("lexical.zig");
const lexical_location = @import("lexical_location.zig");
const summary = @import("summary.zig");

pub const SourceInfo = struct {
    source_code: []const u8,
    is_module: bool = false,
    factory: bool = false,
    factory_tree: ?*ast.Tree = null,
    factory_node: ast.NodeIndex = .null,
    reported_length: ?usize = null,
};

pub const DateParser = protections.DateParser;
pub const DateError = protections.Error;
pub const LogSink = summary.LogSink;
pub const Options = struct {
    minify: bool = false,
    date_parser: ?DateParser = null,
    failure_summary: ?*?[]const u8 = null,
    metro_parent: ?*summary.State = null,
    log_sink: ?LogSink = null,
};

pub const Result = struct {
    protected_sources: [][]const u8,
    jsd_runtime: ?[]const u8,
    random_seed: f64,
    source_maps: ?[]const u8 = null,
    maps: ?[]const u8 = null,
    protection_summary: ?[]const u8 = null,
    metro_bundle_info: []bundle.Range = &.{},

    pub fn deinit(self: Result, allocator: std.mem.Allocator) void {
        for (self.protected_sources) |source| allocator.free(source);
        allocator.free(self.protected_sources);
        if (self.jsd_runtime) |source| allocator.free(source);
        if (self.source_maps) |json| allocator.free(json);
        if (self.maps) |json| allocator.free(json);
        if (self.protection_summary) |json| allocator.free(json);
        if (self.metro_bundle_info.len != 0) allocator.free(self.metro_bundle_info);
    }
};

const Names = struct {
    allocator: std.mem.Allocator,
    values: std.StringHashMapUnmanaged(void) = .empty,
    next_id: i64 = -1,

    fn deinit(self: *Names) void {
        var keys = self.values.keyIterator();
        while (keys.next()) |key| self.allocator.free(key.*);
        self.values.deinit(self.allocator);
        self.values = .empty;
    }

    fn reserve(self: *Names, text: []const u8) !void {
        const owned = try self.allocator.dupe(u8, text);
        errdefer self.allocator.free(owned);
        const entry = try self.values.getOrPut(self.allocator, owned);
        if (entry.found_existing) self.allocator.free(owned);
    }

    fn generate(context: *anyopaque, id: ?u32, allocator: std.mem.Allocator) std.mem.Allocator.Error![]const u8 {
        const self: *Names = @ptrCast(@alignCast(context));
        const value = id orelse @as(u32, @bitCast(@as(i32, @truncate(self.next_id))));
        self.next_id += 1;
        const base = try scalars.mangleName(allocator, value, .base62);
        defer allocator.free(base);
        var candidate: []const u8 = try allocator.dupe(u8, base);
        errdefer allocator.free(candidate);
        var suffix: u32 = 1;
        while (self.values.contains(candidate)) : (suffix += 1) {
            const replacement = try std.fmt.allocPrint(allocator, "{s}${d}", .{ base, suffix });
            allocator.free(candidate);
            candidate = replacement;
        }
        try self.reserve(candidate);
        return candidate;
    }
};
const NameCollector = struct {
    names: *Names,

    pub fn enter_node(
        self: *NameCollector,
        data: ast.NodeData,
        _: ast.NodeIndex,
        ctx: *parser.traverser.basic.Ctx,
    ) !parser.traverser.Action {
        switch (data) {
            .binding_identifier => |value| {
                try self.names.reserve(ctx.tree.string(value.name));
            },
            else => {},
        }
        return .proceed;
    }
};
const Iifes = struct {
    allocator: std.mem.Allocator,
    nodes: std.ArrayList(ast.NodeIndex) = .empty,
    once: std.ArrayList(ast.NodeIndex) = .empty,
    policy: ?*const Policy = null,
    excluded_function: ast.NodeIndex = .null,
    modules: []const ast.NodeIndex = &.{},

    pub fn enter_node(
        self: *Iifes,
        data: ast.NodeData,
        index: ast.NodeIndex,
        ctx: *parser.traverser.transform.Ctx,
    ) !parser.traverser.Action {
        if (index == self.excluded_function) return .skip;
        if (data != .function) return .proceed;
        const enabled = self.policy == null or self.policy.?.isEnabled(index, "self_defending");
        const selected = enabled and (std.mem.indexOfScalar(ast.NodeIndex, self.modules, index) != null or (self.policy != null and self.policy.?.entries.contains(index)));
        if (selected) try self.nodes.append(self.allocator, index);
        if (data.function.type == .function_declaration) return if (self.policy == null) .skip else .proceed;
        var depth = ctx.path.len - 1;
        while (depth > 0 and ctx.tree.data(ctx.path.items[depth - 1]) == .parenthesized_expression) {
            depth -= 1;
        }
        if (depth == 0) return if (self.policy != null) .proceed else .skip;
        const parent = ctx.tree.data(ctx.path.items[depth - 1]);
        // The SDK collector includes function arguments of calls.
        if (parent != .call_expression) return if (self.policy != null) .proceed else .skip;
        var ancestor_depth = depth - 1;
        while (ancestor_depth > 0) {
            ancestor_depth -= 1;
            const ancestor_index = ctx.path.items[ancestor_depth];
            const ancestor = ctx.tree.data(ancestor_index);
            switch (ancestor) {
                .for_statement, .for_in_statement, .for_of_statement, .while_statement, .do_while_statement => return if (self.policy != null) .proceed else .skip,
                .function => if (std.mem.indexOfScalar(ast.NodeIndex, self.once.items, ancestor_index) == null)
                    return if (self.policy != null) .proceed else .skip,
                else => {},
            }
        }
        if (enabled and !selected) try self.nodes.append(self.allocator, index);
        try self.once.append(self.allocator, index);
        return .proceed;
    }
};

fn candidates(allocator: std.mem.Allocator, tree: *ast.Tree) ![]ast.NodeIndex {
    return candidatesWithPolicy(allocator, tree, null);
}

fn candidatesWithPolicy(allocator: std.mem.Allocator, tree: *ast.Tree, rules: ?*const Policy) ![]ast.NodeIndex {
    return candidatesExcluding(allocator, tree, rules, .null);
}

fn candidatesExcluding(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    rules: ?*const Policy,
    excluded: ast.NodeIndex,
) ![]ast.NodeIndex {
    return candidatesWithModules(allocator, tree, rules, excluded, &.{});
}

fn candidatesWithModules(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    rules: ?*const Policy,
    excluded: ast.NodeIndex,
    modules: []const ast.NodeIndex,
) ![]ast.NodeIndex {
    var collector = Iifes{ .allocator = allocator, .policy = rules, .excluded_function = excluded, .modules = modules };
    defer collector.once.deinit(allocator);
    errdefer collector.nodes.deinit(allocator);
    try parser.traverser.transform.traverse(Iifes, tree, &collector);
    return collector.nodes.toOwnedSlice(allocator);
}

fn timestampSeed(allocator: std.mem.Allocator) f64 {
    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const now = std.Io.Clock.real.now(threaded.io()).toMilliseconds();
    const positive: u64 = @intCast(@max(now, 0));
    return @floatFromInt((11 * (positive % 1000) + 19 * ((positive / 1000) % 60)) & 65535);
}

fn parseTree(allocator: std.mem.Allocator, source: SourceInfo) !ast.Tree {
    if (source.factory_tree) |original| {
        var tree = ast.Tree.init(allocator, "");
        errdefer tree.deinit();
        tree.source = try tree.allocator().dupe(u8, original.source);
        tree.strings.source = tree.source;
        const factory = try @import("nodes.zig").cloneSource(original, &tree, source.factory_node);
        const statement = try tree.addNode(.{ .expression_statement = .{ .expression = factory } }, span);
        tree.root = try tree.addNode(.{ .program = .{ .source_type = .module, .body = try tree.addExtra(&.{statement}) } }, span);
        return tree;
    }
    if (source.factory) {
        const wrapped = try std.fmt.allocPrint(allocator, "({s})", .{source.source_code});
        defer allocator.free(wrapped);
        var tree = try parser.parse(allocator, wrapped, .{ .source_type = .module });
        errdefer tree.deinit();
        if (tree.hasErrors()) return error.ParseFailed;
        const owned = try tree.allocator().dupe(u8, wrapped);
        tree.source = owned;
        tree.strings.source = owned;
        const statement = tree.extra(tree.data(tree.root).program.body)[0];
        const expression = tree.data(statement).expression_statement.expression;
        const function = tree.data(expression).parenthesized_expression.expression;
        tree.setData(statement, .{ .expression_statement = .{ .expression = function } });
        tree.setSpan(statement, span);
        return tree;
    }
    var tree = try parser.parse(allocator, source.source_code, .{ .source_type = if (source.is_module) .module else .script });
    if (tree.hasErrors() and !source.is_module) {
        tree.deinit();
        tree = try parser.parse(allocator, source.source_code, .{ .source_type = .module });
    }
    if (tree.hasErrors()) {
        tree.deinit();
        return error.ParseFailed;
    }
    errdefer tree.deinit();
    // Babel 7's configured parser represents dynamic imports as calls and
    // rejects proposals that the underlying Zig parser also understands.
    const count = tree.nodes.len;
    for (0..count) |i| {
        const index: ast.NodeIndex = @fromBackingInt(@intCast(i));
        switch (tree.data(index)) {
            .class => |value| if (tree.extra(value.decorators).len != 0) return error.ParseFailed,
            .property_definition => |value| if (value.accessor or tree.extra(value.decorators).len != 0) return error.ParseFailed,
            .method_definition => |value| if (tree.extra(value.decorators).len != 0) return error.ParseFailed,
            .import_declaration => |value| if (value.phase != null) return error.ParseFailed,
            .import_expression => |value| {
                if (value.phase != null) return error.ParseFailed;
                const location = tree.span(index);
                const callee = try tree.addNode(
                    .{ .identifier_name = .{ .name = try tree.addString("import") } },
                    .{ .start = location.start, .end = location.start + 6 },
                );
                const arguments = if (value.options == .null)
                    try tree.addExtra(&.{value.source})
                else
                    try tree.addExtra(&.{ value.source, value.options });
                tree.setData(index, .{ .call_expression = .{ .callee = callee, .arguments = arguments, .optional = false } });
            },
            else => {},
        }
    }
    return tree;
}

fn checkedCodegen(allocator: std.mem.Allocator, tree: *ast.Tree, options: Options) ![]const u8 {
    if (options.minify) return canonical.render(allocator, tree);
    const result = try parser.codegen.generate(
        allocator,
        tree,
        .{ .minify = options.minify, .format = if (options.minify) .compact else .pretty, .comments = .none },
    );
    defer result.deinit(allocator);
    for (result.diagnostics) |diagnostic| if (diagnostic.severity == .@"error") return error.CodegenFailed;
    return allocator.dupe(u8, result.code);
}

test "source parsing matches Babel dynamic import shape and enabled proposals" {
    const allocator = std.testing.allocator;
    const source = "import(\"x\",{with:{type:\"json\"}});";
    var tree = try parseTree(allocator, .{ .source_code = source });
    defer tree.deinit();
    const stats = try summary.inspect(&tree, source);
    try std.testing.expectEqual(@as(usize, 11), stats.numSyntaxNodes);
    const statement = tree.extra(tree.data(tree.root).program.body)[0];
    const call = tree.data(tree.data(statement).expression_statement.expression).call_expression;
    try std.testing.expectEqual(@as(usize, 2), tree.extra(call.arguments).len);
    for ([_][]const u8{
        "class A{accessor x=1;}",
        "@decorator class A{}",
        "import source x from 'x';",
        "import.defer('x');",
    }) |unsupported| {
        try std.testing.expectError(error.ParseFailed, parseTree(allocator, .{ .source_code = unsupported }));
    }
}

fn globalRuntime(manager: *runtime.Manager) !declarations.GlobalRuntime {
    try manager.initializeProtector();
    return .{ .context = manager, .protector_name = manager.protector_name.?, .require_helper = struct {
        fn call(context: *anyopaque, name: []const u8) declarations.RuntimeError![]const u8 {
            const value: *runtime.Manager = @ptrCast(@alignCast(context));
            return value.addBuiltin(name);
        }
    }.call, .init_property = struct {
        fn call(context: *anyopaque, tree: *ast.Tree, key: []const u8, value: ast.NodeIndex) declarations.RuntimeError![]const u8 {
            const manager_value: *runtime.Manager = @ptrCast(@alignCast(context));
            return manager_value.initPropertyNode(tree, key, value);
        }
    }.call };
}

fn checkUnsafe(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    rules: *Policy,
    report: *summary.State,
    source: usize,
    ignore: bool,
) !bool {
    const Visitor = struct {
        allocator: std.mem.Allocator,
        rules: *Policy,
        nodes: std.ArrayList(ast.NodeIndex) = .empty,

        pub fn enter_node(
            self: *@This(),
            data: ast.NodeData,
            index: ast.NodeIndex,
            _: *parser.traverser.basic.Ctx,
        ) !parser.traverser.Action {
            if (data == .with_statement and self.rules.isEnabled(index, "local_declarations"))
                try self.nodes.append(self.allocator, index);
            return .proceed;
        }
    };
    var visitor = Visitor{ .allocator = allocator, .rules = rules };
    defer visitor.nodes.deinit(allocator);
    try parser.traverser.basic.traverse(Visitor, tree, &visitor);
    if (visitor.nodes.items.len == 0) return false;
    report.unsafe_sources.items[source] = true;
    for (visitor.nodes.items) |node| {
        const original = tree.span(node);
        const prefix = tree.source[0..@min(original.start, tree.source.len)];
        const line = std.mem.count(u8, prefix, "\n") + 1;
        const start = if (std.mem.lastIndexOfScalar(u8, prefix, '\n')) |last| last + 1 else 0;
        const column = summary.units(prefix[start..]);
        const code = if (original.end > original.start and original.end <= tree.source.len)
            tree.source[original.start..original.end]
        else
            "";
        try report.logType(
            "Warning",
            try std.fmt.allocPrint(
                report.arena.allocator(),
                "Unsafe with statement ({d}: {d}): {s} // ...",
                .{ line, column, code },
            ),
        );
    }
    try report.logType(
        if (ignore) "Warning" else "Error",
        try std.fmt.allocPrint(
            report.arena.allocator(),
            "The source code contains {d} *with* statement instances in protected sections. Applying local declaration transform may break working code.",
            .{visitor.nodes.items.len},
        ),
    );
    return !ignore;
}

const CrossReferences = struct {
    snapshot: ?*const cross_source.Snapshot,
    source: usize,

    fn skip(context: *anyopaque, index: ast.NodeIndex) bool {
        const self: *CrossReferences = @ptrCast(@alignCast(context));
        return if (self.snapshot) |snapshot| snapshot.isScriptGlobalReference(self.source, index) else false;
    }
};

const PreparedRuntime = struct {
    code: []const u8,
    locations: ?[]source_map.Record = null,
    identifiers: ?[]lexical_location.Record = null,

    fn deinit(self: PreparedRuntime, allocator: std.mem.Allocator) void {
        allocator.free(self.code);
        if (self.locations) |records| allocator.free(records);
        if (self.identifiers) |records| allocator.free(records);
    }
};

fn prepareRuntime(
    allocator: std.mem.Allocator,
    manager: *runtime.Manager,
    random: *scalars.Random,
    configuration: *const config.Config,
    id_offset: u32,
) !PreparedRuntime {
    const source = try manager.emitSource();
    if (source.len == 0) return .{ .code = try allocator.dupe(u8, "") };
    const has_runtime_file = if (configuration.runtime_file) |file| file.len != 0 else false;
    if (configuration.runtime_injection.mode == .separate_source and !has_runtime_file) return error.RuntimeFileRequired;
    if (configuration.runtime_injection.mode != .separate_source and has_runtime_file) return error.UnexpectedRuntimeFile;
    var tree = try parser.parse(allocator, source, .{ .source_type = .script });
    defer tree.deinit();
    if (tree.hasErrors()) return error.RuntimeUnavailable;
    try source_map.registerRuntime(allocator, &tree, manager.setup.items, manager.setup_origins.items);
    try lexical_location.registerRuntime(allocator, &tree, manager.setup.items, manager.setup_origins.items);
    const setup_statement = tree.extra(tree.data(tree.root).program.body)[1];
    const setup_call = tree.data(tree.data(setup_statement).expression_statement.expression).unary_expression.argument;
    const setup_function = tree.data(setup_call).call_expression.callee;
    manager.active_tree = &tree;
    manager.active_body = tree.data(setup_function).function.body;
    defer {
        manager.active_tree = null;
        manager.active_body = .null;
    }
    try structural.apply(allocator, &tree, .function_reorder, random);
    try flow.apply(allocator, &tree, random, .{ .randomize = true, .skip_runtime = true }, manager);
    try literals.applyBooleans(allocator, &tree, random, true);
    try literals.applyIntegers(allocator, &tree, random, .{ .randomize = true, .lower = 0, .upper = 65535 });
    try declarations.applyLocal(
        allocator,
        &tree,
        .{
            .mode = .base62,
            .exclude_ids = &.{manager.protector_name.?},
            .id_base = 11000000,
            .id_offset = id_offset,
            .protector_name = manager.protector_name,
            .preserve_root_ids = true,
            .ignore_unsafe_constructs = true,
        },
        random,
    );
    const code = try checkedCodegen(allocator, &tree, .{ .minify = true });
    errdefer allocator.free(code);
    const mapped = try source_map.capture(allocator, &tree);
    errdefer if (mapped) |records| allocator.free(records);
    return .{ .code = code, .locations = mapped, .identifiers = try lexical_location.capture(allocator, &tree) };
}

fn injectRuntime(
    allocator: std.mem.Allocator,
    manager: *runtime.Manager,
    random: *scalars.Random,
    configuration: *const config.Config,
    id_offset: u32,
    target: *ast.Tree,
    inside_factory: bool,
) !bool {
    if (manager.injected_function != .null or manager.protector_name == null) return false;
    const prepared = try prepareRuntime(allocator, manager, random, configuration, id_offset);
    defer prepared.deinit(allocator);
    const first_node = target.nodes.len;
    const inserted = try @import("nodes.zig").embedRenderedProgram(allocator, target, prepared.code);
    const statements = target.extra(inserted);
    const call = target.data(target.data(statements[1]).expression_statement.expression).unary_expression.argument;
    manager.injected_function = target.data(call).call_expression.callee;
    manager.active_tree = target;
    manager.active_body = target.data(manager.injected_function).function.body;
    const owner = if (inside_factory) blk: {
        const statement = target.extra(target.data(target.root).program.body)[0];
        const factory = target.data(statement).expression_statement.expression;
        break :blk target.data(factory).function.body;
    } else target.root;
    const original = target.data(owner);
    const range = if (original == .program) original.program.body else original.function_body.body;
    const body = try allocator.dupe(ast.NodeIndex, target.extra(range));
    defer allocator.free(body);
    var prefix: usize = 0;
    while (prefix < body.len and target.data(body[prefix]) == .directive) : (prefix += 1) {}
    var merged: std.ArrayList(ast.NodeIndex) = .empty;
    defer merged.deinit(allocator);
    try merged.appendSlice(allocator, body[0..prefix]);
    try merged.appendSlice(allocator, target.extra(inserted));
    try merged.appendSlice(allocator, body[prefix..]);
    var updated = original;
    switch (updated) {
        .program => |*value| value.body = try target.addExtra(merged.items),
        .function_body => |*value| value.body = try target.addExtra(merged.items),
        else => unreachable,
    }
    target.setData(owner, updated);
    try source_map.assign(allocator, target, first_node, prepared.locations);
    try lexical_location.assign(allocator, target, first_node, prepared.identifiers);
    return true;
}

fn protectMetro(
    allocator: std.mem.Allocator,
    tree: *ast.Tree,
    source_index: usize,
    report: *summary.State,
    configuration: *const config.Config,
    options: Options,
) anyerror!?Result {
    if (std.mem.indexOf(u8, tree.source, "__BUNDLE_START_TIME__") == null) return null;
    const metro = (try bundle.detectMetro(allocator, tree, configuration.filename_map, configuration.protect_user_modules_only)) orelse return null;
    defer metro.deinit(allocator);
    report.statistics.items[source_index].isBundle = true;
    report.statistics.items[source_index].numModules = metro.total_modules;
    try report.log(
        try std.fmt.allocPrint(
            report.arena.allocator(),
            "File #{d} is recognized as 'metro-bundle' with {d} module{s}.",
            .{ source_index + 1, metro.total_modules, if (metro.total_modules > 1) "s" else "" },
        ),
    );
    try report.log("Source tree building in progress...");
    var inputs: std.ArrayList(SourceInfo) = .empty;
    defer {
        for (inputs.items) |input| allocator.free(input.source_code);
        inputs.deinit(allocator);
    }
    var ranges: std.ArrayList(bundle.Range) = .empty;
    defer ranges.deinit(allocator);
    for (metro.modules) |module| {
        if (configuration.protect_user_modules_only and !module.user) continue;
        if (module.node == .null) return error.MissingMetroFactory;
        const body = switch (tree.data(module.node)) {
            .function => |value| value.body,
            .arrow_function_expression => |value| value.body,
            else => return error.InvalidMetroFactory,
        };
        const body_span = tree.span(body);
        const code = try canonical.renderNode(allocator, tree, module.node);
        inputs.append(
            allocator,
            .{
                .source_code = code,
                .is_module = true,
                .factory = true,
                .factory_tree = tree,
                .factory_node = module.node,
                .reported_length = summary.units(tree.source[body_span.start..body_span.end]),
            },
        ) catch |err| {
            allocator.free(code);
            return err;
        };
        try ranges.append(allocator, module.range);
    }
    var child = configuration.*;
    // Metro replaces the entire SDK runtimeInjection value, including options.
    child.runtime_injection = .{ .mode = .all };
    var child_options = options;
    child_options.metro_parent = report;
    var result = try protect(allocator, inputs.items, &child, child_options);
    errdefer result.deinit(allocator);
    result.metro_bundle_info = try ranges.toOwnedSlice(allocator);
    return result;
}

pub fn protect(
    allocator: std.mem.Allocator,
    sources: []const SourceInfo,
    configuration: *const config.Config,
    options: Options,
) !Result {
    var identifiers = lexical_location.Registry.init(allocator);
    defer identifiers.deinit();
    const previous_identifiers = lexical_location.activate(if (configuration.generate_maps) &identifiers else null);
    defer _ = lexical_location.activate(previous_identifiers);
    var locations = source_map.Registry.init(allocator);
    defer locations.deinit();
    const previous_locations = source_map.activate(if (configuration.source_maps) &locations else null);
    defer _ = source_map.activate(previous_locations);
    if (sources.len == 0 and options.metro_parent == null) return error.EmptySourceSet;
    var timer: std.Io.Threaded = .init(allocator, .{});
    defer timer.deinit();
    const started = std.Io.Clock.awake.now(timer.io()).toMilliseconds();
    var report = summary.State.init(allocator);
    report.sink = options.log_sink;
    defer report.deinit();
    if (options.metro_parent) |parent| {
        for (parent.statistics.items) |stats| try report.add(stats);
        try report.logs.appendSlice(report.arena.allocator(), parent.logs.items);
    } else try report.start();
    const seed = if (configuration.random_seed) |value|
        if (value == 0) timestampSeed(allocator) else value
    else
        timestampSeed(allocator);
    errdefer if (options.failure_summary) |output| {
        if (output.* == null)
            output.* = report.json(allocator, &.{}, seed, std.Io.Clock.awake.now(timer.io()).toMilliseconds() - started) catch null;
    };
    var random = scalars.Random.init(seed);
    var names = Names{ .allocator = allocator };
    defer names.deinit();
    const trees = try allocator.alloc(ast.Tree, sources.len);
    defer allocator.free(trees);
    const initialized = try allocator.alloc(bool, sources.len);
    defer allocator.free(initialized);
    @memset(initialized, false);
    defer for (trees, initialized) |*tree, valid| if (valid) {
        tree.deinit();
    };
    const policies = try allocator.alloc(Policy, sources.len);
    const bundles = try allocator.alloc(?bundle.Detection, sources.len);
    defer allocator.free(bundles);
    @memset(bundles, null);
    defer for (bundles) |value| if (value) |detected| detected.deinit(allocator);
    defer allocator.free(policies);
    const policy_initialized = try allocator.alloc(bool, sources.len);
    defer allocator.free(policy_initialized);
    @memset(policy_initialized, false);
    defer for (policies, policy_initialized) |*rules, valid| if (valid) {
        rules.deinit();
    };
    var date_enabled = false;
    var domain_enabled = false;
    var parse_errors: usize = 0;
    var inline_errors: usize = 0;
    for (sources, 0..) |source, i| {
        trees[i] = parseTree(allocator, source) catch |failure| {
            if (failure != error.ParseFailed) return failure;
            parse_errors += 1;
            try report.parseFailed(source.source_code);
            continue;
        };
        initialized[i] = true;
        try source_map.registerSource(allocator, &trees[i]);
        if (source.factory)
            try source_map.registerSynthetic(&trees[i], trees[i].extra(trees[i].data(trees[i].root).program.body)[0]);
        if (!source.factory) bundles[i] = try bundle.detect(allocator, &trees[i]);
        policies[i] = try Policy.init(allocator, &trees[i], configuration, i);
        policy_initialized[i] = true;
        var stats = try summary.inspect(&trees[i], source.source_code);
        if (source.factory and trees[i].data(
            trees[i].data(trees[i].extra(trees[i].data(trees[i].root).program.body)[0]).expression_statement.expression,
        ) == .arrow_function_expression) {
            stats.numSyntaxNodes -= 1;
            stats.numStatements -= 1;
        }
        if (source.reported_length) |length| stats.sourceCodeLength = length;
        if (bundles[i]) |detected| {
            stats.isBundle = true;
            stats.numModules = detected.modules.len;
        }
        if (i < report.statistics.items.len) report.statistics.items[i] = stats else try report.add(stats);
        if (!source.factory)
            if (try protectMetro(allocator, &trees[i], i, &report, configuration, options)) |result| return result;
        for (policies[i].warnings.items) |warning| {
            if (warning.kind == .unknown_named_set) continue;
            inline_errors += 1;
            const offset = trees[i].span(warning.node).start;
            const prefix = trees[i].source[0..@min(offset, trees[i].source.len)];
            const line = std.mem.count(u8, prefix, "\n") + 1;
            const line_start = if (std.mem.lastIndexOfScalar(u8, prefix, '\n')) |last| last + 1 else 0;
            const column = summary.units(prefix[line_start..]);
            if (warning.kind == .invalid_inline_configuration) {
                try report.logType(
                    "Error",
                    try std.fmt.allocPrint(
                        report.arena.allocator(),
                        "Failed to parse the inline configuration directive ({d}:{d}).",
                        .{ line, line },
                    ),
                );
            } else {
                var property: []const u8 = "";
                inline for (.{
                    .{ "date_lock", "dateLock" },
                    .{ "domain_lock", "domainLock" },
                    .{ "console_cloaking", "consoleCloaking" },
                    .{ "dev_tools_blocking", "devToolsBlocking" },
                    .{ "global_object_hiding", "globalObjectHiding" },
                }) |pair| if (std.mem.eql(u8, warning.name.?, pair[0])) {
                    property = pair[1];
                };
                try report.logType(
                    "Error",
                    try std.fmt.allocPrint(
                        report.arena.allocator(),
                        "The {s} option can be applied only globally ({d}:{d}).",
                        .{ property, line, column },
                    ),
                );
            }
        }
        if (bundles[i]) |detected| try report.log(
            try std.fmt.allocPrint(
                report.arena.allocator(),
                "File #{d} is recognized as '{s}' with {d} module{s}.",
                .{ i + 1, detected.kind, detected.modules.len, if (detected.modules.len > 1) "s" else "" },
            ),
        );
        date_enabled = date_enabled or policies[i].root_settings.date_lock.isEnabled();
        domain_enabled = domain_enabled or policies[i].root_settings.domain_lock.isEnabled();
    }
    if (parse_errors != 0) return error.ParseFailed;
    if (inline_errors != 0) return error.InvalidInlineDirectives;
    try report.builtFor(report.statistics.items[0..sources.len]);
    const manager_count = if (configuration.runtime_injection.mode == .all) sources.len else 1;
    const managers = try allocator.alloc(runtime.Manager, manager_count);
    defer allocator.free(managers);
    var runtime_id_counter: u32 = 12000000;
    for (managers) |*manager| manager.* = runtime.Manager.init(
        allocator,
        .{
            .es5 = configuration.es_target == .es5,
            .name_source = .{ .context = &names, .generate = Names.generate },
            .runtime_id_counter = &runtime_id_counter,
        },
        &random,
    );
    defer for (managers) |*manager| manager.deinit();
    const constant_states = try allocator.alloc(structural.ConstantArgumentState, manager_count);
    defer allocator.free(constant_states);
    for (constant_states) |*state| state.* = structural.ConstantArgumentState.init(allocator);
    defer for (constant_states) |*state| state.deinit();
    const offset: u32 = @intFromFloat(random.getRandomInt(0, 10000));
    const source_id_bases = try allocator.alloc(u32, sources.len);
    defer allocator.free(source_id_bases);
    @memset(source_id_bases, 0);
    const mapped_node_limits = try allocator.alloc(usize, sources.len);
    defer allocator.free(mapped_node_limits);
    @memset(mapped_node_limits, 0);
    const module_flags = try allocator.alloc(bool, sources.len);
    defer allocator.free(module_flags);
    for (sources, 0..) |source, i| module_flags[i] = source.is_module;
    var globals: ?cross_source.Snapshot = null;
    defer if (globals) |*snapshot| snapshot.deinit();
    var scopes_built = false;
    var scopes_changed = false;
    const graphs = try allocator.alloc(?lexical.Graph, sources.len);
    defer allocator.free(graphs);
    @memset(graphs, null);
    defer for (graphs) |*graph| if (graph.*) |*value| value.deinit();
    var shared_declarations: lexical.DeclarationMap = .empty;
    var module_arena = std.heap.ArenaAllocator.init(allocator);
    defer module_arena.deinit();
    const module_declarations = try allocator.alloc(lexical.DeclarationMap, sources.len);
    defer allocator.free(module_declarations);
    @memset(module_declarations, .empty);
    var virtual_declarations: lexical.DeclarationMap = .empty;
    var virtual_scope = lexical.Scope{ .parent = null, .node = .null, .declarations = &virtual_declarations };
    var separate_tree = ast.Tree.init(allocator, "");
    defer separate_tree.deinit();
    separate_tree.root = try separate_tree.addNode(.{ .program = .{ .source_type = .script, .body = .empty } }, span);
    var first_non_module: ?usize = null;
    for (sources, 0..) |source, i| {
        if (!source.is_module) {
            first_non_module = i;
            break;
        }
    }
    // The recovered 18-pass order is deliberately explicit.
    for (0..18) |pass| {
        const needs_scopes: ?[]const u8 = switch (pass) {
            6 => "control_flow",
            10 => "property_sparsing",
            11 => "variable_grouping",
            14 => "global_object_hiding",
            15 => "string_literals",
            16 => "local_declarations",
            17 => "self_defending",
            else => null,
        };
        var pass_scopes_prepared = false;
        if (pass == 14 and trees.len > 1) globals = try cross_source.Snapshot.capture(allocator, trees, module_flags);
        for (trees, 0..) |*tree, i| {
            const previous_nodes = tree.nodes.len;
            const rules = &policies[i];
            try rules.refresh(tree);
            const selection = rules.root_settings;
            const manager_index = if (manager_count == 1) 0 else i;
            const manager = &managers[manager_index];
            var pending_lexical_log = false;
            const runtime_target = if (configuration.runtime_injection.mode == .separate_source)
                &separate_tree
            else
                &trees[if (configuration.runtime_injection.mode == .first_non_module) first_non_module orelse i else i];
            // The SDK's pre-injection hook replaces the dirty flag even when
            // no runtime has been requested; cached scopes deliberately survive.
            if (pass >= 16 and manager.injected_function == .null and manager.protector_name == null) scopes_changed = false;
            if (pass >= 16 and manager.protector_name != null and manager.injected_function == .null) {
                if (configuration.runtime_injection.mode == .first_non_module and first_non_module == null) return error.RuntimeFileRequired;
                scopes_changed = try injectRuntime(allocator, manager, &random, configuration, offset, runtime_target, sources[i].factory) or scopes_changed;
            }
            if (!pass_scopes_prepared) if (needs_scopes) |setting| {
                var enabled = false;
                var iterator = rules.entries.valueIterator();
                while (iterator.next()) |settings| inline for (@typeInfo(config.Settings).@"struct".field_names) |name| {
                    if (std.mem.eql(u8, setting, name) and @field(settings.*, name).isEnabled()) enabled = true;
                };
                if (enabled) {
                    if (!scopes_built or scopes_changed) {
                        pending_lexical_log = true;
                        names.next_id = 10;
                        names.deinit();
                        for (trees, 0..) |*source_tree, source_index| {
                            mapped_node_limits[source_index] = source_tree.nodes.len;
                            var collector = NameCollector{ .names = &names };
                            try parser.traverser.basic.traverse(NameCollector, source_tree, &collector);
                        }
                        for (managers) |*runtime_manager| if (runtime_manager.protector_name) |name| try names.reserve(name);
                        {
                            for (graphs, sources, 0..) |*graph, input, source_index| {
                                if (input.is_module) if (graph.*) |*old| {
                                    var retained: lexical.DeclarationMap = .empty;
                                    for (old.root.declarations.values()) |declaration| {
                                        const copy = try module_arena.allocator().create(lexical.Declaration);
                                        copy.* = declaration.*;
                                        copy.name = try module_arena.allocator().dupe(u8, declaration.name);
                                        if (declaration.mangled_name) |name| copy.mangled_name = try module_arena.allocator().dupe(u8, name);
                                        try retained.put(module_arena.allocator(), copy.name, copy);
                                    }
                                    module_declarations[source_index] = retained;
                                };
                                if (graph.*) |*value| value.deinit();
                                graph.* = null;
                            }
                            shared_declarations = .empty;
                            var base: u32 = 0;
                            if (first_non_module) |source_index| {
                                graphs[source_index] = try lexical.Graph.build(allocator, &trees[source_index], source_index, base, &shared_declarations, null);
                                source_id_bases[source_index] = base;
                                base += graphs[source_index].?.count();
                            }
                            for (trees, sources, 0..) |*source_tree, input, source_index| {
                                if (first_non_module == source_index) continue;
                                const module = input.is_module;
                                const parent = if (module) (if (first_non_module) |first| graphs[first].?.root else &virtual_scope) else null;
                                graphs[source_index] = try lexical.Graph.build(
                                    allocator,
                                    source_tree,
                                    source_index,
                                    base,
                                    if (module) &module_declarations[source_index] else &shared_declarations,
                                    parent,
                                );
                                source_id_bases[source_index] = base;
                                base += graphs[source_index].?.count();
                            }
                            for (graphs) |*graph| try graph.*.?.resolve();
                            names.next_id += base;
                        }
                        scopes_built = true;
                    }
                    pass_scopes_prepared = true;
                }
            };
            try rules.refresh(tree);
            const has_date = if (manager_count == 1) date_enabled else selection.date_lock.isEnabled();
            const has_domain = if (manager_count == 1) domain_enabled else selection.domain_lock.isEnabled();
            var cross_references = CrossReferences{ .snapshot = if (globals) |*snapshot| snapshot else null, .source = i };
            var pass_counter = summary.Counter{ .pass = pass };
            const previous_counter = summary.activate(&pass_counter);
            defer _ = summary.activate(previous_counter);
            inline for (summary.settings, 0..) |setting, index| if (pass == index and rules.anyEnabled(setting)) {
                report.applied.items[i] = true;
            };
            const unsafe = pass == 16 and rules.anyEnabled("local_declarations") and try checkUnsafe(allocator, tree, rules, &report, i, configuration.ignore_unsafe_constructs);
            if (pending_lexical_log) try report.lexical();
            if (unsafe) return error.UnsafeConstruct;
            switch (pass) {
                0 => if (rules.anyEnabled("debugger_removal")) {
                    try structural.applyConfigured(allocator, tree, .debugger_removal, &random, .{ .policy = rules });
                },
                1 => if (selection.domain_lock.get()) |value| {
                    try protections.applyDomain(
                        allocator,
                        manager,
                        .{ .domain_pattern = value.domain_pattern, .error_script = value.error_script orelse "" },
                        has_date,
                    );
                },
                2 => if (selection.date_lock.get()) |value| {
                    try protections.applyDate(
                        allocator,
                        manager,
                        .{
                            .start_date = value.start_date,
                            .end_date = value.end_date,
                            .error_script = value.error_script orelse "",
                            .parser = options.date_parser,
                        },
                        has_domain,
                    );
                },
                3 => if (selection.dev_tools_blocking.get()) |value| {
                    try protections.applyDevTools(allocator, manager, .{ .patience = value.patience });
                },
                4 => if (selection.console_cloaking.get()) |value| {
                    try protections.applyConsole(allocator, manager, .{ .exclude = value.exclude });
                },
                5 => if (rules.anyEnabled("function_reorder")) {
                    try structural.applyConfigured(allocator, tree, .function_reorder, &random, .{ .policy = rules });
                },
                6 => if (rules.anyEnabled("control_flow")) {
                    try flow.apply(allocator, tree, &random, .{ .policy = rules }, manager);
                },
                7 => if (rules.anyEnabled("expr_sequence")) {
                    try structural.applyConfigured(allocator, tree, .expr_sequence, &random, .{ .policy = rules });
                },
                8 => if (rules.anyEnabled("boolean_literals")) {
                    try literals.applyBooleansWithPolicy(allocator, tree, &random, rules);
                },
                9 => if (rules.anyEnabled("constant_argument")) {
                    constant_states[manager_index].date_enabled = has_date;
                    constant_states[manager_index].domain_enabled = has_domain;
                    try constant_states[manager_index].applyWithPolicy(tree, &random, manager, rules);
                },
                10 => if (rules.anyEnabled("property_sparsing")) {
                    try structural.applyConfigured(
                        allocator,
                        tree,
                        .property_sparsing,
                        &random,
                        .{ .policy = rules, .name_source = manager.config.name_source },
                    );
                },
                11 => if (rules.anyEnabled("variable_grouping")) {
                    try structural.applyConfigured(allocator, tree, .variable_grouping, &random, .{ .policy = rules });
                },
                12 => if (rules.anyEnabled("property_indirection")) {
                    try structural.applyConfigured(
                        allocator,
                        tree,
                        .property_indirection,
                        &random,
                        .{ .es5 = configuration.es_target == .es5, .policy = rules },
                    );
                },
                13 => if (rules.anyEnabled("integer_literals")) {
                    try literals.applyIntegersWithPolicy(allocator, tree, &random, rules);
                },
                14 => if (selection.global_object_hiding.get()) |value| {
                    try declarations.applyGlobal(
                        allocator,
                        tree,
                        .{
                            .use_predefined = value.use_predefined,

                            .include = value.include,

                            .exclude = value.exclude,

                            .allow_generated_errors = true,

                            .skip_unresolved = .{ .context = &cross_references, .skip = CrossReferences.skip },
                        },
                        try globalRuntime(manager),
                    );
                },
                15 => if (rules.anyEnabled("string_literals")) {
                    const stats = try strings.applyWithRuntimeAndPolicy(allocator, tree, manager, @intCast(i), rules);
                    summary.count(15, stats.literals_transformed);
                },
                16 => if (rules.anyEnabled("local_declarations")) {
                    const value = selection.local_declarations.get() orelse config.LocalDeclarations{};
                    try declarations.applyLocal(
                        allocator,
                        tree,
                        .{
                            .mode = value.name_mangling,

                            .exclude_ids = value.exclude_ids,

                            .id_base = source_id_bases[i],

                            .id_offset = offset,

                            .protector_name = manager.protector_name,

                            .ignore_unsafe_constructs = configuration.ignore_unsafe_constructs,

                            .policy = rules,

                            .mapped_node_limit = mapped_node_limits[i],

                            .scope_graph = &graphs[i].?,

                            .source_policies = policies,

                            .skip_unresolved = .{ .context = &cross_references, .skip = CrossReferences.skip },
                        },
                        &random,
                    );
                },
                17 => if (rules.anyEnabled("self_defending")) {
                    const value = selection.self_defending.get() orelse config.SelfDefending{};
                    const selected = try candidatesWithModules(
                        allocator,
                        tree,
                        rules,
                        manager.injected_function,
                        if (bundles[i]) |detected| detected.modules else &.{},
                    );
                    defer allocator.free(selected);
                    try self_defending.apply(
                        allocator,
                        tree,
                        selected,
                        &random,
                        .{
                            .level = value.level,

                            .error_script = value.error_script orelse "console.log('Error: the code has been tampered!')",

                            .random_seed = seed,

                            .id_offset = offset,

                            .es5 = configuration.es_target == .es5,

                            .policy = rules,
                        },
                        manager,
                    );
                },
                else => unreachable,
            }
            if ((pass == 6 or pass == 10 or pass == 15) and tree.nodes.len != previous_nodes) scopes_changed = true;
            if ((pass == 7 or pass == 11) and pass_counter.value != 0) scopes_changed = true;
            if (pass == 16 and rules.anyEnabled("local_declarations")) scopes_changed = true;
            if (pass == 17 and manager.protector_name != null and manager.injected_function == .null) {
                if (configuration.runtime_injection.mode == .first_non_module and first_non_module == null) return error.RuntimeFileRequired;
                _ = try injectRuntime(allocator, manager, &random, configuration, offset, runtime_target, sources[i].factory);
            }
            inline for (summary.settings, 0..) |setting, index| if (pass == index and rules.anyEnabled(setting)) {
                try report.transformed(i, pass, pass_counter.value);
            };
        }
        if (pass == 9)
            for (constant_states, managers) |*state, *manager| try state.finish(&random, manager, configuration.es_target == .es5);
    }
    const protected = try allocator.alloc([]const u8, sources.len);
    var rendered: usize = 0;
    errdefer {
        for (protected[0..rendered]) |source| allocator.free(source);
        allocator.free(protected);
    }
    var separate: ?[]const u8 = null;
    errdefer if (separate) |source| allocator.free(source);
    for (managers) |*manager| {
        if (manager.injected_function == .null) continue;
        if (configuration.runtime_injection.options != .no_eval) try self_defending.apply(
            allocator,
            manager.active_tree.?,
            &.{manager.injected_function},
            &random,
            .{ .standalone = true, .random_seed = seed, .id_offset = offset, .es5 = configuration.es_target == .es5 },
            manager,
        );
    }
    if (configuration.runtime_injection.mode == .separate_source)
        separate = try checkedCodegen(allocator, &separate_tree, options);
    var map_json: std.ArrayList(u8) = .empty;
    try report.log("Rendering protected files...");
    defer map_json.deinit(allocator);
    if (configuration.source_maps) try map_json.append(allocator, '[');
    for (trees, 0..) |*tree, i| {
        protected[i] = if (configuration.source_maps and options.minify)
            try canonical.renderMapped(allocator, tree)
        else
            try checkedCodegen(allocator, tree, options);
        rendered += 1;
        if (configuration.source_maps) {
            const json = try source_map.generate(allocator, tree, protected[i], i);
            defer allocator.free(json);
            if (i != 0) try map_json.append(allocator, ',');
            try map_json.appendSlice(allocator, json);
        }
    }
    if (configuration.source_maps) try map_json.append(allocator, ']');
    try report.log("Protected files rendered successfully.");
    var declarations_json: std.ArrayList(u8) = .empty;
    defer declarations_json.deinit(allocator);
    if (configuration.generate_maps) {
        try report.log("Rendering lexical scope maps...");
        try declarations_json.append(allocator, '[');
        for (graphs, sources, 0..) |*graph, input, i| {
            if (i != 0) try declarations_json.append(allocator, ',');
            if (graph.*) |*value| {
                const json = try value.json(allocator, !input.is_module and first_non_module != i);
                defer allocator.free(json);
                try declarations_json.appendSlice(allocator, json);
            } else try declarations_json.appendSlice(
                allocator,
                if (input.is_module) "{\"declarations\":[],\"references\":[],\"unresolved\":[],\"nested\":[]}" else "{\"declarations\":\"inherit\",\"references\":[],\"unresolved\":[],\"nested\":[]}",
            );
        }
        try declarations_json.append(allocator, ']');
        try report.log("Lexical scope maps successfully rendered.");
    }
    if (configuration.runtime_injection.mode == .separate_source and separate == null)
        separate = try allocator.dupe(u8, "");
    const report_json = try report.json(allocator, protected, seed, std.Io.Clock.awake.now(timer.io()).toMilliseconds() - started);
    errdefer allocator.free(report_json);
    return .{
        .protected_sources = protected,
        .jsd_runtime = separate,
        .random_seed = seed,
        .protection_summary = report_json,
        .source_maps = if (configuration.source_maps) try map_json.toOwnedSlice(allocator) else null,
        .maps = if (configuration.generate_maps) try declarations_json.toOwnedSlice(allocator) else null,
    };
}

test "default native pipeline emits an executable concealed string runtime" {
    const allocator = std.testing.allocator;
    var configuration = config.defaults(allocator);
    defer configuration.deinit();
    configuration.random_seed = 1;
    const result = try protect(
        allocator,
        &.{.{ .source_code = "function greet(name){return 'hello '+name;}console.log(greet('world'));" }},
        &configuration,
        .{ .minify = true },
    );
    defer result.deinit(allocator);
    try runJavaScript(allocator, result.protected_sources, result.jsd_runtime, "hello world\n");
    try std.testing.expect(std.mem.indexOf(u8, result.protected_sources[0], "hello ") == null);
}

test "all core passes compose and all runtime injection modes execute" {
    const allocator = std.testing.allocator;
    var configuration = config.defaults(allocator);
    defer configuration.deinit();
    configuration.random_seed = 42;
    configuration.runtime_injection.options = .no_eval;
    configuration.settings = .{
        .debugger_removal = .{ .enabled = {} },
        .function_reorder = .{ .enabled = .{ .randomize = true } },
        .control_flow = .{ .enabled = .{ .randomize = true, .inject_fake_code = true } },
        .expr_sequence = .{ .enabled = {} },
        .boolean_literals = .{ .enabled = .{ .randomize = true } },
        .constant_argument = .{ .enabled = {} },
        .property_sparsing = .{ .enabled = {} },
        .variable_grouping = .{ .enabled = {} },
        .property_indirection = .{ .enabled = {} },
        .integer_literals = .{ .enabled = .{ .randomize = true, .lower = 0, .upper = 65535 } },
        .global_object_hiding = .{ .enabled = .{} },
        .string_literals = .{ .enabled = {} },
        .local_declarations = .{ .enabled = .{ .name_mangling = .base62 } },
        .self_defending = .{ .enabled = .{ .level = 1 } },
    };
    const source = "debugger;function add(a,b){return a+b;}var result={value:0};for(var i=0;i<3;i++){if(i===1)continue;result.value+=add(5,i);}console.log('sum',result.value,true);";
    inline for (.{ config.RuntimeMode.first_non_module, .separate_source, .all }) |mode| {
        configuration.runtime_injection.mode = mode;
        configuration.runtime_file = if (mode == .separate_source) "runtime.js" else null;
        const result = try protect(allocator, &.{.{ .source_code = source }}, &configuration, .{});
        defer result.deinit(allocator);
        try runJavaScript(allocator, result.protected_sources, result.jsd_runtime, "sum 12 true\n");
    }
}

test "shared source names and independent runtimes compose" {
    const allocator = std.testing.allocator;
    var configuration = config.defaults(allocator);
    defer configuration.deinit();
    configuration.random_seed = 7;
    const sources: []const SourceInfo = &.{
        .{ .source_code = "var shared=3;function add(a){return shared+a;}" },
        .{ .source_code = "var other=4;console.log('shared',add(other),{shared}.shared);" },
    };
    inline for (.{ config.RuntimeMode.first_non_module, .separate_source, .all }) |mode| {
        configuration.runtime_injection.mode = mode;
        configuration.runtime_file = if (mode == .separate_source) "runtime.js" else null;
        const result = try protect(allocator, sources, &configuration, .{ .minify = true });
        defer result.deinit(allocator);
        try runJavaScript(allocator, result.protected_sources, result.jsd_runtime, "shared 7 3\n");
    }
}

test "inline enabled child overrides disabled parent across passes" {
    const allocator = std.testing.allocator;
    var configuration = config.defaults(allocator);
    defer configuration.deinit();
    configuration.random_seed = 19;
    configuration.runtime_injection.options = .no_eval;
    const source =
        "'use strict';'@jsdefender off';var retained=5;" ++
        "function selected(input){'@pjsd {stringLiterals:true,localDeclarations:{nameMangling:\"hexadecimal\"},integerLiterals:true,booleanLiterals:true,exprSequence:true}';" ++
        "var privateName='concealed';return [privateName,input+1,true].join(':');}" ++
        "console.log('visible',retained,selected(2));";
    const result = try protect(allocator, &.{.{ .source_code = source }}, &configuration, .{});
    defer result.deinit(allocator);
    try runJavaScript(allocator, result.protected_sources, result.jsd_runtime, "visible 5 concealed:3:true\n");
    try std.testing.expect(std.mem.indexOf(u8, result.protected_sources[0], "@pjsd") == null);
    try std.testing.expect(std.mem.indexOf(u8, result.protected_sources[0], "privateName") == null);
    try std.testing.expect(std.mem.indexOf(u8, result.protected_sources[0], "retained") != null);
    try std.testing.expect(std.mem.indexOf(u8, result.protected_sources[0], "visible") != null);
    try std.testing.expect(std.mem.indexOf(u8, result.protected_sources[0], "concealed") == null);
    var parsed = try parser.parse(allocator, result.protected_sources[0], .{});
    defer parsed.deinit();
    const first = parsed.extra(parsed.data(parsed.root).program.body)[0];
    try std.testing.expectEqualStrings("use strict", parsed.string(parsed.data(first).directive.value));
}

test "module only sources require a separately placed runtime" {
    const allocator = std.testing.allocator;
    var configuration = config.defaults(allocator);
    defer configuration.deinit();
    configuration.random_seed = 1;
    try std.testing.expectError(
        error.RuntimeFileRequired,
        protect(
            allocator,
            &.{.{ .source_code = "export const message='hello';", .is_module = true }},
            &configuration,
            .{},
        ),
    );
    const implicit = try protect(
        allocator,
        &.{.{ .source_code = "export const message='hello';" }},
        &configuration,
        .{ .minify = true },
    );
    defer implicit.deinit(allocator);
    try std.testing.expect(implicit.protected_sources[0].len > 1000);
    configuration.runtime_injection.mode = .all;
    const result = try protect(
        allocator,
        &.{.{ .source_code = "export const message='hello';", .is_module = true }},
        &configuration,
        .{},
    );
    defer result.deinit(allocator);
    try std.testing.expect(result.protected_sources[0].len > 1000);
}

test "explicit self defence inside ordinary expressions follows child policy" {
    const allocator = std.testing.allocator;
    var configuration = config.defaults(allocator);
    defer configuration.deinit();
    configuration.random_seed = 1;
    configuration.runtime_injection.options = .no_eval;
    configuration.settings = config.Settings.allOff();
    configuration.settings.self_defending = .{ .enabled = .{ .level = 0 } };
    const result = try protect(
        allocator,
        &.{
            .{
                .source_code = "const outer=function(){function inner(){'@jsdefender {selfDefending:true}';return 42;}return inner();};console.log(outer());",
            },
        },
        &configuration,
        .{ .minify = true },
    );
    defer result.deinit(allocator);
    try runJavaScript(allocator, result.protected_sources, result.jsd_runtime, "42\n");
    try std.testing.expect(std.mem.indexOf(u8, result.protected_sources[0], "eval(") != null);
}

test "ES5 runtime follows upstream hardcoded lexical string decoder" {
    const allocator = std.testing.allocator;
    var configuration = config.defaults(allocator);
    defer configuration.deinit();
    configuration.random_seed = 1;
    configuration.es_target = .es5;
    configuration.settings.self_defending = .{ .enabled = .{} };
    inline for (.{ config.RuntimeOption.no_eval, .self_defending }) |option| {
        configuration.runtime_injection.options = option;
        const result = try protect(
            allocator,
            &.{.{ .source_code = "(function(){console.log('ES5',42);})();" }},
            &configuration,
            .{ .minify = true },
        );
        defer result.deinit(allocator);
        try runJavaScript(allocator, result.protected_sources, result.jsd_runtime, "ES5 42\n");
        var parsed = try parser.parse(allocator, result.protected_sources[0], .{});
        defer parsed.deinit();
        const Visitor = struct {
            lexical: bool = false,

            pub fn enter_variable_declaration(
                self: *@This(),
                declaration: ast.VariableDeclaration,
                _: ast.NodeIndex,
                _: *parser.traverser.basic.Ctx,
            ) parser.traverser.Action {
                self.lexical = self.lexical or declaration.kind != .@"var";
                return .proceed;
            }
        };
        var visitor: Visitor = .{};
        try parser.traverser.basic.traverse(Visitor, &parsed, &visitor);
        // Module 8676 hardcodes let/const in its decoder even for ES5.
        // With runtime encryption those declarations live inside eval text.
        if (option == .no_eval) try std.testing.expect(visitor.lexical);
    }
}

test "independent runtime locks use their own source settings" {
    const allocator = std.testing.allocator;
    var configuration = config.defaults(allocator);
    defer configuration.deinit();
    configuration.random_seed = 3;
    configuration.runtime_injection = .{ .mode = .all, .options = .no_eval };
    try configuration.named_sets.put(
        configuration.allocator(),
        "dated",
        .{ .date_lock = .{ .enabled = .{ .start_date = "2000-01-01", .end_date = "2100-01-01" } } },
    );
    configuration.source_sets = &.{"dated"};
    const result = try protect(allocator, &.{
        .{ .source_code = "console.log('date');" },

        .{
            .source_code = "'@pjsd {constantArgument:true}';function plus(a,b){return a+b;}console.log('guard',plus(3,4));",
        },
    }, &configuration, .{ .minify = true });
    defer result.deinit(allocator);
    try runJavaScript(allocator, result.protected_sources, result.jsd_runtime, "date\nguard 7\n");
}

test "script defined eval is resolved across sources and global only pass allows native eval" {
    const allocator = std.testing.allocator;
    var configuration = config.defaults(allocator);
    defer configuration.deinit();
    configuration.random_seed = 1;
    const result = try protect(allocator, &.{
        .{ .source_code = "function eval(x){return x+1;}" },
        .{ .source_code = "console.log(eval(3));" },
    }, &configuration, .{ .minify = true });
    defer result.deinit(allocator);
    try runJavaScript(allocator, result.protected_sources, result.jsd_runtime, "4\n");
    configuration.settings = config.Settings.allOff();
    configuration.settings.global_object_hiding = .{ .enabled = .{} };
    const global_result = try protect(
        allocator,
        &.{.{ .source_code = "let x=3;console.log(eval('x'));with({x:4}){console.log(x);}" }},
        &configuration,
        .{ .minify = true },
    );
    defer global_result.deinit(allocator);
    try runJavaScript(allocator, global_result.protected_sources, global_result.jsd_runtime, "3\n4\n");
}

test "all eighteen configured stages execute with allowed locks" {
    const allocator = std.testing.allocator;
    const json = try std.json.parseFromSlice(std.json.Value, allocator,
        \\{"randomSeed":42,"settings":{"debuggerRemoval":true,"domainLock":{"domainPattern":"example.com"},"dateLock":{"startDate":"2000-01-01","endDate":"2100-01-01"},"devToolsBlocking":{"patience":0},"consoleCloaking":{"exclude":["log"]},"functionReorder":{"randomize":true},"controlFlow":{"randomize":true,"injectFakeCode":true},"exprSequence":true,"booleanLiterals":{"randomize":true},"constantArgument":true,"propertySparsing":true,"variableGrouping":true,"propertyIndirection":true,"integerLiterals":{"randomize":true,"upper":65535},"globalObjectHiding":true,"stringLiterals":true,"localDeclarations":{"nameMangling":"base62"},"selfDefending":true}}
    , .{});
    defer json.deinit();
    var configuration = try config.parse(allocator, json.value);
    defer configuration.deinit();
    const source = "(function(){debugger;function add(a,b){return a+b;}var result={value:0};for(var i=0;i<3;i++){if(i===1)continue;result.value+=add(5,i);}console.log('sum',result.value,true);})();";
    const result = try protect(allocator, &.{.{ .source_code = source }}, &configuration, .{ .minify = true });
    defer result.deinit(allocator);
    try runJavaScript(
        allocator,
        &.{
            "globalThis.document={domain:'example.com'};Date.now=function(){return 1791936000000;};globalThis.setTimeout=function(){return 0;};",

            result.protected_sources[0],
        },
        null,
        "sum 12 true\n",
    );
}

fn runJavaScript(
    allocator: std.mem.Allocator,
    sources: []const []const u8,
    separate: ?[]const u8,
    expected: []const u8,
) !void {
    var text: std.ArrayList(u8) = .empty;
    defer text.deinit(allocator);
    if (separate) |source| try text.appendSlice(allocator, source);
    for (sources) |source| {
        try text.append(allocator, '\n');
        try text.appendSlice(allocator, source);
    }
    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const io = threaded.io();
    var temporary = std.testing.tmpDir(.{});
    defer temporary.cleanup();
    var file = try temporary.dir.createFile(io, "pipeline.js", .{});
    try file.writeStreamingAll(io, text.items);
    file.close(io);
    const path = try temporary.dir.realPathFileAlloc(io, "pipeline.js", allocator);
    defer allocator.free(path);
    const result = try std.process.run(
        allocator,
        io,
        .{ .argv = &.{ "bun", path }, .timeout = .{ .duration = .{ .raw = .fromSeconds(10), .clock = .awake } } },
    );
    defer allocator.free(result.stdout);
    defer allocator.free(result.stderr);
    if (result.stderr.len != 0) std.debug.print("{s}\n", .{result.stderr});
    try std.testing.expectEqualStrings(expected, result.stdout);
    try std.testing.expectEqualStrings("", result.stderr);
}

//! LocalDeclarationTransform (3557) and GlobalObjectHidigTransform (4131).
//! Scope and reference ownership comes from yuku; global hiding delegates
//! property initialization and builtins to the shared JSDefender runtime.

const std = @import("std");
const parser = @import("parser");
const scalars = @import("scalars.zig");
const Policy = @import("policy.zig").Policy;
const regex_module = @import("regex.zig");
const lexical = @import("lexical.zig");
const ast = parser.ast;
const Semantic = parser.semantic.Semantic;
const Allocator = std.mem.Allocator;
const no_span: ast.Span = .{ .start = 0, .end = 0 };

pub const RuntimeError = Allocator.Error || error{RuntimeUnavailable};
pub const Error = RuntimeError || regex_module.Error || error{
    AnalysisFailed,
    UnsafeEval,
    UnsafeWith,
    UnsupportedLanguage,
    MissingRuntime,
};

pub const ReferenceFilter = struct {
    context: *anyopaque,
    skip: *const fn (*anyopaque, ast.NodeIndex) bool,
};

pub const LocalOptions = struct {
    mode: scalars.NameMode = .sequential,
    exclude_ids: []const []const u8 = &.{},
    id_offset: u32 = 0,
    id_base: u32 = 0,
    preserve_root_ids: bool = false,
    protector_name: ?[]const u8 = null,
    ignore_unsafe_constructs: bool = false,
    policy: ?*const Policy = null,
    skip_unresolved: ?ReferenceFilter = null,
    mapped_node_limit: ?usize = null,
    scope_graph: ?*lexical.Graph = null,
    source_policies: ?[]const Policy = null,
};

pub const GlobalOptions = struct {
    use_predefined: bool = true,
    include: []const []const u8 = &.{},
    exclude: []const []const u8 = &.{},
    policy: ?*const Policy = null,
    skip_unresolved: ?ReferenceFilter = null,
    allow_generated_errors: bool = false,
};

pub const GlobalRuntime = struct {
    context: *anyopaque,
    protector_name: []const u8,
    require_helper: *const fn (*anyopaque, []const u8) RuntimeError![]const u8,
    init_property: *const fn (*anyopaque, *ast.Tree, []const u8, ast.NodeIndex) RuntimeError![]const u8,
};

pub const Options = struct {
    local_declarations: ?LocalOptions = null,
    global_object_hiding: ?GlobalOptions = null,
    runtime: ?GlobalRuntime = null,
};

pub fn apply(allocator: Allocator, tree: *ast.Tree, options: Options, random: *scalars.Random) Error!void {
    if (options.local_declarations) |local| try applyLocal(allocator, tree, local, random);
    if (options.global_object_hiding) |global| try applyGlobal(allocator, tree, global, options.runtime);
}

fn analyze(tree: *ast.Tree, allow_generated_errors: bool) Error!Semantic {
    if (tree.lang != .js) return error.UnsupportedLanguage;
    if (!allow_generated_errors and tree.hasErrors()) return error.AnalysisFailed;
    const semantic = try parser.semantic.analyze(tree);
    if (!allow_generated_errors and tree.hasErrors()) return error.AnalysisFailed;
    return semantic;
}

fn preflight(
    tree: *ast.Tree,
    semantic: Semantic,
    selection: ?*const Policy,
    comptime setting: []const u8,
    filter: ?ReferenceFilter,
    check_eval: bool,
) Error!void {
    for (0..semantic.node_parents.len) |i| {
        const node: ast.NodeIndex = @fromBackingInt(@intCast(i));
        if (node != tree.root and semantic.parentOf(node) == null) continue;
        if (tree.data(node) == .with_statement and (if (selection) |policy| policy.isEnabled(node, setting) else true))
            return error.UnsafeWith;
    }
    if (!check_eval) return;
    for (semantic.references) |reference| {
        if (reference.symbol != .none or !std.mem.eql(u8, tree.string(reference.name), "eval")) continue;
        if (filter) |value| if (value.skip(value.context, reference.node)) continue;
        const parent = expressionParent(tree, semantic, reference.node) orelse continue;
        if (selection) |policy| if (!policy.isEnabled(parent, setting)) continue;
        if (tree.data(parent) == .call_expression) {
            const call = tree.data(parent).call_expression;
            if (unwrapParens(tree, call.callee) == reference.node) return error.UnsafeEval;
        }
    }
}

fn localOptionsFor(options: LocalOptions, node: ast.NodeIndex) ?LocalOptions {
    if (options.policy) |policy| {
        const selection = policy.settingsFor(node).local_declarations.get() orelse return null;
        var selected = options;
        selected.mode = selection.name_mangling;
        selected.exclude_ids = selection.exclude_ids;
        return selected;
    }
    return options;
}

fn globalOptionsFor(options: GlobalOptions, node: ast.NodeIndex) ?GlobalOptions {
    if (options.policy) |policy| {
        const selection = policy.settingsFor(node).global_object_hiding.get() orelse return null;
        return .{ .use_predefined = selection.use_predefined, .include = selection.include, .exclude = selection.exclude };
    }
    return options;
}

fn unwrapParens(tree: *const ast.Tree, original: ast.NodeIndex) ast.NodeIndex {
    var node = original;
    while (tree.data(node) == .parenthesized_expression) node = tree.data(node).parenthesized_expression.expression;
    return node;
}

fn expressionParent(tree: *const ast.Tree, semantic: Semantic, original: ast.NodeIndex) ?ast.NodeIndex {
    var node = original;
    while (semantic.parentOf(node)) |parent| {
        if (tree.data(parent) != .parenthesized_expression) return parent;
        node = parent;
    }
    return null;
}

const reserved_words = [_][]const u8{
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "export",
    "extends",
    "finally",
    "for",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "new",
    "return",
    "super",
    "switch",
    "this",
    "throw",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "yield",
    "enum",
    "implements",
    "interface",
    "let",
    "package",
    "private",
    "protected",
    "public",
    "static",
    "abstract",
    "boolean",
    "byte",
    "char",
    "double",
    "final",
    "float",
    "goto",
    "int",
    "long",
    "native",
    "short",
    "synchronized",
    "throws",
    "transient",
    "volatile",
};

const Names = struct {
    allocator: Allocator,
    values: std.StringHashMapUnmanaged(void) = .empty,

    fn deinit(self: *Names) void {
        var keys = self.values.keyIterator();
        while (keys.next()) |key| self.allocator.free(key.*);
        self.values.deinit(self.allocator);
    }

    fn reserve(self: *Names, text: []const u8) Allocator.Error!void {
        const owned = try self.allocator.dupe(u8, text);
        errdefer self.allocator.free(owned);
        const entry = try self.values.getOrPut(self.allocator, owned);
        if (entry.found_existing) self.allocator.free(owned);
    }

    fn generate(self: *Names, id: u32, mode: scalars.NameMode) Allocator.Error![]const u8 {
        const base = try scalars.mangleName(self.allocator, id, mode);
        defer self.allocator.free(base);
        var suffix: usize = 0;
        while (true) : (suffix += 1) {
            const candidate = if (suffix == 0)
                try self.allocator.dupe(u8, base)
            else
                try std.fmt.allocPrint(self.allocator, "{s}${d}", .{ base, suffix });
            errdefer self.allocator.free(candidate);
            const entry = try self.values.getOrPut(self.allocator, candidate);
            if (!entry.found_existing) return candidate;
            self.allocator.free(candidate);
        }
    }
};

fn contains(names: []const []const u8, name: []const u8) bool {
    for (names) |candidate| if (std.mem.eql(u8, candidate, name)) return true;
    return false;
}

const Exclusions = struct {
    allocator: Allocator,
    exact: std.ArrayList([]const u8) = .empty,
    patterns: std.ArrayList(regex_module.Regex) = .empty,

    fn init(allocator: Allocator, values: []const []const u8) Error!Exclusions {
        var self = Exclusions{ .allocator = allocator };
        errdefer self.deinit();
        for (values) |value| {
            const text = std.mem.trim(u8, value, " \t\r\n");
            if (std.mem.startsWith(u8, text, "r:")) {
                const pattern = regex_module.Regex.compile(text[2..]) catch |err| switch (err) {
                    error.InvalidPattern => break, // One upstream try/catch owns the entire ordered list.
                    else => return err,
                };
                self.patterns.append(allocator, pattern) catch |err| {
                    pattern.deinit();
                    return err;
                };
            } else try self.exact.append(allocator, text);
        }
        return self;
    }

    fn deinit(self: *Exclusions) void {
        for (self.patterns.items) |pattern| pattern.deinit();
        self.patterns.deinit(self.allocator);
        self.exact.deinit(self.allocator);
    }

    fn matches(self: *const Exclusions, name: []const u8) Error!bool {
        if (contains(self.exact.items, "*") or contains(self.exact.items, name)) return true;
        for (self.patterns.items) |pattern| if (try pattern.matches(self.allocator, name)) return true;
        return false;
    }
};

fn isTopLevel(semantic: Semantic, symbol: parser.traverser.semantic.Symbol) bool {
    return switch (semantic.scope(symbol.scope).kind) {
        .global, .module => true,
        else => false,
    };
}

const IdCollector = struct {
    semantic: Semantic,
    ids: []u32,
    next: u32,
    preserve_root_ids: bool = false,
    next_root: u32 = 0,
    mapped_node_limit: ?usize = null,

    pub fn enter_node(
        self: *IdCollector,
        data: ast.NodeData,
        index: ast.NodeIndex,
        ctx: *parser.traverser.transform.Ctx,
    ) Allocator.Error!parser.traverser.Action {
        if (self.mapped_node_limit) |limit| if (@backingInt(index) >= limit) return .skip;
        switch (data) {
            .export_named_declaration => |value| if (value.declaration != .null) {
                return .skip;
            },
            .binding_identifier => {
                const symbol_id = self.semantic.symbolOf(index) orelse return .proceed;
                const symbol = self.semantic.symbol(symbol_id);
                if (symbol.flags.import or symbol.flags.type_import) return .proceed;
                const slot = &self.ids[@backingInt(symbol_id)];
                if (slot.* == std.math.maxInt(u32)) {
                    if (self.preserve_root_ids and isTopLevel(self.semantic, symbol)) {
                        slot.* = self.next_root;
                        self.next_root += 1;
                    } else {
                        slot.* = self.next;
                        self.next += 1;
                    }
                }
            },
            .method_definition => |method| {
                if (ctx.tree.data(method.key) == .identifier_name or ctx.tree.data(method.key) == .identifier_reference)
                    self.next += 1;
            },
            .object_property => |property| {
                if (property.method and (ctx.tree.data(property.key) == .identifier_name or ctx.tree.data(property.key) == .identifier_reference))
                    self.next += 1;
            },
            else => {},
        }
        return .proceed;
    }
};

pub fn declarationCount(allocator: Allocator, tree: *ast.Tree) Error!u32 {
    const semantic = try analyze(tree, false);
    const ids = try allocator.alloc(u32, semantic.symbols.len);
    defer allocator.free(ids);
    @memset(ids, std.math.maxInt(u32));
    var collector = IdCollector{ .semantic = semantic, .ids = ids, .next = 0 };
    try parser.traverser.transform.traverse(IdCollector, tree, &collector);
    return collector.next;
}

pub fn isIgnoredNamedExport(tree: *const ast.Tree, semantic: Semantic, index: ast.NodeIndex) bool {
    var current: ?ast.NodeIndex = index;
    while (current) |node| {
        if (tree.data(node) == .export_named_declaration and tree.data(node).export_named_declaration.declaration != .null)
            return true;
        current = semantic.parentOf(node);
    }
    return false;
}

fn expandShorthand(tree: *ast.Tree, semantic: Semantic, index: ast.NodeIndex) void {
    var parent = semantic.parentOf(index) orelse return;
    if (tree.data(parent) == .assignment_pattern) parent = semantic.parentOf(parent) orelse return;
    switch (tree.data(parent)) {
        .object_property => |old| {
            if (old.shorthand and !old.computed) {
                var property = old;
                property.shorthand = false;
                tree.setData(parent, .{ .object_property = property });
            }
        },
        .binding_property => |old| {
            if (old.shorthand and !old.computed) {
                var property = old;
                property.shorthand = false;
                tree.setData(parent, .{ .binding_property = property });
            }
        },
        else => {},
    }
}

pub fn renameNode(tree: *ast.Tree, semantic: Semantic, index: ast.NodeIndex, name: ast.String) void {
    if (semantic.parentOf(index)) |parent| if (tree.data(parent) == .formal_parameter) {
        tree.setSpan(parent, @import("nodes.zig").detached_span);
    };
    expandShorthand(tree, semantic, index);
    switch (tree.data(index)) {
        .binding_identifier => |old| {
            var identifier = old;
            identifier.name = name;
            tree.setData(index, .{ .binding_identifier = identifier });
        },
        .identifier_reference => tree.setData(index, .{ .identifier_reference = .{ .name = name } }),
        else => {},
    }
}

pub fn applyLocal(
    allocator: Allocator,
    tree: *ast.Tree,
    options: LocalOptions,
    random: *scalars.Random,
) Error!void {
    _ = random; // The shared pipeline supplies its one sampled id_offset.
    const initial = try analyze(tree, options.scope_graph != null);
    var exclusions = try Exclusions.init(allocator, options.exclude_ids);
    defer exclusions.deinit();
    if (!options.ignore_unsafe_constructs) try preflight(
        tree,
        initial,
        options.policy,
        "local_declarations",
        options.skip_unresolved,
        options.scope_graph == null,
    );
    const semantic = try analyze(tree, options.scope_graph != null);
    if (options.scope_graph) |graph| {
        var names = Names{ .allocator = allocator };
        defer names.deinit();
        for (reserved_words) |name| try names.reserve(name);
        var renamed: std.AutoHashMapUnmanaged(ast.NodeIndex, void) = .empty;
        defer renamed.deinit(allocator);
        try renameScope(tree, semantic, graph.root, options, &exclusions, &names, &renamed);
        try renameLabels(allocator, tree, semantic, options);
        return;
    }
    const ids = try allocator.alloc(u32, semantic.symbols.len);
    defer allocator.free(ids);
    @memset(ids, std.math.maxInt(u32));
    var collector = IdCollector{
        .semantic = semantic,
        .ids = ids,
        .next = options.id_base,
        .preserve_root_ids = options.preserve_root_ids,
        .mapped_node_limit = options.mapped_node_limit,
    };
    try parser.traverser.transform.traverse(IdCollector, tree, &collector);

    var names = Names{ .allocator = allocator };
    defer names.deinit();
    for (reserved_words) |name| try names.reserve(name);
    for (semantic.symbols, 0..) |symbol, i| {
        if (symbol.flags.class or symbol.flags.import or symbol.flags.type_import or !symbol.flags.inValueSpace()) continue;
        const old_name = tree.string(symbol.name);
        if (options.protector_name) |protector| if (std.mem.eql(u8, protector, old_name)) continue;
        const symbol_id: parser.traverser.semantic.SymbolId = @fromBackingInt(@intCast(i));
        const declarations = semantic.decls(symbol_id);
        if (declarations.len == 0) continue;
        const selected = localOptionsFor(options, declarations[0]) orelse continue;
        if (isTopLevel(semantic, symbol) and try exclusions.matches(old_name)) continue;
        if (ids[i] == std.math.maxInt(u32)) continue;
        const generated = try names.generate(ids[i] + options.id_offset, selected.mode);
        const new_name = try tree.addString(generated);
        for (semantic.decls(symbol_id)) |node| {
            renameNode(tree, semantic, node, new_name);
            if (options.preserve_root_ids) try @import("lexical_location.zig").markAbsent(tree, node);
        }
        for (semantic.uses(symbol_id)) |ref_id| {
            const node = semantic.reference(ref_id).node;
            if (options.mapped_node_limit) |limit| if (@backingInt(node) >= limit) continue;
            renameNode(tree, semantic, node, new_name);
            if (options.preserve_root_ids) try @import("lexical_location.zig").markAbsent(tree, node);
        }
    }
    try renameLabels(allocator, tree, semantic, options);
}

fn renameScope(
    tree: *ast.Tree,
    semantic: Semantic,
    scope: *lexical.Scope,
    options: LocalOptions,
    exclusions: *const Exclusions,
    names: *Names,
    renamed: *std.AutoHashMapUnmanaged(ast.NodeIndex, void),
) Error!void {
    for (scope.declarations.values()) |declaration| {
        if (declaration.kind == .ClassDeclaration or declaration.kind == .ClassMethod) continue;
        var declaration_options = options;
        if (options.source_policies) |policies| declaration_options.policy = &policies[declaration.tree_id];
        const selected = localOptionsFor(declaration_options, declaration.node) orelse continue;
        if (scope.parent == null and try exclusions.matches(declaration.name)) continue;
        if (options.protector_name) |protector| if (std.mem.eql(u8, protector, declaration.name)) continue;
        const previously_named = declaration.mangled_name != null;
        if (previously_named and declaration.tree != tree) continue;
        const mode = if (declaration.tree == tree) selected.mode else scalars.NameMode.sequential;
        declaration.mangled_name = try options.scope_graph.?.arena.allocator().dupe(
            u8,
            try names.generate(declaration.global_id + options.id_offset, mode),
        );
        if (!previously_named or declaration.tree_id == options.scope_graph.?.tree_id)
            @import("summary.zig").count(16, 1);
    }
    for (scope.references.items) |reference| {
        const declaration = reference.declaration.?;
        const name = declaration.mangled_name orelse continue;
        const entry = try renamed.getOrPut(names.allocator, reference.node);
        const parent = semantic.parentOf(reference.node);
        const shorthand = if (parent) |owner| switch (tree.data(owner)) {
            inline .object_property, .binding_property => |v| v.shorthand and !v.computed,
            .assignment_pattern => if (semantic.parentOf(owner)) |grandparent| switch (tree.data(grandparent)) {
                .binding_property => |v| v.shorthand and !v.computed,
                else => false,
            } else false,
            else => false,
        } else false;
        if (!shorthand) @import("summary.zig").count(16, 1);
        if (entry.found_existing) continue;
        renameNode(tree, semantic, reference.node, try tree.addString(name));
    }
    for (scope.nested.items) |child| try renameScope(tree, semantic, child, options, exclusions, names, renamed);
}

fn renameLabels(
    allocator: Allocator,
    tree: *ast.Tree,
    semantic: Semantic,
    options: LocalOptions,
) Error!void {
    _ = semantic;
    var label_names = Names{ .allocator = allocator };
    defer label_names.deinit();
    var labels = LabelVisitor{ .allocator = allocator, .names = &label_names, .options = options };
    defer labels.stack.deinit(allocator);
    defer labels.boundaries.deinit(allocator);
    try parser.traverser.transform.traverse(LabelVisitor, tree, &labels);
}

const LabelVisitor = struct {
    allocator: Allocator,
    names: *Names,
    options: LocalOptions,
    next_id: u32 = 0,
    stack: std.ArrayList(struct {
        old: ast.String,
        new: ast.String,
    }) = .empty,
    boundaries: std.ArrayList(usize) = .empty,

    pub fn enter_node(
        self: *LabelVisitor,
        data: ast.NodeData,
        index: ast.NodeIndex,
        ctx: *parser.traverser.transform.Ctx,
    ) Allocator.Error!parser.traverser.Action {
        switch (data) {
            .function, .arrow_function_expression => try self.boundaries.append(self.allocator, self.stack.items.len),
            .labeled_statement => |statement| {
                const old = ctx.tree.data(statement.label).label_identifier.name;
                const id = self.next_id + self.options.id_offset;
                self.next_id += 1;
                const new = if (localOptionsFor(self.options, index)) |selected|
                    try ctx.tree.addString(try self.names.generate(id, selected.mode))
                else
                    old;
                try self.stack.append(self.allocator, .{ .old = old, .new = new });
                ctx.tree.setData(statement.label, .{ .label_identifier = .{ .name = new } });
            },
            .break_statement => |statement| self.renameTarget(ctx.tree, statement.label),
            .continue_statement => |statement| self.renameTarget(ctx.tree, statement.label),
            else => {},
        }
        return .proceed;
    }

    fn renameTarget(self: *LabelVisitor, tree: *ast.Tree, label: ast.NodeIndex) void {
        if (label == .null) return;
        const old = tree.data(label).label_identifier.name;
        const boundary = if (self.boundaries.items.len == 0) 0 else self.boundaries.items[self.boundaries.items.len - 1];
        var i = self.stack.items.len;
        while (i > boundary) {
            i -= 1;
            const entry = self.stack.items[i];
            if (std.mem.eql(u8, tree.string(old), tree.string(entry.old))) {
                tree.setData(label, .{ .label_identifier = .{ .name = entry.new } });
                return;
            }
        }
    }

    pub fn exit_node(
        self: *LabelVisitor,
        data: ast.NodeData,
        _: ast.NodeIndex,
        _: *parser.traverser.transform.Ctx,
    ) void {
        switch (data) {
            .labeled_statement => {
                _ = self.stack.pop();
            },
            .function, .arrow_function_expression => {
                _ = self.boundaries.pop();
            },
            else => {},
        }
    }
};

const unbound_predefined = [_][]const u8{
    "window",
    "console",
    "document",
    "history",
    "location",
    "navigator",
    "origin",
    "parent",
    "performance",
    "screen",
    "self",
    "Object",
    "Function",
    "Boolean",
    "Symbol",
    "Number",
    "BigInt",
    "Math",
    "Date",
    "String",
    "RegExp",
    "Array",
    "Int8Array",
    "Uint8Array",
    "Uint8ClampedArray",
    "Int16Array",
    "Uint16Array",
    "Int32Array",
    "Uint32Array",
    "Float32Array",
    "Float64Array",
    "BigInt64Array",
    "BigUint64Array",
    "Map",
    "Set",
    "WeakMap",
    "WeakSet",
    "ArrayBuffer",
    "SharedArrayBuffer",
    "JSON",
    "Promise",
};

const bound_predefined = [_][]const u8{
    "alert",
    "clearImmediate",
    "clearInterval",
    "clearTimeout",
    "setInterval",
    "setTimeout",
    "isFinite",
    "isNaN",
    "parseFloat",
    "parseInt",
    "encodeURI",
    "encodeURIComponent",
    "decodeURI",
    "decodeURIComponent",
};

fn globalBinding(name: []const u8, options: GlobalOptions) ?bool {
    if (contains(options.exclude, name)) return null;
    var bound: ?bool = null;
    if (options.use_predefined) {
        if (contains(&unbound_predefined, name)) bound = false;
        if (contains(&bound_predefined, name)) bound = true;
    }
    for (options.include) |include| {
        const bind = std.mem.endsWith(u8, include, ":g");
        const included_name = if (bind) std.mem.trim(u8, include[0 .. include.len - 2], " \t\r\n") else include;
        if (std.mem.eql(u8, included_name, name)) bound = bind;
    }
    return bound;
}

pub fn applyGlobal(
    allocator: Allocator,
    tree: *ast.Tree,
    options: GlobalOptions,
    runtime_option: ?GlobalRuntime,
) Error!void {
    const semantic = try analyze(tree, options.allow_generated_errors);
    const Group = struct {
        name: []const u8,
        bound: bool,
        nodes: std.ArrayList(ast.NodeIndex) = .empty,
    };
    var groups: std.StringArrayHashMapUnmanaged(Group) = .empty;
    defer {
        for (groups.keys()) |key| allocator.free(key);
        for (groups.values()) |*group| group.nodes.deinit(allocator);
        groups.deinit(allocator);
    }
    // JSDefender visits each lexical scope's own unresolved list before
    // nested scopes, rather than interleaving references in source order.
    for (semantic.scopes.list, 0..) |_, scope_index| {
        for (semantic.references) |reference| {
            if (@backingInt(reference.scope) != scope_index or reference.symbol != .none or reference.flags.space != .value)
                continue;
            if (options.skip_unresolved) |filter| if (filter.skip(filter.context, reference.node)) continue;
            const selected = globalOptionsFor(options, reference.node) orelse continue;
            const name = tree.string(reference.name);
            const bound = globalBinding(name, selected) orelse continue;
            // Different lexical policies can request bound and unbound
            // access to the same global. Those require distinct getters.
            const owned = try std.fmt.allocPrint(allocator, "{c}{s}", .{ @as(u8, if (bound) '1' else '0'), name });
            const entry = groups.getOrPut(allocator, owned) catch |err| {
                allocator.free(owned);
                return err;
            };
            if (entry.found_existing)
                allocator.free(owned)
            else
                entry.value_ptr.* = .{ .name = owned[1..], .bound = bound };
            try entry.value_ptr.nodes.append(allocator, reference.node);
        }
    }
    if (groups.count() == 0) return;
    const runtime = runtime_option orelse return error.MissingRuntime;
    if (runtime.protector_name.len == 0) return error.RuntimeUnavailable;
    _ = try runtime.require_helper(runtime.context, "getGlobalObject");
    const bind_name = try tree.addString(try runtime.require_helper(runtime.context, "bindToGlobal"));
    const protector_name = try tree.addString(runtime.protector_name);
    for (groups.values(), 0..) |group, ordinal| {
        const original = try tree.addNode(.{ .identifier_reference = .{ .name = try tree.addString(group.name) } }, no_span);
        const result = if (group.bound) try tree.addNode(.{ .call_expression = .{
            .callee = try tree.addNode(.{ .identifier_reference = .{ .name = bind_name } }, no_span),
            .arguments = try tree.addExtra(&.{original}),
            .optional = false,
        } }, no_span) else original;
        const ret = try tree.addNode(.{ .return_statement = .{ .argument = result } }, no_span);
        const function = try tree.addNode(.{ .function = .{
            .type = .function_expression,
            .id = .null,
            .params = try tree.addNode(
                .{ .formal_parameters = .{ .items = .empty, .rest = .null, .kind = .formal_parameters } },
                no_span,
            ),
            .body = try tree.addNode(.{ .function_body = .{ .body = try tree.addExtra(&.{ret}) } }, no_span),
            .generator = false,
            .async = false,
        } }, no_span);
        var key_buffer: [40]u8 = undefined;
        const key = std.fmt.bufPrint(&key_buffer, "globalID{d}", .{ordinal}) catch unreachable;
        const property = try tree.addString(try runtime.init_property(runtime.context, tree, key, function));
        for (group.nodes.items) |node| {
            expandShorthand(tree, semantic, node);
            const object = try tree.addNode(.{ .identifier_reference = .{ .name = protector_name } }, no_span);
            const member = try tree.addNode(.{ .member_expression = .{
                .object = object,
                .property = try tree.addNode(.{ .identifier_name = .{ .name = property } }, no_span),
                .computed = false,
                .optional = false,
            } }, no_span);
            const call = try tree.addNode(.{ .call_expression = .{ .callee = member, .arguments = .empty, .optional = false } }, no_span);
            tree.setData(node, .{ .parenthesized_expression = .{ .expression = call } });
            tree.setSpan(node, @import("nodes.zig").explicit_parentheses_span);
        }
    }
}

fn execute(allocator: Allocator, code: []const u8) ![]u8 {
    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const io = threaded.io();
    var temporary = std.testing.tmpDir(.{});
    defer temporary.cleanup();
    {
        var file = try temporary.dir.createFile(io, "declarations.js", .{});
        defer file.close(io);
        try file.writeStreamingAll(io, code);
    }
    const path = try temporary.dir.realPathFileAlloc(io, "declarations.js", allocator);
    defer allocator.free(path);
    const result = try std.process.run(
        allocator,
        io,
        .{ .argv = &.{ "bun", path }, .timeout = .{ .duration = .{ .raw = .fromSeconds(5), .clock = .awake } } },
    );
    defer allocator.free(result.stderr);
    if (result.term != .exited or result.term.exited != 0) {
        allocator.free(result.stdout);
        return error.ExecutionFailed;
    }
    return result.stdout;
}

test "jsdefender declarations preserve destructuring, shorthand, captures and labels" {
    const allocator = std.testing.allocator;
    var tree = try parser.parse(
        allocator,
        "function f({value=3}){const output={value}; outer:for(let i=0;i<2;i++){if(i)break outer;}return ()=>output.value;} console.log(f({})());",
        .{},
    );
    defer tree.deinit();
    var random = scalars.Random.init(1);
    try applyLocal(allocator, &tree, .{ .mode = .base52 }, &random);
    const generated = try parser.codegen.generate(allocator, &tree, .{});
    defer generated.deinit(allocator);
    const output = try execute(allocator, generated.code);
    defer allocator.free(output);
    try std.testing.expectEqualStrings("3\n", output);
}

test "jsdefender declarations keep import and export interfaces" {
    const allocator = std.testing.allocator;
    var tree = try parser.parse(
        allocator,
        "import {thing as input} from 'pkg'; export const result=()=>({input}); export {input as original};",
        .{},
    );
    defer tree.deinit();
    var random = scalars.Random.init(1);
    try applyLocal(allocator, &tree, .{ .mode = .base62 }, &random);
    const generated = try parser.codegen.generate(allocator, &tree, .{});
    defer generated.deinit(allocator);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "thing as input") != null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "export const result") != null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "input as original") != null);
    var reparsed = try parser.parse(allocator, generated.code, .{});
    defer reparsed.deinit();
    _ = try parser.semantic.analyze(&reparsed);
    try std.testing.expect(!reparsed.hasErrors());
}

test "jsdefender declarations match oracle method pseudo-binding IDs" {
    const allocator = std.testing.allocator;
    var tree = try parser.parse(allocator, "const obj={method(p){return p;}};let last=2;", .{});
    defer tree.deinit();
    var random = scalars.Random.init(1);
    try applyLocal(allocator, &tree, .{}, &random);
    const generated = try parser.codegen.generate(allocator, &tree, .{});
    defer generated.deinit(allocator);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "const _0x000000") != null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "method(_0x000002)") != null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "let _0x000003") != null);
}

test "jsdefender declarations reject dynamic scopes and preserve regexp exclusions" {
    const allocator = std.testing.allocator;
    var random = scalars.Random.init(1);
    var eval_tree = try parser.parse(allocator, "function f(){let x=1;return (eval)('x');}", .{});
    defer eval_tree.deinit();
    try std.testing.expectError(error.UnsafeEval, applyLocal(allocator, &eval_tree, .{}, &random));
    var with_tree = try parser.parse(allocator, "with (object) { value; }", .{ .source_type = .script });
    defer with_tree.deinit();
    try std.testing.expectError(error.UnsafeWith, applyLocal(allocator, &with_tree, .{}, &random));
    var regex_tree = try parser.parse(allocator, "var x=1,y=2;console.log(x,y);", .{});
    defer regex_tree.deinit();
    try applyLocal(allocator, &regex_tree, .{ .exclude_ids = &.{"r:^x"} }, &random);
    const protected = try parser.codegen.generate(allocator, &regex_tree, .{});
    defer protected.deinit(allocator);
    try std.testing.expect(std.mem.indexOf(u8, protected.code, "x = 1") != null);
    try std.testing.expect(std.mem.indexOf(u8, protected.code, "_0x000001") != null);
}

test "jsdefender declarations require shared global runtime for reads writes and typeof" {
    const allocator = std.testing.allocator;
    var tree = try parser.parse(allocator, "console.log(Math.max(1,2));", .{});
    defer tree.deinit();
    try std.testing.expectError(error.MissingRuntime, applyGlobal(allocator, &tree, .{}, null));
    var write = try parser.parse(allocator, "console=3;", .{});
    defer write.deinit();
    try std.testing.expectError(error.MissingRuntime, applyGlobal(allocator, &write, .{}, null));
    var type_of = try parser.parse(allocator, "typeof window;", .{});
    defer type_of.deinit();
    try std.testing.expectError(error.MissingRuntime, applyGlobal(allocator, &type_of, .{}, null));
}

test "jsdefender declarations global getters use shared properties and binding helper" {
    const Mock = struct {
        helpers: usize = 0,
        properties: usize = 0,
        bound: usize = 0,

        fn helper(context: *anyopaque, name: []const u8) RuntimeError![]const u8 {
            const self: *@This() = @ptrCast(@alignCast(context));
            const expected: []const u8 = if (self.helpers == 0) "getGlobalObject" else "bindToGlobal";
            if (!std.mem.eql(u8, name, expected)) return error.RuntimeUnavailable;
            self.helpers += 1;
            return if (self.helpers == 1) "_getGlobal" else "_bind";
        }

        fn property(context: *anyopaque, tree: *ast.Tree, key: []const u8, function: ast.NodeIndex) RuntimeError![]const u8 {
            const self: *@This() = @ptrCast(@alignCast(context));
            const expected = [_][]const u8{ "globalID0", "globalID1", "globalID2" };
            const names = [_][]const u8{ "first", "second", "third" };
            if (self.properties >= expected.len or !std.mem.eql(u8, key, expected[self.properties])) return error.RuntimeUnavailable;
            const body = tree.data(tree.data(function).function.body).function_body;
            const argument = tree.data(tree.extra(body.body)[0]).return_statement.argument;
            if (tree.data(argument) == .call_expression) self.bound += 1;
            const result = names[self.properties];
            self.properties += 1;
            return result;
        }
    };
    const allocator = std.testing.allocator;
    var tree = try parser.parse(allocator, "console.log(Math.max(1,2));setTimeout(()=>{},1);", .{});
    defer tree.deinit();
    var mock = Mock{};
    try applyGlobal(
        allocator,
        &tree,
        .{},
        .{ .context = &mock, .protector_name = "R", .require_helper = Mock.helper, .init_property = Mock.property },
    );
    try std.testing.expectEqual(@as(usize, 2), mock.helpers);
    try std.testing.expectEqual(@as(usize, 3), mock.properties);
    try std.testing.expectEqual(@as(usize, 1), mock.bound);
    const generated = try parser.codegen.generate(allocator, &tree, .{});
    defer generated.deinit(allocator);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "R.first()") != null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "R.second()") != null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "R.third()") != null);
    var reparsed = try parser.parse(allocator, generated.code, .{});
    defer reparsed.deinit();
    try std.testing.expect(!reparsed.hasErrors());
}

test "jsdefender declarations inherit off and nested default policies" {
    const allocator = std.testing.allocator;
    var tree = try parser.parse(
        allocator,
        "\"@jsdefender off\";let untouched=10;keptLabel:{break keptLabel;}function preserve(){\"@jsdefender off\";let inner=2;return eval('inner');}function f(p){\"@jsdefender default\";let value=p+untouched;outer:for(let i=0;i<2;i++){if(i)break outer;}return ()=>({value});}console.log(f(5)().value,preserve(),untouched);",
        .{},
    );
    defer tree.deinit();
    var configuration = @import("config.zig").defaults(allocator);
    defer configuration.deinit();
    var policy = try Policy.init(allocator, &tree, &configuration, 0);
    defer policy.deinit();
    var random = scalars.Random.init(1);
    try applyLocal(allocator, &tree, .{ .policy = &policy }, &random);
    const generated = try parser.codegen.generate(allocator, &tree, .{});
    defer generated.deinit(allocator);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "let untouched") != null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "function preserve") != null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "let inner") != null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "keptLabel:") != null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "outer:") == null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "function f(") == null);
    const output = try execute(allocator, generated.code);
    defer allocator.free(output);
    try std.testing.expectEqualStrings("15 2 10\n", output);
}

test "jsdefender declarations custom inline hexadecimal mode matches oracle" {
    const allocator = std.testing.allocator;
    var tree = try parser.parse(
        allocator,
        "\"@jsdefender off\";function f(p){\"@jsdefender {localDeclarations:{nameMangling:'hexadecimal'}}\";const x=p;return x;}console.log(f(5));",
        .{},
    );
    defer tree.deinit();
    var configuration = @import("config.zig").defaults(allocator);
    defer configuration.deinit();
    var policy = try Policy.init(allocator, &tree, &configuration, 0);
    defer policy.deinit();
    var random = scalars.Random.init(1);
    try applyLocal(allocator, &tree, .{ .policy = &policy }, &random);
    const generated = try parser.codegen.generate(allocator, &tree, .{});
    defer generated.deinit(allocator);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "function _0x7CD012(_0x7CF012)") != null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "const _0x7C9012 = _0x7CF012") != null);
    const output = try execute(allocator, generated.code);
    defer allocator.free(output);
    try std.testing.expectEqualStrings("5\n", output);
}

test "jsdefender declarations global reference policies preserve disabled scopes" {
    const Runtime = @import("runtime.zig");
    const Adapter = struct {
        fn helper(context: *anyopaque, key: []const u8) RuntimeError![]const u8 {
            const manager: *Runtime.Manager = @ptrCast(@alignCast(context));
            return manager.addBuiltin(key);
        }

        fn property(context: *anyopaque, tree: *ast.Tree, key: []const u8, value: ast.NodeIndex) RuntimeError![]const u8 {
            const manager: *Runtime.Manager = @ptrCast(@alignCast(context));
            return manager.initPropertyNode(tree, key, value);
        }
    };
    const allocator = std.testing.allocator;
    var tree = try parser.parse(
        allocator,
        "\"@jsdefender {globalObjectHiding:false,localDeclarations:false,stringLiterals:false}\";console.log(Math.max(1,2));function f(){\"@jsdefender {globalObjectHiding:{usePredefined:false,include:['Math']}}\";return Math.min(3,7);}console.log(f());",
        .{},
    );
    defer tree.deinit();
    var configuration = @import("config.zig").defaults(allocator);
    defer configuration.deinit();
    var policy = try Policy.init(allocator, &tree, &configuration, 0);
    defer policy.deinit();
    var random = scalars.Random.init(1);
    var manager = Runtime.Manager.init(allocator, .{}, &random);
    defer manager.deinit();
    try manager.initializeProtector();
    try applyGlobal(
        allocator,
        &tree,
        .{ .policy = &policy },
        .{
            .context = &manager,
            .protector_name = manager.protector_name.?,
            .require_helper = Adapter.helper,
            .init_property = Adapter.property,
        },
    );
    const generated = try parser.codegen.generate(allocator, &tree, .{});
    defer generated.deinit(allocator);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "Math.max") != null);
    try std.testing.expect(std.mem.indexOf(u8, generated.code, "return Math.min") == null);
    try std.testing.expect(manager.property("globalID0") != null);
    try std.testing.expect(manager.property("globalID1") == null);
    const code = try std.fmt.allocPrint(allocator, "{s}\n{s}", .{ try manager.emitSource(), generated.code });
    defer allocator.free(code);
    const output = try execute(allocator, code);
    defer allocator.free(output);
    try std.testing.expectEqualStrings("2\n3\n", output);
}

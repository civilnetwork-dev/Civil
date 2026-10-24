//! LexicalScope and SourceTree.mapLexicalScopes from modules 5256/7500.
//! The extra function-name, parameter and body scopes are intentional.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const A = std.mem.Allocator;
const N = ast.NodeIndex;
const Kind = enum {
    Var,
    Let,
    Const,
    FunctionDeclaration,
    FunctionExpression,
    Parameter,
    Catch,
    ClassDeclaration,
    ClassExpression,
    ClassMethod,
    ObjectMethod,
};

pub const Declaration = struct {
    global_id: u32,
    local_id: usize,
    name: []const u8,
    kind: Kind,
    node: N,
    parent: N,
    tree: *ast.Tree,
    tree_id: usize,
    references: usize = 0,
    nested_references: usize = 0,
    searchable: bool = true,
    mangled_name: ?[]const u8 = null,
};

test "lexical references retain names and locations after expression replacement" {
    const allocator = std.testing.allocator;
    var tree = try parser.parse(allocator, "Math=1;", .{});
    defer tree.deinit();
    var graph = try Graph.build(allocator, &tree, 0, 0, null, null);
    defer graph.deinit();
    try graph.resolve();
    const reference = graph.root.unresolved.items[0].node;
    tree.setData(reference, .{ .numeric_literal = .{ .kind = .decimal, .raw = try tree.addString("2") } });
    const json = try graph.json(allocator, false);
    defer allocator.free(json);
    var parsed_json = try std.json.parseFromSlice(std.json.Value, allocator, json, .{});
    defer parsed_json.deinit();
    const unresolved = parsed_json.value.object.get("unresolved").?.array.items[0].object;
    try std.testing.expectEqualStrings("Math", unresolved.get("id").?.string);
    try std.testing.expectEqual(@as(i64, 1), unresolved.get("line").?.integer);
    try std.testing.expectEqual(@as(i64, 0), unresolved.get("column").?.integer);
}
const IdentifierRecord = @import("lexical_location.zig").Record;
const Reference = struct {
    node: N,
    name: []const u8,
    location: IdentifierRecord,
    declaration: ?*Declaration = null,
};

pub const DeclarationMap = std.StringArrayHashMapUnmanaged(*Declaration);
pub const Scope = struct {
    parent: ?*Scope,
    node: N,
    declarations: *DeclarationMap,
    references: std.ArrayList(Reference) = .empty,
    unresolved: std.ArrayList(Reference) = .empty,
    nested: std.ArrayList(*Scope) = .empty,
};

pub const Graph = struct {
    arena: std.heap.ArenaAllocator,
    tree: *ast.Tree,
    tree_id: usize,
    root: *Scope = undefined,
    next: u32,
    initial: u32,

    pub fn deinit(self: *Graph) void {
        self.arena.deinit();
    }

    pub fn build(
        allocator: A,
        tree: *ast.Tree,
        tree_id: usize,
        id_base: u32,
        shared: ?*DeclarationMap,
        parent: ?*Scope,
    ) !Graph {
        var self = Graph{
            .arena = std.heap.ArenaAllocator.init(allocator),
            .tree = tree,
            .tree_id = tree_id,
            .next = id_base,
            .initial = id_base,
        };
        errdefer self.deinit();
        self.root = try self.newScope(tree.root, parent, false);
        if (shared) |map| self.root.declarations = map;
        try self.body(tree.data(tree.root).program.body, self.root, self.root);
        return self;
    }

    pub fn count(self: Graph) u32 {
        return self.next - self.initial;
    }

    fn alloc(self: *Graph) A {
        return self.arena.allocator();
    }

    fn newScope(self: *Graph, node: N, parent: ?*Scope, attach: bool) !*Scope {
        const scope = try self.alloc().create(Scope);
        const map = try self.alloc().create(DeclarationMap);
        map.* = .empty;
        scope.* = .{ .parent = parent, .node = node, .declarations = map };
        if (attach) if (parent) |owner| try owner.nested.append(self.alloc(), scope);
        return scope;
    }

    fn name(self: *Graph, node: N) ?[]const u8 {
        if (node == .null) return null;
        return switch (self.tree.data(node)) {
            .binding_identifier => |v| self.tree.string(v.name),
            .identifier_reference => |v| self.tree.string(v.name),
            .identifier_name => |v| self.tree.string(v.name),
            else => null,
        };
    }

    fn declare(self: *Graph, scope: *Scope, node: N, parent: N, kind: Kind) !*Declaration {
        const text = try self.alloc().dupe(u8, self.name(node) orelse "");
        const declaration = try self.alloc().create(Declaration);
        declaration.* = .{
            .global_id = self.next,
            .local_id = scope.declarations.count(),
            .name = text,
            .kind = kind,
            .node = node,
            .parent = parent,
            .tree = self.tree,
            .tree_id = self.tree_id,
        };
        self.next += 1;
        try scope.declarations.put(self.alloc(), text, declaration);
        return declaration;
    }

    fn binding(self: *Graph, scope: *Scope, node: N, parent: N, kind: Kind, reuse: bool) anyerror!void {
        if (node == .null) return;
        switch (self.tree.data(node)) {
            .binding_identifier, .identifier_reference => {
                if (reuse) if (scope.declarations.get(self.name(node).?)) |old| {
                    if (old.kind == .FunctionDeclaration and self.tree.data(parent) == .variable_declarator and self.tree.data(parent).variable_declarator.init != .null) {
                        const replacement = try self.alloc().create(Declaration);
                        replacement.* = old.*;
                        replacement.node = node;
                        replacement.parent = parent;
                        replacement.kind = kind;
                        replacement.tree = self.tree;
                        replacement.tree_id = self.tree_id;
                        try scope.declarations.put(self.alloc(), old.name, replacement);
                    }
                    return;
                };
                _ = try self.declare(scope, node, parent, kind);
            },
            .formal_parameter => |v| try self.binding(scope, v.pattern, parent, kind, reuse),
            .binding_rest_element => |v| try self.binding(scope, v.argument, node, kind, reuse),
            .assignment_pattern => |v| try self.binding(scope, v.left, node, kind, reuse),
            .array_pattern => |v| {
                for (self.tree.extra(v.elements)) |item| try self.binding(scope, item, node, kind, reuse);
                try self.binding(scope, v.rest, node, kind, reuse);
            },
            .object_pattern => |v| {
                for (self.tree.extra(v.properties)) |item| try self.binding(scope, item, node, kind, reuse);
                try self.binding(scope, v.rest, node, kind, reuse);
            },
            .binding_property => |v| try self.binding(scope, v.value, node, kind, reuse),
            else => {},
        }
    }

    fn body(self: *Graph, range: ast.IndexRange, hoist: *Scope, scope: *Scope) anyerror!void {
        for (self.tree.extra(range)) |node| try self.visit(node, hoist, scope);
    }

    fn ref(self: *Graph, node: N, hoist: *Scope, scope: *Scope) anyerror!void {
        if (node == .null) return;
        switch (self.tree.data(node)) {
            .binding_identifier, .identifier_reference, .identifier_name => {
                const locations = @import("lexical_location.zig");
                try scope.unresolved.append(self.alloc(), .{
                    .node = node,
                    .name = try self.alloc().dupe(u8, self.name(node).?),
                    .location = locations.lookup(self.tree, node) orelse locations.parsed(self.tree, node),
                });
            },
            else => try self.visit(node, hoist, scope),
        }
    }

    fn refs(self: *Graph, range: ast.IndexRange, hoist: *Scope, scope: *Scope) anyerror!void {
        for (self.tree.extra(range)) |node| try self.ref(node, hoist, scope);
    }

    fn params(self: *Graph, node: N, owner: N, hoist: *Scope, scope: *Scope) anyerror!void {
        const value = self.tree.data(node).formal_parameters;
        for (self.tree.extra(value.items)) |item| {
            const pattern = self.tree.data(item).formal_parameter.pattern;
            try self.binding(scope, pattern, owner, .Parameter, false);
            if (self.tree.data(pattern) == .assignment_pattern)
                try self.ref(self.tree.data(pattern).assignment_pattern.right, hoist, scope);
        }
        try self.binding(scope, value.rest, owner, .Parameter, false);
        for (self.tree.extra(value.items)) |item| try self.ref(self.tree.data(item).formal_parameter.pattern, hoist, scope);
        try self.ref(value.rest, hoist, scope);
    }

    fn function(
        self: *Graph,
        node: N,
        value: ast.Function,
        hoist: *Scope,
        scope: *Scope,
        is_method: bool,
    ) anyerror!void {
        var parameters_parent = scope;
        if (!is_method) {
            if (value.type == .function_declaration) {
                if (value.id != .null) {
                    if (hoist.declarations.get(self.name(value.id).?)) |old| {
                        if (self.tree.data(old.parent) != .variable_declarator or self.tree.data(old.parent).variable_declarator.init == .null) {
                            const replacement = try self.alloc().create(Declaration);
                            replacement.* = old.*;
                            replacement.node = value.id;
                            replacement.parent = node;
                            replacement.kind = .FunctionDeclaration;
                            replacement.tree = self.tree;
                            replacement.tree_id = self.tree_id;
                            try hoist.declarations.put(self.alloc(), old.name, replacement);
                        }
                    } else _ = try self.declare(hoist, value.id, node, .FunctionDeclaration);
                }
                try self.ref(value.id, hoist, scope);
            } else {
                parameters_parent = try self.newScope(node, scope, true);
                if (value.id != .null) _ = try self.declare(parameters_parent, value.id, node, .FunctionExpression);
                try self.ref(value.id, hoist, parameters_parent);
            }
        }
        const parameter_scope = try self.newScope(node, parameters_parent, true);
        try self.params(value.params, node, hoist, parameter_scope);
        const body_scope = try self.newScope(value.body, parameter_scope, true);
        try self.body(self.tree.data(value.body).function_body.body, body_scope, body_scope);
    }

    fn method(
        self: *Graph,
        node: N,
        key: N,
        computed: bool,
        value: N,
        kind: Kind,
        hoist: *Scope,
        scope: *Scope,
    ) anyerror!void {
        var identifier = key;
        while (self.tree.data(identifier) == .parenthesized_expression) identifier = self.tree.data(identifier).parenthesized_expression.expression;
        if (self.name(identifier) != null) (try self.declare(scope, identifier, node, kind)).searchable = false;
        if (computed) try self.ref(key, hoist, scope);
        try self.function(node, self.tree.data(value).function, hoist, scope, true);
    }

    fn visit(self: *Graph, node: N, hoist: *Scope, scope: *Scope) anyerror!void {
        if (node == .null) return;
        const tree = self.tree;
        switch (tree.data(node)) {
            .variable_declaration => |v| {
                const target = if (v.kind == .@"var") hoist else scope;
                const kind: Kind = if (v.kind == .@"var") .Var else if (v.kind == .let) .Let else .Const;
                for (tree.extra(v.declarators)) |item| try self.binding(target, tree.data(item).variable_declarator.id, item, kind, true);
                try self.refs(v.declarators, hoist, scope);
            },
            .variable_declarator => |v| {
                try self.ref(v.id, hoist, scope);
                try self.ref(v.init, hoist, scope);
            },
            .function => |v| try self.function(node, v, hoist, scope, false),
            .arrow_function_expression => |v| {
                const parameters = try self.newScope(node, scope, true);
                try self.params(v.params, node, hoist, parameters);
                if (tree.data(v.body) == .function_body or tree.data(v.body) == .block_statement) {
                    const inner = try self.newScope(v.body, parameters, true);
                    const range = if (tree.data(v.body) == .function_body)
                        tree.data(v.body).function_body.body
                    else
                        tree.data(v.body).block_statement.body;
                    try self.body(range, inner, inner);
                } else try self.ref(v.body, hoist, parameters);
            },
            .block_statement => |v| try self.body(v.body, hoist, try self.newScope(node, scope, true)),
            .function_body => |v| try self.body(v.body, hoist, scope),
            .object_expression => |v| try self.body(v.properties, hoist, try self.newScope(node, scope, true)),
            .object_property => |v| {
                if (v.method or v.kind != .init) try self.method(node, v.key, v.computed, v.value, .ObjectMethod, hoist, scope) else {
                    try self.ref(v.value, hoist, scope);
                    if (v.computed) try self.ref(v.key, hoist, scope);
                }
            },
            .binding_property => |v| {
                try self.ref(v.value, hoist, scope);
                if (v.computed) try self.ref(v.key, hoist, scope);
            },
            .class => |v| {
                if (v.id != .null) _ = try self.declare(scope, v.id, node, .ClassDeclaration);
                try self.ref(v.id, hoist, scope);
                try self.ref(v.super_class, hoist, scope);
                try self.visit(v.body, hoist, try self.newScope(node, scope, true));
            },
            .class_body => |v| try self.body(v.body, hoist, scope),
            .method_definition => |v| if (tree.data(v.key) != .private_identifier) {
                try self.method(node, v.key, v.computed, v.value, .ClassMethod, hoist, scope);
            },
            .property_definition => |v| if (tree.data(v.key) != .private_identifier) {
                try self.visit(v.key, hoist, scope);
                try self.visit(v.value, hoist, scope);
            },
            .for_statement => |v| {
                const inner = try self.newScope(node, scope, true);
                if (v.init != .null and tree.data(v.init) == .variable_declaration)
                    try self.visit(v.init, hoist, inner)
                else
                    try self.ref(v.init, hoist, inner);
                try self.ref(v.@"test", hoist, inner);
                try self.ref(v.update, hoist, inner);
                try self.visit(v.body, hoist, inner);
            },
            inline .for_in_statement, .for_of_statement => |v| {
                const inner = try self.newScope(node, scope, true);
                if (tree.data(v.left) == .variable_declaration)
                    try self.visit(v.left, hoist, inner)
                else
                    try self.ref(v.left, hoist, inner);
                try self.ref(v.right, hoist, inner);
                try self.visit(v.body, hoist, inner);
            },
            .switch_statement => |v| {
                try self.ref(v.discriminant, hoist, scope);
                try self.body(v.cases, hoist, try self.newScope(node, scope, true));
            },
            .switch_case => |v| {
                try self.ref(v.@"test", hoist, scope);
                try self.body(v.consequent, hoist, scope);
            },
            .try_statement => |v| {
                try self.visit(v.block, hoist, scope);
                if (v.handler != .null) {
                    const handler = tree.data(v.handler).catch_clause;
                    const inner = try self.newScope(handler.body, scope, true);
                    try self.binding(inner, handler.param, v.handler, .Catch, false);
                    try self.ref(handler.param, hoist, inner);
                    try self.body(tree.data(handler.body).block_statement.body, hoist, inner);
                }
                try self.visit(v.finalizer, hoist, scope);
            },
            .export_default_declaration => |v| try self.ref(v.declaration, hoist, scope),
            .export_named_declaration => |v| try self.refs(v.specifiers, hoist, scope),
            .export_specifier => |v| try self.ref(v.local, hoist, scope),
            .labeled_statement => |v| try self.visit(v.body, hoist, scope),
            inline .expression_statement, .parenthesized_expression, .chain_expression => |v| try self.ref(v.expression, hoist, scope),
            .if_statement => |v| {
                try self.ref(v.@"test", hoist, scope);
                try self.visit(v.consequent, hoist, scope);
                try self.visit(v.alternate, hoist, scope);
            },
            .do_while_statement => |v| {
                try self.visit(v.body, hoist, scope);
                try self.ref(v.@"test", hoist, scope);
            },
            .while_statement => |v| {
                try self.ref(v.@"test", hoist, scope);
                try self.visit(v.body, hoist, scope);
            },
            .with_statement => |v| {
                try self.ref(v.object, hoist, scope);
                try self.visit(v.body, hoist, scope);
            },
            inline .return_statement, .throw_statement, .unary_expression, .update_expression, .spread_element, .yield_expression, .await_expression, .binding_rest_element => |v| try self.ref(v.argument, hoist, scope),
            .array_pattern => |v| {
                try self.refs(v.elements, hoist, scope);
                try self.ref(v.rest, hoist, scope);
            },
            .object_pattern => |v| {
                try self.refs(v.properties, hoist, scope);
                try self.ref(v.rest, hoist, scope);
            },
            .array_expression => |v| try self.refs(v.elements, hoist, scope),
            inline .assignment_expression, .assignment_pattern, .binary_expression, .logical_expression => |v| {
                try self.ref(v.left, hoist, scope);
                try self.ref(v.right, hoist, scope);
            },
            .call_expression => |v| {
                // Babel's dynamic-import callee is an Import node rather
                // than an identifier reference. The compatibility AST uses
                // identifier_name solely to retain its rendering.
                const callee = tree.data(v.callee);
                if (callee != .identifier_name or !std.mem.eql(u8, tree.string(callee.identifier_name.name), "import"))
                    try self.ref(v.callee, hoist, scope);
                try self.refs(v.arguments, hoist, scope);
            },
            .new_expression => |v| {
                try self.ref(v.callee, hoist, scope);
                try self.refs(v.arguments, hoist, scope);
            },
            .conditional_expression => |v| {
                try self.ref(v.@"test", hoist, scope);
                try self.ref(v.consequent, hoist, scope);
                try self.ref(v.alternate, hoist, scope);
            },
            inline .sequence_expression, .template_literal => |v| try self.refs(v.expressions, hoist, scope),
            .tagged_template_expression => |v| try self.ref(v.tag, hoist, scope),
            .member_expression => |v| {
                try self.ref(v.object, hoist, scope);
                if (v.computed) try self.ref(v.property, hoist, scope);
            },
            else => {},
        }
    }

    pub fn resolve(self: *Graph) !void {
        try self.resolveScope(self.root);
    }

    fn resolveScope(self: *Graph, scope: *Scope) anyerror!void {
        var unresolved: std.ArrayList(Reference) = .empty;
        for (scope.unresolved.items) |reference| {
            const text = reference.name;
            var owner: ?*Scope = scope;
            var found = false;
            while (owner) |current| : (owner = current.parent) {
                if (current.declarations.get(text)) |declaration| if (declaration.searchable) {
                    var resolved = reference;
                    resolved.declaration = declaration;
                    try scope.references.append(self.alloc(), resolved);
                    declaration.references += 1;
                    if (current != scope) declaration.nested_references += 1;
                    found = true;
                    break;
                };
            }
            if (!found) try unresolved.append(self.alloc(), reference);
        }
        scope.unresolved = unresolved;
        for (scope.nested.items) |child| try self.resolveScope(child);
    }

    pub fn json(self: *Graph, allocator: A, inherit: bool) ![]u8 {
        return std.json.Stringify.valueAlloc(allocator, try self.scopeJson(self.root, inherit), .{});
    }

    fn object(self: *Graph) std.json.ObjectMap {
        _ = self;
        return .empty;
    }

    fn string(value: []const u8) std.json.Value {
        return .{ .string = value };
    }

    fn number(value: anytype) std.json.Value {
        return .{ .integer = @intCast(value) };
    }

    fn location(self: *Graph, value: *std.json.ObjectMap, tree: *ast.Tree, node: N) !void {
        const locations = @import("lexical_location.zig");
        const record = locations.lookup(tree, node) orelse locations.parsed(tree, node);
        const point = record.location orelse return;
        try value.put(self.alloc(), "line", number(point.line));
        try value.put(self.alloc(), "column", number(point.column));
    }

    fn referenceLocation(self: *Graph, value: *std.json.ObjectMap, reference: Reference) !void {
        const point = reference.location.location orelse return;
        try value.put(self.alloc(), "line", number(point.line));
        try value.put(self.alloc(), "column", number(point.column));
    }

    fn scopeJson(self: *Graph, scope: *Scope, inherit: bool) anyerror!std.json.Value {
        var output = self.object();
        var declarations_json: std.array_list.Managed(std.json.Value) = .init(self.alloc());
        if (!inherit) for (scope.declarations.values()) |declaration| {
            var value = self.object();
            try value.put(self.alloc(), "globalId", number(declaration.global_id));
            try value.put(self.alloc(), "localId", number(declaration.local_id));
            try value.put(self.alloc(), "name", string(declaration.name));
            try self.location(&value, declaration.tree, declaration.node);
            const current = switch (declaration.tree.data(declaration.node)) {
                .binding_identifier => |v| declaration.tree.string(v.name),
                .identifier_reference => |v| declaration.tree.string(v.name),
                else => declaration.name,
            };
            try value.put(
                self.alloc(),
                "mangledName",
                if (declaration.mangled_name) |text|
                    string(text)
                else if (std.mem.eql(u8, current, declaration.name)) .null else string(current),
            );
            try value.put(self.alloc(), "type", string(@tagName(declaration.kind)));
            try value.put(self.alloc(), "referenceCount", number(declaration.references));
            try value.put(self.alloc(), "nestedReferenceCount", number(declaration.nested_references));
            try value.put(self.alloc(), "tree", number(declaration.tree_id));
            try declarations_json.append(.{ .object = value });
        };
        try output.put(self.alloc(), "declarations", if (inherit) string("inherit") else .{ .array = declarations_json });
        var references: std.array_list.Managed(std.json.Value) = .init(self.alloc());
        for (scope.references.items) |reference| {
            const declaration = reference.declaration.?;
            var value = self.object();
            try value.put(self.alloc(), "id", string(declaration.name));
            try value.put(self.alloc(), "globalId", number(declaration.global_id));
            try self.referenceLocation(&value, reference);
            try references.append(.{ .object = value });
        }
        try output.put(self.alloc(), "references", .{ .array = references });
        var unresolved: std.array_list.Managed(std.json.Value) = .init(self.alloc());
        for (scope.unresolved.items) |reference| {
            var value = self.object();
            try value.put(self.alloc(), "id", string(reference.name));
            try self.referenceLocation(&value, reference);
            try unresolved.append(.{ .object = value });
        }
        try output.put(self.alloc(), "unresolved", .{ .array = unresolved });
        var nested: std.array_list.Managed(std.json.Value) = .init(self.alloc());
        for (scope.nested.items) |child| try nested.append(try self.scopeJson(child, false));
        try output.put(self.alloc(), "nested", .{ .array = nested });
        return .{ .object = output };
    }
};

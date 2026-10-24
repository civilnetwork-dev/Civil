//! Canonical renderer recovered from module 5825, independent of yuku's
//! formatting and precedence choices. Original raw literals and semicolons
//! are significant to JSDefender's source-bound checksums.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const nodes = @import("nodes.zig");
const A = std.mem.Allocator;
pub const Error = A.Error || error{UnsupportedRenderSyntax};

pub fn render(allocator: A, tree: *const ast.Tree) Error![]u8 {
    return renderNode(allocator, tree, tree.root);
}

pub fn renderNode(allocator: A, tree: *const ast.Tree, index: ast.NodeIndex) Error![]u8 {
    return renderMode(allocator, tree, index, false);
}

pub fn renderMapped(allocator: A, tree: *const ast.Tree) Error![]u8 {
    return renderNodeMapped(allocator, tree, tree.root);
}

pub fn renderNodeMapped(allocator: A, tree: *const ast.Tree, index: ast.NodeIndex) Error![]u8 {
    return renderMode(allocator, tree, index, true);
}

fn renderMode(allocator: A, tree: *const ast.Tree, index: ast.NodeIndex, mapped: bool) Error![]u8 {
    var arena = std.heap.ArenaAllocator.init(allocator);
    defer arena.deinit();
    var printer = Printer{ .allocator = arena.allocator(), .tree = tree, .mapped = mapped };
    return allocator.dupe(u8, try printer.n(index));
}
const Printer = struct {
    allocator: A,
    tree: *const ast.Tree,
    untracked_syntax: usize = 0,
    mapped: bool = false,

    fn f(self: *@This(), comptime format: []const u8, args: anytype) A.Error![]const u8 {
        return std.fmt.allocPrint(self.allocator, format, args);
    }

    fn semi(self: *@This(), index: ast.NodeIndex) []const u8 {
        if (self.untracked_syntax != 0) return "";
        return if (nodes.hasSemicolon(self.tree, index)) ";" else "";
    }

    fn needsSemi(self: *@This(), index: ast.NodeIndex) bool {
        if (index == .null) return false;
        return switch (self.tree.data(index)) {
            .block_statement, .function_body, .class, .do_while_statement, .empty_statement, .switch_statement, .try_statement => false,
            .function => |value| value.type != .function_declaration,
            .for_statement => |value| self.needsSemi(value.body),
            .for_in_statement => |value| self.needsSemi(value.body),
            .for_of_statement => |value| self.needsSemi(value.body),
            .while_statement => |value| self.needsSemi(value.body),
            .labeled_statement => |value| self.needsSemi(value.body),
            .with_statement => |value| self.needsSemi(value.body),
            .if_statement => |value| self.needsSemi(if (value.alternate != .null) value.alternate else value.consequent),
            else => true,
        };
    }

    fn list(self: *@This(), range: ast.IndexRange, separator: []const u8) Error![]const u8 {
        var out: std.ArrayList(u8) = .empty;
        for (self.tree.extra(range), 0..) |index, i| {
            if (i != 0) try out.appendSlice(self.allocator, separator);
            try out.appendSlice(self.allocator, try self.n(index));
        }
        return out.toOwnedSlice(self.allocator);
    }
    // H4QI prints call arguments and property values directly; XsfK prints
    // expressions with Babel's extra.parenthesized flag. Yuku makes that
    // distinction an explicit wrapper node.
    fn direct(self: *@This(), index: ast.NodeIndex) Error![]const u8 {
        if (index == .null) return "";
        if (self.tree.data(index) == .parenthesized_expression) {
            if (self.tree.span(index).start == nodes.explicit_parentheses_span.start) return self.n(index);
            const inner = self.tree.data(index).parenthesized_expression.expression;
            return switch (self.tree.data(inner)) {
                .sequence_expression, .class => self.n(index),
                else => self.direct(inner),
            };
        }
        return self.n(index);
    }

    fn arguments(self: *@This(), range: ast.IndexRange) Error![]const u8 {
        var out: std.ArrayList(u8) = .empty;
        for (self.tree.extra(range), 0..) |index, i| {
            if (i != 0) try out.append(self.allocator, ',');
            try out.appendSlice(self.allocator, try self.direct(index));
        }
        return out.toOwnedSlice(self.allocator);
    }

    fn body(self: *@This(), range: ast.IndexRange) Error![]const u8 {
        var out: std.ArrayList(u8) = .empty;
        var previous: ast.NodeIndex = .null;
        for (self.tree.extra(range)) |index| {
            if (out.items.len != 0 and out.items[out.items.len - 1] != ';' and self.needsSemi(previous))
                try out.append(self.allocator, ';');
            try out.appendSlice(self.allocator, try self.n(index));
            previous = index;
        }
        if (previous != .null and self.tree.data(previous) == .directive and out.items.len != 0 and out.items[out.items.len - 1] != ';')
            try out.append(self.allocator, ';');
        return out.toOwnedSlice(self.allocator);
    }

    fn params(self: *@This(), index: ast.NodeIndex) Error![]const u8 {
        const value = self.tree.data(index).formal_parameters;
        return self.f(
            "({s}{s}{s})",
            .{
                try self.list(value.items, ","),
                if (value.rest != .null and self.tree.extra(value.items).len != 0) "," else "",
                try self.n(value.rest),
            },
        );
    }

    fn key(self: *@This(), index: ast.NodeIndex, computed: bool) Error![]const u8 {
        return if (computed) self.f("[{s}]", .{try self.direct(index)}) else self.direct(index);
    }

    fn trailingComma(self: *@This(), index: ast.NodeIndex) bool {
        const span = self.tree.span(index);
        if (span.end <= span.start + 1 or span.end > self.tree.source.len) return false;
        const text = std.mem.trimEnd(u8, self.tree.source[span.start .. span.end - 1], " ");
        return text.len != 0 and text[text.len - 1] == ',';
    }

    fn quoted(self: *@This(), text: []const u8) Error![]const u8 {
        return @import("strings.zig").quote(self.allocator, text);
    }

    fn collision(a: u8, b: u8) bool {
        return a == b and std.mem.indexOfScalar(u8, "+-. *<>=|&", a) != null;
    }

    fn binary(self: *@This(), left: ast.NodeIndex, operator: []const u8, right: ast.NodeIndex) Error![]const u8 {
        const lhs = try self.n(left);
        const rhs = try self.n(right);
        const first = operator[0];
        const last = operator[operator.len - 1];
        return self.f(
            "{s}{s}{s}{s}{s}",
            .{
                lhs,

                if (std.ascii.isAlphanumeric(first) or first == '_' or first == '$' or (lhs.len != 0 and collision(lhs[lhs.len - 1], first)))
                    " "
                else
                    "",

                operator,

                if (std.ascii.isAlphanumeric(last) or last == '_' or last == '$' or (rhs.len != 0 and collision(last, rhs[0])))
                    " "
                else
                    "",

                rhs,
            },
        );
    }

    fn n(self: *@This(), index: ast.NodeIndex) Error![]const u8 {
        if (index == .null) return "";
        const tree = self.tree;
        if (self.mapped and (tree.data(index) == .static_block or tree.data(index) == .property_definition or tree.data(index) == .private_identifier or tree.data(index) == .meta_property or @import("policy.zig").privateMember(tree, tree.data(index))))
            return "";
        return switch (tree.data(index)) {
            .program => |value| self.body(value.body),
            .block_statement => |value| self.f("{{{s}}}", .{try self.body(value.body)}),
            .function_body => |value| self.f("{{{s}}}", .{try self.body(value.body)}),
            .directive => |value| self.f("{s}{s}", .{ try self.n(value.expression), self.semi(index) }),
            .expression_statement => |value| self.f("{s}{s}", .{ try self.n(value.expression), self.semi(index) }),
            .empty_statement => self.semi(index),
            .debugger_statement => self.f("debugger{s}", .{self.semi(index)}),
            .variable_declaration => |value| self.f("{s} {s}{s}", .{ value.kind.toString(), try self.list(value.declarators, ","), self.semi(index) }),
            .variable_declarator => |value| self.f("{s}{s}{s}", .{ try self.n(value.id), if (value.init == .null) "" else "=", try self.n(value.init) }),
            .binding_identifier => |value| tree.string(value.name),
            .identifier_reference => |value| tree.string(value.name),
            .identifier_name => |value| tree.string(value.name),
            .label_identifier => |value| tree.string(value.name),
            .private_identifier => |value| self.f("#{s}", .{tree.string(value.name)}),
            .numeric_literal => |value| tree.string(value.raw),
            .bigint_literal => |value| self.f("{s}n", .{tree.string(value.raw)}),
            .regexp_literal => |value| self.f("/{s}/{s}", .{ tree.string(value.pattern), tree.string(value.flags) }),
            .string_literal => |value| if (tree.string(value.raw).len != 0) tree.string(value.raw) else self.quoted(tree.string(value.value)),
            .boolean_literal => |value| if (value.value) "true" else "false",
            .null_literal => "null",
            .this_expression => "this",
            .super => "super",
            .function => |value| self.f(
                "{s}function{s}{s}{s}{s}{s}{s}",
                .{
                    if (value.async) "async " else "",
                    if (value.id != .null and !value.generator) " " else "",
                    if (value.generator) "*" else "",
                    try self.n(value.id),
                    try self.params(value.params),
                    try self.n(value.body),
                    self.semi(index),
                },
            ),
            .formal_parameter => |value| self.n(value.pattern),
            .formal_parameters => self.params(index),
            .parenthesized_expression => |value| blk: {
                var inner = value.expression;
                if (tree.span(index).start != nodes.explicit_parentheses_span.start) {
                    while (tree.data(inner) == .parenthesized_expression and tree.span(inner).start != nodes.explicit_parentheses_span.start) inner = tree.data(inner).parenthesized_expression.expression;
                }
                break :blk self.f("({s})", .{try self.n(inner)});
            },
            .chain_expression => |value| self.n(value.expression),
            .arrow_function_expression => |value| blk: {
                const parameters = tree.data(value.params).formal_parameters;
                const items = tree.extra(parameters.items);
                var parenthesized = items.len != 1 or parameters.rest != .null;
                if (items.len == 1) {
                    const pattern = tree.data(items[0]).formal_parameter.pattern;
                    parenthesized = parenthesized or tree.data(pattern) != .binding_identifier;
                    const start = tree.span(index).start;
                    const end = tree.span(pattern).start;
                    if (tree.span(items[0]).start != nodes.detached_span.start and end > start and end <= tree.source.len)
                        parenthesized = parenthesized or std.mem.indexOfScalar(u8, tree.source[start..end], '(') != null;
                }
                break :blk self.f(
                    "{s}{s}{s}=>{s}",
                    .{
                        if (value.async) "async" else "",

                        if (value.async and !parenthesized) " " else "",

                        if (parenthesized) try self.params(value.params) else try self.list(parameters.items, ","),

                        try self.n(value.body),
                    },
                );
            },
            .return_statement => |value| self.f(
                "return{s}{s}{s}",
                .{ if (value.argument == .null) "" else " ", try self.n(value.argument), self.semi(index) },
            ),
            .throw_statement => |value| self.f("throw {s}{s}", .{ try self.n(value.argument), self.semi(index) }),
            .break_statement => |value| self.f("break{s}{s}{s}", .{ if (value.label == .null) "" else " ", try self.n(value.label), self.semi(index) }),
            .continue_statement => |value| self.f(
                "continue{s}{s}{s}",
                .{ if (value.label == .null) "" else " ", try self.n(value.label), self.semi(index) },
            ),
            .labeled_statement => |value| self.f("{s}:{s}", .{ try self.n(value.label), try self.n(value.body) }),
            .if_statement => |value| blk: {
                const yes = try self.n(value.consequent);
                const alternate = if (value.alternate == .null) "" else try self.f(
                    "{s}else{s}{s}",
                    .{
                        if (yes.len != 0 and yes[yes.len - 1] != ';' and self.needsSemi(value.consequent)) ";" else "",

                        if (tree.data(value.alternate) == .block_statement) "" else " ",

                        try self.n(value.alternate),
                    },
                );
                break :blk self.f("if({s}){s}{s}", .{ try self.n(value.@"test"), yes, alternate });
            },
            .for_statement => |value| self.f(
                "for({s};{s};{s}){s}",
                .{ try self.n(value.init), try self.n(value.@"test"), try self.n(value.update), try self.n(value.body) },
            ),
            .for_in_statement => |value| self.f("for({s} in {s}){s}", .{ try self.n(value.left), try self.n(value.right), try self.n(value.body) }),
            .for_of_statement => |value| self.f(
                "for{s}({s} of {s}){s}",
                .{ if (value.await) " await" else "", try self.n(value.left), try self.n(value.right), try self.n(value.body) },
            ),
            .while_statement => |value| self.f("while({s}){s}", .{ try self.n(value.@"test"), try self.n(value.body) }),
            .do_while_statement => |value| blk: {
                const body_text = try self.n(value.body);
                break :blk self.f(
                    "do{s}{s}{s}while({s}){s}",
                    .{
                        if (tree.data(value.body) == .block_statement or tree.data(value.body) == .empty_statement) "" else " ",

                        body_text,

                        if (body_text.len != 0 and body_text[body_text.len - 1] != ';' and self.needsSemi(value.body)) ";" else "",

                        try self.n(value.@"test"),

                        self.semi(index),
                    },
                );
            },
            .with_statement => |value| self.f("with({s}){s}", .{ try self.n(value.object), try self.n(value.body) }),
            .switch_statement => |value| self.f("switch({s}){{{s}}}", .{ try self.n(value.discriminant), try self.list(value.cases, "") }),
            .switch_case => |value| blk: {
                const statements = tree.extra(value.consequent);
                const body_text = try self.body(value.consequent);
                break :blk self.f(
                    "{s}:{s}{s}",
                    .{
                        if (value.@"test" == .null) "default" else try self.f("case {s}", .{try self.n(value.@"test")}),

                        body_text,

                        if (body_text.len != 0 and body_text[body_text.len - 1] != ';' and statements.len != 0 and self.needsSemi(statements[statements.len - 1]))
                            ";"
                        else
                            "",
                    },
                );
            },
            .try_statement => |value| self.f(
                "try{s}{s}{s}{s}",
                .{
                    try self.n(value.block),
                    try self.n(value.handler),
                    if (value.finalizer == .null) "" else "finally",
                    try self.n(value.finalizer),
                },
            ),
            .catch_clause => |value| self.f(
                "catch{s}{s}",
                .{ if (value.param == .null) "" else try self.f("({s})", .{try self.n(value.param)}), try self.n(value.body) },
            ),
            .binary_expression => |value| self.binary(value.left, value.operator.toString(), value.right),
            .logical_expression => |value| self.binary(value.left, value.operator.toString(), value.right),
            .assignment_expression => |value| self.f("{s}{s}{s}", .{ try self.n(value.left), value.operator.toString(), try self.n(value.right) }),
            .assignment_pattern => |value| self.f("{s}={s}", .{ try self.n(value.left), try self.n(value.right) }),
            .unary_expression => |value| self.f(
                "{s}{s}{s}",
                .{
                    value.operator.toString(),
                    if (std.ascii.isAlphabetic(value.operator.toString()[0])) " " else "",
                    try self.n(value.argument),
                },
            ),
            .update_expression => |value| self.f(
                "{s}{s}{s}",
                .{
                    if (value.prefix) value.operator.toString() else "",
                    try self.n(value.argument),
                    if (value.prefix) "" else value.operator.toString(),
                },
            ),
            .conditional_expression => |value| self.f(
                "{s}?{s}:{s}",
                .{ try self.n(value.@"test"), try self.n(value.consequent), try self.n(value.alternate) },
            ),
            .sequence_expression => |value| self.list(value.expressions, ","),
            .call_expression => |value| self.f(
                "{s}{s}({s})",
                .{ try self.n(value.callee), if (value.optional) "?." else "", try self.arguments(value.arguments) },
            ),
            .new_expression => |value| self.f("new {s}({s})", .{ try self.n(value.callee), try self.arguments(value.arguments) }),
            .member_expression => |value| self.f(
                "{s}{s}{s}",
                .{
                    try self.n(value.object),
                    if (value.optional) "?." else if (value.computed) "" else ".",
                    try self.key(value.property, value.computed),
                },
            ),
            .await_expression => |value| self.f("await {s}", .{try self.n(value.argument)}),
            .yield_expression => |value| self.f("yield{s}{s}", .{ if (value.argument == .null) "" else " ", try self.n(value.argument) }),
            .spread_element => |value| self.f("...{s}", .{try self.n(value.argument)}),
            .binding_rest_element => |value| self.f("...{s}", .{try self.n(value.argument)}),
            .array_expression => |value| self.f("[{s}{s}]", .{ try self.list(value.elements, ","), if (self.trailingComma(index)) "," else "" }),
            .array_pattern => |value| self.f(
                "[{s}{s}{s}{s}]",
                .{
                    try self.list(value.elements, ","),
                    if (value.rest != .null and tree.extra(value.elements).len != 0) "," else "",
                    try self.n(value.rest),
                    if (value.rest == .null and self.trailingComma(index)) "," else "",
                },
            ),
            .object_expression => |value| self.f("{{{s}}}", .{try self.list(value.properties, ",")}),
            .object_pattern => |value| self.f(
                "{{{s}{s}{s}}}",
                .{
                    try self.list(value.properties, ","),
                    if (value.rest != .null and tree.extra(value.properties).len != 0) "," else "",
                    try self.n(value.rest),
                },
            ),
            .binding_property => |value| self.f(
                "{s}{s}{s}",
                .{
                    if (value.shorthand) "" else try self.key(value.key, value.computed),
                    if (value.shorthand) "" else ":",
                    try self.n(value.value),
                },
            ),
            .object_property => |value| blk: {
                if (!value.method and value.kind == .init) break :blk self.f(
                    "{s}{s}{s}",
                    .{
                        if (value.shorthand) "" else try self.key(value.key, value.computed),
                        if (value.shorthand) "" else ":",
                        try self.direct(value.value),
                    },
                );
                const function = tree.data(value.value).function;
                break :blk self.f(
                    "{s}{s}{s}{s}{s}{s}",
                    .{
                        if (function.async) "async " else "",
                        if (function.generator) "*" else "",
                        if (value.kind == .init) "" else if (value.kind == .get) "get " else "set ",
                        try self.key(value.key, value.computed),
                        try self.params(function.params),
                        try self.n(function.body),
                    },
                );
            },
            .class => |value| self.f(
                "class{s}{s}{s}{s}{s}",
                .{
                    if (value.id == .null) "" else " ",
                    try self.n(value.id),
                    if (value.super_class == .null) "" else " extends ",
                    try self.n(value.super_class),
                    try self.n(value.body),
                },
            ),
            .class_body => |value| self.f("{{{s}}}", .{try self.list(value.body, "")}),
            .method_definition => |value| blk: {
                const function = tree.data(value.value).function;
                const private = tree.data(value.key) == .private_identifier;
                if (private) self.untracked_syntax += 1;
                defer if (private) {
                    self.untracked_syntax -= 1;
                };
                break :blk self.f(
                    "{s}{s}{s}{s}{s}{s}{s}",
                    .{
                        if (value.static) "static " else "",
                        if (function.async) "async " else "",
                        if (function.generator) "*" else "",
                        if (value.kind == .get) "get " else if (value.kind == .set) "set " else "",
                        try self.key(value.key, value.computed),
                        try self.params(function.params),
                        try self.n(function.body),
                    },
                );
            },
            .property_definition => |value| self.f(
                "{s}{s}{s}{s};",
                .{
                    if (value.static) "static " else "",
                    try self.n(value.key),
                    if (value.value == .null) "" else " = ",
                    try self.n(value.value),
                },
            ),
            .static_block => |value| blk: {
                self.untracked_syntax += 1;
                const contents = try self.list(value.body, " ");
                self.untracked_syntax -= 1;
                break :blk self.f("static {{{s}}}", .{contents});
            },
            .template_element => |value| tree.string(value.raw),
            .template_literal => |value| blk: {
                var out: std.ArrayList(u8) = .empty;
                try out.append(self.allocator, '`');
                const quasis = tree.extra(value.quasis);
                const expressions = tree.extra(value.expressions);
                for (quasis, 0..) |quasi, i| {
                    try out.appendSlice(self.allocator, try self.n(quasi));
                    if (i < expressions.len)
                        try out.appendSlice(self.allocator, try self.f("${{{s}}}", .{try self.n(expressions[i])}));
                }
                try out.append(self.allocator, '`');
                break :blk out.toOwnedSlice(self.allocator);
            },
            .tagged_template_expression => |value| self.f("{s}{s}", .{ try self.n(value.tag), try self.n(value.quasi) }),
            .meta_property => |value| self.f("{s}.{s}", .{ try self.n(value.meta), try self.n(value.property) }),
            .import_expression => |value| self.f(
                "import({s}{s}{s})",
                .{ try self.n(value.source), if (value.options == .null) "" else ",", try self.direct(value.options) },
            ),
            .import_default_specifier => |value| self.n(value.local),
            .import_namespace_specifier => |value| self.f("* as {s}", .{try self.n(value.local)}),
            .import_specifier => |value| if (tree.span(value.imported).start == tree.span(value.local).start)
                self.n(value.local)
            else
                self.f("{s} as {s}", .{ try self.n(value.imported), try self.n(value.local) }),
            .export_specifier => |value| if (tree.span(value.local).start == tree.span(value.exported).start and std.mem.eql(u8, try self.n(value.local), try self.n(value.exported)))
                self.n(value.local)
            else
                self.f("{s} as {s}", .{ try self.n(value.local), try self.n(value.exported) }),
            .import_declaration => |value| self.f(
                "import {s}{s}{s}",
                .{
                    try self.specifiers(value.specifiers, true),
                    if (tree.extra(value.specifiers).len == 0) "" else " from ",
                    try self.n(value.source),
                },
            ),
            .export_named_declaration => |value| if (value.declaration != .null) self.f("export {s}", .{try self.n(value.declaration)}) else self.f(
                "export {s}{s}{s}",
                .{
                    try self.specifiers(value.specifiers, false),
                    if (value.source == .null) "" else " from ",
                    try self.n(value.source),
                },
            ),
            .export_default_declaration => |value| self.f("export default {s}", .{try self.n(value.declaration)}),
            .export_all_declaration => |value| self.f(
                "export *{s}{s} from {s}",
                .{ if (value.exported == .null) "" else " as ", try self.n(value.exported), try self.n(value.source) },
            ),
            else => error.UnsupportedRenderSyntax,
        };
    }

    fn specifiers(self: *@This(), range: ast.IndexRange, imports: bool) Error![]const u8 {
        var out: std.ArrayList(u8) = .empty;
        var named = false;
        for (self.tree.extra(range), 0..) |index, i| {
            if (i != 0) try out.append(self.allocator, ',');
            const next_named = if (imports) self.tree.data(index) == .import_specifier else self.tree.data(index) == .export_specifier;
            if (next_named and !named) try out.append(self.allocator, '{');
            if (named and !next_named) try out.append(self.allocator, '}');
            try out.appendSlice(self.allocator, try self.n(index));
            named = next_named;
        }
        if (named) try out.append(self.allocator, '}');
        return out.toOwnedSlice(self.allocator);
    }
};

test "canonical rendering preserves original punctuation and literal spelling" {
    const allocator = std.testing.allocator;
    var tree = try parser.parse(allocator, "var x = 0x10; function f(a) { return (a + x); } console.log(f(2))", .{});
    defer tree.deinit();
    const output = try render(allocator, &tree);
    defer allocator.free(output);
    try std.testing.expectEqualStrings("var x=0x10;function f(a){return (a+x);}console.log(f(2))", output);
}

test "canonical import rendering follows Babel source forms" {
    const allocator = std.testing.allocator;
    const cases = [_]struct {
        source: []const u8,
        expected: []const u8,
    }{
        .{ .source = "import data from 'x' with {type:'json'};", .expected = "import data from 'x'" },
        .{ .source = "export * as ns from 'x';", .expected = "export * as ns from 'x'" },
        .{ .source = "import('x',{with:{type:'json'}});", .expected = "import('x',{with:{type:'json'}});" },
    };
    for (cases) |case| {
        var tree = try parser.parse(allocator, case.source, .{ .source_type = .module });
        defer tree.deinit();
        const output = try render(allocator, &tree);
        defer allocator.free(output);
        try std.testing.expectEqualStrings(case.expected, output);
    }
}

//! Flatten: a function's body moves to a new, decoupled top-level function,
//! leaving the original (same name, same params, callers unaffected) as a
//! thin wrapper that builds a proxy object and calls through to it. Any
//! variable the body closes over from an enclosing scope becomes a
//! getter/setter (or, for one called as a function, a same-`this`-safe
//! shim method) on that proxy instead of a direct reference — so the
//! function that actually runs the logic no longer lexically sits where
//! it's declared, and closure state passes through an opaque property
//! instead of a real closure. Port of js-confuser's `transforms/flatten.ts`.
//!
//! Two deliberate simplifications:
//! - The original forwards the wrapper's own parameters to the flattened
//!   function packed into one array, destructured back out of an array
//!   pattern on the other end (`function f(...args) {...}` calling
//!   `flat(obj, [a, b] = args)`-shaped). This forwards them by name
//!   instead (`flat(obj, a, b)`), leaving the wrapper's own signature —
//!   and therefore `fn.length` — untouched. Same closure-hiding value,
//!   without introducing array-pattern-destructured parameters as new AST
//!   surface. It does give up the original's *own* signature-shape
//!   hiding on the wrapper, which is a real but smaller loss.
//! - A captured variable used only as `typeof x` gets the same standard
//!   getter/setter as an ordinary read — `typeof (proxy.p)` and `typeof x`
//!   give identical answers since the getter's whole body is `return x;`,
//!   so the original's separate typeof-flavored property isn't a
//!   correctness requirement, just a micro-optimization skipped here. The
//!   call-shim property *is* kept (see below) — that one is load-bearing.
//!
//! The property doing real work here: a captured variable that's *called*
//! (`x(...)`) needs its own method-shaped property whose body does
//! `return x(...args)` as a plain call, rather than being read through the
//! standard getter and invoked as `proxy.p(...)` — the latter would call
//! `x` with `this` bound to the proxy object instead of whatever `x()`
//! itself would have used. Skipping this distinction would be a real,
//! silent `this`-corruption bug for any captured function that reads its
//! own `this`.
//!
//! Excluded, matching the original: generators, anything nested under a
//! method/property (same reasoning as variable_masking.zig — getters and
//! setters have a fixed arity the engine enforces, though flatten doesn't
//! change arity itself, keeping this restriction is one less interaction
//! to reason about for no real loss), and a function with an explicit
//! `"use strict"` directive of its own (the original converts to a
//! non-simple-parameter workaround there; skipped as a rare case for
//! bundled output, which is strict by being a module, not by scattering
//! explicit directives — module-implied strictness doesn't trip the
//! non-simple-parameter restriction this exists to route around).
//!
//! Needs the pre-mutation `Semantic` snapshot — see obfuscate.zig's
//! pipeline comment.

const std = @import("std");
const parser = @import("parser");
const ast = parser.ast;
const transform = parser.traverser.transform;
const Action = parser.traverser.Action;
const Semantic = parser.semantic.Semantic;
const SymbolId = parser.traverser.semantic.SymbolId;
const ScopeId = parser.traverser.semantic.ScopeId;

const no_span: ast.Span = .{ .start = 0, .end = 0 };

fn isSelfOrDescendant(semantic: Semantic, scope: ScopeId, of: ScopeId) bool {
    var it = semantic.scopes.ancestors(scope);
    while (it.next()) |id| {
        if (id == of) return true;
    }
    return false;
}

fn isProperAncestor(semantic: Semantic, ancestor: ScopeId, of: ScopeId) bool {
    var it = semantic.scopes.ancestors(of);
    _ = it.next(); // skip `of` itself -- only ancestors count as "outside"
    while (it.next()) |id| {
        if (id == ancestor) return true;
    }
    return false;
}

const CaptureInfo = struct {
    name: []const u8, // owned
    standard_prop: ?[]const u8 = null, // owned
    call_prop: ?[]const u8 = null, // owned
    needs_setter: bool = false,
    is_const: bool = false,
};

pub const Visitor = struct {
    allocator: std.mem.Allocator,
    semantic: Semantic,
    counter: u32 = 0,
    pending: std.ArrayList(ast.NodeIndex) = .empty,
    err: ?std.mem.Allocator.Error = null,

    pub fn init(allocator: std.mem.Allocator, semantic: Semantic) Visitor {
        return .{ .allocator = allocator, .semantic = semantic };
    }

    pub fn deinit(self: *Visitor) void {
        self.pending.deinit(self.allocator);
    }

    fn hasUseStrictDirective(ctx: *transform.Ctx, body: ast.FunctionBody) bool {
        const stmts = ctx.tree.extra(body.body);
        if (stmts.len == 0) return false;
        return switch (ctx.tree.data(stmts[0])) {
            .directive => |d| std.mem.eql(u8, ctx.tree.string(d.value), "use strict"),
            else => false,
        };
    }

    fn generateProp(self: *Visitor, counter: *u32) ![]const u8 {
        var buf: [16]u8 = undefined;
        const text = std.fmt.bufPrint(&buf, "p{d}", .{counter.*}) catch unreachable;
        counter.* += 1;
        return self.allocator.dupe(u8, text);
    }

    pub fn enter_function(
        self: *Visitor,
        func: ast.Function,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) !Action {
        try self.tryFlatten(func, index, ctx);
        return .proceed;
    }

    fn tryFlatten(self: *Visitor, func: ast.Function, index: ast.NodeIndex, ctx: *transform.Ctx) !void {
        if (@intFromEnum(index) >= self.semantic.node_references.len) return;
        if (func.generator) return;
        if (func.body == .null) return;
        if (hasUseStrictDirective(ctx, ctx.tree.data(func.body).function_body)) return;

        if (self.semantic.parentOf(index)) |parent| {
            switch (ctx.tree.data(parent)) {
                .object_property, .method_definition => return,
                else => {},
            }
        }

        // Every param must be a simple `binding_identifier` -- checked
        // *before* anything below mutates the tree, not during the
        // param-copying loop further down. The capture-scanning loop right
        // after this rewrites every captured reference in place as it
        // finds them (`rewriteReference`, called mid-scan, not deferred
        // until some later "is this safe" check) -- bailing out *after*
        // that on a non-simple param left every rewritten reference
        // pointing at a `flat_object_name` that no wrapper-building code
        // ever went on to declare, since the function returned before
        // reaching it. Not hypothetical: `function f(x, y = 1) {}`
        // capturing an outer variable produced `__obf_flatobj0["p0"]` with
        // `__obf_flatobj0` never declared anywhere -- a `ReferenceError`
        // on every call. See this file's own test for the repro.
        {
            const orig_params = ctx.tree.data(func.params).formal_parameters;
            for (ctx.tree.extra(orig_params.items)) |p_idx| {
                const pattern = switch (ctx.tree.data(p_idx)) {
                    .formal_parameter => |p| p.pattern,
                    else => return, // non-simple param shape somewhere unexpected -- leave this function untouched
                };
                if (ctx.tree.data(pattern) != .binding_identifier) return; // destructured/defaulted param -- bail
            }
        }

        const function_scope = self.semantic.scopeOf(index);

        // Computed up front, not just once captures are known to exist:
        // every capture site needs to be rewritten to reference this name
        // *as it's found*, during the same scan that discovers captures.
        var name_buf: [24]u8 = undefined;
        const flat_object_name = try self.allocator.dupe(
            u8,
            std.fmt.bufPrint(&name_buf, "__obf_flatobj{d}", .{self.counter}) catch unreachable,
        );
        defer self.allocator.free(flat_object_name);
        const new_fn_name = try self.allocator.dupe(
            u8,
            std.fmt.bufPrint(&name_buf, "__obf_flat{d}", .{self.counter}) catch unreachable,
        );
        defer self.allocator.free(new_fn_name);
        self.counter += 1;

        var captures: std.AutoHashMapUnmanaged(SymbolId, CaptureInfo) = .empty;
        defer {
            var it = captures.valueIterator();
            while (it.next()) |cap| {
                self.allocator.free(cap.name);
                if (cap.standard_prop) |p| self.allocator.free(p);
                if (cap.call_prop) |p| self.allocator.free(p);
            }
            captures.deinit(self.allocator);
        }

        var prop_counter: u32 = 0;

        for (self.semantic.references) |ref| {
            if (ref.symbol == .none) continue;
            if (ref.flags.space != .value) continue;
            if (!isSelfOrDescendant(self.semantic, ref.scope, function_scope)) continue;
            const sym = self.semantic.symbol(ref.symbol);
            if (!isProperAncestor(self.semantic, sym.scope, function_scope)) continue;

            const name = ctx.tree.string(sym.name);
            if (std.mem.eql(u8, name, "arguments")) continue;

            const gop = try captures.getOrPut(self.allocator, ref.symbol);
            if (!gop.found_existing) {
                gop.value_ptr.* = .{ .name = try self.allocator.dupe(u8, name), .is_const = sym.flags.const_var };
            }
            const cap = gop.value_ptr;
            if (ref.flags.write and !cap.is_const) cap.needs_setter = true;

            const is_call = blk: {
                const parent = self.semantic.parentOf(ref.node) orelse break :blk false;
                break :blk switch (ctx.tree.data(parent)) {
                    .call_expression => |c| c.callee == ref.node,
                    else => false,
                };
            };

            const prop = if (is_call) prop: {
                if (cap.call_prop == null) cap.call_prop = try self.generateProp(&prop_counter);
                break :prop cap.call_prop.?;
            } else prop: {
                if (cap.standard_prop == null) cap.standard_prop = try self.generateProp(&prop_counter);
                break :prop cap.standard_prop.?;
            };

            try self.rewriteReference(ctx, ref.node, flat_object_name, prop);
        }

        if (captures.count() == 0) return;

        var properties: std.ArrayList(ast.NodeIndex) = .empty;
        defer properties.deinit(self.allocator);
        var it = captures.iterator();
        while (it.next()) |entry| {
            const cap = entry.value_ptr;
            if (cap.standard_prop) |prop| {
                try properties.append(self.allocator, try self.buildGetter(ctx, prop, cap.name));
                if (cap.needs_setter) {
                    try properties.append(self.allocator, try self.buildSetter(ctx, prop, cap.name));
                }
            }
            if (cap.call_prop) |prop| {
                try properties.append(self.allocator, try self.buildCallShim(ctx, prop, cap.name));
            }
        }

        // var __obf_flatobjN = { ...properties };
        const flat_object_expr = try ctx.tree.addNode(
            .{ .object_expression = .{ .properties = try ctx.tree.addExtra(properties.items) } },
            no_span,
        );
        const flat_object_binding = try ctx.tree.addNode(
            .{ .binding_identifier = .{ .name = try ctx.tree.addString(flat_object_name) } },
            no_span,
        );
        const flat_object_decl = try ctx.tree.addNode(.{ .variable_declaration = .{
            .kind = .@"var",
            .declarators = try ctx.tree.addExtra(&.{try ctx.tree.addNode(
                .{ .variable_declarator = .{ .id = flat_object_binding, .init = flat_object_expr } },
                no_span,
            )}),
            .declare = false,
        } }, no_span);

        // Build fresh param nodes for the new function (same names, own
        // nodes -- never share a binding/scope-carrying node across two
        // functions, see this project's established discipline) and,
        // separately, fresh reference nodes forwarding the wrapper's own
        // params by name in the call.
        const orig_params = ctx.tree.data(func.params).formal_parameters;
        const orig_param_nodes = ctx.tree.extra(orig_params.items);

        var new_params: std.ArrayList(ast.NodeIndex) = .empty;
        defer new_params.deinit(self.allocator);
        var forward_args: std.ArrayList(ast.NodeIndex) = .empty;
        defer forward_args.deinit(self.allocator);
        try new_params.ensureTotalCapacityPrecise(self.allocator, orig_param_nodes.len + 1);
        try forward_args.ensureTotalCapacityPrecise(self.allocator, orig_param_nodes.len + 1);
        forward_args.appendAssumeCapacity(try ctx.tree.addNode(
            .{ .identifier_reference = .{ .name = try ctx.tree.addString(flat_object_name) } },
            no_span,
        ));
        // The flattened function's own first parameter -- its body
        // accesses every capture through this name (rewritten above), so
        // it has to actually be bound here, not just referenced.
        new_params.appendAssumeCapacity(try ctx.tree.addNode(.{ .formal_parameter = .{
            .pattern = try ctx.tree.addNode(
                .{ .binding_identifier = .{ .name = try ctx.tree.addString(flat_object_name) } },
                no_span,
            ),
        } }, no_span));

        for (orig_param_nodes) |p_idx| {
            // Shape already verified above, before the capture-rewriting
            // loop ran -- `unreachable`, not another bail-out `return`
            // here: returning at this point would repeat the exact bug
            // this function's own top-of-function pre-check exists to
            // prevent (see that comment), just one step further from the
            // mutation that makes it unsafe.
            const pattern = switch (ctx.tree.data(p_idx)) {
                .formal_parameter => |p| p.pattern,
                else => unreachable,
            };
            if (ctx.tree.data(pattern) != .binding_identifier) unreachable;
            const param_name = ctx.tree.string(ctx.tree.data(pattern).binding_identifier.name);
            const owned_param_name = try self.allocator.dupe(u8, param_name);
            defer self.allocator.free(owned_param_name);

            const new_binding = try ctx.tree.addNode(
                .{ .binding_identifier = .{ .name = try ctx.tree.addString(owned_param_name) } },
                no_span,
            );
            new_params.appendAssumeCapacity(try ctx.tree.addNode(
                .{ .formal_parameter = .{ .pattern = new_binding } },
                no_span,
            ));
            forward_args.appendAssumeCapacity(try ctx.tree.addNode(
                .{ .identifier_reference = .{ .name = try ctx.tree.addString(owned_param_name) } },
                no_span,
            ));
        }

        const new_formal_params = try ctx.tree.addNode(.{ .formal_parameters = .{
            .items = try ctx.tree.addExtra(new_params.items),
            .rest = .null,
            .kind = .formal_parameters,
        } }, no_span);

        // New top-level function keeps the original body's statements
        // verbatim (captured-variable references were already rewritten
        // above; param references keep resolving correctly by ordinary
        // lexical scoping once nested under the fresh params built here).
        // Capture the original statement range and give it a *fresh*
        // function_body node -- reusing `func.body`'s own index directly
        // would alias it with the wrapper body written below, since both
        // would then be the very same node.
        const original_body_range = ctx.tree.data(func.body).function_body.body;
        const new_fn_body = try ctx.tree.addNode(
            .{ .function_body = .{ .body = original_body_range } },
            no_span,
        );
        const new_fn_id = try ctx.tree.addNode(
            .{ .binding_identifier = .{ .name = try ctx.tree.addString(new_fn_name) } },
            no_span,
        );
        const new_fn_decl = try ctx.tree.addNode(.{ .function = .{
            .type = .function_declaration,
            .id = new_fn_id,
            .params = new_formal_params,
            .body = new_fn_body,
            .generator = false,
            .async = func.async,
        } }, no_span);
        try self.pending.append(self.allocator, new_fn_decl);

        // Wrapper body: var flatobj = {...}; return flat(flatobj, ...params);
        const call_callee = try ctx.tree.addNode(
            .{ .identifier_reference = .{ .name = try ctx.tree.addString(new_fn_name) } },
            no_span,
        );
        const call_expr = try ctx.tree.addNode(.{ .call_expression = .{
            .callee = call_callee,
            .type_arguments = .null,
            .arguments = try ctx.tree.addExtra(forward_args.items),
            .optional = false,
        } }, no_span);
        const return_stmt = try ctx.tree.addNode(.{ .return_statement = .{ .argument = call_expr } }, no_span);
        const new_body = try ctx.tree.addNode(.{ .function_body = .{
            .body = try ctx.tree.addExtra(&.{ flat_object_decl, return_stmt }),
        } }, no_span);

        ctx.tree.setData(func.body, ctx.tree.data(new_body));
    }

    fn rewriteReference(
        self: *Visitor,
        ctx: *transform.Ctx,
        node: ast.NodeIndex,
        flat_object_name: []const u8,
        prop: []const u8,
    ) !void {
        _ = self;
        const object_ref = try ctx.tree.addNode(
            .{ .identifier_reference = .{ .name = try ctx.tree.addString(flat_object_name) } },
            no_span,
        );
        const prop_lit = try ctx.tree.addNode(
            .{ .string_literal = .{ .value = try ctx.tree.addString(prop) } },
            no_span,
        );
        ctx.tree.setData(node, .{ .member_expression = .{
            .object = object_ref,
            .property = prop_lit,
            .computed = true,
            .optional = false,
        } });
    }

    fn buildGetter(self: *Visitor, ctx: *transform.Ctx, prop: []const u8, name: []const u8) !ast.NodeIndex {
        _ = self;
        const name_ref = try ctx.tree.addNode(
            .{ .identifier_reference = .{ .name = try ctx.tree.addString(name) } },
            no_span,
        );
        const ret = try ctx.tree.addNode(.{ .return_statement = .{ .argument = name_ref } }, no_span);
        const body = try ctx.tree.addNode(.{ .function_body = .{ .body = try ctx.tree.addExtra(&.{ret}) } }, no_span);
        const params = try ctx.tree.addNode(.{ .formal_parameters = .{
            .items = try ctx.tree.addExtra(&.{}),
            .rest = .null,
            .kind = .formal_parameters,
        } }, no_span);
        const value = try ctx.tree.addNode(.{ .function = .{
            .type = .function_expression,
            .id = .null,
            .params = params,
            .body = body,
            .generator = false,
            .async = false,
        } }, no_span);
        const key = try ctx.tree.addNode(.{ .string_literal = .{ .value = try ctx.tree.addString(prop) } }, no_span);
        return ctx.tree.addNode(.{
            .object_property = .{
                .key = key,
                .value = value,
                .kind = .get,
                .method = false,
                .shorthand = false,
                // `true`, not `false`: the key is a string_literal today, but
                // array_extraction/duplicate_literals_removal run later and
                // rewrite string literals into array-lookup expressions
                // wherever they appear -- a non-computed key position can't
                // hold an expression, only a computed one can, regardless of
                // what ends up there. Getters/setters/methods all accept a
                // computed name in ES6+.
                .computed = true,
            },
        }, no_span);
    }

    fn buildSetter(self: *Visitor, ctx: *transform.Ctx, prop: []const u8, name: []const u8) !ast.NodeIndex {
        _ = self;
        const value_binding = try ctx.tree.addNode(
            .{ .binding_identifier = .{ .name = try ctx.tree.addString("v") } },
            no_span,
        );
        const value_param = try ctx.tree.addNode(.{ .formal_parameter = .{ .pattern = value_binding } }, no_span);
        const params = try ctx.tree.addNode(.{ .formal_parameters = .{
            .items = try ctx.tree.addExtra(&.{value_param}),
            .rest = .null,
            .kind = .formal_parameters,
        } }, no_span);

        const name_ref = try ctx.tree.addNode(
            .{ .identifier_reference = .{ .name = try ctx.tree.addString(name) } },
            no_span,
        );
        const value_ref = try ctx.tree.addNode(
            .{ .identifier_reference = .{ .name = try ctx.tree.addString("v") } },
            no_span,
        );
        const assign = try ctx.tree.addNode(.{ .assignment_expression = .{
            .left = name_ref,
            .right = value_ref,
            .operator = .assign,
        } }, no_span);
        const stmt = try ctx.tree.addNode(.{ .expression_statement = .{ .expression = assign } }, no_span);
        const body = try ctx.tree.addNode(.{ .function_body = .{ .body = try ctx.tree.addExtra(&.{stmt}) } }, no_span);
        const value = try ctx.tree.addNode(.{ .function = .{
            .type = .function_expression,
            .id = .null,
            .params = params,
            .body = body,
            .generator = false,
            .async = false,
        } }, no_span);
        const key = try ctx.tree.addNode(.{ .string_literal = .{ .value = try ctx.tree.addString(prop) } }, no_span);
        return ctx.tree.addNode(.{
            .object_property = .{
                .key = key,
                .value = value,
                .kind = .set,
                .method = false,
                .shorthand = false,
                // `true`, not `false`: the key is a string_literal today, but
                // array_extraction/duplicate_literals_removal run later and
                // rewrite string literals into array-lookup expressions
                // wherever they appear -- a non-computed key position can't
                // hold an expression, only a computed one can, regardless of
                // what ends up there. Getters/setters/methods all accept a
                // computed name in ES6+.
                .computed = true,
            },
        }, no_span);
    }

    fn buildCallShim(self: *Visitor, ctx: *transform.Ctx, prop: []const u8, name: []const u8) !ast.NodeIndex {
        _ = self;
        const args_binding = try ctx.tree.addNode(
            .{ .binding_identifier = .{ .name = try ctx.tree.addString("args") } },
            no_span,
        );
        const rest = try ctx.tree.addNode(.{ .binding_rest_element = .{ .argument = args_binding } }, no_span);
        const params = try ctx.tree.addNode(.{ .formal_parameters = .{
            .items = try ctx.tree.addExtra(&.{}),
            .rest = rest,
            .kind = .formal_parameters,
        } }, no_span);

        const callee = try ctx.tree.addNode(
            .{ .identifier_reference = .{ .name = try ctx.tree.addString(name) } },
            no_span,
        );
        const args_ref = try ctx.tree.addNode(
            .{ .identifier_reference = .{ .name = try ctx.tree.addString("args") } },
            no_span,
        );
        const spread = try ctx.tree.addNode(.{ .spread_element = .{ .argument = args_ref } }, no_span);
        const call = try ctx.tree.addNode(.{ .call_expression = .{
            .callee = callee,
            .type_arguments = .null,
            .arguments = try ctx.tree.addExtra(&.{spread}),
            .optional = false,
        } }, no_span);
        const ret = try ctx.tree.addNode(.{ .return_statement = .{ .argument = call } }, no_span);
        const body = try ctx.tree.addNode(.{ .function_body = .{ .body = try ctx.tree.addExtra(&.{ret}) } }, no_span);
        const value = try ctx.tree.addNode(.{ .function = .{
            .type = .function_expression,
            .id = .null,
            .params = params,
            .body = body,
            .generator = false,
            .async = false,
        } }, no_span);
        const key = try ctx.tree.addNode(.{ .string_literal = .{ .value = try ctx.tree.addString(prop) } }, no_span);
        return ctx.tree.addNode(.{
            .object_property = .{
                .key = key,
                .value = value,
                .kind = .init,
                .method = false,
                .shorthand = false,
                // `true`, not `false`: the key is a string_literal today, but
                // array_extraction/duplicate_literals_removal run later and
                // rewrite string literals into array-lookup expressions
                // wherever they appear -- a non-computed key position can't
                // hold an expression, only a computed one can, regardless of
                // what ends up there. Getters/setters/methods all accept a
                // computed name in ES6+.
                .computed = true,
            },
        }, no_span);
    }

    pub fn exit_program(
        self: *Visitor,
        prog: ast.Program,
        index: ast.NodeIndex,
        ctx: *transform.Ctx,
    ) void {
        self.finishProgram(prog, index, ctx) catch |err| {
            self.err = err;
        };
    }

    fn finishProgram(self: *Visitor, prog: ast.Program, index: ast.NodeIndex, ctx: *transform.Ctx) !void {
        if (self.pending.items.len == 0) return;
        const original_body = ctx.tree.extra(prog.body);
        var new_body: std.ArrayList(ast.NodeIndex) = .empty;
        defer new_body.deinit(self.allocator);
        try new_body.ensureTotalCapacityPrecise(self.allocator, original_body.len + self.pending.items.len);
        new_body.appendSliceAssumeCapacity(self.pending.items);
        new_body.appendSliceAssumeCapacity(original_body);
        ctx.tree.setData(index, .{ .program = .{
            .source_type = prog.source_type,
            .body = try ctx.tree.addExtra(new_body.items),
            .hashbang = prog.hashbang,
        } });
    }
};

test "flattens a function's captured variables and runs identically" {
    const allocator = std.testing.allocator;
    const source =
        \\let counter = 0;
        \\function bump(step) {
        \\  counter = counter + step;
        \\  return counter;
        \\}
        \\function log(msg) {
        \\  console.log(msg);
        \\}
        \\function runAll() {
        \\  log("running");
        \\  return bump(2) + bump(3);
        \\}
        \\console.log(runAll(), counter);
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    const semantic = try parser.semantic.analyze(&tree);

    var visitor = Visitor.init(allocator, semantic);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_flat") != null);

    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const io = threaded.io();

    var tmp_dir = std.testing.tmpDir(.{});
    defer tmp_dir.cleanup();
    {
        var file = try tmp_dir.dir.createFile(io, "out.js", .{});
        defer file.close(io);
        try file.writeStreamingAll(io, result.code);
    }
    const path = try tmp_dir.dir.realPathFileAlloc(io, "out.js", allocator);
    defer allocator.free(path);

    const run = try std.process.run(allocator, io, .{ .argv = &.{ "bun", path } });
    defer allocator.free(run.stdout);
    defer allocator.free(run.stderr);

    try std.testing.expectEqualStrings("running\n7 5\n", run.stdout);
}

test "leaves a function with a captured variable and a defaulted param untouched, not half-flattened" {
    const allocator = std.testing.allocator;
    // `options = {}` is a non-simple (defaulted) param -- the
    // param-copying loop used to discover that *after* the capture scan
    // above it had already rewritten `outerCounter`'s references to
    // `flat_object_name["p0"]`, then bailed out without ever declaring
    // `flat_object_name`: every call threw `ReferenceError:
    // __obf_flatobj0 is not defined`. The fix checks param shapes first,
    // before any mutation, so this function should now come out
    // completely untouched by this pass -- proven by actually running the
    // output, not just checking it parses.
    const source =
        \\let outerCounter = 0;
        \\function useCounter(step, options = {}) {
        \\  outerCounter = outerCounter + step;
        \\  return outerCounter + (options.extra || 0);
        \\}
        \\console.log(useCounter(2), useCounter(3, { extra: 10 }));
    ;

    var tree = try parser.parse(allocator, source, .{});
    defer tree.deinit();
    const semantic = try parser.semantic.analyze(&tree);

    var visitor = Visitor.init(allocator, semantic);
    defer visitor.deinit();
    try transform.traverse(Visitor, &tree, &visitor);
    try std.testing.expect(visitor.err == null);

    const result = try parser.codegen.generate(allocator, &tree, .{});
    defer result.deinit(allocator);

    try std.testing.expect(std.mem.indexOf(u8, result.code, "__obf_flatobj") == null);

    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const io = threaded.io();

    var tmp_dir = std.testing.tmpDir(.{});
    defer tmp_dir.cleanup();
    {
        var file = try tmp_dir.dir.createFile(io, "out.js", .{});
        defer file.close(io);
        try file.writeStreamingAll(io, result.code);
    }
    const path = try tmp_dir.dir.realPathFileAlloc(io, "out.js", allocator);
    defer allocator.free(path);

    const run = try std.process.run(allocator, io, .{ .argv = &.{ "bun", path } });
    defer allocator.free(run.stdout);
    defer allocator.free(run.stderr);

    try std.testing.expectEqualStrings("2 15\n", run.stdout);
}

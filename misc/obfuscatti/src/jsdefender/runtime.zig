//! Shared JSDefender 2.12 runtime, recovered from modules 5068/949/1503/297.
//! Returned slices belong to this manager and remain valid until deinit().

const std = @import("std");
const source_map = @import("source_map.zig");
const parser = @import("parser");
const ast = parser.ast;
const scalars = @import("scalars.zig");
const data = @import("runtime_data.zig");
const embed = @import("embed_snippet.zig");
const Allocator = std.mem.Allocator;
pub const Error = Allocator.Error || error{RuntimeUnavailable};
pub const Substitution = struct {
    key: []const u8,
    value: []const u8,
};

pub const NameSource = struct {
    context: *anyopaque,
    generate: *const fn (*anyopaque, ?u32, Allocator) Allocator.Error![]const u8,
};

pub const Config = struct {
    es5: bool = false,
    name_source: ?NameSource = null,
    global_id: u32 = 10,
    runtime_id_counter: ?*u32 = null,
};

pub const NamePair = struct {
    left: []const u8,
    right: []const u8,
    full: []const u8,
};

pub const Sentinel = struct {
    mirror: []const u8,
    validation_property: []const u8,
    check_result: []const u8,
    sentinel: []const u8,
    sentries: []const u8,
    counter: []const u8 = "counter",
};

pub const Manager = struct {
    arena: std.heap.ArenaAllocator,
    config: Config,
    random: ?*scalars.Random,
    runtime_id: u32 = 12000000,
    global_id: u32,
    next_property: ?u32 = null,
    protector_name: ?[]const u8 = null,
    valid_property: ?[]const u8 = null,
    validation_property: ?[]const u8 = null,
    domain_lock_applied: bool = false,
    date_lock_applied: bool = false,
    setup: std.ArrayList([]const u8) = .empty,
    setup_origins: std.ArrayList(?source_map.Origin) = .empty,
    template_origins: std.StringHashMapUnmanaged([]const u8) = .empty,
    properties: std.StringHashMapUnmanaged([]const u8) = .empty,
    variables: std.StringHashMapUnmanaged([]const u8) = .empty,
    helpers: std.StringHashMapUnmanaged([]const u8) = .empty,
    pairs: std.StringHashMapUnmanaged(NamePair) = .empty,
    integers: std.AutoHashMapUnmanaged(u32, std.ArrayList([]const u8)) = .empty,
    characters: std.AutoHashMapUnmanaged(u8, []const u8) = .empty,
    strings: std.StringHashMapUnmanaged([]const u8) = .empty,
    state_accessors: std.AutoHashMapUnmanaged(u32, []const u8) = .empty,
    control_flow_states: ?[32]u32 = null,
    sentinel_info: ?Sentinel = null,
    completed: bool = false,
    active_tree: ?*ast.Tree = null,
    active_body: ast.NodeIndex = .null,
    injected_function: ast.NodeIndex = .null,

    pub fn init(allocator: Allocator, config: Config, random: ?*scalars.Random) Manager {
        return .{
            .arena = std.heap.ArenaAllocator.init(allocator),
            .config = config,
            .random = random,
            .global_id = config.global_id,
        };
    }

    pub fn deinit(self: *Manager) void {
        self.arena.deinit();
    }

    fn alloc(self: *Manager) Allocator {
        return self.arena.allocator();
    }

    fn fmt(self: *Manager, comptime format: []const u8, args: anytype) Allocator.Error![]const u8 {
        return std.fmt.allocPrint(self.alloc(), format, args);
    }

    fn randomInt(self: *Manager, lower: usize, upper: usize, fallback: usize) usize {
        return if (self.random) |random| @intFromFloat(random.getRandomInt(@floatFromInt(lower), @floatFromInt(upper))) else fallback;
    }

    fn pick(self: *Manager, values: []const []const u8) []const u8 {
        return values[self.randomInt(0, values.len, 0)];
    }

    fn name(self: *Manager, explicit: ?u32) Allocator.Error![]const u8 {
        if (self.config.name_source) |source| return source.generate(source.context, explicit, self.alloc());
        const id = explicit orelse self.global_id;
        self.global_id += 1;
        return scalars.mangleName(self.alloc(), id, .base62);
    }

    pub fn generateRuntimeName(self: *Manager) Allocator.Error![]const u8 {
        const id = if (self.config.runtime_id_counter) |counter| counter.* else self.runtime_id;
        if (self.config.runtime_id_counter) |counter| counter.* += 1 else self.runtime_id += 1;
        return self.name(id);
    }

    pub fn generateGlobalName(self: *Manager) Allocator.Error![]const u8 {
        return self.name(null);
    }

    pub fn generatePropertyName(self: *Manager) Allocator.Error![]const u8 {
        if (self.next_property == null) self.next_property = @as(u32, @intCast(self.randomInt(0, 100, 17))) ^ 91;
        var id = self.next_property.?;
        self.next_property = id + 1;
        const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        var out: std.ArrayList(u8) = .empty;
        try out.append(self.alloc(), alphabet[id % 52]);
        id /= 52;
        while (id != 0) : (id /= 62) try out.append(self.alloc(), alphabet[id % 62]);
        return out.toOwnedSlice(self.alloc());
    }

    fn push(self: *Manager, source: []const u8) Error!void {
        return self.pushOrigin(source, if (self.template_origins.get(source)) |origin| .{ .source = origin } else null);
    }

    fn pushOrigin(self: *Manager, source: []const u8, origin: ?source_map.Origin) Error!void {
        try self.setup.append(self.alloc(), try self.alloc().dupe(u8, source));
        try self.setup_origins.append(self.alloc(), origin);
        if (self.active_tree) |tree| {
            const first = tree.nodes.len;
            const added = try @import("nodes.zig").embedProgram(self.alloc(), tree, source);
            for (first..tree.nodes.len) |i| @import("nodes.zig").markDetached(tree, @fromBackingInt(@intCast(i)));
            var body = tree.data(self.active_body);
            const existing = switch (body) {
                .function_body => |value| value.body,
                .block_statement => |value| value.body,
                else => return error.RuntimeUnavailable,
            };
            const merged = try self.alloc().alloc(ast.NodeIndex, tree.extra(existing).len + tree.extra(added).len);
            @memcpy(merged[0..tree.extra(existing).len], tree.extra(existing));
            @memcpy(merged[tree.extra(existing).len..], tree.extra(added));
            const range = try tree.addExtra(merged);
            switch (body) {
                .function_body => |*value| value.body = range,
                .block_statement => |*value| value.body = range,
                else => unreachable,
            }
            tree.setData(self.active_body, body);
            source_map.registerEmbedded(self.alloc(), tree, first, origin, false) catch return error.RuntimeUnavailable;
            for (tree.extra(added)) |statement| @import("lexical_location.zig").registerEmbedded(self.alloc(), tree, statement, origin) catch |failure| switch (failure) {
                error.OutOfMemory => return error.OutOfMemory,
                else => return error.RuntimeUnavailable,
            };
        }
    }

    pub fn addSetup(self: *Manager, source: []const u8) Error!void {
        try self.initializeProtector();
        try self.push(source);
    }

    pub fn addSetupTemplate(self: *Manager, source: []const u8, template_source: []const u8) Error!void {
        try self.initializeProtector();
        try self.pushOrigin(source, .{ .source = try self.alloc().dupe(u8, template_source), .body_only = true });
    }

    pub fn getNamePair(self: *Manager, key: []const u8) Allocator.Error!NamePair {
        if (self.pairs.get(key)) |existing| return existing;
        const left = try self.generateRuntimeName();
        const right = try self.generateRuntimeName();
        const pair = NamePair{ .left = left, .right = right, .full = try self.fmt("{s}{s}", .{ left, right }) };
        try self.pairs.put(self.alloc(), try self.alloc().dupe(u8, key), pair);
        return pair;
    }

    pub fn namePair(self: *Manager, key: []const u8) Allocator.Error!NamePair {
        return self.getNamePair(key);
    }

    fn primeArray(self: *Manager) Allocator.Error![]const u8 {
        const count = self.randomInt(3, 7, 3);
        var start = self.randomInt(0, data.primes.len, data.primes.len / 2);
        var out: std.ArrayList(u8) = .empty;
        try out.append(self.alloc(), '[');
        for (0..count) |i| {
            if (i != 0) try out.append(self.alloc(), ',');
            try out.appendSlice(self.alloc(), try self.fmt("{d}", .{data.primes[start]}));
            start = (start + 1) % data.primes.len;
        }
        try out.append(self.alloc(), ']');
        return out.toOwnedSlice(self.alloc());
    }

    pub fn initializeProtector(self: *Manager) Error!void {
        if (self.protector_name != null) return;
        const offset: u32 = @intCast(self.randomInt(0, 10000, 0));
        if (self.config.runtime_id_counter) |counter| counter.* += offset else self.runtime_id += offset;
        self.protector_name = try self.generateRuntimeName();
        try self.push(try self.fmt("{s}={{}}", .{self.protector_name.?}));
        self.valid_property = try self.generatePropertyName();
        try self.push(try self.fmt("{s}.{s}=true", .{ self.protector_name.?, self.valid_property.? }));
        try self.properties.put(self.alloc(), "valid", self.valid_property.?);
        const fence = try self.addSetupVar("fence", try self.primeArray(), true);
        const mirror = try self.addSetupVar("mirror", try self.primeArray(), true);
        const embrace = try self.getNamePair("embrace");
        const get_protector = try self.getNamePair("getProtector");
        const sentries = try self.getNamePair("sentries");
        const source = try self.template(data.protector_template, &.{
            .{ .key = "fence", .value = fence },
            .{ .key = "mirror", .value = mirror },

            .{ .key = "embrace", .value = try self.protectString(embrace.full, false) },
            .{ .key = "embraceLeft", .value = try self.protectString(embrace.left, false) },

            .{ .key = "embraceRight", .value = try self.protectString(embrace.right, false) },
            .{ .key = "getProtector", .value = try self.protectString(get_protector.full, false) },

            .{ .key = "getProtectorLeft", .value = try self.protectString(get_protector.left, false) },
            .{ .key = "getProtectorRight", .value = try self.protectString(get_protector.right, false) },

            .{ .key = "sentriesLeft", .value = try self.protectString(sentries.left, false) },
            .{ .key = "sentriesRight", .value = try self.protectString(sentries.right, false) },
        }, false);
        try self.push(source);
    }

    pub fn addSetupVar(self: *Manager, key: []const u8, value: ?[]const u8, force_var: bool) Error![]const u8 {
        try self.initializeProtector();
        if (self.variables.get(key)) |existing| return existing;
        const generated = try self.generateRuntimeName();
        const kind = if (force_var or self.config.es5) "var" else "let";
        try self.push(
            if (value) |expr|
                try self.fmt("{s} {s}={s}", .{ kind, generated, expr })
            else
                try self.fmt("{s} {s}", .{ kind, generated }),
        );
        try self.variables.put(self.alloc(), try self.alloc().dupe(u8, key), generated);
        return generated;
    }

    pub fn reserveSetupVar(self: *Manager, key: []const u8) Error![]const u8 {
        try self.initializeProtector();
        if (self.variables.get(key)) |existing| return existing;
        const generated = try self.generateRuntimeName();
        try self.variables.put(self.alloc(), try self.alloc().dupe(u8, key), generated);
        return generated;
    }

    pub fn property(self: *Manager, key: []const u8) ?[]const u8 {
        return self.properties.get(key);
    }

    pub fn reserveProperty(self: *Manager, key: []const u8) Error![]const u8 {
        try self.initializeProtector();
        const generated = try self.generatePropertyName();
        try self.properties.put(self.alloc(), try self.alloc().dupe(u8, key), generated);
        return generated;
    }

    pub fn initProperty(self: *Manager, key: []const u8, value: []const u8) Error![]const u8 {
        const generated = try self.reserveProperty(key);
        try self.push(try self.fmt("{s}.{s}={s}", .{ self.protector_name.?, generated, value }));
        return generated;
    }

    pub fn initPropertyTemplate(
        self: *Manager,
        key: []const u8,
        value: []const u8,
        origin: []const u8,
    ) Error![]const u8 {
        const generated = try self.reserveProperty(key);
        try self.pushOrigin(
            try self.fmt("{s}.{s}={s}", .{ self.protector_name.?, generated, value }),
            .{ .source = try self.alloc().dupe(u8, origin), .body_only = true },
        );
        return generated;
    }

    pub fn initPropertyNode(self: *Manager, tree: *ast.Tree, key: []const u8, value: ast.NodeIndex) Error![]const u8 {
        const source = @import("render.zig").renderNode(self.alloc(), tree, value) catch |err| switch (err) {
            error.OutOfMemory => return error.OutOfMemory,
            else => return error.RuntimeUnavailable,
        };
        return self.initProperty(key, source);
    }

    pub fn stateAccessor(self: *Manager, value: u32) Error![]const u8 {
        try self.initializeProtector();
        const generated = if (self.state_accessors.get(value)) |existing| existing else blk: {
            const name_value = try self.generateGlobalName();
            try self.push(try self.fmt("{s}.{s}=function(){{return {d}}}", .{ self.protector_name.?, name_value, value }));
            try self.state_accessors.put(self.alloc(), value, name_value);
            break :blk name_value;
        };
        return self.fmt("{s}.{s}()", .{ self.protector_name.?, generated });
    }

    fn getter(self: *Manager, expression: []const u8) Error![]const u8 {
        const generated = try self.generateRuntimeName();
        try self.push(try self.fmt("function {s}(){{return {s}}}", .{ generated, expression }));
        return generated;
    }

    pub fn integerGetter(self: *Manager, number: u32) Error!?[]const u8 {
        const result = try self.integer(number);
        return if (result.is_getter) result.source else null;
    }

    pub fn integerExpr(self: *Manager, number: u32) Error![]const u8 {
        const result = try self.integer(number);
        return if (result.is_getter) self.fmt("{s}()", .{result.source}) else result.source;
    }
    const Integer = struct {
        source: []const u8,
        is_getter: bool,
    };

    fn integer(self: *Manager, number: u32) Error!Integer {
        try self.initializeProtector();
        if (number <= 2) return .{ .source = self.pick(switch (number) {
            0 => &data.zeroExpressions,
            1 => &data.oneExpressions,
            else => &data.twoExpressions,
        }), .is_getter = false };
        const limit: usize = if (number <= 5) 2 else 1;
        const existing = try self.integers.getOrPut(self.alloc(), number);
        if (!existing.found_existing) existing.value_ptr.* = .empty;
        if (existing.value_ptr.items.len >= limit)
            return .{ .source = self.pick(existing.value_ptr.items), .is_getter = true };
        const expression = if (number <= 5) blk: {
            const templates: []const []const u8 = switch (number) {
                3 => &data.threeExpressions,
                4 => &data.fourExpressions,
                else => &data.fiveExpressions,
            };
            var out: std.ArrayList(u8) = .empty;
            // Recovered code chooses SMALL_LEGO_INSTANCES % length for both
            // instances, rather than indexing by the current cache length.
            for (templates[2 % templates.len]) |ch| {
                if (ch >= '0' and ch <= '2')
                    try out.appendSlice(self.alloc(), try self.integerExpr(ch - '0'))
                else
                    try out.append(self.alloc(), ch);
            }
            break :blk try out.toOwnedSlice(self.alloc());
        } else blk: {
            const kind = self.randomInt(0, 3, 1);
            const factor: u32 = @intCast(self.randomInt(2, number / 2 + 1, 2));
            const quotient = number / factor;
            if (kind == 0) {
                const left = try self.integerExpr(quotient);
                const right = try self.integerExpr(number - quotient);
                break :blk try self.fmt("({s})+({s})", .{ left, right });
            }
            const multiplicand = number / quotient;
            const remainder = number - quotient * multiplicand;
            const left = try self.integerExpr(quotient);
            const right = try self.integerExpr(multiplicand);
            const rest = try self.integerExpr(remainder);
            break :blk if (kind == 1)
                try self.fmt("({s})+(({s})*({s}))", .{ rest, left, right })
            else
                try self.fmt("(({s})*({s}))+({s})", .{ left, right, rest });
        };
        const generated = try self.getter(expression);
        // Recursive integer creation can resize the map; reacquire its entry.
        try self.integers.getPtr(number).?.append(self.alloc(), generated);
        return .{ .source = generated, .is_getter = true };
    }

    fn characterGetter(self: *Manager, ch: u8) Error![]const u8 {
        if (self.characters.get(ch)) |existing| {
            _ = self.randomInt(0, 1, 0);
            return existing;
        }
        const choices = for (data.characters) |entry| {
            if (entry.value == ch) break entry.expressions;
        } else return error.RuntimeUnavailable;
        const expression = self.pick(choices);
        const expanded = if (expression[0] == ':') try self.expandLegos(expression[1..], false) else expression;
        const generated = try self.getter(expanded);
        try self.characters.put(self.alloc(), ch, generated);
        return generated;
    }

    pub fn stringGetter(self: *Manager, text: []const u8, use_trap: bool) Error![]const u8 {
        if (text.len == 0) return error.RuntimeUnavailable;
        if (self.strings.get(text)) |existing| {
            _ = self.randomInt(0, 1, 0);
            return existing;
        }
        try self.initializeProtector();
        if (text.len == 1) return self.characterGetter(text[0]);
        var trap: ?[]const u8 = null;
        var trap_position: usize = std.math.maxInt(usize);
        if (use_trap and text.len >= 3) {
            trap = try self.addBuiltin("getTrapString");
            if (!self.helpers.contains("hideConsole")) {
                const hide = try self.addBuiltin("hideConsole");
                try self.push(try self.fmt("{s}();", .{hide}));
            }
            trap_position = self.randomInt(1, text.len - 1, text.len - 2);
        }
        var expression = try self.fmt("{s}()", .{try self.characterGetter(text[0])});
        for (text[1..], 1..) |ch, i| {
            expression = try self.fmt("{s}+{s}()", .{ expression, try self.characterGetter(ch) });
            if (i == trap_position) if (trap) |name_value| {
                expression = try self.fmt("{s}+{s}()", .{ expression, name_value });
            };
        }
        const generated = try self.getter(expression);
        try self.strings.put(self.alloc(), try self.alloc().dupe(u8, text), generated);
        return generated;
    }

    pub fn protectString(self: *Manager, text: []const u8, use_trap: bool) Error![]const u8 {
        return self.fmt("({s}())", .{try self.stringGetter(text, use_trap)});
    }

    fn replaceAll(self: *Manager, source: []const u8, token: []const u8, replacement: []const u8) Allocator.Error![]const u8 {
        var out: std.ArrayList(u8) = .empty;
        var start: usize = 0;
        while (std.mem.indexOfPos(u8, source, start, token)) |pos| {
            try out.appendSlice(self.alloc(), source[start..pos]);
            try out.appendSlice(self.alloc(), replacement);
            start = pos + token.len;
        }
        try out.appendSlice(self.alloc(), source[start..]);
        return out.toOwnedSlice(self.alloc());
    }
    const Placeholder = struct {
        start: usize,
        end: usize,
        value: []const u8,
    };

    fn placeholder(source: []const u8, delimiter: u8, integer_value: bool) ?Placeholder {
        var start: usize = 0;
        while (std.mem.indexOfScalarPos(u8, source, start, delimiter)) |pos| {
            var end = pos + 1;
            while (end < source.len and (if (integer_value)
                std.ascii.isDigit(source[end])
            else
                (std.ascii.isAlphabetic(source[end]) or source[end] == '.'))) : (end += 1)
            {}
            if (end > pos + 1 and end < source.len and source[end] == delimiter)
                return .{ .start = pos, .end = end + 1, .value = source[pos + 1 .. end] };
            start = pos + 1;
        }
        return null;
    }

    fn expandLegos(self: *Manager, source: []const u8, use_trap: bool) Error![]const u8 {
        var result = source;
        while (placeholder(result, '#', true)) |token| {
            const number = std.fmt.parseInt(u32, token.value, 10) catch return error.RuntimeUnavailable;
            const expr = try self.integerExpr(number);
            result = try self.fmt("{s}{s}{s}", .{ result[0..token.start], expr, result[token.end..] });
        }
        while (placeholder(result, '$', false)) |token| {
            const name_value = try self.stringGetter(token.value, use_trap);
            result = try self.fmt("{s}{s}(){s}", .{ result[0..token.start], name_value, result[token.end..] });
        }
        return result;
    }

    pub fn template(
        self: *Manager,
        source: []const u8,
        substitutions: []const Substitution,
        use_trap: bool,
    ) Error![]const u8 {
        if (source.len == 0) return error.RuntimeUnavailable;
        var result = try self.replaceAll(source, "$LET", if (self.config.es5) "var" else "let");
        result = try self.replaceAll(result, "$CONST", if (self.config.es5) "var" else "const");
        result = try self.replaceAll(result, "$PROT", self.protector_name orelse "");
        for (substitutions) |sub| result = try self.replaceAll(result, try self.fmt("{{{{{s}}}}}", .{sub.key}), sub.value);
        const expanded = try self.expandLegos(result, use_trap);
        try self.template_origins.put(self.alloc(), expanded, expanded);
        return expanded;
    }
    pub const Shuffled = struct {
        shuffled: []const u8,
        size: u16,
        base: u16,
        index: u16,
    };

    pub fn shuffle(self: *Manager, text: []const u8, separator: u8, suggested_length: ?usize) Error!Shuffled {
        const target = (suggested_length orelse @as(usize, @intFromFloat(@floor(1.1 * @as(f64, @floatFromInt(text.len)))))) + 5;
        const prime = for (data.primes) |item| {
            if (item >= target) break item;
        } else return .{ .shuffled = "", .size = 0, .base = 0, .index = 0 };
        var candidates: std.ArrayList(u8) = .empty;
        var separator_available = false;
        for (data.shuffle_alphabet) |ch| {
            if (std.mem.indexOfScalar(u8, text, ch) != null) continue;
            if (ch == separator) {
                separator_available = true;
                continue;
            }
            try candidates.append(self.alloc(), ch);
        }
        if (!separator_available or candidates.items.len < 3)
            return .{ .shuffled = "", .size = 0, .base = 0, .index = 0 };
        var random = scalars.Random.init(123);
        var padded: std.ArrayList(u8) = .empty;
        try padded.appendSlice(self.alloc(), text);
        try padded.append(self.alloc(), separator);
        while (padded.items.len < prime - 1) try padded.append(self.alloc(), candidates.items[random.index(candidates.items.len)]);
        const roots = for (data.roots) |item| {
            if (item.prime == prime) break item.values;
        } else return error.RuntimeUnavailable;
        const base = roots[random.index(roots.len)];
        var index: u16 = @intCast(1 + random.index(prime - 1));
        const original_index = index;
        var shuffled: std.ArrayList(u8) = .empty;
        for (0..prime - 1) |_| {
            try shuffled.append(self.alloc(), padded.items[index - 1]);
            index = @intCast((@as(u32, index) * base) % prime);
        }
        return .{ .shuffled = try shuffled.toOwnedSlice(self.alloc()), .size = prime, .base = base, .index = original_index };
    }

    pub fn addBuiltin(self: *Manager, key: []const u8) Error![]const u8 {
        try self.initializeProtector();
        if (self.helpers.get(key)) |existing| return existing;
        const generated = try self.generateRuntimeName();
        const helper = for (data.helpers) |entry| {
            if (std.mem.eql(u8, key, entry.name)) break entry;
        } else return error.RuntimeUnavailable;
        var substitutions: std.ArrayList(Substitution) = .empty;
        for (helper.vars) |variable| try substitutions.append(self.alloc(), .{ .key = variable, .value = try self.addSetupVar(variable, null, false) });
        for (helper.dependencies) |dependency| try substitutions.append(self.alloc(), .{ .key = dependency, .value = try self.addBuiltin(dependency) });
        if (helper.strings.len != 0) {
            const decoder = try self.addBuiltin("decodeShuffledString");
            for (helper.strings) |string| {
                const choices = "<=>[]/().";
                const separator = choices[self.randomInt(0, choices.len, 0)];
                const shuffled = try self.shuffle(
                    string.value orelse string.key,
                    if (string.separator) |sep| sep[0] else separator,
                    string.suggested_length,
                );
                const getter_name = try self.stringGetter(
                    try self.fmt("{s}{c}", .{ shuffled.shuffled, separator }),
                    helper.use_trap or string.use_trap,
                );
                try substitutions.append(
                    self.alloc(),
                    .{
                        .key = try self.fmt("${s}", .{string.key}),
                        .value = try self.fmt(
                            "{s}({s}(), #{d}#, #{d}#, #{d}#)",
                            .{ decoder, getter_name, shuffled.size, shuffled.base, shuffled.index },
                        ),
                    },
                );
            }
        }
        const expanded = try self.template(helper.template, substitutions.items, false);
        // Every builtin is exactly one named function declaration. Rename only
        // its declaration identifier, retaining the recovered body verbatim.
        const start = (std.mem.indexOf(u8, expanded, "function ") orelse return error.RuntimeUnavailable) + "function ".len;
        const end = std.mem.indexOfScalarPos(u8, expanded, start, '(') orelse return error.RuntimeUnavailable;
        const renamed = try self.fmt("{s}{s}{s}", .{ expanded[0..start], generated, expanded[end..] });
        try self.template_origins.put(self.alloc(), renamed, expanded);
        try self.push(renamed);
        try self.helpers.put(self.alloc(), try self.alloc().dupe(u8, key), generated);
        return generated;
    }

    pub fn injectSentinel(self: *Manager, date_enabled: bool, domain_enabled: bool) Error!Sentinel {
        if (self.sentinel_info) |existing| return existing;
        const date_applied = (try self.integerGetter(if (date_enabled) 12 else 8)).?;
        const domain_applied = (try self.integerGetter(if (domain_enabled) 13 else 7)).?;
        const fence = try self.addSetupVar("fence", null, false);
        const mirror = try self.addSetupVar("mirror", null, false);
        const sentinel = try self.getNamePair("sentinel");
        const protector = try self.getNamePair("getProtector");
        const sentries = try self.getNamePair("sentries");
        const date_result = try self.getNamePair("dateResult");
        const domain_result = try self.getNamePair("domainResult");
        const validation = try self.getNamePair("validation");
        self.validation_property = validation.full;
        const check_result = try self.getNamePair("checkResult");
        var substitutions: std.ArrayList(Substitution) = .empty;
        try substitutions.appendSlice(
            self.alloc(),
            &.{
                .{ .key = "getGlobalObject", .value = try self.addBuiltin("getGlobalObject") },
                .{ .key = "fence", .value = fence },
                .{ .key = "mirror", .value = mirror },
                .{ .key = "dateApplied", .value = date_applied },
                .{ .key = "domainApplied", .value = domain_applied },
                .{ .key = "validationFlat", .value = validation.full },
            },
        );
        const items = [_]struct {
            key: []const u8,
            pair: NamePair,
        }{
            .{ .key = "sentinel", .pair = sentinel },
            .{ .key = "getProtector", .pair = protector },
            .{ .key = "sentries", .pair = sentries },
            .{ .key = "dateResult", .pair = date_result },
            .{ .key = "domainResult", .pair = domain_result },
            .{ .key = "validation", .pair = validation },
            .{ .key = "checkResult", .pair = check_result },
        };
        for (items) |item| {
            try substitutions.append(
                self.alloc(),
                .{ .key = item.key, .value = try self.protectString(item.pair.full, false) },
            );
            try substitutions.append(
                self.alloc(),
                .{ .key = try self.fmt("{s}Left", .{item.key}), .value = try self.protectString(item.pair.left, false) },
            );
            try substitutions.append(
                self.alloc(),
                .{ .key = try self.fmt("{s}Right", .{item.key}), .value = try self.protectString(item.pair.right, false) },
            );
        }
        try self.push(try self.template(data.sentinel_template, substitutions.items, false));
        const result = Sentinel{
            .mirror = mirror,
            .validation_property = validation.full,
            .check_result = check_result.full,
            .sentinel = sentinel.full,
            .sentries = sentries.full,
        };
        self.sentinel_info = result;
        return result;
    }

    pub fn completeProtector(self: *Manager) Error!void {
        if (self.completed) return;
        if (self.helpers.contains("hideConsole"))
            try self.push(try self.fmt("{s}()", .{try self.addBuiltin("restoreConsole")}));
        self.completed = true;
    }

    pub fn emitSource(self: *Manager) Error![]const u8 {
        if (self.protector_name == null) return "";
        try self.completeProtector();
        var out: std.ArrayList(u8) = .empty;
        try out.appendSlice(
            self.alloc(),
            try self.fmt("{s} {s};!function(){{\n", .{ if (self.config.es5) "var" else "let", self.protector_name.? }),
        );
        for (self.setup.items) |statement| {
            try out.appendSlice(self.alloc(), statement);
            try out.append(self.alloc(), '\n');
        }
        try out.appendSlice(self.alloc(), "}()");
        return out.toOwnedSlice(self.alloc());
    }

    pub fn finalize(self: *Manager, tree: *ast.Tree) Error!void {
        const runtime_source = try self.emitSource();
        if (runtime_source.len == 0) return;
        const runtime = try embed.embedProgram(self.alloc(), tree, runtime_source);
        const program = tree.data(tree.root).program;
        const original = tree.extra(program.body);
        var directive_count: usize = 0;
        while (directive_count < original.len and tree.data(original[directive_count]) == .directive) : (directive_count += 1) {}
        var body: std.ArrayList(ast.NodeIndex) = .empty;
        try body.appendSlice(self.alloc(), original[0..directive_count]);
        try body.appendSlice(self.alloc(), tree.extra(runtime));
        try body.appendSlice(self.alloc(), original[directive_count..]);
        var updated = program;
        updated.body = try tree.addExtra(body.items);
        tree.setData(tree.root, .{ .program = updated });
    }
};

test "runtime names cache draws and shuffle match original module oracle seed1" {
    var random = scalars.Random.init(1);
    var manager = Manager.init(std.testing.allocator, .{}, &random);
    defer manager.deinit();
    try manager.initializeProtector();
    try std.testing.expectEqualStrings("b8Aj", manager.protector_name.?);
    try std.testing.expectEqualStrings("Ib", manager.valid_property.?);
    try std.testing.expectEqual(@as(f64, 152607844), random.state);
    try std.testing.expectEqual(@as(u32, 82), manager.global_id);
    try std.testing.expectEqualStrings("TPih", try manager.addBuiltin("getString"));
    try std.testing.expectEqual(@as(f64, 1614285132), random.state);
    try std.testing.expectEqualStrings("bWog", try manager.stringGetter("Abc09_./()[]<=>", false));
    try std.testing.expectEqual(@as(f64, 798669970), random.state);
    try std.testing.expectEqualStrings("PAye()", try manager.integerExpr(65535));
    try std.testing.expectEqual(@as(f64, 911254352), random.state);
    try std.testing.expectEqualStrings("PAye()", try manager.integerExpr(65535));
    try std.testing.expectEqual(@as(f64, 1746007307), random.state);
    const shuffled = try manager.shuffle("return this", '<', 30);
    try std.testing.expectEqualStrings("ww>0.9NQT/Jtuerf9) xsp<ntPirSSFLLvh(", shuffled.shuffled);
    try std.testing.expectEqual(@as(u16, 37), shuffled.size);
    try std.testing.expectEqual(@as(u16, 19), shuffled.base);
    try std.testing.expectEqual(@as(u16, 30), shuffled.index);
}

test "shared runtime decodes shuffled helper text and evaluates cached LEGO getters" {
    const allocator = std.testing.allocator;
    var random = scalars.Random.init(1);
    var manager = Manager.init(allocator, .{}, &random);
    defer manager.deinit();
    const string_helper = try manager.addBuiltin("getString");
    const marker = try manager.stringGetter("Abc09_./()[]<=>", false);
    const integer = try manager.integerExpr(65535);
    const repeated_integer = try manager.integerExpr(65535);
    try std.testing.expectEqualStrings(integer, repeated_integer);
    const sentinel = try manager.injectSentinel(false, false);
    const property_name = try manager.initProperty("answer", "function(){return 42;}");
    const state_accessor = try manager.stateAccessor(123);
    try std.testing.expectEqualStrings(state_accessor, try manager.stateAccessor(123));
    try manager.addSetup(
        try manager.fmt(
            "console.log({s}(),{s}, {s}.{s}(),{s});console.log({s}().fromCharCode(65),{s}.{s}());",
            .{
                marker,
                integer,
                manager.protector_name.?,
                property_name,
                state_accessor,
                string_helper,
                manager.protector_name.?,
                sentinel.check_result,
            },
        ),
    );
    try manager.addSetup(try manager.fmt("console.log({s});", .{try manager.integerExpr(65536)}));
    const source = try manager.emitSource();
    var tree = try parser.parse(allocator, source, .{ .source_type = .script });
    defer tree.deinit();
    try std.testing.expect(!tree.hasErrors());
    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const run = try std.process.run(allocator, threaded.io(), .{ .argv = &.{ "bun", "-e", source } });
    defer allocator.free(run.stdout);
    defer allocator.free(run.stderr);
    try std.testing.expectEqualStrings("", run.stderr);
    try std.testing.expectEqualStrings("Abc09_./()[]<=> 65535 42 123\nA true\n65536\n", run.stdout);
}

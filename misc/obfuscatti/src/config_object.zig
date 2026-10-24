//! N-API configuration semantics from 2198/6100: live property validation,
//! mutating recursive defaults, and enumerable protection-set selection.

const std = @import("std");
const napi = @import("napi-zig");
const config = @import("obfuscate").config;
const schema = config.validation;
const Value = std.json.Value;
const A = std.mem.Allocator;
const LiveOption = struct {
    value: Value,
    object: napi.Val,
};

pub const ReadResult = struct {
    value: Value,
    options: []LiveOption,

    pub fn attach(self: @This(), configuration: *config.Config) void {
        if (self.value.object.get("settings")) |settings| self.attachSet(&configuration.settings, settings);
        const sets = self.value.object.get("namedSets") orelse return;
        if (sets != .object) return;
        var iterator = configuration.named_sets.iterator();
        while (iterator.next()) |entry| {
            const settings = sets.object.get(entry.key_ptr.*) orelse continue;
            self.attachSet(entry.value_ptr, settings);
        }
    }

    fn attachSet(self: @This(), settings: *config.Settings, value: Value) void {
        if (value != .object) return;
        inline for (.{
            .{ "booleanLiterals", "boolean_literals" },
            .{ "functionReorder", "function_reorder" },
            .{ "controlFlow", "control_flow" },
            .{ "integerLiterals", "integer_literals" },
        }) |pair| {
            if (value.object.get(pair[0])) |option| {
                if (option == .object) {
                    for (self.options) |live| {
                        if (live.value.object.keys().ptr != option.object.keys().ptr) continue;
                        switch (@field(settings, pair[1])) {
                            .enabled => |*enabled| enabled.live_object = @ptrCast(live.object.handle),
                            else => {},
                        }
                    }
                }
            }
        }
    }
};
const Context = struct {
    env: napi.Env,
    allocator: A,
    object: napi.Val,
    reflect: napi.Val,
    options: std.ArrayList(LiveOption) = .empty,

    fn method(self: *@This(), name: [:0]const u8, args: anytype) !napi.Val {
        return (try (try self.object.getNamedProperty(self.env, name)).to(self.env, napi.Callback)).callWith(
            self.env,
            self.object,
            args,
        );
    }

    fn get(self: *@This(), value: napi.Val, name: []const u8) !napi.Val {
        return value.getProperty(self.env, try self.env.createString(name));
    }

    fn scalar(self: *@This(), value: napi.Val) !Value {
        return switch (try value.typeOf(self.env)) {
            .undefined, .null => .null,
            .boolean => .{ .bool = try value.to(self.env, bool) },
            .number => .{ .float = try value.to(self.env, f64) },
            .string => .{ .string = try self.allocator.dupe(u8, try value.to(self.env, []const u8)) },
            else => .{ .object = .{} },
        };
    }

    fn invalid(self: *@This(), name: []const u8) !void {
        try self.env.throwValue(
            try self.env.createError(
                try std.fmt.allocPrint(self.allocator, "The value of '{s}' property is invalid.", .{name}),
            ),
        );
        return error.InvalidConfigurationValue;
    }

    fn validateObject(
        self: *@This(),
        value: napi.Val,
        fields: []const schema.Field,
        allow_minify: bool,
    ) anyerror!void {
        const kind = try value.typeOf(self.env);
        if (kind != .object and kind != .null) {
            try self.env.throwValue(try self.env.createError("The instance must be an object."));
            return error.InvalidConfiguration;
        }
        const names = try self.method("getOwnPropertyNames", .{value});
        var unknown: std.ArrayList(u8) = .empty;
        var count: usize = 0;
        for (0..try names.getArrayLength(self.env)) |i| {
            const name = try (try names.getElement(self.env, @intCast(i))).to(self.env, []const u8);
            if (find(fields, name) != null or (allow_minify and std.mem.eql(u8, name, "minify"))) continue;
            if (count != 0) try unknown.append(self.allocator, ',');
            try unknown.appendSlice(self.allocator, name);
            count += 1;
        }
        if (count != 0) {
            try self.env.throwValue(
                try self.env.createError(
                    try std.fmt.allocPrint(
                        self.allocator,
                        "The configuration object contains {s}: {s}",
                        .{ if (count == 1) "an invalid property" else "invalid properties", unknown.items },
                    ),
                ),
            );
            return error.UnknownConfigurationProperty;
        }
        for (fields) |field| {
            if (!try self.validateProperty(try self.get(value, field.name), field.rule)) return self.invalid(field.name);
            const actual = try self.get(value, field.name);
            if (try truthy(self.env, actual)) {
                if (!schema.custom(try self.scalar(actual), field.rule.custom)) return self.invalid(field.name);
                if (std.mem.eql(u8, field.name, "startDate") or std.mem.eql(u8, field.name, "endDate")) {
                    const date = try (try self.env.getGlobal()).getNamedProperty(self.env, "Date");
                    const parse = try (try date.getNamedProperty(self.env, "parse")).to(self.env, napi.Callback);
                    const result = try (try parse.callWith(self.env, date, .{actual})).to(self.env, f64);
                    if (std.math.isNan(result)) return self.invalid(field.name);
                }
            }
        }
    }

    fn validateProperty(self: *@This(), value: napi.Val, rule: schema.Rule) anyerror!bool {
        const kind = try value.typeOf(self.env);
        if (!rule.mandatory and (kind == .null or kind == .undefined)) return true;
        if ((rule.boolean and kind == .boolean) or (rule.number and kind == .number) or (rule.string and kind == .string))
            return true;
        if (rule.descriptor) |fields| {
            try self.validateObject(value, fields, false);
            return true;
        }
        if (rule.array) {
            if (!try value.isArray(self.env)) return false;
            for (0..try value.getArrayLength(self.env)) |i| {
                const item = try value.getElement(self.env, @intCast(i));
                if (rule.item) |descriptor| if (!try self.validateProperty(item, descriptor.*)) return false;
            }
            return true;
        }
        if (rule.hash and kind == .object) {
            const names = try self.method("getOwnPropertyNames", .{value});
            if (rule.item) |descriptor| for (0..try names.getArrayLength(self.env)) |i| {
                const item = try value.getProperty(self.env, try names.getElement(self.env, @intCast(i)));
                if (try truthy(self.env, item)) _ = try self.validateProperty(item, descriptor.*);
            };
            return true;
        }
        return false;
    }

    fn merge(self: *@This(), defaults: napi.Val, value: napi.Val, depth: usize) anyerror!napi.Val {
        if (depth > 512) {
            try self.env.throwValue(try self.env.createError("Maximum call stack size exceeded"));
            return error.ObjectMutation;
        }
        const keys = try self.method("keys", .{value});
        for (0..try keys.getArrayLength(self.env)) |i| {
            const key = try keys.getElement(self.env, @intCast(i));
            const first = try value.getProperty(self.env, key);
            if (try first.typeOf(self.env) == .undefined) {
                const remove = try (try self.reflect.getNamedProperty(self.env, "deleteProperty")).to(self.env, napi.Callback);
                if (!try (try remove.callWith(self.env, self.reflect, .{ value, key })).to(self.env, bool)) {
                    try self.env.throwValue(
                        try self.env.createError(
                            try std.fmt.allocPrint(
                                self.allocator,
                                "Cannot delete property '{s}' of #<Object>",
                                .{try key.to(self.env, []const u8)},
                            ),
                        ),
                    );
                    return error.ObjectMutation;
                }
                continue;
            }
            const second = try value.getProperty(self.env, key);
            var object = false;
            const kind = try second.typeOf(self.env);
            if ((kind == .object or kind == .function) and napi.c.napi_instanceof(self.env.handle, second.handle, self.object.handle, &object) != .ok)
                return error.ObjectMutation;
            if (object) {
                const target = try value.getProperty(self.env, key);
                var inherited = try defaults.getProperty(self.env, key);
                if (!try truthy(self.env, inherited)) inherited = try self.env.createObject();
                const merged = try self.merge(inherited, try value.getProperty(self.env, key), depth + 1);
                _ = try self.method("assign", .{ target, merged });
            }
        }
        return self.method("assign", .{ try self.env.createObject(), defaults, value });
    }
    const Candidate = struct {
        owner: napi.Val,
        key: napi.Val,
    };

    fn collectNames(self: *@This(), value: napi.Val, enumerable: bool) ![]Candidate {
        var result: std.ArrayList(Candidate) = .empty;
        var object = value;
        while (try object.typeOf(self.env) != .null) {
            const own = try self.method("getOwnPropertyNames", .{object});
            for (0..try own.getArrayLength(self.env)) |i| {
                const key = try own.getElement(self.env, @intCast(i));
                try result.append(self.allocator, .{ .owner = object, .key = key });
            }
            if (!enumerable) break;
            object = try self.method("getPrototypeOf", .{object});
        }
        return result.toOwnedSlice(self.allocator);
    }

    fn materialize(
        self: *@This(),
        value: napi.Val,
        rule: schema.Rule,
        protection_set: bool,
        live_option: bool,
    ) anyerror!Value {
        if (try value.typeOf(self.env) != .object) return self.scalar(value);
        if (try value.isArray(self.env)) {
            var array: std.array_list.Managed(Value) = .init(self.allocator);
            for (0..try value.getArrayLength(self.env)) |i| try array.append(
                try self.materialize(
                    try value.getElement(self.env, @intCast(i)),
                    if (rule.item) |item| item.* else .{},
                    false,
                    false,
                ),
            );
            return .{ .array = array };
        }
        var output: std.json.ObjectMap = .{};
        if (rule.descriptor) |fields| {
            if (protection_set) {
                var seen: std.StringHashMapUnmanaged(void) = .empty;
                for (try self.collectNames(value, true)) |candidate| {
                    const key = candidate.key;
                    const name = try key.to(self.env, []const u8);
                    const entry = try seen.getOrPut(self.allocator, name);
                    if (entry.found_existing) continue;
                    const descriptor = try self.method("getOwnPropertyDescriptor", .{ candidate.owner, key });
                    if (try descriptor.typeOf(self.env) == .undefined) continue;
                    if (!try (try descriptor.getNamedProperty(self.env, "enumerable")).to(self.env, bool)) continue;
                    const first = try value.getProperty(self.env, key);
                    if (try first.typeOf(self.env) == .undefined) continue;
                    const actual = try value.getProperty(self.env, key);
                    const field = find(fields, name) orelse continue;
                    const live = std.mem.eql(u8, name, "booleanLiterals") or std.mem.eql(u8, name, "functionReorder") or std.mem.eql(u8, name, "controlFlow") or std.mem.eql(u8, name, "integerLiterals");
                    try output.put(self.allocator, name, try self.materialize(actual, field.rule, false, live));
                }
            } else for (fields) |field| {
                if (live_option and (std.mem.eql(u8, field.name, "randomize") or std.mem.eql(u8, field.name, "injectFakeCode"))) {
                    try output.put(self.allocator, field.name, .{ .bool = false });
                    continue;
                }
                if (live_option and (std.mem.eql(u8, field.name, "lower") or std.mem.eql(u8, field.name, "upper") or std.mem.eql(u8, field.name, "radix"))) {
                    try output.put(
                        self.allocator,
                        field.name,
                        if (std.mem.eql(u8, field.name, "radix"))
                            .null
                        else
                            .{ .float = if (std.mem.eql(u8, field.name, "upper")) 8 else 0 },
                    );
                    continue;
                }
                var actual = try self.get(value, field.name);
                if (std.mem.eql(u8, field.name, "settings") and try truthy(self.env, actual))
                    actual = try self.get(value, field.name);
                if (try actual.typeOf(self.env) != .undefined) try output.put(
                    self.allocator,
                    field.name,
                    try self.materialize(actual, field.rule, std.mem.eql(u8, field.name, "settings"), false),
                );
            }
        } else if (rule.hash) {
            for (try self.collectNames(value, false)) |candidate| {
                const key = candidate.key;
                const actual = try value.getProperty(self.env, key);
                const name = try key.to(self.env, []const u8);
                try output.put(
                    self.allocator,
                    name,
                    try self.materialize(actual, if (rule.item) |item| item.* else .{}, rule.item != null, false),
                );
            }
        }
        const result = Value{ .object = output };
        if (live_option) try self.options.append(self.allocator, .{ .value = result, .object = value });
        return result;
    }
};

pub fn truthy(env: napi.Env, value: napi.Val) !bool {
    return switch (try value.typeOf(env)) {
        .undefined, .null => false,
        .boolean => try value.to(env, bool),
        .number => blk: {
            const number = try value.to(env, f64);
            break :blk number != 0 and !std.math.isNan(number);
        },
        .string => (try value.to(env, []const u8)).len != 0,
        else => true,
    };
}

fn find(fields: []const schema.Field, name: []const u8) ?schema.Field {
    for (fields) |field| if (std.mem.eql(u8, name, field.name)) return field;
    return null;
}

pub fn read(env: napi.Env, allocator: A, value: napi.Val, allow_minify: bool) !ReadResult {
    const global = try env.getGlobal();
    var context = Context{
        .env = env,
        .allocator = allocator,
        .object = try global.getNamedProperty(env, "Object"),
        .reflect = try global.getNamedProperty(env, "Reflect"),
    };
    try context.validateObject(value, &schema.root, allow_minify);
    const defaults = try env.createObject();
    const settings = try env.createObject();
    const local = try env.createObject();
    try local.setNamedProperty(env, "nameMangling", try env.createString("base62"));
    try settings.setNamedProperty(env, "stringLiterals", try env.createBoolean(true));
    try settings.setNamedProperty(env, "localDeclarations", local);
    try defaults.setNamedProperty(env, "settings", settings);
    _ = try context.merge(defaults, value, 0);
    var output = try context.materialize(value, .{ .descriptor = &schema.root }, false, false);
    if (allow_minify) {
        const minify = try value.getNamedProperty(env, "minify");
        if (try minify.typeOf(env) != .undefined)
            try output.object.put(allocator, "minify", try context.scalar(minify));
    }
    return .{ .value = output, .options = context.options.items };
}

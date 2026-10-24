//! Descriptor validation from modules 6100/2198. Array item custom checks
//! are intentionally omitted: the SDK invokes them only for object fields.

const std = @import("std");
const Value = std.json.Value;
pub const Custom = enum {
    none,
    not_true,
    domain,
    include,
    identifier,
    radix,
    name_mode,
    uint16,
    patience,
    level,
    self_defending,
    es_target,
    runtime,
    runtime_mode,
    runtime_options,
};

pub const Rule = struct {
    boolean: bool = false,
    number: bool = false,
    string: bool = false,
    mandatory: bool = false,
    array: bool = false,
    hash: bool = false,
    descriptor: ?[]const Field = null,
    item: ?*const Rule = null,
    custom: Custom = .none,
};

pub const Field = struct {
    name: []const u8,
    rule: Rule,
};

fn field(name: []const u8, rule: Rule) Field {
    return .{ .name = name, .rule = rule };
}
const boolean: Rule = .{ .boolean = true };
const string: Rule = .{ .string = true };
const randomizable = [_]Field{field("randomize", boolean)};
pub const settings = [_]Field{
    field("booleanLiterals", .{ .boolean = true, .descriptor = &randomizable }),

    field("constantArgument", boolean),

    field(
        "controlFlow",
        .{ .boolean = true, .descriptor = &.{ field("randomize", boolean), field("injectFakeCode", boolean) } },
    ),

    field(
        "consoleCloaking",
        .{ .boolean = true, .descriptor = &.{field("exclude", .{ .string = true, .array = true, .item = &string })} },
    ),

    field(
        "dateLock",
        .{
            .boolean = true,

            .custom = .not_true,

            .descriptor = &.{ field("startDate", string), field("endDate", string), field("errorScript", string) },
        },
    ),

    field("debuggerRemoval", boolean),

    field(
        "devToolsBlocking",
        .{ .boolean = true, .descriptor = &.{field("patience", .{ .number = true, .custom = .patience })} },
    ),

    field(
        "domainLock",
        .{
            .boolean = true,
            .string = true,
            .custom = .not_true,
            .descriptor = &.{
                field("domainPattern", .{ .string = true, .mandatory = true, .custom = .domain }),
                field("errorScript", string),
            },
        },
    ),

    field("exprSequence", boolean),

    field("functionReorder", .{ .boolean = true, .descriptor = &randomizable }),

    field("globalObjectHiding", .{ .boolean = true, .descriptor = &.{
        field("usePredefined", boolean),
        field("include", .{ .string = true, .array = true, .item = &string, .custom = .include }),
        field("exclude", .{ .string = true, .array = true, .item = &string, .custom = .identifier }),
    } }),

    field("integerLiterals", .{ .boolean = true, .descriptor = &.{
        field("randomize", boolean),
        field("radix", .{ .string = true, .array = true, .item = &string, .custom = .radix }),

        field("lower", .{ .number = true, .custom = .uint16 }),
        field("upper", .{ .number = true, .custom = .uint16 }),
    } }),

    field(
        "localDeclarations",
        .{
            .boolean = true,
            .descriptor = &.{
                field("nameMangling", .{ .string = true, .custom = .name_mode }),
                field("excludeIds", .{ .string = true, .array = true, .item = &string }),
            },
        },
    ),

    field("propertyIndirection", boolean),

    field("propertySparsing", boolean),

    field(
        "selfDefending",
        .{
            .boolean = true,

            .number = true,

            .custom = .self_defending,

            .descriptor = &.{ field("level", .{ .number = true, .custom = .level }), field("errorScript", string) },
        },
    ),

    field("stringLiterals", boolean),

    field("variableGrouping", boolean),
};

pub const root = [_]Field{
    field("settings", .{ .descriptor = &settings }),
    field("license", string),
    field("checkForUpdates", boolean),
    field("email", string),

    field("namedSets", .{ .hash = true, .item = &.{ .descriptor = &settings } }),
    field("esTarget", .{ .string = true, .custom = .es_target }),
    field("randomSeed", .{ .number = true }),

    field(
        "runtimeInjection",
        .{
            .string = true,
            .custom = .runtime,
            .descriptor = &.{
                field("mode", .{ .string = true, .custom = .runtime_mode }),
                field("options", .{ .string = true, .mandatory = true, .custom = .runtime_options }),
            },
        },
    ),

    field("runtimeFile", string),
    field("ignoreUnsafeConstructs", boolean),
    field("disableInline", boolean),
    field("generateMaps", boolean),

    field("sourceMaps", boolean),
    field("glob", boolean),
    field("filenameMap", .{ .hash = true }),
    field("protectUserModulesOnly", boolean),

    field("sourceSets", .{ .array = true, .item = &string }),
};

pub const Failure = union(enum) { object_required, property: []const u8, unknown: struct {
    value: Value,
    fields: []const Field,
} };
const Check = union(enum) {
    valid,
    invalid,
    failure: Failure,
};

pub fn validate(value: Value, options_only: bool) ?Failure {
    return object(value, if (options_only) &settings else &root);
}

fn known(name: []const u8, fields: []const Field) bool {
    for (fields) |item| if (std.mem.eql(u8, name, item.name)) return true;
    return false;
}

fn object(value: Value, fields: []const Field) ?Failure {
    if (value != .object and value != .array and value != .null) return .object_required;
    if (value == .array or value == .null) return .{ .unknown = .{ .value = value, .fields = fields } };
    for (value.object.keys()) |key| if (!known(key, fields)) return .{ .unknown = .{ .value = value, .fields = fields } };
    for (fields) |item| {
        const actual = value.object.get(item.name) orelse .null;
        switch (property(actual, item.rule)) {
            .invalid => return .{ .property = item.name },
            .failure => |failure| return failure,
            .valid => {},
        }
        if (truthy(actual) and !custom(actual, item.rule.custom)) return .{ .property = item.name };
    }
    return null;
}

fn property(value: Value, rule: Rule) Check {
    if (!rule.mandatory and value == .null) return .valid;
    if ((rule.boolean and value == .bool) or (rule.number and (value == .integer or value == .float or value == .number_string)) or (rule.string and value == .string))
        return .valid;
    if (rule.descriptor) |fields| return if (object(value, fields)) |failure| .{ .failure = failure } else .valid;
    if (rule.array and value == .array) {
        for (value.array.items) |item| {
            if ((rule.boolean and item == .bool) or (rule.number and (item == .integer or item == .float)) or (rule.string and item == .string))
                continue;
            if (rule.item) |item_rule| switch (property(item, item_rule.*)) {
                .valid => {},
                .invalid => return .invalid,
                .failure => |failure| return .{ .failure = failure },
            } else return .invalid;
        }
        return .valid;
    }
    if (rule.hash and (value == .object or value == .array)) {
        if (rule.item) |item_rule| {
            const values = if (value == .object) value.object.values() else value.array.items;
            for (values) |item| if (truthy(item)) {
                switch (property(item, item_rule.*)) {
                    .failure => |failure| return .{ .failure = failure },
                    else => {},
                }
            };
            if (value == .array and values.len != 0) switch (property(.{ .integer = @intCast(values.len) }, item_rule.*)) {
                .failure => |failure| return .{ .failure = failure },
                else => {},
            };
        }
        return .valid;
    }
    return .invalid;
}

fn truthy(value: Value) bool {
    return switch (value) {
        .null => false,
        .bool => value.bool,
        .integer => value.integer != 0,
        .float => value.float != 0 and !std.math.isNan(value.float),
        .string => value.string.len != 0,
        else => true,
    };
}

fn number(value: Value) f64 {
    return switch (value) {
        .integer => @floatFromInt(value.integer),
        .float => value.float,
        else => std.math.nan(f64),
    };
}

fn identifier(text: []const u8) bool {
    if (text.len == 0) return false;
    for (text, 0..) |byte, i| if (!std.ascii.isAlphabetic(byte) and byte != '$' and byte != '_' and !(i > 0 and std.ascii.isDigit(byte)))
        return false;
    return true;
}

pub fn custom(value: Value, kind: Custom) bool {
    const n = number(value);
    return switch (kind) {
        .none => true,
        .not_true => value != .bool or !value.bool,
        .uint16 => std.math.isFinite(n) and @floor(n) == n and n >= 0 and n <= 65535,
        .patience => n >= 0 and n <= 1000,
        .level => n >= 0 and n <= 4,
        .self_defending => value == .object or value == .bool or (n >= 0 and n <= 4),
        .include => value != .string or identifier(
            if (std.mem.endsWith(u8, value.string, ":g")) value.string[0 .. value.string.len - 2] else value.string,
        ),
        .identifier => value != .string or identifier(value.string),
        .radix => value != .string or std.meta.stringToEnum(@import("scalars.zig").Radix, value.string) != null,
        .name_mode => std.meta.stringToEnum(@import("scalars.zig").NameMode, value.string) != null,
        .es_target => blk: {
            for ([_][]const u8{
                "es5",
                "es2015",
                "es2016",
                "es2017",
                "es2018",
                "es2019",
                "es2020",
                "es2021",
                "es2022",
                "es2023",
                "es2024",
                "es2025",
                "es2026",
            }) |name| if (std.mem.eql(u8, value.string, name)) break :blk true;
            break :blk false;
        },
        .runtime => value == .object or custom(value, .runtime_mode),
        .runtime_mode => std.mem.eql(u8, value.string, "all") or std.mem.eql(u8, value.string, "firstNonModule") or std.mem.eql(u8, value.string, "separateSource"),
        .runtime_options => std.mem.eql(u8, value.string, "no-eval") or std.mem.eql(u8, value.string, "self-defending"),
        .domain => blk: {
            if (std.ascii.isWhitespace(value.string[0]) or std.ascii.isWhitespace(value.string[value.string.len - 1]))
                break :blk false;
            var parts = std.mem.splitScalar(u8, value.string, ';');
            while (parts.next()) |part| {
                const text = std.mem.trim(u8, part, " \t\r\n\x0b\x0c");
                if (text.len == 0) break :blk false;
                for (text) |byte| if (!std.ascii.isAlphanumeric(byte) and byte != '.' and byte != '-') break :blk false;
            }
            break :blk true;
        },
    };
}

pub fn describe(allocator: std.mem.Allocator, failure: Failure) ![]u8 {
    return switch (failure) {
        .object_required => allocator.dupe(u8, "The instance must be an object."),
        .property => |name| std.fmt.allocPrint(allocator, "The value of '{s}' property is invalid.", .{name}),
        .unknown => |details| blk: {
            var names: std.ArrayList(u8) = .empty;
            defer names.deinit(allocator);
            var count: usize = 0;
            if (details.value == .object) {
                for (details.value.object.keys()) |key| {
                    if (known(key, details.fields)) continue;
                    if (count != 0) try names.append(allocator, ',');
                    try names.appendSlice(allocator, key);
                    count += 1;
                }
            } else if (details.value == .array) {
                for (details.value.array.items, 0..) |_, i| {
                    if (i != 0) try names.append(allocator, ',');
                    var buffer: [32]u8 = undefined;
                    try names.appendSlice(allocator, try std.fmt.bufPrint(&buffer, "{d}", .{i}));
                    count += 1;
                }
                if (count != 0) try names.append(allocator, ',');
                try names.appendSlice(allocator, "length");
                count += 1;
            } else break :blk try allocator.dupe(u8, "Cannot convert undefined or null to object");
            break :blk try std.fmt.allocPrint(
                allocator,
                "The configuration object contains {s}: {s}",
                .{ if (count == 1) "an invalid property" else "invalid properties", names.items },
            );
        },
    };
}

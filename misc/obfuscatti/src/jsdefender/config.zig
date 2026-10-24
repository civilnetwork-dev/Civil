//! Configuration descriptors and option semantics recovered from modules
//! 6100, 2198, 4850, 6559 and protectSource's configuration merge in 9219.

const std = @import("std");
const scalars = @import("scalars.zig");
const Allocator = std.mem.Allocator;
const Value = std.json.Value;
pub const validation = @import("validation.zig");
threadlocal var validation_failure: ?validation.Failure = null;
threadlocal var invalid_fields_object: ?std.json.ObjectMap = null;
threadlocal var valid_fields: []const []const u8 = &.{};

pub fn describeError(allocator: Allocator, failure: anyerror) ![]const u8 {
    if (validation_failure) |details| return validation.describe(allocator, details);
    if (failure == error.UnknownConfigurationProperty) if (invalid_fields_object) |object| {
        var names: std.ArrayList(u8) = .empty;
        defer names.deinit(allocator);
        var count: usize = 0;
        for (object.keys()) |key| {
            var known = false;
            for (valid_fields) |field| if (std.mem.eql(u8, key, field)) {
                known = true;
                break;
            };
            if (known) continue;
            if (count != 0) try names.append(allocator, ',');
            try names.appendSlice(allocator, key);
            count += 1;
        }
        return std.fmt.allocPrint(
            allocator,
            "The configuration object contains {s}: {s}",
            .{ if (count == 1) "an invalid property" else "invalid properties", names.items },
        );
    };
    return allocator.dupe(
        u8,
        if (failure == error.InvalidConfiguration) "The instance must be an object." else @errorName(failure),
    );
}

pub const Error = Allocator.Error || error{
    InvalidConfiguration,
    UnknownConfigurationProperty,
    InvalidConfigurationValue,
    MissingConfigurationProperty,
    InvalidIdentifier,
    InvalidDomainPattern,
    UnknownNamedSet,
    RuntimeFileRequired,
    UnexpectedRuntimeFile,
};

/// Missing settings inherit, whereas null and false explicitly disable.
pub fn Setting(comptime T: type) type {
    return union(enum) {
        inherit,
        disabled,
        enabled: T,

        pub fn get(self: @This()) ?T {
            return switch (self) {
                .enabled => |value| value,
                else => null,
            };
        }

        pub fn isEnabled(self: @This()) bool {
            return switch (self) {
                .enabled => true,
                else => false,
            };
        }
    };
}

pub const Boolean = Setting(void);
pub const Randomizable = struct {
    randomize: bool = false,
    live_object: ?*anyopaque = null,

    pub fn isRandomized(self: @This()) bool {
        return scalars.liveBool(self.live_object, "randomize", self.randomize);
    }
};

pub const ControlFlow = struct {
    randomize: bool = false,
    inject_fake_code: bool = false,
    live_object: ?*anyopaque = null,

    pub fn isRandomized(self: @This()) bool {
        return scalars.liveBool(self.live_object, "randomize", self.randomize);
    }

    pub fn injectFakeCode(self: @This()) bool {
        return scalars.liveBool(self.live_object, "injectFakeCode", self.inject_fake_code);
    }
};

pub const BoolReader = scalars.BoolReader;
pub const activateBoolReader = scalars.activateBoolReader;
pub const IntegerOptions = scalars.IntegerOptions;
pub const IntegerReader = scalars.IntegerReader;
pub const Radix = scalars.Radix;
pub const activateIntegerReader = scalars.activateIntegerReader;
pub const ConsoleCloaking = struct { exclude: []const []const u8 = &.{} };
pub const DateLock = struct {
    start_date: ?[]const u8 = null,
    end_date: ?[]const u8 = null,
    error_script: ?[]const u8 = null,
};

pub const DevTools = struct {
    patience: f64 = 5,
};

pub const DomainLock = struct {
    domain_pattern: []const u8,
    error_script: ?[]const u8 = null,
};

pub const GlobalHiding = struct { use_predefined: bool = true, include: []const []const u8 = &.{}, exclude: []const []const u8 = &.{} };
pub const LocalDeclarations = struct { name_mangling: scalars.NameMode = .sequential, exclude_ids: []const []const u8 = &.{} };
pub const SelfDefending = struct {
    level: u3 = 1,
    error_script: ?[]const u8 = null,
};

pub const Settings = struct {
    boolean_literals: Setting(Randomizable) = .inherit,
    constant_argument: Boolean = .inherit,
    console_cloaking: Setting(ConsoleCloaking) = .inherit,
    control_flow: Setting(ControlFlow) = .inherit,
    date_lock: Setting(DateLock) = .inherit,
    debugger_removal: Boolean = .inherit,
    dev_tools_blocking: Setting(DevTools) = .inherit,
    domain_lock: Setting(DomainLock) = .inherit,
    expr_sequence: Boolean = .inherit,
    function_reorder: Setting(Randomizable) = .inherit,
    global_object_hiding: Setting(GlobalHiding) = .inherit,
    integer_literals: Setting(scalars.IntegerOptions) = .inherit,
    local_declarations: Setting(LocalDeclarations) = .inherit,
    property_indirection: Boolean = .inherit,
    property_sparsing: Boolean = .inherit,
    self_defending: Setting(SelfDefending) = .inherit,
    string_literals: Boolean = .inherit,
    variable_grouping: Boolean = .inherit,

    /// Protection-set inheritance is shallow: a later option object replaces
    /// the entire earlier option object, matching buildProtectionSets.
    pub fn merge(base: Settings, overrides: Settings) Settings {
        var result = base;
        inline for (@typeInfo(Settings).@"struct".field_names) |name| {
            switch (@field(overrides, name)) {
                .inherit => {},
                else => @field(result, name) = @field(overrides, name),
            }
        }
        return result;
    }

    pub fn defaults(mode: scalars.NameMode) Settings {
        return .{ .string_literals = .{ .enabled = {} }, .local_declarations = .{ .enabled = .{ .name_mangling = mode } } };
    }

    pub fn off() Settings {
        var result: Settings = .{};
        inline for (@typeInfo(Settings).@"struct".field_names) |name| {
            // The recovered special "off" set does not list these options.
            if (comptime !std.mem.eql(u8, name, "console_cloaking") and !std.mem.eql(u8, name, "dev_tools_blocking") and !std.mem.eql(u8, name, "global_object_hiding"))
                @field(result, name) = .disabled;
        }
        return result;
    }

    pub fn allOff() Settings {
        var result: Settings = .{};
        inline for (@typeInfo(Settings).@"struct".field_names) |name| @field(result, name) = .disabled;
        return result;
    }
};

pub const EsTarget = enum {
    es5,
    es2015,
    es2016,
    es2017,
    es2018,
    es2019,
    es2020,
    es2021,
    es2022,
    es2023,
    es2024,
    es2025,
    es2026,
};

pub const RuntimeMode = enum {
    first_non_module,
    separate_source,
    all,
};

pub const RuntimeOption = enum {
    self_defending,
    no_eval,
};

pub const RuntimeInjection = struct {
    mode: RuntimeMode = .first_non_module,
    options: ?RuntimeOption = null,
};

pub const SourceSettings = struct {
    settings: Settings,
    disable_inline: bool,
};

pub const Config = struct {
    arena: std.heap.ArenaAllocator,
    settings: Settings = .{},
    named_sets: std.StringHashMapUnmanaged(Settings) = .empty,
    source_sets: []const []const u8 = &.{},
    random_seed: ?f64 = null,
    es_target: ?EsTarget = null,
    ignore_unsafe_constructs: bool = false,
    disable_inline: bool = false,
    runtime_injection: RuntimeInjection = .{},
    runtime_file: ?[]const u8 = null,
    source_maps: bool = false,
    generate_maps: bool = false,
    glob: bool = false,
    protect_user_modules_only: bool = false,
    filename_map: Value = .null,
    license: ?[]const u8 = null,
    email: ?[]const u8 = null,
    check_for_updates: bool = false,

    pub fn deinit(self: *Config) void {
        self.arena.deinit();
    }

    pub fn allocator(self: *Config) Allocator {
        return self.arena.allocator();
    }

    pub fn lookupSet(self: *const Config, name: []const u8) ?Settings {
        if (std.mem.eql(u8, name, "off")) return Settings.off();
        if (std.mem.eql(u8, name, "default")) return Settings.merge(Settings.off(), Settings.defaults(.base62));
        if (isDisableInline(name)) return Settings.merge(Settings.off(), self.settings);
        return self.named_sets.get(name);
    }

    pub fn forSource(self: *const Config, index: usize) Error!SourceSettings {
        if (index >= self.source_sets.len) return .{ .settings = self.settings, .disable_inline = self.disable_inline };
        const name = self.source_sets[index];
        return .{
            .settings = self.lookupSet(name) orelse return error.UnknownNamedSet,
            .disable_inline = self.disable_inline or isDisableInline(name),
        };
    }
};

pub fn isDisableInline(name: []const u8) bool {
    return std.mem.eql(u8, name, "disableinline") or std.mem.eql(u8, name, "disable-inline") or std.mem.eql(u8, name, "disableInline");
}

/// No supplied configuration has a distinct Base52 default in protectSource.
pub fn defaults(allocator: Allocator) Config {
    return .{ .arena = std.heap.ArenaAllocator.init(allocator), .settings = Settings.defaults(.base52) };
}

/// Returned configuration owns strings and arrays, independent of Value's
/// lifetime. Explicit {} has no settings; explicit settings:{} gets Base62.
pub fn parse(allocator: Allocator, value: Value) Error!Config {
    return parseValue(allocator, value, true);
}
/// N-API callers have already undergone the SDK's mutating object merge.
pub fn parseNormalized(allocator: Allocator, value: Value) Error!Config {
    return parseValue(allocator, value, false);
}

fn parseValue(allocator: Allocator, value: Value, merge_settings_defaults: bool) Error!Config {
    invalid_fields_object = null;
    validation_failure = null;
    if (value == .null) return defaults(allocator);
    if (validation.validate(value, false)) |failure| {
        validation_failure = failure;
        return switch (failure) {
            .unknown => error.UnknownConfigurationProperty,
            .object_required => error.InvalidConfiguration,
            .property => error.InvalidConfigurationValue,
        };
    }
    const object = try asObject(value);
    try knownFields(
        object,
        &.{
            "settings",
            "license",
            "email",
            "checkForUpdates",
            "namedSets",
            "esTarget",
            "randomSeed",
            "runtimeInjection",
            "runtimeFile",
            "ignoreUnsafeConstructs",
            "disableInline",
            "generateMaps",
            "sourceMaps",
            "glob",
            "filenameMap",
            "protectUserModulesOnly",
            "sourceSets",
        },
    );
    var result = Config{ .arena = std.heap.ArenaAllocator.init(allocator) };
    errdefer result.deinit();
    const owned = result.allocator();
    if (object.get("settings")) |settings| {
        if (settings != .null)
            result.settings = try parseSettingsWithDefaults(owned, settings, merge_settings_defaults);
    }
    result.license = try optionalString(owned, object.get("license"));
    result.email = try optionalString(owned, object.get("email"));
    result.check_for_updates = try optionalBool(object.get("checkForUpdates"), false);
    result.ignore_unsafe_constructs = try optionalBool(object.get("ignoreUnsafeConstructs"), false);
    result.disable_inline = try optionalBool(object.get("disableInline"), false);
    result.source_maps = try optionalBool(object.get("sourceMaps"), false);
    result.generate_maps = try optionalBool(object.get("generateMaps"), false);
    result.runtime_file = try optionalString(owned, object.get("runtimeFile"));
    if (object.get("randomSeed")) |seed| {
        if (seed != .null) result.random_seed = try number(seed);
    }
    if (object.get("esTarget")) |target| {
        if (target != .null and (try string(target)).len != 0)
            result.es_target = std.meta.stringToEnum(EsTarget, target.string) orelse return error.InvalidConfigurationValue;
    }
    if (object.get("runtimeInjection")) |injection| result.runtime_injection = try parseRuntime(injection);
    if (object.get("namedSets")) |sets| {
        if (sets != .null) {
            var iterator = (try asObject(sets)).iterator();
            while (iterator.next()) |item| {
                const settings = if (item.value_ptr.* == .null or (item.value_ptr.* == .bool and !item.value_ptr.bool))
                    Settings{}
                else
                    try parseSettings(owned, item.value_ptr.*);
                try result.named_sets.put(owned, try owned.dupe(u8, item.key_ptr.*), settings);
            }
        }
    }
    if (object.get("sourceSets")) |sets| {
        if (sets != .null) {
            if (sets != .array) return error.InvalidConfigurationValue;
            result.source_sets = try stringList(owned, sets, .any);
        }
    }
    result.glob = try optionalBool(object.get("glob"), false);
    result.protect_user_modules_only = try optionalBool(object.get("protectUserModulesOnly"), false);
    if (object.get("filenameMap")) |mapping| {
        if (mapping != .null and mapping != .object and mapping != .array) return error.InvalidConfigurationValue;
        result.filename_map = try copyValue(owned, mapping);
    }
    return result;
}

fn copyValue(allocator: Allocator, value: Value) Allocator.Error!Value {
    return switch (value) {
        .string => |text| .{ .string = try allocator.dupe(u8, text) },
        .number_string => |text| .{ .number_string = try allocator.dupe(u8, text) },
        .array => |items| blk: {
            var output = std.array_list.Managed(Value).init(allocator);
            for (items.items) |item| try output.append(try copyValue(allocator, item));
            break :blk .{ .array = output };
        },
        .object => |object| blk: {
            var output: std.json.ObjectMap = .{};
            var iterator = object.iterator();
            while (iterator.next()) |entry| try output.put(allocator, try allocator.dupe(u8, entry.key_ptr.*), try copyValue(allocator, entry.value_ptr.*));
            break :blk .{ .object = output };
        },
        else => value,
    };
}

pub fn parseSettings(allocator: Allocator, value: Value) Error!Settings {
    return parseSettingsWithDefaults(allocator, value, false);
}

const setting_names = [_][]const u8{
    "booleanLiterals",
    "constantArgument",
    "consoleCloaking",
    "controlFlow",
    "dateLock",
    "debuggerRemoval",
    "devToolsBlocking",
    "domainLock",
    "exprSequence",
    "functionReorder",
    "globalObjectHiding",
    "integerLiterals",
    "localDeclarations",
    "propertyIndirection",
    "propertySparsing",
    "selfDefending",
    "stringLiterals",
    "variableGrouping",
};

fn parseSettingsWithDefaults(allocator: Allocator, value: Value, with_defaults: bool) Error!Settings {
    validation_failure = null;
    if (validation.validate(value, true)) |failure| {
        validation_failure = failure;
        return switch (failure) {
            .unknown => error.UnknownConfigurationProperty,
            .object_required => error.InvalidConfiguration,
            .property => error.InvalidConfigurationValue,
        };
    }
    const object = try asObject(value);
    try knownFields(object, &setting_names);
    var settings = if (with_defaults) Settings.defaults(.base62) else Settings{};
    inline for (@typeInfo(Settings).@"struct".field_names, setting_names) |field, external| {
        if (object.get(external)) |option| {
            const Field = @FieldType(Settings, field);
            if (option == .null or (option == .bool and !option.bool)) {
                @field(settings, field) = .disabled;
            } else if (comptime Field == Boolean) {
                if (option != .bool or !option.bool) return error.InvalidConfigurationValue;
                @field(settings, field) = .{ .enabled = {} };
            } else if (comptime std.mem.eql(u8, field, "boolean_literals") or std.mem.eql(u8, field, "function_reorder")) {
                @field(settings, field) = .{ .enabled = try parseRandomizable(option) };
            } else if (comptime std.mem.eql(u8, field, "control_flow")) {
                var parsed: ControlFlow = .{};
                if (option != .bool) {
                    const options = try asObject(option);
                    try knownFields(options, &.{ "randomize", "injectFakeCode" });
                    parsed.randomize = try optionalBool(options.get("randomize"), false);
                    parsed.inject_fake_code = try optionalBool(options.get("injectFakeCode"), false);
                }
                @field(settings, field) = .{ .enabled = parsed };
            } else if (comptime std.mem.eql(u8, field, "console_cloaking")) {
                var parsed: ConsoleCloaking = .{};
                if (option != .bool) {
                    const options = try asObject(option);
                    try knownFields(options, &.{"exclude"});
                    if (options.get("exclude")) |list| {
                        if (list != .null) parsed.exclude = try stringList(allocator, list, .any);
                    }
                }
                @field(settings, field) = .{ .enabled = parsed };
            } else if (comptime std.mem.eql(u8, field, "date_lock")) {
                if (option == .bool) return error.InvalidConfigurationValue;
                const options = try asObject(option);
                try knownFields(options, &.{ "startDate", "endDate", "errorScript" });
                @field(settings, field) = .{
                    .enabled = .{
                        .start_date = try optionalString(allocator, options.get("startDate")),
                        .end_date = try optionalString(allocator, options.get("endDate")),
                        .error_script = try optionalString(allocator, options.get("errorScript")),
                    },
                };
            } else if (comptime std.mem.eql(u8, field, "dev_tools_blocking")) {
                var parsed: DevTools = .{};
                if (option != .bool) {
                    const options = try asObject(option);
                    try knownFields(options, &.{"patience"});
                    if (options.get("patience")) |patience| {
                        parsed.patience = if (patience == .null) 0 else try boundedNumber(patience, 0, 1000);
                    }
                }
                @field(settings, field) = .{ .enabled = parsed };
            } else if (comptime std.mem.eql(u8, field, "domain_lock")) {
                if (option == .bool) return error.InvalidConfigurationValue;
                if (option == .string) {
                    @field(settings, field) = .{ .enabled = .{ .domain_pattern = try allocator.dupe(u8, option.string) } };
                } else {
                    const options = try asObject(option);
                    try knownFields(options, &.{ "domainPattern", "errorScript" });
                    const pattern = try string(options.get("domainPattern") orelse return error.MissingConfigurationProperty);
                    if (pattern.len != 0 and !validDomainPattern(pattern)) return error.InvalidDomainPattern;
                    @field(settings, field) = .{
                        .enabled = .{
                            .domain_pattern = try allocator.dupe(u8, pattern),
                            .error_script = try optionalString(allocator, options.get("errorScript")),
                        },
                    };
                }
            } else if (comptime std.mem.eql(u8, field, "global_object_hiding")) {
                var parsed: GlobalHiding = .{};
                if (option != .bool) {
                    const options = try asObject(option);
                    try knownFields(options, &.{ "usePredefined", "include", "exclude" });
                    parsed.use_predefined = try optionalBool(options.get("usePredefined"), true);
                    if (options.get("include")) |list| {
                        if (list != .null) parsed.include = try stringList(allocator, list, .global_include);
                    }
                    if (options.get("exclude")) |list| {
                        if (list != .null) parsed.exclude = try stringList(allocator, list, .identifier);
                    }
                }
                @field(settings, field) = .{ .enabled = parsed };
            } else if (comptime std.mem.eql(u8, field, "integer_literals")) {
                @field(settings, field) = .{ .enabled = try parseInteger(allocator, option) };
            } else if (comptime std.mem.eql(u8, field, "local_declarations")) {
                var parsed: LocalDeclarations = .{};
                if (option != .bool) {
                    const options = try asObject(option);
                    try knownFields(options, &.{ "nameMangling", "excludeIds" });
                    if (options.get("nameMangling")) |mode| {
                        parsed.name_mangling = if (mode == .null)
                            .sequential
                        else if ((try string(mode)).len == 0)
                            .sequential
                        else
                            std.meta.stringToEnum(scalars.NameMode, mode.string) orelse return error.InvalidConfigurationValue;
                    } else if (with_defaults) parsed.name_mangling = .base62;
                    if (options.get("excludeIds")) |list| {
                        if (list != .null) parsed.exclude_ids = try stringList(allocator, list, .exclusions);
                    }
                }
                @field(settings, field) = .{ .enabled = parsed };
            } else if (comptime std.mem.eql(u8, field, "self_defending")) {
                var parsed: SelfDefending = .{};
                if (option == .integer or option == .float or option == .number_string) {
                    const level = try boundedNumber(option, 0, 4);
                    parsed.level = if (@floor(level) != level or level == 0) 1 else @intFromFloat(level);
                } else if (option != .bool) {
                    const options = try asObject(option);
                    try knownFields(options, &.{ "level", "errorScript" });
                    if (options.get("level")) |raw| {
                        const level = if (raw == .null) @as(f64, 0) else try boundedNumber(raw, 0, 4);
                        parsed.level = if (@floor(level) != level) 1 else @intFromFloat(level);
                    }
                    parsed.error_script = try optionalString(allocator, options.get("errorScript"));
                }
                @field(settings, field) = .{ .enabled = parsed };
            } else unreachable;
        }
    }
    return settings;
}

fn parseRandomizable(value: Value) Error!Randomizable {
    if (value == .bool) return .{};
    const object = try asObject(value);
    try knownFields(object, &.{"randomize"});
    return .{ .randomize = try optionalBool(object.get("randomize"), false) };
}

fn parseInteger(allocator: Allocator, value: Value) Error!scalars.IntegerOptions {
    if (value == .bool) return .{};
    const object = try asObject(value);
    try knownFields(object, &.{ "randomize", "radix", "lower", "upper" });
    var options: scalars.IntegerOptions = .{ .randomize = try optionalBool(object.get("randomize"), false) };
    if (object.get("lower")) |lower| {
        if (lower != .null) options.lower = @floatFromInt(try uint16(lower));
    }
    if (object.get("upper")) |upper| {
        if (upper != .null) options.upper = @floatFromInt(try uint16(upper));
    }
    if (object.get("radix")) |radix| {
        if (radix == .array) {
            const radices = try allocator.alloc(scalars.Radix, radix.array.items.len);
            for (radix.array.items, radices) |item, *out| out.* = if (item == .null) .none else std.meta.stringToEnum(scalars.Radix, try string(item)) orelse .none;
            options.radices = radices;
        } else if (radix != .null) options.radix = std.meta.stringToEnum(scalars.Radix, try string(radix)) orelse .none;
    }
    return options;
}

fn parseRuntime(value: Value) Error!RuntimeInjection {
    if (value == .null) return .{};
    if (value == .string) return .{ .mode = try runtimeMode(value.string) };
    const object = try asObject(value);
    try knownFields(object, &.{ "mode", "options" });
    var options: RuntimeInjection = .{};
    if (object.get("mode")) |mode| {
        if (mode != .null and (try string(mode)).len != 0) options.mode = try runtimeMode(mode.string);
    }
    const flags = try string(object.get("options") orelse return error.MissingConfigurationProperty);
    options.options = if (flags.len == 0)
        null
    else if (std.mem.eql(u8, flags, "self-defending"))
        .self_defending
    else if (std.mem.eql(u8, flags, "no-eval")) .no_eval else return error.InvalidConfigurationValue;
    return options;
}

fn runtimeMode(value: []const u8) Error!RuntimeMode {
    if (std.mem.eql(u8, value, "firstNonModule")) return .first_non_module;
    if (std.mem.eql(u8, value, "separateSource")) return .separate_source;
    if (std.mem.eql(u8, value, "all")) return .all;
    return error.InvalidConfigurationValue;
}

const ListKind = enum {
    any,
    identifier,
    global_include,
    exclusions,
};

fn stringList(allocator: Allocator, value: Value, kind: ListKind) Error![]const []const u8 {
    var count: usize = switch (value) {
        .string => 1,
        .array => value.array.items.len,
        else => return error.InvalidConfigurationValue,
    };
    if (kind == .exclusions and value == .array) for (value.array.items, 0..) |item, i| if (item == .null) {
        count = i;
        break;
    };
    const output = try allocator.alloc([]const u8, count);
    for (output, 0..) |*item, index| {
        const actual = if (value == .string) value else value.array.items[index];
        const text = if (actual == .null) "" else try string(actual);
        if (value == .string and (kind == .identifier or kind == .global_include)) {
            const identifier = if (kind == .global_include and std.mem.endsWith(u8, text, ":g")) text[0 .. text.len - 2] else text;
            if (text.len != 0 and !validIdentifier(identifier)) return error.InvalidIdentifier;
        }
        item.* = try allocator.dupe(u8, text);
    }
    return output;
}

fn validIdentifier(value: []const u8) bool {
    if (value.len == 0) return false;
    for (value, 0..) |char, index| {
        if (!(std.ascii.isAlphabetic(char) or char == '$' or char == '_' or (index != 0 and std.ascii.isDigit(char))))
            return false;
    }
    return true;
}

fn validDomainPattern(value: []const u8) bool {
    var iterator = std.mem.splitScalar(u8, value, ';');
    while (iterator.next()) |piece| {
        const domain = std.mem.trim(u8, piece, " \t\r\n\x0b\x0c");
        if (domain.len == 0) return false;
        for (domain) |char| {
            if (!(std.ascii.isAlphanumeric(char) or char == '.' or char == '-')) return false;
        }
    }
    return value.len == 0 or (!std.ascii.isWhitespace(value[0]) and !std.ascii.isWhitespace(value[value.len - 1]));
}

fn asObject(value: Value) Error!std.json.ObjectMap {
    return if (value == .object) value.object else error.InvalidConfiguration;
}

fn knownFields(object: std.json.ObjectMap, fields: []const []const u8) Error!void {
    invalid_fields_object = object;
    valid_fields = fields;
    for (object.keys()) |key| {
        var found = false;
        for (fields) |field| if (std.mem.eql(u8, key, field)) {
            found = true;
            break;
        };
        if (!found) return error.UnknownConfigurationProperty;
    }
}

fn string(value: Value) Error![]const u8 {
    return if (value == .string) value.string else error.InvalidConfigurationValue;
}

fn optionalString(allocator: Allocator, value: ?Value) Error!?[]const u8 {
    const actual = value orelse return null;
    if (actual == .null) return null;
    return try allocator.dupe(u8, try string(actual));
}

fn optionalBool(value: ?Value, fallback: bool) Error!bool {
    const actual = value orelse return fallback;
    if (actual == .null) return fallback;
    return if (actual == .bool) actual.bool else error.InvalidConfigurationValue;
}

fn number(value: Value) Error!f64 {
    const result = switch (value) {
        .integer => @as(f64, @floatFromInt(value.integer)),
        .float => value.float,
        .number_string => std.fmt.parseFloat(f64, value.number_string) catch return error.InvalidConfigurationValue,
        else => return error.InvalidConfigurationValue,
    };
    return if (std.math.isFinite(result)) result else error.InvalidConfigurationValue;
}

fn boundedNumber(value: Value, minimum: f64, maximum: f64) Error!f64 {
    const result = try number(value);
    return if (result >= minimum and result <= maximum) result else error.InvalidConfigurationValue;
}

fn uint16(value: Value) Error!u16 {
    const result = try boundedNumber(value, 0, 65535);
    return if (@floor(result) == result) @intFromFloat(result) else error.InvalidConfigurationValue;
}

test "configuration preserves omitted, false, null and distinct source defaults" {
    const allocator = std.testing.allocator;
    var implicit = defaults(allocator);
    defer implicit.deinit();
    try std.testing.expectEqual(scalars.NameMode.base52, implicit.settings.local_declarations.get().?.name_mangling);
    var empty = try parse(allocator, .{ .object = .{} });
    defer empty.deinit();
    try std.testing.expect(!empty.settings.string_literals.isEnabled());
    const json = try std.json.parseFromSlice(
        Value,
        allocator,
        "{\"settings\":{\"booleanLiterals\":{\"randomize\":true},\"constantArgument\":false,\"propertySparsing\":null,\"localDeclarations\":{}}}",
        .{},
    );
    defer json.deinit();
    var configuration = try parse(allocator, json.value);
    defer configuration.deinit();
    try std.testing.expect(configuration.settings.boolean_literals.get().?.randomize);
    try std.testing.expect(configuration.settings.constant_argument == .disabled);
    try std.testing.expect(configuration.settings.property_sparsing == .disabled);
    try std.testing.expect(configuration.settings.string_literals.isEnabled());
    try std.testing.expectEqual(
        scalars.NameMode.base62,
        configuration.settings.local_declarations.get().?.name_mangling,
    );
}

test "configuration validates all transform settings and source overrides" {
    const allocator = std.testing.allocator;
    const json = try std.json.parseFromSlice(Value, allocator,
        \\{"randomSeed":1.5,"esTarget":"es2026","runtimeInjection":{"mode":"separateSource","options":"no-eval"},"runtimeFile":"runtime.js","namedSets":{"custom":{"integerLiterals":{"radix":["hexadecimal","binary"],"lower":0,"upper":65535},"localDeclarations":{"nameMangling":"runic","excludeIds":["keep"]}}},"sourceSets":["custom","off","default","disable-inline"],"settings":{"booleanLiterals":true,"constantArgument":true,"consoleCloaking":{"exclude":["log"]},"controlFlow":{"randomize":true,"injectFakeCode":true},"dateLock":{"startDate":"2020-01-01"},"debuggerRemoval":true,"devToolsBlocking":{"patience":0},"domainLock":{"domainPattern":"example.com; localhost"},"exprSequence":true,"functionReorder":{},"globalObjectHiding":{"include":["custom:g"],"exclude":"window"},"integerLiterals":true,"localDeclarations":true,"propertyIndirection":true,"propertySparsing":true,"selfDefending":{"level":4},"stringLiterals":true,"variableGrouping":true}}
    , .{});
    defer json.deinit();
    var configuration = try parse(allocator, json.value);
    defer configuration.deinit();
    try std.testing.expectEqual(@as(f64, 1.5), configuration.random_seed.?);
    const custom = try configuration.forSource(0);
    try std.testing.expectEqual(@as(usize, 2), custom.settings.integer_literals.get().?.radices.?.len);
    try std.testing.expectEqual(scalars.NameMode.runic, custom.settings.local_declarations.get().?.name_mangling);
    try std.testing.expect(!(try configuration.forSource(1)).settings.string_literals.isEnabled());
    try std.testing.expect((try configuration.forSource(2)).settings.string_literals.isEnabled());
    try std.testing.expect((try configuration.forSource(3)).disable_inline);
    try std.testing.expectEqual(@as(f64, 0), configuration.settings.dev_tools_blocking.get().?.patience);
}

test "configuration rejects invalid fields and values" {
    const allocator = std.testing.allocator;
    const cases = [_]struct {
        json: []const u8,
        err: Error,
    }{
        .{ .json = "{\"unknown\":true}", .err = error.UnknownConfigurationProperty },

        .{ .json = "{\"settings\":{\"integerLiterals\":{\"upper\":1.5}}}", .err = error.InvalidConfigurationValue },

        .{ .json = "{\"settings\":{\"domainLock\":true}}", .err = error.InvalidConfigurationValue },

        .{ .json = "{\"glob\":17}", .err = error.InvalidConfigurationValue },
    };
    for (cases) |case| {
        const json = try std.json.parseFromSlice(Value, allocator, case.json, .{});
        defer json.deinit();
        try std.testing.expectError(case.err, parse(allocator, json.value));
    }
}

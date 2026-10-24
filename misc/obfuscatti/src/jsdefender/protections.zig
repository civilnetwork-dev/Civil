//! Domain/date locks, console cloaking and devtools blocking recovered from
//! JSDefender Core 2.12.0 modules 6755, 5619, 2915 and 881.

const std = @import("std");
const parser = @import("parser");
const runtime = @import("runtime.zig");
const templates = @import("protection_templates.zig");
const Allocator = std.mem.Allocator;
pub const Error = runtime.Error || error{
    InvalidDomainPattern,
    UnsupportedDomainCharacter,
    DomainComponentUnderflow,
    UnsupportedDateFormat,
    InvalidDate,
    InvalidErrorScript,
    InvalidPatience,
    DateAdapterFailed,
};

pub const DateParser = struct {
    context: *anyopaque,
    parse: *const fn (*anyopaque, []const u8) Error!i64,
};

pub const DomainOptions = struct {
    domain_pattern: []const u8,
    error_script: []const u8 = "",
};

pub const DateOptions = struct {
    start_date: ?[]const u8 = null,
    end_date: ?[]const u8 = null,
    error_script: []const u8 = "",
    parser: ?DateParser = null,
};

pub const DevToolsOptions = struct {
    patience: f64 = 5,
};

pub const ConsoleOptions = struct { exclude: []const []const u8 = &.{} };
pub const Options = struct {
    domain_lock: ?DomainOptions = null,
    date_lock: ?DateOptions = null,
    dev_tools_blocking: ?DevToolsOptions = null,
    console_cloaking: ?ConsoleOptions = null,
};

pub fn apply(allocator: Allocator, manager: *runtime.Manager, options: Options) Error!void {
    if (options.domain_lock) |domain| try applyDomain(allocator, manager, domain, options.date_lock != null);
    if (options.date_lock) |date| try applyDate(allocator, manager, date, options.domain_lock != null);
    if (options.dev_tools_blocking) |devtools| try applyDevTools(allocator, manager, devtools);
    if (options.console_cloaking) |console| try applyConsole(allocator, manager, console);
}

fn validateErrorScript(allocator: Allocator, script: []const u8) Error!void {
    if (script.len == 0) return;
    const source = try std.fmt.allocPrint(allocator, "function errorHandler(){{{s}}}", .{script});
    defer allocator.free(source);
    var tree = try parser.parse(allocator, source, .{ .source_type = .script });
    defer tree.deinit();
    if (tree.hasErrors()) return error.InvalidErrorScript;
}

fn domainCharacter(character: u8) bool {
    return std.ascii.isAlphanumeric(character) or character == '-' or character == '.';
}

/// JS's signed int32 hash over ASCII domain labels after lowercasing.
pub fn domainHash(label: []const u8) i32 {
    var hash: u32 = 0;
    for (label) |character| hash = hash *% 31 +% std.ascii.toLower(character);
    return @bitCast(hash);
}

/// Every entry begins with the leading-dot flag, then signed label hashes.
pub fn createDomainSpec(allocator: Allocator, pattern: []const u8) Error![][]i32 {
    var entries: std.ArrayList([]i32) = .empty;
    errdefer {
        for (entries.items) |entry| allocator.free(entry);
        entries.deinit(allocator);
    }
    var patterns = std.mem.splitScalar(u8, pattern, ';');
    while (patterns.next()) |raw_pattern| {
        const trimmed = std.mem.trim(u8, raw_pattern, " \t\r\n");
        if (trimmed.len == 0) return error.InvalidDomainPattern;
        for (trimmed) |character| if (!domainCharacter(character)) return error.UnsupportedDomainCharacter;
        var labels: std.ArrayList(i32) = .empty;
        errdefer labels.deinit(allocator);
        const leading_dot = trimmed[0] == '.';
        try labels.append(allocator, if (leading_dot) 1 else 0);
        var segments = std.mem.splitScalar(u8, trimmed[if (leading_dot) @as(usize, 1) else 0..], '.');
        while (segments.next()) |segment| try labels.append(allocator, domainHash(segment));
        try entries.append(allocator, try labels.toOwnedSlice(allocator));
    }
    return entries.toOwnedSlice(allocator);
}

pub fn freeDomainSpec(allocator: Allocator, spec: []const []const i32) void {
    for (spec) |entry| allocator.free(entry);
    allocator.free(spec);
}

/// Preserves the recovered length comparison: a leading dot accepts at most
/// one extra hostname label. A too-short hostname throws upstream; report it
/// explicitly here instead of silently applying different wildcard rules.
pub fn evalDomainSpec(allocator: Allocator, hostname: []const u8, spec: []const []const i32) Error!bool {
    var parts: std.ArrayList([]const u8) = .empty;
    defer parts.deinit(allocator);
    var split = std.mem.splitScalar(u8, hostname, '.');
    while (split.next()) |part| {
        for (part) |character| if (!domainCharacter(character)) return error.UnsupportedDomainCharacter;
        try parts.append(allocator, part);
    }
    for (spec) |entry| {
        if (entry.len == 0) return error.InvalidDomainPattern;
        if (entry.len < parts.items.len) continue;
        if (entry[0] == 0 and entry.len != parts.items.len + 1) continue;
        var j = entry.len;
        var k = parts.items.len;
        var matches = true;
        while (j > 1) {
            j -= 1;
            if (k == 0) return error.DomainComponentUnderflow;
            k -= 1;
            if (entry[j] != domainHash(parts.items[k])) {
                matches = false;
                break;
            }
        }
        if (matches) return true;
    }
    return false;
}

fn domainSpecSource(allocator: Allocator, spec: []const []const i32) Allocator.Error![]u8 {
    var source: std.ArrayList(u8) = .empty;
    errdefer source.deinit(allocator);
    try source.append(allocator, '[');
    for (spec, 0..) |entry, i| {
        if (i != 0) try source.append(allocator, ',');
        try source.append(allocator, '[');
        for (entry, 0..) |number, j| {
            if (j != 0) try source.append(allocator, ',');
            var digits: [16]u8 = undefined;
            try source.appendSlice(allocator, std.fmt.bufPrint(&digits, "{d}", .{number}) catch unreachable);
        }
        try source.append(allocator, ']');
    }
    try source.append(allocator, ']');
    return source.toOwnedSlice(allocator);
}

pub fn applyDomain(
    allocator: Allocator,
    manager: *runtime.Manager,
    options: DomainOptions,
    date_enabled: bool,
) Error!void {
    if (manager.domain_lock_applied) return;
    try validateErrorScript(allocator, options.error_script);
    var arena = std.heap.ArenaAllocator.init(allocator);
    defer arena.deinit();
    const temporary = arena.allocator();
    const spec = try createDomainSpec(temporary, options.domain_pattern);
    manager.domain_lock_applied = true;
    const global = try manager.addBuiltin("getGlobalObject");
    _ = try manager.injectSentinel(date_enabled, true);
    const sentinel = try manager.namePair("sentinel");
    const fence = try manager.addSetupVar("fence", null, false);
    const mirror = try manager.addSetupVar("mirror", null, false);
    const get_protector = try manager.namePair("getProtector");
    const result = try manager.namePair("domainResult");
    const handler = try manager.namePair("domainLockHandler");
    const protected_sentinel = try manager.protectString(sentinel.full, true);
    const protected_get = try manager.protectString(get_protector.full, true);
    const protected_result = try manager.protectString(result.full, true);
    const protected_handler_left = try manager.protectString(handler.left, true);
    const protected_handler_right = try manager.protectString(handler.right, true);
    const error_script = if (options.error_script.len == 0)
        try std.fmt.allocPrint(temporary, "{s}();", .{global})
    else
        try std.fmt.allocPrint(temporary, "{{{s}}}", .{options.error_script});
    const error_get = try manager.protectString(get_protector.full, true);
    const setup = try manager.template(templates.domain_error, &.{
        .{ .key = "getProtector", .value = error_get },
        .{ .key = "domainLockHandler", .value = try manager.protectString(handler.full, true) },
        .{ .key = "fence", .value = fence },
        .{ .key = "errorScript", .value = error_script },
    }, true);
    try manager.addSetup(setup);
    try manager.addSetup(try manager.template(templates.domain_check, &.{
        .{ .key = "domainSpec", .value = try domainSpecSource(temporary, spec) },
        .{ .key = "getGlobalObject", .value = global },
        .{ .key = "fence", .value = fence },
        .{ .key = "mirror", .value = mirror },
        .{ .key = "sentinel", .value = protected_sentinel },
        .{ .key = "getProtector", .value = protected_get },
        .{ .key = "domainResult", .value = protected_result },
        .{ .key = "domainLockHandlerLeft", .value = protected_handler_left },
        .{ .key = "domainLockHandlerRight", .value = protected_handler_right },
        .{ .key = "protector", .value = manager.protector_name.? },
        .{ .key = "valid", .value = manager.valid_property.? },
    }, true));
}

fn decimalDigits(text: []const u8) Error!i64 {
    if (text.len == 0) return error.UnsupportedDateFormat;
    var value: i64 = 0;
    for (text) |character| {
        if (!std.ascii.isDigit(character)) return error.UnsupportedDateFormat;
        value = value * 10 + character - '0';
    }
    return value;
}

fn leapYear(year: i64) bool {
    return @mod(year, 4) == 0 and (@mod(year, 100) != 0 or @mod(year, 400) == 0);
}

/// Supported Date.parse subset: YYYY-MM-DD (UTC) and ISO timestamps with
/// explicit Z or ±HH:mm. Local-time and legacy date formats are rejected.
pub fn parseIsoDate(text: []const u8) Error!i64 {
    if (text.len < 10 or text[4] != '-' or text[7] != '-') return error.UnsupportedDateFormat;
    const year = try decimalDigits(text[0..4]);
    const month = try decimalDigits(text[5..7]);
    const day = try decimalDigits(text[8..10]);
    if (month < 1 or month > 12) return error.InvalidDate;
    const lengths = [_]i64{ 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 };
    const days_in_month = lengths[@intCast(month - 1)] + @as(i64, if (month == 2 and leapYear(year)) 1 else 0);
    if (day < 1 or day > days_in_month) return error.InvalidDate;
    var hour: i64 = 0;
    var minute: i64 = 0;
    var second: i64 = 0;
    var millis: i64 = 0;
    var timezone: i64 = 0;
    if (text.len > 10) {
        if (text.len < 17 or text[10] != 'T' or text[13] != ':') return error.UnsupportedDateFormat;
        hour = try decimalDigits(text[11..13]);
        minute = try decimalDigits(text[14..16]);
        var cursor: usize = 16;
        if (cursor < text.len and text[cursor] == ':') {
            if (cursor + 3 > text.len) return error.UnsupportedDateFormat;
            second = try decimalDigits(text[cursor + 1 .. cursor + 3]);
            cursor += 3;
        }
        if (cursor < text.len and text[cursor] == '.') {
            if (cursor != 19) return error.UnsupportedDateFormat;
            cursor += 1;
            const start = cursor;
            while (cursor < text.len and std.ascii.isDigit(text[cursor])) : (cursor += 1) {}
            const length = cursor - start;
            if (length == 0 or length > 3) return error.UnsupportedDateFormat;
            millis = try decimalDigits(text[start..cursor]);
            if (length == 1) millis *= 100 else if (length == 2) millis *= 10;
        }
        if (cursor >= text.len) return error.UnsupportedDateFormat;
        if (text[cursor] == 'Z' and cursor + 1 == text.len) {
            timezone = 0;
        } else if ((text[cursor] == '+' or text[cursor] == '-') and cursor + 6 == text.len and text[cursor + 3] == ':') {
            const zone_hour = try decimalDigits(text[cursor + 1 .. cursor + 3]);
            const zone_minute = try decimalDigits(text[cursor + 4 .. cursor + 6]);
            if (zone_hour > 23 or zone_minute > 59) return error.InvalidDate;
            timezone = (zone_hour * 60 + zone_minute) * (if (text[cursor] == '+') @as(i64, 1) else -1);
        } else return error.UnsupportedDateFormat;
        if (hour > 24 or minute > 59 or second > 59 or (hour == 24 and (minute != 0 or second != 0 or millis != 0)))
            return error.InvalidDate;
    }
    const adjusted_year = year - @as(i64, if (month <= 2) 1 else 0);
    const era = @divFloor(adjusted_year, 400);
    const yoe = adjusted_year - era * 400;
    const shifted_month = month + (if (month > 2) @as(i64, -3) else 9);
    const doy = @divFloor(153 * shifted_month + 2, 5) + day - 1;
    const doe = yoe * 365 + @divFloor(yoe, 4) - @divFloor(yoe, 100) + doy;
    const days = era * 146097 + doe - 719468;
    return ((days * 24 + hour) * 60 + minute - timezone) * 60000 + second * 1000 + millis;
}

fn signedRadix(allocator: Allocator, number: i64, base: u8) Allocator.Error![]u8 {
    const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
    var value: u64 = @intCast(if (number < 0) -number else number);
    var buffer: [65]u8 = undefined;
    var length: usize = 0;
    while (true) {
        buffer[length] = alphabet[@intCast(value % base)];
        length += 1;
        value /= base;
        if (value == 0) break;
    }
    const result = try allocator.alloc(u8, length + @as(usize, if (number < 0) 1 else 0));
    if (number < 0) result[0] = '-';
    for (0..length) |i| result[result.len - i - 1] = buffer[i];
    return result;
}

fn randomInt(manager: *runtime.Manager, lower: f64, upper: f64, fallback: u32) u32 {
    return if (manager.random) |random| @intFromFloat(random.getRandomInt(lower, upper)) else fallback;
}

fn encodeDateString(allocator: Allocator, manager: *runtime.Manager, text: []const u8, key: u32) Error![]u8 {
    const suffix = try std.fmt.allocPrint(allocator, "{d}", .{randomInt(manager, 1, 99999, 0)});
    const padded = try std.fmt.allocPrint(allocator, "{c}{s}{s}", .{ @as(u8, @intCast('c' + suffix.len)), text, suffix });
    var encoded: std.ArrayList(u8) = .empty;
    try encoded.append(allocator, '[');
    for (padded, 0..) |character, i| {
        if (i != 0) try encoded.append(allocator, ',');
        const key_byte = (key >> @as(u5, @intCast((i % 3) * 8))) & 255;
        const value: u16 = @intCast((@as(u32, character) ^ key_byte ^ 540) - 291);
        try encoded.appendSlice(allocator, try manager.integerExpr(value));
    }
    try encoded.append(allocator, ']');
    return encoded.toOwnedSlice(allocator);
}

pub fn applyDate(
    allocator: Allocator,
    manager: *runtime.Manager,
    options: DateOptions,
    domain_enabled: bool,
) Error!void {
    if (manager.date_lock_applied) return;
    try validateErrorScript(allocator, options.error_script);
    const start = if (options.start_date) |date|
        (if (date.len == 0)
            @as(i64, -9007199254740991)
        else if (options.parser) |adapter| try adapter.parse(adapter.context, date) else try parseIsoDate(date))
    else
        -9007199254740991;
    const end = if (options.end_date) |date|
        (if (date.len == 0)
            @as(i64, 9007199254740991)
        else if (options.parser) |adapter| try adapter.parse(adapter.context, date) else try parseIsoDate(date))
    else
        9007199254740991;
    var arena = std.heap.ArenaAllocator.init(allocator);
    defer arena.deinit();
    const temporary = arena.allocator();
    manager.date_lock_applied = true;
    const global = try manager.addBuiltin("getGlobalObject");
    const string = try manager.addBuiltin("getString");
    _ = try manager.injectSentinel(true, domain_enabled);
    const radix: u8 = @intCast(randomInt(manager, 7, 33, 23));
    const radix_expression = try manager.integerExpr(radix);
    const key = randomInt(manager, 123456, 987654, 123456);
    const sentinel = try manager.namePair("sentinel");
    const fence = try manager.addSetupVar("fence", null, false);
    const mirror = try manager.addSetupVar("mirror", null, false);
    const get_protector = try manager.namePair("getProtector");
    const result = try manager.namePair("dateResult");
    const handler = try manager.namePair("dateLockHandler");
    const protected_sentinel = try manager.protectString(sentinel.full, true);
    const protected_get = try manager.protectString(get_protector.full, true);
    const protected_result = try manager.protectString(result.full, true);
    const protected_result_left = try manager.protectString(result.left, true);
    const protected_result_right = try manager.protectString(result.right, true);
    const encoded_date = try encodeDateString(temporary, manager, "Date", key);
    const encoded_now = try encodeDateString(temporary, manager, "now", key);
    const encoded_start = try encodeDateString(temporary, manager, try signedRadix(temporary, start, radix), key);
    const encoded_end = try encodeDateString(temporary, manager, try signedRadix(temporary, end, radix), key);
    const protected_handler_left = try manager.protectString(handler.left, true);
    const protected_handler_right = try manager.protectString(handler.right, true);
    const error_get = try manager.protectString(get_protector.full, true);
    const protected_handler = try manager.protectString(handler.full, true);
    const error_script = if (options.error_script.len == 0)
        try std.fmt.allocPrint(temporary, "{s}();", .{global})
    else
        try std.fmt.allocPrint(temporary, "{{{s}}}", .{options.error_script});
    try manager.addSetup(try manager.template(templates.date_error, &.{
        .{ .key = "getProtector", .value = error_get },
        .{ .key = "dateLockHandler", .value = protected_handler },
        .{ .key = "fence", .value = fence },
        .{ .key = "errorScript", .value = error_script },
    }, true));
    try manager.addSetup(try manager.template(templates.date_check, &.{
        .{ .key = "getGlobalObject", .value = global },
        .{ .key = "getString", .value = string },
        .{ .key = "key", .value = try std.fmt.allocPrint(temporary, "{d}", .{key}) },
        .{ .key = "fence", .value = fence },
        .{ .key = "mirror", .value = mirror },
        .{ .key = "sentinel", .value = protected_sentinel },
        .{ .key = "getProtector", .value = protected_get },
        .{ .key = "dateResult", .value = protected_result },
        .{ .key = "dateResultLeft", .value = protected_result_left },
        .{ .key = "dateResultRight", .value = protected_result_right },
        .{ .key = "Date", .value = encoded_date },
        .{ .key = "now", .value = encoded_now },
        .{ .key = "startDate", .value = encoded_start },
        .{ .key = "endDate", .value = encoded_end },
        .{ .key = "radixExpr", .value = radix_expression },
        .{ .key = "valid", .value = manager.valid_property.? },
        .{ .key = "dateLockHandlerLeft", .value = protected_handler_left },
        .{ .key = "dateLockHandlerRight", .value = protected_handler_right },
    }, true));
}

fn encodedDebugger(allocator: Allocator, key: u8) Allocator.Error![]u8 {
    const input = "debugger";
    const digits = "0123456789ABCDEF";
    var output: std.ArrayList(u8) = .empty;
    try output.append(allocator, '"');
    var i = input.len;
    while (i > 0) {
        i -= 1;
        const value = input[i] ^ key;
        if (value >= 32 and value <= 126 and value != '\'' and value != '"' and value != '\\')
            try output.append(allocator, value)
        else
            try output.appendSlice(allocator, &.{ '\\', 'x', digits[value >> 4], digits[value & 15] });
    }
    try output.append(allocator, '"');
    return output.toOwnedSlice(allocator);
}

pub fn applyDevTools(allocator: Allocator, manager: *runtime.Manager, options: DevToolsOptions) Error!void {
    if (!std.math.isFinite(options.patience) or options.patience < 0 or options.patience > 1000) return error.InvalidPatience;
    var arena = std.heap.ArenaAllocator.init(allocator);
    defer arena.deinit();
    const temporary = arena.allocator();
    const global = try manager.addBuiltin("getGlobalObject");
    const string = try manager.addBuiltin("getString");
    const key: u8 = @intCast(randomInt(manager, 8, 32, 0));
    const encoded = try encodedDebugger(temporary, key);
    const interval = randomInt(manager, 800, 1001, 0);
    try manager.addSetup(try manager.template(templates.devtools, &.{
        .{ .key = "getGlobal", .value = global },
        .{ .key = "getString", .value = string },
        .{ .key = "debuggerEncoded", .value = encoded },

        .{
            .key = "patience",

            .value = try std.fmt.allocPrint(temporary, "{d}", .{if (options.patience == 0) @as(f64, 1193046) else options.patience}),
        },

        .{ .key = "checkInterval", .value = try std.fmt.allocPrint(temporary, "{d}", .{interval}) },
        .{ .key = "key", .value = try std.fmt.allocPrint(temporary, "{d}", .{key}) },
        .{ .key = "protector", .value = manager.protector_name.? },

        .{ .key = "valid", .value = manager.valid_property.? },
    }, false));
}

pub fn applyConsole(allocator: Allocator, manager: *runtime.Manager, options: ConsoleOptions) Error!void {
    var arena = std.heap.ArenaAllocator.init(allocator);
    defer arena.deinit();
    const temporary = arena.allocator();
    const global = try manager.addBuiltin("getGlobalObject");
    var body: std.ArrayList(u8) = .empty;
    try body.appendSlice(temporary, templates.console_start);
    for (templates.console_methods, 0..) |method, i| {
        const excluded = for (options.exclude) |exclude| {
            if (std.mem.eql(u8, exclude, method)) break true;
        } else false;
        if (excluded) continue;
        const statement = try std.fmt.allocPrint(
            temporary,
            "global[{s}][{s}] = global[{s}]();",
            .{
                templates.console_targets[i % templates.console_targets.len],
                try manager.protectString(method, false),
                templates.console_replacements[i % templates.console_replacements.len],
            },
        );
        try body.appendSlice(temporary, statement);
    }
    try body.appendSlice(temporary, templates.console_end);
    try manager.addSetup(try manager.template(body.items, &.{.{ .key = "getGlobalObject", .value = global }}, false));
}

test "jsdefender protections domain hashes and wildcard behavior match original oracle" {
    const allocator = std.testing.allocator;
    const spec = try createDomainSpec(allocator, "Example.COM;.example.org");
    defer freeDomainSpec(allocator, spec);
    try std.testing.expectEqualSlices(i32, &.{ 0, -1322970774, 98689 }, spec[0]);
    try std.testing.expectEqualSlices(i32, &.{ 1, -1322970774, 110308 }, spec[1]);
    try std.testing.expect(try evalDomainSpec(allocator, "example.org", spec));
    try std.testing.expect(try evalDomainSpec(allocator, "a.example.org", spec));
    try std.testing.expect(!try evalDomainSpec(allocator, "a.b.example.org", spec));
    try std.testing.expectError(error.DomainComponentUnderflow, evalDomainSpec(allocator, "org", spec));
}

test "jsdefender protections ISO dates match Date.parse oracle" {
    const cases = [_]struct {
        text: []const u8,
        expected: i64,
    }{
        .{ .text = "1970-01-01", .expected = 0 },
        .{ .text = "2000-02-29T12:34:56.789Z", .expected = 951827696789 },
        .{ .text = "2026-10-14T01:23:45-07:00", .expected = 1791966225000 },
        .{ .text = "0000-01-01", .expected = -62167219200000 },
        .{ .text = "2026-10-14T24:00:00Z", .expected = 1792022400000 },
    };
    for (cases) |case| try std.testing.expectEqual(case.expected, try parseIsoDate(case.text));
    try std.testing.expectError(error.InvalidDate, parseIsoDate("2025-02-29"));
    try std.testing.expectError(error.UnsupportedDateFormat, parseIsoDate("2026-10-14T01:23:45"));
    try std.testing.expectError(error.UnsupportedDateFormat, parseIsoDate("October 14, 2026"));
}

test "jsdefender protections expand all four recovered templates through shared runtime" {
    const allocator = std.testing.allocator;
    var random = @import("scalars.zig").Random.init(123);
    var manager = runtime.Manager.init(allocator, .{}, &random);
    defer manager.deinit();
    try apply(
        allocator,
        &manager,
        .{
            .domain_lock = .{ .domain_pattern = "example.com" },
            .date_lock = .{ .start_date = "2000-01-01", .end_date = "2100-01-01" },
            .dev_tools_blocking = .{},
            .console_cloaking = .{ .exclude = &.{"log"} },
        },
    );
    const source = try manager.emitSource();
    var tree = try parser.parse(allocator, source, .{ .source_type = .script });
    defer tree.deinit();
    if (tree.hasErrors()) for (tree.diagnostics.items) |diagnostic| {
        const start = @min(diagnostic.span.start, source.len);
        const end = @min(diagnostic.span.end +| 70, source.len);
        std.debug.print("Runtime parse: {s} at {d}: {s}\n", .{ diagnostic.message, start, source[start -| 60..end] });
    };
    try std.testing.expect(!tree.hasErrors());
    try std.testing.expect(manager.domain_lock_applied and manager.date_lock_applied);
    const count = manager.setup.items.len;
    try applyDomain(allocator, &manager, .{ .domain_pattern = "other.com" }, true);
    try applyDate(allocator, &manager, .{}, true);
    try std.testing.expectEqual(count, manager.setup.items.len);
}

test "jsdefender protections execute allowed and rejected date/domain contexts" {
    const allocator = std.testing.allocator;
    const cases = [_]struct {
        domain: []const u8,
        end: []const u8,
        expected: []const u8,
    }{
        .{ .domain = "example.com", .end = "2100-01-01", .expected = "allowed true\n" },
        .{ .domain = "wrong.com", .end = "2100-01-01", .expected = "blocked" },
        .{ .domain = "example.com", .end = "2001-01-01", .expected = "blocked" },
    };
    var threaded: std.Io.Threaded = .init(allocator, .{});
    defer threaded.deinit();
    const io = threaded.io();
    var temporary = std.testing.tmpDir(.{});
    defer temporary.cleanup();
    for (cases) |case| {
        var random = @import("scalars.zig").Random.init(123);
        var manager = runtime.Manager.init(allocator, .{}, &random);
        defer manager.deinit();
        try apply(allocator, &manager, .{
            .domain_lock = .{ .domain_pattern = "example.com", .error_script = "process.stdout.write('blocked');process.exit(0);" },

            .date_lock = .{
                .start_date = "2000-01-01",
                .end_date = case.end,
                .error_script = "process.stdout.write('blocked');process.exit(0);",
            },

            .dev_tools_blocking = .{},

            .console_cloaking = .{ .exclude = &.{"log"} },
        });
        const source = try std.fmt.allocPrint(
            allocator,
            "globalThis.document={{domain:'{s}'}};Date.now=()=>1791936000000;globalThis.setTimeout=()=>0;\n{s}\nconsole.log(globalThis.blocked?'blocked':'allowed',{s}.{s});",
            .{ case.domain, try manager.emitSource(), manager.protector_name.?, manager.valid_property.? },
        );
        defer allocator.free(source);
        {
            var file = try temporary.dir.createFile(io, "locks.js", .{});
            defer file.close(io);
            try file.writeStreamingAll(io, source);
        }
        const path = try temporary.dir.realPathFileAlloc(io, "locks.js", allocator);
        defer allocator.free(path);
        const result = try std.process.run(
            allocator,
            io,
            .{ .argv = &.{ "bun", path }, .timeout = .{ .duration = .{ .raw = .fromSeconds(5), .clock = .awake } } },
        );
        defer allocator.free(result.stdout);
        defer allocator.free(result.stderr);
        try std.testing.expectEqualStrings("", result.stderr);
        try std.testing.expectEqualStrings(case.expected, result.stdout);
    }
}

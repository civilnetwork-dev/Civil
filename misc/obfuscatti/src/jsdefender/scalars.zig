//! Scalar algorithms recovered from JSDefender Core 2.12.0 modules
//! 2029, 2463, 2900, 4835, 5256, and 5687. No JavaScript runtime required.

const std = @import("std");
const Allocator = std.mem.Allocator;

/// Park-Miller, including JavaScript remainder and seed normalization.
/// A floating state preserves the original's accepted fractional seeds.
pub const Random = struct {
    state: f64,

    pub fn init(seed: f64) Random {
        var state = @rem(seed, 2147483647.0);
        if (state <= 0) state += 2147483646.0;
        return .{ .state = state };
    }

    pub fn next(self: *Random) f64 {
        self.state = @rem(16807.0 * self.state, 2147483647.0);
        return self.state;
    }

    pub fn nextFloat(self: *Random) f64 {
        return (self.next() - 1.0) / 2147483646.0;
    }

    /// The upper bound is exclusive. A zero-width interval still advances RNG.
    pub fn getRandomInt(self: *Random, lower: f64, upper: f64) f64 {
        const lo = @ceil(lower);
        const hi = @floor(upper);
        return @floor(self.nextFloat() * (hi - lo)) + lo;
    }

    pub fn index(self: *Random, upper: usize) usize {
        return @intFromFloat(self.getRandomInt(0, @floatFromInt(upper)));
    }
};

pub const NameMode = enum {
    sequential,
    hexadecimal,
    base52,
    base62,
    runic,
    glagolitic,
    tifinagh,
};

/// Collision suffixes and reserved words belong to the scope-aware caller.
pub fn mangleName(allocator: Allocator, id: u32, mode: NameMode) Allocator.Error![]u8 {
    const mixed: u32 = 8179730 ^ (((id & 2047) << 13) | ((id >> 11) & 8191));
    if (mode == .sequential or mode == .hexadecimal) {
        const number = if (mode == .sequential) id else mixed;
        const digits = try formatRadix(allocator, number, .hexadecimal, true);
        defer allocator.free(digits);
        const width = @max(@as(usize, 6), digits.len - 2);
        const result = try allocator.alloc(u8, width + 3);
        @memcpy(result[0..3], "_0x");
        @memset(result[3..], '0');
        @memcpy(result[result.len - (digits.len - 2) ..], digits[2..]);
        return result;
    }

    var buffer: [96]u8 = undefined;
    var length: usize = 0;
    var value = mixed;
    var first = true;
    while (true) {
        const radix: u32 = switch (mode) {
            .base52 => 52,
            .base62 => if (first) 52 else 62,
            .runic => 64,
            .glagolitic => 78,
            .tifinagh => 48,
            else => unreachable,
        };
        const digit = value % radix;
        value /= radix;
        const codepoint: u21 = switch (mode) {
            .base52, .base62 => @intCast(if (digit < 26) 'a' + digit else if (digit < 52) 'A' + digit - 26 else '0' + digit - 52),
            .runic => @intCast(0x16a0 + digit),
            .tifinagh => @intCast(0x2d30 + digit),
            .glagolitic => blk: {
                var point = 0x2c00 + digit;
                if (point >= 0x2c0d) point += 1;
                if (point >= 0x2c2f) point += 1;
                break :blk @intCast(point);
            },
            else => unreachable,
        };
        var encoded: [4]u8 = undefined;
        const size = std.unicode.utf8Encode(codepoint, &encoded) catch unreachable;
        @memcpy(buffer[length..][0..size], encoded[0..size]);
        length += size;
        first = false;
        if (value == 0) break;
    }
    return allocator.dupe(u8, buffer[0..length]);
}

pub const true_templates = [_][]const u8{
    "!![]", "(NaN!==NaN)", "(1=='1')", "(null==undefined)", "([null]=='')", "(null == undefined)",
};

pub const false_templates = [_][]const u8{
    "(NaN===NaN)", "![]", "(1==='1')", "(null===undefined)", "([0]=='')", "(null === undefined)",
};

/// Returned text is borrowed. Upstream templates intentionally reference NaN
/// and undefined; callers must account for shadowing when applying the pass.
pub fn booleanExpression(value: bool, randomize: bool, random: *Random) []const u8 {
    const templates = if (value) &true_templates else &false_templates;
    return templates[if (randomize) random.index(templates.len) else 0];
}

pub const Radix = enum {
    none,
    binary,
    decimal,
    hexadecimal,
    octal,
};

pub const BoolReader = struct {
    context: *anyopaque,
    read: *const fn (*anyopaque, *anyopaque, [:0]const u8) bool,
};

threadlocal var bool_reader: ?BoolReader = null;

pub fn activateBoolReader(value: ?BoolReader) ?BoolReader {
    const old = bool_reader;
    bool_reader = value;
    return old;
}

pub fn liveBool(object: ?*anyopaque, property: [:0]const u8, fallback: bool) bool {
    if (object) |token| if (bool_reader) |reader| return reader.read(reader.context, token, property);
    return fallback;
}

pub const IntegerReader = struct {
    context: *anyopaque,
    read: *const fn (*anyopaque, *anyopaque, bool) IntegerOptions,
    read_radix: *const fn (*anyopaque, *anyopaque, f64) Radix,
};

threadlocal var integer_reader: ?IntegerReader = null;

pub fn activateIntegerReader(value: ?IntegerReader) ?IntegerReader {
    const previous = integer_reader;
    integer_reader = value;
    return previous;
}

pub const IntegerOptions = struct {
    randomize: bool = false,
    live_object: ?*anyopaque = null,
    lower: f64 = 0,
    upper: f64 = 8,
    radix: Radix = .none,
    /// When present, this overrides radix, even when the array is empty.
    /// Upstream selects array entries randomly regardless of randomize.
    radices: ?[]const Radix = null,
    live_radix: ?*anyopaque = null,

    pub fn isRandomized(self: @This()) bool {
        return liveBool(self.live_object, "randomize", self.randomize);
    }

    pub fn resolve(self: @This()) @This() {
        if (self.live_object) |object|
            if (integer_reader) |reader| return reader.read(reader.context, object, self.randomize);
        return self;
    }

    fn selectRadix(self: @This(), random: *Random) Radix {
        if (self.live_radix) |object|
            if (integer_reader) |reader| return reader.read_radix(reader.context, object, random.nextFloat());
        if (self.radices) |radices| {
            const index = random.index(radices.len);
            return if (radices.len == 0) .none else radices[index];
        }
        return self.radix;
    }
};

pub const integer_templates = [_][]const []const u8{
    &.{ "(0x75bcd15-0O726746425)", "(0x21786%3)" },
    &.{ "(0O57060516-0xbc614d)", "(0O12130251%3)" },
    &.{ "(15658734^0O73567354)", "(0x2935494a%7)" },
    &.{ "(0O334664274-0x37368B9)", "(0x20451009%9)", "(0O455601253%7)" },
    &.{ "(0x5E30A78-0O570605164)", "(0O73567354%6)", "(0x4A5D0CE&0O320423424)" },
    &.{ "(0O507646144^0x51F4C61)", "(0x510A64F%6)", "(0O300235434-50412311)" },
    &.{ "(1011010-0O3666474)", "(0x37F22A%12)", "(72559687&0O312111266)" },
    &.{ "(0x9D8DE4-0O47306735)", "(0O264353757%8)", "(0O144657447^0x1935F20)" },
    &.{ "(0O347010110&0x463A71D)", "(73639709%9)", "(0O3153050563-0x19AC516B)" },
};

/// Returns owned expression text, or null when no replacement applies.
/// This handles scalar values only; the AST caller enforces NumericLiteral
/// and rejects ObjectProperty, ClassMethod, and ObjectMethod parents.
/// Negative source numbers are unary expressions around positive literals.
pub fn integerExpression(
    allocator: Allocator,
    number: i64,
    options: IntegerOptions,
    random: *Random,
) Allocator.Error!?[]u8 {
    if (number < 0) return null;
    const value: u64 = @intCast(number);
    // The original uses `upper || 8`, including for an explicit zero upper.
    const upper: f64 = if (options.upper == 0) 8 else options.upper;
    const numeric: f64 = @floatFromInt(value);
    const in_range = numeric >= options.lower and numeric <= upper;
    if (in_range and value <= 8) {
        const templates = integer_templates[@intCast(value)];
        return try allocator.dupe(u8, templates[if (options.isRandomized()) random.index(templates.len) else 0]);
    }
    if (in_range)
        return if (value <= 65535) try arithmeticExpression(allocator, @intCast(value), options.isRandomized(), random) else null;

    const radix = options.selectRadix(random);
    if (radix == .none) return null;
    return try formatRadix(allocator, value, radix, false);
}

/// JavaScript Number stores integer literals as binary64, including values
/// beyond u64. Power-of-two radices expose those exact significand bits.
pub fn largeIntegerExpression(
    allocator: Allocator,
    value: f64,
    options: IntegerOptions,
    random: *Random,
) Allocator.Error!?[]u8 {
    const radix = options.selectRadix(random);
    if (radix == .none) return null;
    if (radix == .decimal) {
        var buffer: [128]u8 = undefined;
        const text = std.fmt.float.render(&buffer, value, .{ .mode = if (value < 1e21) .decimal else .scientific }) catch unreachable;
        if (std.mem.indexOfScalar(u8, text, 'e')) |position| {
            const exponent = std.fmt.parseInt(i32, text[position + 1 ..], 10) catch unreachable;
            return try std.fmt.allocPrint(allocator, "{s}e{s}{d}", .{ text[0..position], if (exponent >= 0) "+" else "", exponent });
        }
        return try allocator.dupe(u8, text);
    }
    const width: u4 = switch (radix) {
        .binary => 1,
        .octal => 3,
        .hexadecimal => 4,
        else => unreachable,
    };
    const prefix: []const u8 = switch (radix) {
        .binary => "0b",
        .octal => "0o",
        .hexadecimal => "0x",
        else => unreachable,
    };
    const bits: u64 = @bitCast(value);
    const exponent: u11 = @intCast((bits >> 52) & 0x7ff);
    const highest: usize = @as(usize, exponent) - 1023;
    const shift = highest - 52;
    const significand = (bits & 0xfffffffffffff) | 0x10000000000000;
    const count = highest / width + 1;
    const result = try allocator.alloc(u8, prefix.len + count);
    @memcpy(result[0..prefix.len], prefix);
    for (0..count) |i| {
        var digit: u4 = 0;
        const position = (count - 1 - i) * width;
        for (0..width) |j| {
            const bit = position + j;
            if (bit >= shift and bit - shift < 53 and ((significand >> @as(u6, @intCast(bit - shift))) & 1) != 0)
                digit |= @as(u4, 1) << @as(u2, @intCast(j));
        }
        result[prefix.len + i] = "0123456789abcdef"[digit];
    }
    return result;
}

fn arithmeticExpression(allocator: Allocator, value: u16, randomize: bool, random: *Random) Allocator.Error![]u8 {
    const addition = if (randomize) value == 0 or random.index(2) == 0 else value % 2 == 0;
    var a: u64 = undefined;
    var b: u64 = undefined;
    var operator: u8 = undefined;
    const n: f64 = @floatFromInt(value);
    if (addition) {
        a = 65536 + @as(u64, @intFromFloat(@floor(if (randomize) n * random.getRandomInt(1, 14) * 10 else 0.8 * n)));
        b = a - value;
        operator = '-';
    } else {
        std.debug.assert(value > 0);
        b = @as(u64, value) * @as(u64, @intFromFloat(@ceil(65536.0 / n))) +
            (if (randomize) @as(u64, @intFromFloat(random.getRandomInt(5, 19))) else 7);
        a = b * (if (randomize) @as(u64, @intFromFloat(random.getRandomInt(2, 5))) else 3) + value;
        operator = '%';
    }
    const choice = if (randomize) random.index(4) else @as(usize, @intCast(a % 4));
    const a_radix: Radix = switch (choice) {
        0 => .hexadecimal,
        1, 3 => .octal,
        else => .decimal,
    };
    const b_radix: Radix = switch (choice) {
        0, 2 => .octal,
        1 => .hexadecimal,
        else => .decimal,
    };
    const a_text = try formatRadix(allocator, a, a_radix, true);
    defer allocator.free(a_text);
    const b_text = try formatRadix(allocator, b, b_radix, true);
    defer allocator.free(b_text);
    return std.fmt.allocPrint(allocator, "({s}{c}{s})", .{ a_text, operator, b_text });
}

fn formatRadix(allocator: Allocator, value: u64, radix: Radix, uppercase: bool) Allocator.Error![]u8 {
    const base: u64 = switch (radix) {
        .binary => 2,
        .octal => 8,
        .decimal => 10,
        .hexadecimal => 16,
        .none => unreachable,
    };
    const prefix: []const u8 = switch (radix) {
        .binary => "0b",
        .octal => "0o",
        .hexadecimal => "0x",
        else => "",
    };
    const alphabet = if (uppercase) "0123456789ABCDEF" else "0123456789abcdef";
    var digits: [64]u8 = undefined;
    var remaining = value;
    var length: usize = 0;
    while (true) {
        digits[length] = alphabet[@intCast(remaining % base)];
        length += 1;
        remaining /= base;
        if (remaining == 0) break;
    }
    const result = try allocator.alloc(u8, prefix.len + length);
    @memcpy(result[0..prefix.len], prefix);
    for (0..length) |i| result[prefix.len + i] = digits[length - i - 1];
    return result;
}

test "Park-Miller states, seed normalization, and exclusive fractional bounds" {
    var random = Random.init(1);
    for ([_]f64{ 16807, 282475249, 1622650073, 984943658, 1144108930 }) |expected| {
        try std.testing.expectEqual(expected, random.next());
    }
    var zero = Random.init(0);
    try std.testing.expectEqual(@as(f64, 2147466840), zero.next());
    var negative = Random.init(-1);
    try std.testing.expectEqual(@as(f64, 2147450033), negative.next());
    var fractional_bounds = Random.init(1);
    try std.testing.expectEqual(@as(f64, 1), fractional_bounds.getRandomInt(0.2, 10.8));
    try std.testing.expectEqual(@as(usize, 0), fractional_bounds.index(0));
    try std.testing.expectEqual(@as(f64, 282475249), fractional_bounds.state);
}

test "all name alphabets match recovered ID zero vectors" {
    const cases = [_]struct {
        mode: NameMode,
        expected: []const u8,
    }{
        .{ .mode = .sequential, .expected = "_0x000000" },
        .{ .mode = .hexadecimal, .expected = "_0x7CD012" },
        .{ .mode = .base52, .expected = "Acjgb" },
        .{ .mode = .base62, .expected = "Ai5O" },
        .{ .mode = .runic, .expected = "\u{16b2}\u{16a0}\u{16ad}\u{16bf}" },
        .{ .mode = .glagolitic, .expected = "\u{2c1b}\u{2c25}\u{2c13}\u{2c12}" },
        .{ .mode = .tifinagh, .expected = "\u{2d32}\u{2d3b}\u{2d5e}\u{2d49}\u{2d31}" },
    };
    for (cases) |case| {
        const name = try mangleName(std.testing.allocator, 0, case.mode);
        defer std.testing.allocator.free(name);
        try std.testing.expectEqualStrings(case.expected, name);
    }
    const name = try mangleName(std.testing.allocator, 1234, .base62);
    defer std.testing.allocator.free(name);
    try std.testing.expectEqualStrings("cWKnb", name);
}

test "boolean defaults and seeded template selection" {
    var random = Random.init(1);
    try std.testing.expectEqualStrings("!![]", booleanExpression(true, false, &random));
    try std.testing.expectEqualStrings("(NaN===NaN)", booleanExpression(false, false, &random));
    try std.testing.expectEqual(@as(f64, 1), random.state);
    try std.testing.expectEqualStrings("!![]", booleanExpression(true, true, &random));
    try std.testing.expectEqualStrings("(NaN===NaN)", booleanExpression(false, true, &random));
    try std.testing.expectEqualStrings("([null]=='')", booleanExpression(true, true, &random));
}

test "integer templates, arithmetic, and out-of-range radix fallback" {
    const allocator = std.testing.allocator;
    var random = Random.init(1);
    const cases = [_]struct {
        n: i64,
        options: IntegerOptions,
        expected: []const u8,
    }{
        .{ .n = 0, .options = .{}, .expected = "(0x75bcd15-0O726746425)" },
        .{ .n = 8, .options = .{ .upper = 0 }, .expected = "(0O347010110&0x463A71D)" },
        .{ .n = 10, .options = .{ .upper = 100 }, .expected = "(0x10008-0o177776)" },
        .{ .n = 11, .options = .{ .upper = 100 }, .expected = "(196646%0o200011)" },
        .{ .n = 42, .options = .{ .radix = .hexadecimal }, .expected = "0x2a" },
        .{ .n = 10, .options = .{ .upper = 100, .randomize = true }, .expected = "(0o200310-65726)" },
    };
    for (cases) |case| {
        const expression = (try integerExpression(allocator, case.n, case.options, &random)).?;
        defer allocator.free(expression);
        try std.testing.expectEqualStrings(case.expected, expression);
    }
    try std.testing.expectEqual(@as(?[]u8, null), try integerExpression(allocator, -1, .{}, &random));
    try std.testing.expectEqual(@as(?[]u8, null), try integerExpression(allocator, 9, .{}, &random));
    var radix_random = Random.init(1);
    const expression = (try integerExpression(allocator, 9, .{ .radices = &.{ .octal, .hexadecimal } }, &radix_random)).?;
    defer allocator.free(expression);
    try std.testing.expectEqualStrings("0o11", expression);
    try std.testing.expectEqual(@as(f64, 16807), radix_random.state);
}

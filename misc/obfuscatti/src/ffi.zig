//! Node API surface backed exclusively by the native Zig protection engine.

const std = @import("std");
const napi = @import("napi-zig");
const obf = @import("obfuscate");
const config_object = @import("config_object.zig");
const config = obf.config;
const truthy = config_object.truthy;

const summary_array_fields = .{
    "sourceCodeLength",
    "isBundle",
    "numSyntaxNodes",
    "numFunctions",
    "maxFunctionDepths",
    "numStatements",
    "numClasses",
    "numModules",
    "numLoops",
    "numConditions",
    "numFlowBreaking",
    "esVersion",
    "protectedSourceLength",
    "transformSummary",
    "hasParseError",
    "unsafeConstructs",
};

fn restoreSummaryHoles(env: napi.Env, summary: napi.Val) !void {
    const reflect = try (try env.getGlobal()).getNamedProperty(env, "Reflect");
    const delete_property = try (try reflect.getNamedProperty(env, "deleteProperty")).to(env, napi.Callback);
    inline for (summary_array_fields) |name| {
        const array = try summary.getNamedProperty(env, name);
        if (try array.isArray(env)) {
            for (0..try array.getArrayLength(env)) |i| if (try (try array.getElement(env, @intCast(i))).typeOf(env) == .null) {
                _ = try delete_property.callWith(env, reflect, .{ array, try env.createFloat64(@floatFromInt(i)) });
            };
        }
    }
}
const MapPool = struct {
    env: napi.c.napi_env,
    reference: napi.Ref,
};

threadlocal var map_pool: ?MapPool = null;

fn clearMapPool(_: ?*anyopaque) callconv(.c) void {
    if (map_pool) |pool| {
        _ = napi.c.napi_delete_reference(pool.env, pool.reference.handle);
        map_pool = null;
    }
}

fn sourceMaps(env: napi.Env, json: ?[]const u8) !napi.Val {
    if (map_pool == null) {
        const array = try env.createArray();
        const reference = try env.createReference(array);
        errdefer reference.delete(env) catch {};
        if (napi.c.napi_add_env_cleanup_hook(env.handle, clearMapPool, null) != .ok) return error.NapiMapPool;
        map_pool = .{ .env = env.handle, .reference = reference };
    }
    const pool = try map_pool.?.reference.value(env);
    if (json) |text| {
        const updates = try parseJson(env, text);
        for (0..try updates.getArrayLength(env)) |i| try pool.setElement(env, @intCast(i), try updates.getElement(env, @intCast(i)));
    }
    return pool;
}

const ParsedOptions = struct {
    configuration: config.Config,
    minify: bool = false,

    fn deinit(self: *ParsedOptions) void {
        self.configuration.deinit();
    }
};

fn parseJson(env: napi.Env, source: []const u8) !napi.Val {
    const global = try env.getGlobal();
    const json = try global.getNamedProperty(env, "JSON");
    const parse = try (try json.getNamedProperty(env, "parse")).to(env, napi.Callback);
    return parse.callWith(env, json, .{try env.createString(source)});
}

const Logger = struct {
    env: napi.Env,
    callback: napi.Val,
    entries: napi.Val,

    fn append(self: *Logger, entry: napi.Val) !void {
        try self.entries.setElement(self.env, try self.entries.getArrayLength(self.env), entry);
        if (try self.callback.typeOf(self.env) != .function) return;
        const callback = try self.callback.to(self.env, napi.Callback);
        _ = callback.callWith(self.env, try self.env.createUndefined(), .{entry}) catch {
            if (self.env.isExceptionPending()) {
                var ignored: napi.c.napi_value = undefined;
                _ = napi.c.napi_get_and_clear_last_exception(self.env.handle, &ignored);
            }
            return;
        };
    }

    fn emit(self: *Logger, kind: []const u8, message: []const u8) !void {
        const entry = try self.env.createObject();
        try entry.setNamedProperty(self.env, "type", try self.env.createString(kind));
        try entry.setNamedProperty(self.env, "message", try self.env.createString(message));
        try entry.setNamedProperty(self.env, "code", try self.env.createUndefined());
        try self.append(entry);
    }

    fn finish(self: *Logger, result: napi.Val) !void {
        const report = try result.getNamedProperty(self.env, "protectionSummary");
        const logs = try report.getNamedProperty(self.env, "protectionLog");
        var cursor = try self.entries.getArrayLength(self.env);
        while (cursor < try logs.getArrayLength(self.env)) : (cursor += 1) try self.append(try logs.getElement(self.env, cursor));
        try report.setNamedProperty(self.env, "protectionLog", self.entries);
    }
};

fn hostDate(env: napi.Env, text: []const u8) !i64 {
    const date = try (try env.getGlobal()).getNamedProperty(env, "Date");
    const parse = try (try date.getNamedProperty(env, "parse")).to(env, napi.Callback);
    const value = try (try parse.callWith(env, date, .{try env.createString(text)})).to(env, f64);
    if (!std.math.isFinite(value)) return error.InvalidDate;
    return @intFromFloat(value);
}

fn validateDates(env: napi.Env, settings: config.Settings) !void {
    const value = settings.date_lock.get() orelse return;
    inline for (.{ .{ "startDate", value.start_date }, .{ "endDate", value.end_date } }) |field| {
        if (field[1]) |text| {
            if (text.len != 0) _ = hostDate(env, text) catch |failure| {
                if (failure != error.InvalidDate) return failure;
                try env.throwValue(
                    try env.createError(
                        try std.fmt.allocPrint(env.allocator(), "The value of '{s}' property is invalid.", .{field[0]}),
                    ),
                );
                return error.InvalidConfigurationValue;
            };
        }
    }
}

fn readOptions(env: napi.Env, value: ?napi.Val, allow_minify: bool) !ParsedOptions {
    const present = value orelse return .{ .configuration = config.defaults(env.allocator()) };
    if ((!allow_minify and !try truthy(env, present)) or try present.typeOf(env) == .null)
        return .{ .configuration = config.defaults(env.allocator()) };
    if (try present.typeOf(env) != .object) {
        try env.throwValue(try env.createError("The instance must be an object."));
        return error.InvalidConfiguration;
    }
    var arena = std.heap.ArenaAllocator.init(env.allocator());
    defer arena.deinit();
    const live = try config_object.read(env, arena.allocator(), present, allow_minify);
    var parsed = live.value;
    if (parsed != .object) return error.InvalidConfiguration;
    var minify = false;
    if (allow_minify) {
        if (parsed.object.get("minify")) |flag| {
            if (flag != .bool) return error.InvalidMinifyOption;
            minify = flag.bool;
            _ = parsed.object.swapRemove("minify");
        }
    }
    var configuration = if (allow_minify and parsed.object.count() == 0)
        config.defaults(env.allocator())
    else
        config.parseNormalized(env.allocator(), parsed) catch |failure| {
            try env.throwValue(try env.createError(try config.describeError(env.allocator(), failure)));
            return failure;
        };
    errdefer configuration.deinit();
    live.attach(&configuration);
    try validateDates(env, configuration.settings);
    var named = configuration.named_sets.valueIterator();
    while (named.next()) |settings| try validateDates(env, settings.*);
    return .{ .configuration = configuration, .minify = minify };
}

// Windows Node calls addons on a stack smaller than the CLI's. Parsing the
// recovered runtime can exhaust it. Only pure native work moves to this joined
// thread; every N-API call stays on the caller. The caller does not touch its
// arena during join, so the worker has exclusive access to that allocator.
fn optionNumber(env: napi.Env, value: napi.Val) !f64 {
    if (try value.typeOf(env) == .number) return value.to(env, f64);
    const number = try (try (try env.getGlobal()).getNamedProperty(env, "Number")).to(env, napi.Callback);
    return (try number.callWith(env, try env.createUndefined(), .{value})).to(env, f64);
}

fn optionRadix(env: napi.Env, value: napi.Val) !config.Radix {
    if (try value.typeOf(env) != .string) return .none;
    return std.meta.stringToEnum(config.Radix, try value.to(env, []const u8)) orelse .none;
}
const NativeJob = struct {
    allocator: std.mem.Allocator,
    sources: []const obf.SourceInfo,
    configuration: *const config.Config,
    minify: bool,
    result: ?obf.Result = null,
    failure: ?anyerror = null,
    failure_summary: ?*?[]const u8 = null,
    io: std.Io,
    ready: std.Io.Semaphore = .{},
    continue_native: std.Io.Semaphore = .{},
    done: bool = false,
    date_text: []const u8 = "",
    date_value: i64 = 0,
    host_failure: ?anyerror = null,
    logger: ?*Logger = null,
    request: Request = .date,
    option_object: *anyopaque = undefined,
    option_property: [:0]const u8 = "",
    option_value: bool = false,
    integer_value: config.IntegerOptions = .{},
    radix_fraction: f64 = 0,
    radix_value: config.Radix = .none,
    log_kind: []const u8 = "",
    log_message: []const u8 = "",

    const Request = enum {
        date,
        log,
        option,
        integer,
        radix,
    };

    fn requestHost(self: *NativeJob, request: Request) void {
        self.request = request;
        self.ready.post(self.io);
        self.continue_native.waitUncancelable(self.io);
    }

    fn parseDate(context: *anyopaque, text: []const u8) obf.engine.DateError!i64 {
        const self: *NativeJob = @ptrCast(@alignCast(context));
        self.date_text = text;
        self.requestHost(.date);
        if (self.host_failure != null) return error.DateAdapterFailed;
        return self.date_value;
    }

    fn emitLog(context: *anyopaque, kind: []const u8, message: []const u8) anyerror!void {
        const self: *NativeJob = @ptrCast(@alignCast(context));
        if (std.mem.eql(u8, message, "JSDefender version 2.12.0")) return;
        self.log_kind = kind;
        self.log_message = message;
        self.requestHost(.log);
        if (self.host_failure) |failure| return failure;
    }

    fn readBool(context: *anyopaque, object: *anyopaque, property: [:0]const u8) bool {
        const self: *NativeJob = @ptrCast(@alignCast(context));
        if (self.host_failure != null) return false;
        self.option_object = object;
        self.option_property = property;
        self.requestHost(.option);
        return self.option_value;
    }

    fn readInteger(context: *anyopaque, object: *anyopaque, randomize: bool) config.IntegerOptions {
        const self: *NativeJob = @ptrCast(@alignCast(context));
        if (self.host_failure != null) return .{};
        self.option_object = object;
        self.integer_value.randomize = randomize;
        self.requestHost(.integer);
        return self.integer_value;
    }

    fn integerOptions(self: *NativeJob, env: napi.Env) !config.IntegerOptions {
        const object = napi.Val{ .handle = @ptrCast(self.option_object) };
        const radix = try object.getNamedProperty(env, "radix");
        const lower = try object.getNamedProperty(env, "lower");
        const upper = try object.getNamedProperty(env, "upper");
        var value = config.IntegerOptions{
            .randomize = self.integer_value.randomize,
            .lower = if (try truthy(env, lower)) try optionNumber(env, lower) else 0,
            .upper = if (try truthy(env, upper)) try optionNumber(env, upper) else 8,
        };
        if (try radix.isArray(env)) {
            value.live_radix = @ptrCast(radix.handle);
        } else value.radix = try optionRadix(env, radix);
        return value;
    }

    fn readRadix(context: *anyopaque, object: *anyopaque, fraction: f64) config.Radix {
        const self: *NativeJob = @ptrCast(@alignCast(context));
        if (self.host_failure != null) return .none;
        self.option_object = object;
        self.radix_fraction = fraction;
        self.requestHost(.radix);
        return self.radix_value;
    }

    fn selectedRadix(self: *NativeJob, env: napi.Env) !config.Radix {
        const object = napi.Val{ .handle = @ptrCast(self.option_object) };
        const length = try (try object.getNamedProperty(env, "length")).to(env, u32);
        const index: u32 = @intFromFloat(@floor(self.radix_fraction * @as(f64, @floatFromInt(length))));
        return optionRadix(env, try object.getElement(env, index));
    }

    fn run(self: *NativeJob) void {
        const previous = config.activateBoolReader(.{ .context = self, .read = readBool });
        defer _ = config.activateBoolReader(previous);
        const previous_integer = config.activateIntegerReader(.{ .context = self, .read = readInteger, .read_radix = readRadix });
        defer _ = config.activateIntegerReader(previous_integer);
        defer {
            self.done = true;
            self.ready.post(self.io);
        }
        self.result = obf.protectSource(
            self.allocator,
            self.sources,
            self.configuration,
            .{
                .minify = self.minify,
                .date_parser = .{ .context = self, .parse = parseDate },
                .failure_summary = self.failure_summary,
                .log_sink = if (self.logger != null) .{ .context = self, .emit = emitLog } else null,
            },
        ) catch |failure| {
            self.failure = failure;
            return;
        };
    }
};

fn runProtection(
    env: napi.Env,
    allocator: std.mem.Allocator,
    sources: []const obf.SourceInfo,
    configuration: *const config.Config,
    minify: bool,
    failure_summary: ?*?[]const u8,
    logger: ?*Logger,
) !obf.Result {
    var threaded = std.Io.Threaded.init(std.heap.smp_allocator, .{});
    defer threaded.deinit();
    var job = NativeJob{
        .allocator = allocator,
        .sources = sources,
        .configuration = configuration,
        .minify = minify,
        .io = threaded.io(),
        .failure_summary = failure_summary,
        .logger = logger,
    };
    const thread = try std.Thread.spawn(
        .{ .stack_size = 16 * 1024 * 1024, .allocator = std.heap.smp_allocator },
        NativeJob.run,
        .{&job},
    );
    while (true) {
        job.ready.waitUncancelable(job.io);
        if (job.done) break;
        switch (job.request) {
            .date => job.date_value = hostDate(env, job.date_text) catch |failure| blk: {
                job.host_failure = failure;
                break :blk 0;
            },
            .log => job.logger.?.emit(job.log_kind, job.log_message) catch |failure| {
                job.host_failure = failure;
            },
            .option => job.option_value = truthy(env, (napi.Val{ .handle = @ptrCast(job.option_object) }).getNamedProperty(env, job.option_property) catch |failure| blk: {
                job.host_failure = failure;
                break :blk env.createBoolean(false) catch unreachable;
            }) catch |failure| blk: {
                job.host_failure = failure;
                break :blk false;
            },
            .integer => job.integer_value = job.integerOptions(env) catch |failure| blk: {
                job.host_failure = failure;
                break :blk .{};
            },
            .radix => job.radix_value = job.selectedRadix(env) catch |failure| blk: {
                job.host_failure = failure;
                break :blk .none;
            },
        }
        job.continue_native.post(job.io);
    }
    thread.join();
    if (job.host_failure) |failure| return failure;
    if (job.failure) |failure| return failure;
    return job.result.?;
}

pub fn obfuscate(env: napi.Env, source: []const u8, options: ?napi.Val) ![]const u8 {
    var parsed = try readOptions(env, options, true);
    defer parsed.deinit();
    if (parsed.configuration.runtime_injection.mode == .separate_source) {
        env.throwError("UnsupportedRuntimeMode: use protectSource() to receive the separately emitted jsdRuntime.");
        return error.UnsupportedRuntimeMode;
    }
    // The compatibility helper must return one self-contained ES module too.
    // The multi-source protectSource API preserves firstNonModule strictly.
    if (parsed.configuration.runtime_injection.mode == .first_non_module)
        parsed.configuration.runtime_injection.mode = .all;
    const result = try runProtection(
        env,
        env.allocator(),
        &.{.{ .source_code = source }},
        &parsed.configuration,
        parsed.minify,
        null,
        null,
    );
    defer result.deinit(env.allocator());
    if (result.protected_sources.len == 0) return env.allocator().dupe(u8, source);
    if (result.metro_bundle_info.len != 0) {
        const Replacement = struct {
            index: usize,
            start: usize,
            end: usize,
        };
        const replacements = try env.allocator().alloc(Replacement, result.metro_bundle_info.len);
        for (result.metro_bundle_info, replacements, 0..) |range, *replacement, i| replacement.* = .{ .index = i, .start = byteOffset(source, range.start), .end = byteOffset(source, range.end) };
        const Order = struct {
            fn less(_: void, a: Replacement, b: Replacement) bool {
                return a.start < b.start;
            }
        };
        std.mem.sort(Replacement, replacements, {}, Order.less);
        var output: std.ArrayList(u8) = .empty;
        var cursor: usize = 0;
        for (replacements) |replacement| {
            try output.appendSlice(env.allocator(), source[cursor..replacement.start]);
            try output.appendSlice(env.allocator(), result.protected_sources[replacement.index]);
            cursor = replacement.end;
        }
        try output.appendSlice(env.allocator(), source[cursor..]);
        return output.toOwnedSlice(env.allocator());
    }
    return env.allocator().dupe(u8, result.protected_sources[0]);
}

fn byteOffset(source: []const u8, target: usize) usize {
    var offset: usize = 0;
    var units: usize = 0;
    while (offset < source.len and units < target) {
        const length = std.unicode.utf8ByteSequenceLength(source[offset]) catch 1;
        units += if (length == 4) @as(usize, 2) else 1;
        offset += length;
    }
    return offset;
}

const FailureContext = struct {
    source_index: ?usize = null,
    source_is_array: bool = false,
    summary_json: ?[]const u8 = null,
};

fn protect(
    env: napi.Env,
    source_set: ?napi.Val,
    configuration: ?napi.Val,
    failure_context: *FailureContext,
    logger: ?*Logger,
) !napi.Val {
    const source_value = source_set orelse return error.InvalidSourceSet;
    if (!try source_value.isArray(env)) return error.InvalidSourceSet;
    failure_context.source_is_array = true;
    const sources = try env.allocator().alloc(obf.SourceInfo, try source_value.getArrayLength(env));
    if (sources.len == 0) return error.EmptySourceSet;
    for (sources, 0..) |*source, i| {
        failure_context.source_index = i;
        const value = try source_value.getElement(env, @intCast(i));
        if (try value.typeOf(env) == .null) {
            try env.throwValue(try env.createError("Cannot read properties of null (reading 'sourceCode')"));
            return error.NullSource;
        }
        if (try value.typeOf(env) != .object) return error.InvalidSourceSet;
        const code = try value.getNamedProperty(env, "sourceCode");
        if (try code.typeOf(env) != .string) return error.InvalidSourceSet;
        const is_module = try truthy(env, try value.getNamedProperty(env, "isModule"));
        source.* = .{ .source_code = try code.to(env, []const u8), .is_module = is_module };
    }
    failure_context.source_index = null;
    var options = try readOptions(env, configuration, false);
    defer options.deinit();
    const result = try runProtection(
        env,
        env.allocator(),
        sources,
        &options.configuration,
        true,
        &failure_context.summary_json,
        logger,
    );
    defer result.deinit(env.allocator());
    const output = try env.createObject();
    try output.setNamedProperty(env, "success", try env.createBoolean(true));
    try output.setNamedProperty(env, "protectedSources", try env.toJs(result.protected_sources));
    try output.setNamedProperty(
        env,
        "jsdRuntime",
        if (result.jsd_runtime) |runtime| try env.createString(runtime) else try env.createNull(),
    );
    const summary = if (result.protection_summary) |json| try parseJson(env, json) else try env.createObject();
    try restoreSummaryHoles(env, summary);
    try summary.setNamedProperty(env, "protectionException", try env.createUndefined());
    const logs = try summary.getNamedProperty(env, "protectionLog");
    for (0..try logs.getArrayLength(env)) |i| try (try logs.getElement(env, @intCast(i))).setNamedProperty(env, "code", try env.createUndefined());
    try output.setNamedProperty(env, "protectionSummary", summary);
    try output.setNamedProperty(
        env,
        "maps",
        if (result.maps) |json| try parseJson(env, json) else try env.createArray(),
    );
    try output.setNamedProperty(env, "sourceMaps", try sourceMaps(env, result.source_maps));
    const JsRange = struct {
        start: f64,
        end: f64,
    };
    const ranges = try env.allocator().alloc(JsRange, result.metro_bundle_info.len);
    for (result.metro_bundle_info, ranges) |range, *value| value.* = .{ .start = @floatFromInt(range.start), .end = @floatFromInt(range.end) };
    try output.setNamedProperty(env, "metroBundleInfo", try env.toJs(ranges));
    return output;
}

fn failedResult(
    env: napi.Env,
    failure: anyerror,
    context: FailureContext,
    configuration: ?napi.Val,
) !napi.Val {
    var pending_message: ?[]const u8 = null;
    if (env.isExceptionPending()) {
        var exception: napi.c.napi_value = undefined;
        if (napi.c.napi_get_and_clear_last_exception(env.handle, &exception) == .ok) {
            const value = napi.Val{ .handle = exception };
            if (try value.typeOf(env) == .object) {
                const text = try value.getNamedProperty(env, "message");
                if (try text.typeOf(env) == .string) pending_message = try text.to(env, []const u8);
            } else if (try value.typeOf(env) == .string) pending_message = try value.to(env, []const u8);
        }
    }
    var separate_runtime = false;
    if (configuration) |value| if (try value.typeOf(env) == .object) {
        const injection = try value.getNamedProperty(env, "runtimeInjection");
        const mode = if (try injection.typeOf(env) == .object) try injection.getNamedProperty(env, "mode") else injection;
        if (try mode.typeOf(env) == .string)
            separate_runtime = std.mem.eql(u8, try mode.to(env, []const u8), "separateSource");
    };
    var message: []const u8 = switch (failure) {
        error.InvalidSourceSet => if (context.source_is_array) try std.fmt.allocPrint(
            env.allocator(),
            "Each elements of the input array must be an object with a 'sourceCode' string property. Element at index {d} is not valid.",
            .{context.source_index orelse 0},
        ) else "The input must be an array of source code information.",
        error.EmptySourceSet => "The input cannot be an empty array.",
        error.ParseFailed => "Parse error found in 1 source code script.",
        error.InvalidInlineDirectives => "Inline protection directive parse errors founds in the source code.",
        error.UnsupportedControlFlowBinding => "Property name expected type of string but got undefined",
        error.MissingMetroHeaderDeclarator => "Cannot read properties of undefined (reading 'id')",
        error.MissingMetroFactory => "Cannot read properties of undefined (reading 'body')",
        error.InvalidMetroFactory => "Cannot read properties of undefined (reading 'end')",
        error.InvalidFilenameMap => "Cannot read properties of undefined (reading 'indexOf')",
        error.NullFilenameMap => "Cannot read properties of null (reading 'indexOf')",
        error.InvalidFilenameMapType => "(intermediate value)(intermediate value)(intermediate value).indexOf is not a function",
        error.RuntimeFileRequired => if (separate_runtime)
            "the `runtimeFile` option should be set explicitly if the `runtimeInjection` mode is set to `separateSource`."
        else
            "JSDefender cannot inject its Runtime into the protected code, as all inputs are modules.",
        error.UnexpectedRuntimeFile => "the `runtimeInjection` mode cannot be set to `firstNonModule` or `all` if the `runtimeFile` is being provided. Either remove the `runtimeFile` option or set the `runtimeInjection` to `separateSource`.",
        else => @errorName(failure),
    };
    if (try obf.engine.failureMessage(env.allocator(), failure)) |text| message = text;
    if (pending_message) |text| message = text;
    const summary = if (context.summary_json) |json| try parseJson(env, json) else try env.createObject();
    if (context.summary_json != null) try restoreSummaryHoles(env, summary);
    if (failure == error.ParseFailed and context.summary_json != null) {
        const errors = try summary.getNamedProperty(env, "hasParseError");
        var count: usize = 0;
        for (0..try errors.getArrayLength(env)) |i| if (try truthy(env, try errors.getElement(env, @intCast(i)))) {
            count += 1;
        };
        message = try std.fmt.allocPrint(
            env.allocator(),
            "Parse error found in {d} source code {s}.",
            .{ count, if (count == 1) "script" else "scripts" },
        );
    }
    if (failure == error.UnsafeConstruct and context.summary_json != null) {
        const unsafe_sources = try summary.getNamedProperty(env, "unsafeConstructs");
        var index: usize = 0;
        for (0..try unsafe_sources.getArrayLength(env)) |i| if (try truthy(env, try unsafe_sources.getElement(env, @intCast(i)))) {
            index = i;
            break;
        };
        message = try std.fmt.allocPrint(env.allocator(), "Unsafe construct found in script #{d}", .{index});
    }
    const input_error = switch (failure) {
        error.InvalidSourceSet, error.EmptySourceSet, error.InvalidIdentifier, error.InvalidDomainPattern, error.MissingConfigurationProperty => true,
        else => std.mem.indexOf(u8, @errorName(failure), "Configuration") != null,
    };
    const code: ?[]const u8 = switch (failure) {
        error.InvalidSourceSet, error.EmptySourceSet => "invalid-protection-input",
        error.ParseFailed, error.InvalidInlineDirectives => "parse",
        error.UnsafeConstruct => "unsafe-construct",
        error.RuntimeFileRequired => if (separate_runtime) "no-runtime-file-separate-source" else "no-runtime-file",
        error.UnexpectedRuntimeFile => "no-runtime-file-separate-source",
        else => if (input_error) "invalid-configuration" else null,
    };
    const output = try env.createObject();
    try output.setNamedProperty(env, "success", try env.createBoolean(false));
    try output.setNamedProperty(env, "jsdRuntime", try env.createNull());
    inline for (.{ "protectedSources", "maps", "metroBundleInfo" }) |name| try output.setNamedProperty(env, name, try env.createArray());
    try output.setNamedProperty(env, "sourceMaps", try sourceMaps(env, null));
    if (context.summary_json == null) {
        inline for (summary_array_fields) |name| try summary.setNamedProperty(env, name, try env.createArray());
        try summary.setNamedProperty(env, "executionTime", try env.createFloat64(0));
    }
    var seed: f64 = 0;
    if (configuration) |value| if (try value.typeOf(env) == .object) {
        const property = try value.getNamedProperty(env, "randomSeed");
        if (try property.typeOf(env) == .number) seed = try property.to(env, f64);
    };
    if (context.summary_json == null) try summary.setNamedProperty(env, "randomSeed", try env.createFloat64(seed));
    try summary.setNamedProperty(env, "protectionException", try env.createUndefined());
    try summary.setNamedProperty(
        env,
        if (input_error) "inputError" else "protectionException",
        try env.createString(message),
    );
    const logs = if (context.summary_json != null) try summary.getNamedProperty(env, "protectionLog") else try env.createArray();
    if (context.summary_json == null) {
        const version = try env.createObject();
        try version.setNamedProperty(env, "type", try env.createString("Info"));
        try version.setNamedProperty(env, "message", try env.createString("JSDefender version 2.12.0"));
        try version.setNamedProperty(env, "code", try env.createUndefined());
        try logs.setElement(env, 0, version);
    } else for (0..try logs.getArrayLength(env)) |i| try (try logs.getElement(env, @intCast(i))).setNamedProperty(env, "code", try env.createUndefined());
    const entry = try env.createObject();
    try entry.setNamedProperty(env, "type", try env.createString("Error"));
    try entry.setNamedProperty(env, "message", try env.createString(message));
    try entry.setNamedProperty(
        env,
        "code",
        if (code) |value| try env.createString(value) else try env.createUndefined(),
    );
    try logs.setElement(env, try logs.getArrayLength(env), entry);
    try summary.setNamedProperty(env, "protectionLog", logs);
    try output.setNamedProperty(env, "protectionSummary", summary);
    return output;
}

fn reject(env: napi.Env, deferred: napi.Deferred, failure: anyerror) !void {
    var reason: ?napi.Val = null;
    if (env.isExceptionPending()) {
        var exception: napi.c.napi_value = undefined;
        if (napi.c.napi_get_and_clear_last_exception(env.handle, &exception) == .ok) reason = .{ .handle = exception };
    }
    try deferred.reject(env, reason orelse try env.createError(@errorName(failure)));
}

/// Always returns a promise, including validation and protection failures.
pub fn protectSource(
    env: napi.Env,
    source_set: ?napi.Val,
    configuration: ?napi.Val,
    caller: ?napi.Val,
    log_callback: ?napi.Val,
) !napi.Val {
    _ = caller; // Module 9219 accepts this argument without consulting it.
    const promise = try env.createPromise();
    var logger: ?Logger = if (log_callback) |callback| .{ .env = env, .callback = callback, .entries = try env.createArray() } else null;
    if (logger) |*value| try value.emit("Info", "JSDefender version 2.12.0");
    var context = FailureContext{};
    const output = protect(env, source_set, configuration, &context, if (logger) |*value| value else null) catch |failure| {
        if (failure == error.OutOfMemory) {
            try reject(env, promise.deferred, failure);
            return promise.promise;
        }
        const result = failedResult(env, failure, context, configuration) catch |report_failure| {
            try reject(env, promise.deferred, report_failure);
            return promise.promise;
        };
        if (logger) |*value| try value.finish(result);
        try promise.deferred.resolve(env, result);
        return promise.promise;
    };
    if (logger) |*value| try value.finish(output);
    try promise.deferred.resolve(env, output);
    return promise.promise;
}

pub fn getVersion() []const u8 {
    return "2.12.0";
}

comptime {
    napi.module(@This());
}

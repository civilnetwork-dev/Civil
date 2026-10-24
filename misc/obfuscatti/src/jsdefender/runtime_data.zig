//! Inert template data recovered from JSDefender Core2.12.0 modules949,1503,297,5068.

pub const zeroExpressions = [_][]const u8{
    "+[]",
    "++[+[]][+[]]-+!+[]",
    "+[[+[[+!+[]]+[+[]]]+[]][+[]][+!+[]]]",
    "+[[+[[!+[]+!+[]]+[+[]]]+[]][+[]][+!+[]]]",
    "+[[+[[+[]]+[+[]]]+[]][+[]][+!+[]]]",
    "+[[+[[+[]]+[+[]]]+[]][+[]][+[]]]",
};

pub const oneExpressions = [_][]const u8{
    "+!+[]",
    "+[]+!+[]",
    "+[[+[[+!+[]]+[+[]]]+[]][+[]][+[]]]",
    "+[[+[[+![]+!+[]]+[+[]]]+[]][+[]][+[]]]",
    "++[+[]][+[]]",
    "++[+[]][+[]]+(++[+[]][+[]])-+!+[]",
};

pub const twoExpressions = [_][]const u8{
    "++[+[]][+[]]+(++[+[]][+[]])",
    "+!+[]+!+[]",
    "+([+[[!+[]+!+[]]+[+[]]]]+[])[+[]]",
    "+([+[[!+[]+!+[]]+[+[]]]]+[])[+[[+[[+[]]+[+[]]]+[]][+[]][+!+[]]]]",
    "+!+[]+(++[+[]][+[]])",
    "+[]+!+[]+(++[+[]][+[]+[]])",
};

pub const threeExpressions = [_][]const u8{ "(1)+(1)+(1)", "(1)+(2)", "(2)+(1)", "(2)*(1)+1", "(1)+(2)*(1)" };
pub const fourExpressions = [_][]const u8{ "(1)+(2)+(1)", "(2)*(2)", "(2)*(1)+(2)", "(1)+(1)+(2)", "(2)+(1)*(0)+(2)" };
pub const fiveExpressions = [_][]const u8{ "(2)*(2)+(1)", "(1)+(2)*(2)", "(1)+(2)+(2)", "(2)+(1)+(2)" };
pub const Character = struct {
    value: u8,
    expressions: []const []const u8,
};

pub const characters = [_]Character{
    .{ .value = 48, .expressions = &.{":(#0#)+[]"} },

    .{ .value = 49, .expressions = &.{":(#1#)+[]"} },

    .{ .value = 50, .expressions = &.{":(#2#)+[]"} },

    .{ .value = 51, .expressions = &.{":(#3#)+[]"} },

    .{ .value = 52, .expressions = &.{":(#4#)+[]"} },

    .{ .value = 53, .expressions = &.{":(#5#)+[]"} },

    .{ .value = 54, .expressions = &.{":(#6#)+[]"} },

    .{ .value = 55, .expressions = &.{":(#7#)+[]"} },

    .{ .value = 56, .expressions = &.{":(#8#)+[]"} },

    .{ .value = 57, .expressions = &.{":(#9#)+[]"} },

    .{ .value = 97, .expressions = &.{ "(![]+[])[+!+[]]", "((+[![]])+[])[+!+[]]" } },

    .{ .value = 98, .expressions = &.{"(typeof ![])[+[]]"} },

    .{ .value = 99, .expressions = &.{":([][$find$] +[])[+!+[]+!+[]+!+[]]"} },

    .{ .value = 100, .expressions = &.{"([][[]]+[])[++[++[[]][+[]]][+[]]]"} },

    .{ .value = 101, .expressions = &.{ "(!![]+[])[+!+[]+!+[]+!+[]]", "([][[]]+[])[+!+[]+!+[]+!+[]]" } },

    .{ .value = 102, .expressions = &.{ "(![]+[])[+[]]", "([][[]]+[])[+!+[]+!+[]+!+[]+!+[]]" } },

    .{ .value = 103, .expressions = &.{"(typeof ([]+[]))[+!+[]+!+[]+!+[]+!+[]+!+[]]"} },

    .{
        .value = 104,

        .expressions = &.{ ":(#17#)[$toString$](#36#)", ":(#17#)[$toString$](#23#)", ":(#17#)[$toString$](#31#)" },
    },

    .{ .value = 105, .expressions = &.{"(typeof ([]+[]))[+!+[]+!+[]+!+[]]"} },

    .{
        .value = 106,

        .expressions = &.{ ":(#19#)[$toString$](#36#)", ":(#19#)[$toString$](#33#)", ":(#19#)[$toString$](#31#)" },
    },

    .{
        .value = 107,

        .expressions = &.{ ":(#20#)[$toString$](#36#)", ":(#20#)[$toString$](#21#)", ":(#20#)[$toString$](#29#)" },
    },

    .{ .value = 108, .expressions = &.{"(![]+[])[+!+[]+!+[]]"} },

    .{
        .value = 109,

        .expressions = &.{ ":(#22#)[$toString$](#36#)", ":(#22#)[$toString$](#23#)", ":(#22#)[$toString$](#31#)" },
    },

    .{ .value = 110, .expressions = &.{"([][[]]+[])[+[]+!+[]]"} },

    .{ .value = 111, .expressions = &.{ "(typeof ![])[+!+[]]", "(typeof [])[+[]]" } },

    .{ .value = 112, .expressions = &.{"'\\u0070'"} },

    .{
        .value = 113,

        .expressions = &.{ ":(#26#)[$toString$](#36#)", ":(#26#)[$toString$](#27#)", ":(#26#)[$toString$](#28#)" },
    },

    .{ .value = 114, .expressions = &.{ "(!![]+[])[+!+[]]", "(typeof ([]+[]))[+!+[]+!+[]]" } },

    .{ .value = 115, .expressions = &.{"(![]+[])[+!+[]+!+[]+!+[]]"} },

    .{ .value = 116, .expressions = &.{ "(!![]+[])[+[]]", "(typeof ([]+[]))[+!+[]]" } },

    .{ .value = 117, .expressions = &.{"([][[]]+[])[+[]]"} },

    .{
        .value = 118,

        .expressions = &.{ ":(#31#)[$toString$](#36#)", ":(#31#)[$toString$](#34#)", ":(#31#)[$toString$](#35#)" },
    },

    .{
        .value = 119,

        .expressions = &.{ ":(#32#)[$toString$](#36#)", ":(#32#)[$toString$](#33#)", ":(#32#)[$toString$](#35#)" },
    },

    .{
        .value = 120,

        .expressions = &.{ ":(#33#)[$toString$](#36#)", ":(#33#)[$toString$](#35#)", ":(#33#)[$toString$](#34#)" },
    },

    .{
        .value = 121,

        .expressions = &.{
            "(+(((+!+[])+[])+((!![]+[])[+!+[]+!+[]+!+[]])+(+!+[])+(+[])+(+[])+(+[]))+[])[+!+[]+!+[]+!+[]+!+[]+!+[]+!+[]+!+[]]",
        },
    },

    .{ .value = 122, .expressions = &.{":(#35#)[$toString$](#36#)"} },

    .{ .value = 65, .expressions = &.{ ":($a$)[$toUpperCase$]()", ":([][$entries$]() +[])[#8#]" } },

    .{ .value = 66, .expressions = &.{":($b$)[$toUpperCase$]()"} },

    .{ .value = 67, .expressions = &.{"'\\u0043'"} },

    .{ .value = 68, .expressions = &.{":($d$)[$toUpperCase$]()"} },

    .{ .value = 69, .expressions = &.{":($e$)[$toUpperCase$]()"} },

    .{ .value = 70, .expressions = &.{":($f$)[$toUpperCase$]()"} },

    .{ .value = 71, .expressions = &.{":($g$)[$toUpperCase$]()"} },

    .{ .value = 72, .expressions = &.{":($h$)[$toUpperCase$]()"} },

    .{ .value = 73, .expressions = &.{ ":($i$)[$toUpperCase$]()", ":([][$entries$]() +[])[#14#]" } },

    .{ .value = 74, .expressions = &.{":($j$)[$toUpperCase$]()"} },

    .{ .value = 75, .expressions = &.{":($k$)[$toUpperCase$]()"} },

    .{ .value = 76, .expressions = &.{":($l$)[$toUpperCase$]()"} },

    .{ .value = 77, .expressions = &.{":($m$)[$toUpperCase$]()"} },

    .{ .value = 78, .expressions = &.{":($n$)[$toUpperCase$]()"} },

    .{ .value = 79, .expressions = &.{":($o$)[$toUpperCase$]()"} },

    .{ .value = 80, .expressions = &.{":($p$)[$toUpperCase$]()"} },

    .{ .value = 81, .expressions = &.{":($q$)[$toUpperCase$]()"} },

    .{ .value = 82, .expressions = &.{":($r$)[$toUpperCase$]()"} },

    .{ .value = 83, .expressions = &.{":($s$)[$toUpperCase$]()"} },

    .{ .value = 84, .expressions = &.{":($t$)[$toUpperCase$]()"} },

    .{ .value = 85, .expressions = &.{"'\\u0055'"} },

    .{ .value = 86, .expressions = &.{":($v$)[$toUpperCase$]()"} },

    .{ .value = 87, .expressions = &.{":($w$)[$toUpperCase$]()"} },

    .{ .value = 88, .expressions = &.{":($x$)[$toUpperCase$]()"} },

    .{ .value = 89, .expressions = &.{":($y$)[$toUpperCase$]()"} },

    .{ .value = 90, .expressions = &.{":($z$)[$toUpperCase$]()"} },

    .{ .value = 32, .expressions = &.{":([][$find$] +[])[#8#]"} },

    .{ .value = 60, .expressions = &.{":(''[$fontcolor$]())[+[]]"} },

    .{ .value = 61, .expressions = &.{":(''[$fontcolor$]())[#11#]"} },

    .{ .value = 62, .expressions = &.{":(''[$fontcolor$]())[#23#]"} },

    .{ .value = 91, .expressions = &.{":([][$entries$]() +[])[+[]]"} },

    .{ .value = 93, .expressions = &.{":([][$entries$]() +[])[#22#]"} },

    .{ .value = 47, .expressions = &.{":(''[$fontcolor$]())[#25#]"} },

    .{ .value = 40, .expressions = &.{":([][$find$] +[])[#13#]"} },

    .{ .value = 41, .expressions = &.{":([][$find$] +[])[#14#]"} },

    .{ .value = 46, .expressions = &.{":(((#1#)/(#2#))+[])[+!+[]]"} },

    .{ .value = 95, .expressions = &.{"'\\u005f'"} },
};

pub const StringSpec = struct {
    key: []const u8,
    value: ?[]const u8 = null,
    separator: ?[]const u8 = null,
    suggested_length: ?usize = null,
    use_trap: bool = false,
};

pub const Helper = struct {
    name: []const u8,
    template: []const u8,
    dependencies: []const []const u8 = &.{},
    vars: []const []const u8 = &.{},
    strings: []const StringSpec = &.{},
    use_trap: bool = false,
};

pub const helpers = [_]Helper{
    .{ .name = "getGlobalObject", .template = "\x0afunction getGlobalObject2() {\x0a  if (!{{_globalObj}}) {\x0a    $CONST glob = {{_globalObj}} = Function({{$returnThis}})();\x0a    setProtector();\x0a    $LET hiddenCons = glob[$webkit$+$EventStorage$];\x0a    if (!hiddenCons) {\x0a      {{_globalObj}}[$webkitEventStorage$] = glob[$co$+$nsole$];\x0a      glob[$AbortSignalRenderer$] = getNoOp;\x0a    }\x0a  }\x0a  return {{_globalObj}};\x0a}\x0a", .dependencies = &.{"decodeShuffledString"}, .vars = &.{"_globalObj"}, .strings = &.{
        .{ .key = "returnThis", .value = "return this", .separator = null, .suggested_length = 30, .use_trap = false },
    }, .use_trap = false },

    .{
        .name = "getObject",
        .template = "\x0afunction getObject() {\x0a  return {{getGlobalObject}}()[$Object$];\x0a}\x0a",
        .dependencies = &.{"getGlobalObject"},
        .vars = &.{},
        .strings = &.{},
        .use_trap = false,
    },

    .{
        .name = "getArray",
        .template = "\x0afunction getArray() {\x0a  return {{getGlobalObject}}()[$Array$];\x0a}\x0a",
        .dependencies = &.{"getGlobalObject"},
        .vars = &.{},
        .strings = &.{},
        .use_trap = false,
    },

    .{
        .name = "getNumber",
        .template = "\x0afunction getNumber() {\x0a  return {{getGlobalObject}}()[$Number$];\x0a}\x0a",
        .dependencies = &.{"getGlobalObject"},
        .vars = &.{},
        .strings = &.{},
        .use_trap = false,
    },

    .{
        .name = "getFunction",
        .template = "\x0afunction getFunction() {\x0a  return {{getGlobalObject}}()[$Function$];\x0a}\x0a",
        .dependencies = &.{"getGlobalObject"},
        .vars = &.{},
        .strings = &.{},
        .use_trap = false,
    },

    .{
        .name = "getString",
        .template = "\x0afunction getString() {\x0a  return {{getGlobalObject}}()[$String$];\x0a}\x0a",
        .dependencies = &.{"getGlobalObject"},
        .vars = &.{},
        .strings = &.{},
        .use_trap = false,
    },

    .{
        .name = "getDateNow",

        .template = "\x0afunction getDateNow() {\x0a  return {{getGlobalObject}}()[$Date$][$now$]();\x0a}\x0a",

        .dependencies = &.{"getGlobalObject"},

        .vars = &.{},

        .strings = &.{},

        .use_trap = false,
    },

    .{
        .name = "bindToGlobal",

        .template = "\x0afunction bindToGlobal(subject) {\x0a  if (typeof subject === \"function\") {\x0a    return subject.bind({{getGlobalObject}}());\x0a  }\x0a  return subject;\x0a}\x0a",

        .dependencies = &.{"getGlobalObject"},

        .vars = &.{},

        .strings = &.{},

        .use_trap = false,
    },

    .{
        .name = "string-fill",

        .template = "\x0afunction fill(size, filler) {\x0a  $LET result = \"\";\x0a  for ($LET j = size - (#1#); j >= #0#; j--) {\x0a    result += filler;\x0a  }\x0a  return result;\x0a}\x0a",

        .dependencies = &.{},

        .vars = &.{},

        .strings = &.{},

        .use_trap = false,
    },

    .{
        .name = "string-substr",

        .template = "\x0afunction substr(input, start, len) {\x0a  $LET result = \"\";\x0a  for ($LET i = start; i < start + (len === undefined ? input.length: len); i++) {\x0a    if (i >= input.length) break;\x0a    result += input[i];\x0a  }\x0a  return result;\x0a}\x0a",

        .dependencies = &.{},

        .vars = &.{},

        .strings = &.{},

        .use_trap = false,
    },

    .{
        .name = "string-indexOfChar",

        .template = "\x0afunction indexOfChar(input, searchFor) {\x0a  $LET pos = -#1#;\x0a  for ($LET i = #0#; i < input.length; i++) {\x0a    if (input[i] === searchFor[#0#]) return i;\x0a  }\x0a  return pos;\x0a}\x0a",

        .dependencies = &.{},

        .vars = &.{},

        .strings = &.{},

        .use_trap = false,
    },

    .{
        .name = "decodeShuffledString",

        .template = "\x0afunction decodeShuffledString(\x0a  input,\x0a  size,\x0a  base,\x0a  startIndex\x0a) {\x0a  $CONST separator = {{string-substr}}(input, input.length - (#1#));\x0a  $LET result = {{string-fill}}(size - (#1#), separator);\x0a  $LET index = startIndex;\x0a  for (let i = #0#; i < size - (#1#); i++) {\x0a    $CONST nextCh = input[i];\x0a    result = {{string-substr}}(result, #0#, index - (#1#)) + nextCh + {{string-substr}}(result, index);\x0a    index = (index * base) % size;\x0a  }\x0a  $CONST pos = {{string-indexOfChar}}(result, separator);\x0a  if (pos >= #0#) {\x0a    result = {{string-substr}}(result, #0#, pos);\x0a  }\x0a  return result;\x0a}\x0a",

        .dependencies = &.{ "string-fill", "string-substr", "string-indexOfChar" },

        .vars = &.{},

        .strings = &.{},

        .use_trap = false,
    },

    .{
        .name = "getTrapString",

        .template = "\x0afunction getTrapString() {\x0a  const cons = {{getGlobalObject}}()[$console$];\x0a  return cons ? (cons+[])[{{getDateNow}} % #10#] : {{string-substr}}(cons+[], #19#);\x0a}\x0a",

        .dependencies = &.{ "getGlobalObject", "getDateNow", "string-substr" },

        .vars = &.{},

        .strings = &.{},

        .use_trap = false,
    },

    .{
        .name = "hideConsole",

        .template = "\x0afunction hideConsole() {\x0a  $PROT[$ch$] = {{getGlobalObject}}()[$console$];\x0a  {{getGlobalObject}}()[$co$+$nsole$] = $PROT[$unknown$];\x0a}\x0a",

        .dependencies = &.{"getGlobalObject"},

        .vars = &.{},

        .strings = &.{},

        .use_trap = false,
    },

    .{
        .name = "restoreConsole",

        .template = "\x0afunction restoreConsole() {\x0a  {{getGlobalObject}}()[$console$] = $PROT[$ch$];\x0a}\x0a",

        .dependencies = &.{"getGlobalObject"},

        .vars = &.{},

        .strings = &.{},

        .use_trap = false,
    },
};

pub const primes = [_]u16{
    2,
    3,
    5,
    7,
    11,
    13,
    17,
    19,
    23,
    29,
    31,
    37,
    41,
    43,
    47,
    53,
    59,
    61,
    67,
    71,
    73,
    79,
    83,
    89,
    97,
    101,
    103,
    107,
    109,
    113,
    127,
    131,
    137,
    139,
    149,
    151,
    157,
    163,
    167,
    173,
    179,
    181,
    191,
    193,
    197,
    199,
    211,
    223,
    227,
    229,
    233,
    239,
    241,
    251,
    257,
};

pub const Roots = struct {
    prime: u16,
    values: []const u16,
};

pub const roots = [_]Roots{
    .{ .prime = 5, .values = &.{ 3, 2 } },
    .{ .prime = 7, .values = &.{ 5, 3 } },
    .{ .prime = 11, .values = &.{ 7, 2 } },
    .{ .prime = 13, .values = &.{ 11, 7, 2 } },
    .{ .prime = 17, .values = &.{ 11, 7, 5, 3 } },
    .{ .prime = 19, .values = &.{ 13, 3, 2 } },
    .{ .prime = 23, .values = &.{ 19, 17, 11, 7, 5 } },
    .{ .prime = 29, .values = &.{ 19, 11, 3, 2 } },
    .{ .prime = 31, .values = &.{ 17, 13, 11, 3 } },
    .{ .prime = 37, .values = &.{ 19, 17, 13, 5, 2 } },
    .{ .prime = 41, .values = &.{ 29, 19, 17, 13, 11, 7 } },
    .{ .prime = 43, .values = &.{ 29, 19, 5, 3 } },
    .{ .prime = 47, .values = &.{ 43, 41, 31, 29, 23, 19, 13, 11 } },
    .{ .prime = 53, .values = &.{ 41, 31, 19, 5, 3, 2 } },
    .{ .prime = 59, .values = &.{ 47, 43, 37, 31, 23, 13, 11, 2 } },
    .{ .prime = 61, .values = &.{ 59, 43, 31, 17, 7, 2 } },
    .{ .prime = 67, .values = &.{ 61, 41, 31, 13, 11, 7, 2 } },
    .{ .prime = 71, .values = &.{ 67, 61, 59, 53, 47, 31, 13, 11 } },
    .{ .prime = 73, .values = &.{ 59, 53, 47, 31, 29, 13, 11, 5 } },
    .{ .prime = 79, .values = &.{ 59, 53, 47, 43, 37, 29, 7, 3 } },
    .{ .prime = 83, .values = &.{ 79, 73, 71, 67, 53, 47, 43, 19 } },
    .{ .prime = 89, .values = &.{ 83, 61, 59, 43, 41, 31, 29, 23 } },
    .{ .prime = 97, .values = &.{ 83, 71, 59, 41, 37, 29, 23, 17 } },
    .{ .prime = 101, .values = &.{ 89, 83, 73, 67, 61, 59, 53, 29 } },
    .{ .prime = 103, .values = &.{ 101, 71, 67, 53, 43, 11, 5 } },
    .{ .prime = 107, .values = &.{ 103, 97, 73, 71, 67, 59, 43, 31 } },
    .{ .prime = 109, .values = &.{ 103, 79, 67, 59, 53, 47, 37, 13 } },
    .{ .prime = 113, .values = &.{ 107, 103, 101, 89, 79, 67, 59, 47 } },
    .{ .prime = 127, .values = &.{ 109, 101, 97, 83, 67, 53, 43, 29 } },
    .{ .prime = 131, .values = &.{ 127, 103, 97, 83, 67, 37, 31, 29 } },
    .{ .prime = 137, .values = &.{ 131, 113, 97, 89, 83, 79, 71, 67 } },
    .{ .prime = 139, .values = &.{ 109, 101, 73, 61, 53, 19, 17, 3 } },
    .{ .prime = 149, .values = &.{ 139, 137, 131, 109, 101, 97, 89, 83 } },
    .{ .prime = 151, .values = &.{ 109, 89, 71, 61, 13, 7 } },
    .{ .prime = 157, .values = &.{ 151, 139, 137, 131, 97, 83, 73, 61 } },
    .{ .prime = 163, .values = &.{ 149, 139, 137, 109, 107, 103, 101, 89 } },
    .{ .prime = 167, .values = &.{ 163, 151, 149, 139, 131, 113, 109, 103 } },
    .{ .prime = 173, .values = &.{ 131, 127, 107, 103, 101, 97, 79, 71 } },
    .{ .prime = 179, .values = &.{ 167, 163, 157, 137, 131, 127, 113, 109 } },
    .{ .prime = 181, .values = &.{ 179, 163, 157, 131, 127, 103, 97, 83 } },
    .{ .prime = 191, .values = &.{ 181, 179, 173, 167, 157, 151, 137, 131 } },
    .{ .prime = 193, .values = &.{ 167, 163, 149, 127, 113, 103, 79, 73 } },
    .{ .prime = 197, .values = &.{ 179, 167, 151, 149, 139, 131, 103, 89 } },
    .{ .prime = 199, .values = &.{ 197, 179, 173, 167, 163, 149, 127, 113 } },
    .{ .prime = 211, .values = &.{ 191, 181, 167, 149, 131, 127, 41, 29 } },
    .{ .prime = 223, .values = &.{ 173, 151, 149, 137, 113, 107, 97, 79 } },
    .{ .prime = 227, .values = &.{ 223, 211, 199, 197, 193, 191, 179, 163 } },
    .{ .prime = 229, .values = &.{ 223, 191, 179, 163, 157, 139, 137, 131 } },
    .{ .prime = 233, .values = &.{ 227, 223, 211, 199, 193, 191, 179, 163 } },
    .{ .prime = 239, .values = &.{ 227, 223, 191, 181, 179, 173, 167, 151 } },
    .{ .prime = 241, .values = &.{ 227, 199, 179, 173, 167, 163, 157, 149 } },
    .{ .prime = 251, .values = &.{ 239, 229, 223, 199, 193, 191, 167, 163 } },
    .{ .prime = 257, .values = &.{ 251, 233, 229, 191, 181, 179, 167, 163 } },
};

pub const shuffle_alphabet = "0123456789()./<=>ABCDEFGHIJKLMNOPQRSTUVWXYZ[]abcdefghijklmnopqrstuvwxyz";
pub const protector_template = "\x0afunction setProtector() {\x0a  {{fence}}[{{embrace}}] = $PROT;\x0a  {{fence}}[{{getProtector}}] = getProtector[$bind$]({{fence}});\x0a  {{mirror}} = {{fence}}[{{getProtectorLeft}}+{{getProtectorRight}}]();\x0a  {{mirror}}[{{sentriesLeft}}+{{sentriesRight}}] = [];\x0a}\x0afunction getProtector() {\x0a  return this[{{embraceLeft}}+{{embraceRight}}];\x0a}\x0afunction getNoOp() {\x0a  return function(){};\x0a}\x0a";
pub const sentinel_template = "\x0a// Sentinel method\x0a$PROT[{{sentinelLeft}}+{{sentinelRight}}] = function (count, sentry, handler) {\x0a  if (count === (#0#)) {\x0a    return {{fence}}[{{getProtector}}]()[{{sentries}}][sentry];\x0a  }\x0a  count = {{getGlobalObject}}()[$Math$][$min$](count, #17#);\x0a  $CONST next = #11# + {{getGlobalObject}}()[$Math$][$max$](count/(#2#) - (#6#), count) - #12#;\x0a  if (count + (#3#) < (#0#)) {\x0a    if (handler) {\x0a      handler();\x0a      return {{fence}}[{{getProtectorLeft}}+{{getProtectorRight}}]()[{{sentinel}}](count, sentry);\x0a    }\x0a  }\x0a  return {{mirror}}[{{sentinel}}](next, sentry, handler);\x0a};\x0a\x0a// Initialize date lock result\x0a$PROT[{{dateResult}}] = (#9#) - {{dateApplied}}();\x0a\x0a// Refresh results method\x0afunction refreshResults() {\x0a  {{fence}}[{{getProtector}}]()[{{validationLeft}}+{{validationRight}}] = [];\x0a  for ($LET i = #0#; i < #256#; i++) {\x0a    $CONST val =\x0a    {{getGlobalObject}}()[$Math$][$min$]($PROT[{{dateResultLeft}}+{{dateResultRight}}],\x0a      {{fence}}[{{getProtectorLeft}}+{{getProtectorRight}}]()[{{domainResultLeft}}+{{domainResultRight}}]) || (#3#);\x0a      {{fence}}[{{getProtector}}]()[{{validation}}][$push$](\x0a        {{getGlobalObject}}()[$Math$][$sign$](val) * {{getGlobalObject}}()[$Math$][$floor$]\x0a          ({{getGlobalObject}}()[$Math$][$random$]() * (#256#) + (#1#)\x0a    ) + (#12#));\x0a  }\x0a}\x0a\x0a// Counter declaration\x0a$LET counter = #7# + ({{getGlobalObject}}() ? #0# : #2#);\x0a\x0a// Check result function\x0a{{fence}}[{{getProtector}}]()[{{checkResultLeft}}+{{checkResultRight}}] = function () {\x0a  counter = (counter + 1) % (#100#);\x0a  return $PROT.{{validationFlat}}[counter] > (#12#);\x0a};\x0a\x0a// Initialize domain lock result\x0a{{fence}}[{{getProtectorLeft}}+{{getProtectorRight}}]()[{{domainResult}}] = (#11#) - {{domainApplied}}();\x0a\x0a// Initialize results\x0arefreshResults();\x0a";

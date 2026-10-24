//! Emitted JavaScript templates extracted inertly from JSDefender Core 2.12.0.

pub const domain_check = "\nfunction checkDomainLock() {\n  $CONST singleNodeCallControllerFunctionName = (function(){\n    $LET firstCall = #12# === (#4# + #8#);\n\n    return function (context, fn){\n      $LET rfn = firstCall ? function(){\n        if(fn){\n          $CONST res = fn[$apply$](context, arguments);\n          fn = null;\n          return res;\n        }\n      } : function(){};\n      firstCall = (#6#) >= (#8#);\n\n      return rfn;\n    }\n  })();\n\n  $CONST domainLockFunctionName = singleNodeCallControllerFunctionName(this, function () {\n    $CONST global = {{getGlobalObject}}();\n    $CONST len = $length$;\n    $CONST cCA = $charCodeAt$;\n\n    $LET document, domain, location, hostname;\n    for ($CONST d in global) {\n      if (d[len] === (#8#) && d[cCA](#7#) === (#116#) && d[cCA](#5#) === (#101#) && d[cCA](#3#) === (#117#) && d[cCA](#0#) === (#100#)) {\n        document = d;\n        break;\n      }\n    }\n\n    $CONST cCA1 = $charCodeAt$;\n\n    for ($CONST d1 in global[document]) {\n      if (d1[len] === (#6#) && d1[cCA1](#5#) === (#110#) && d1[cCA](#0#) === (#100#)) {\n        domain = d1;\n        break;\n      }\n    }\n\n    if (!(\"~\" > domain)) {\n      for ($CONST d2 in global[document]) {\n        if (d2[len] === (#8#) && d2[cCA](#7#) === (#110#) && d2[cCA1](#0#) === (#108#)) {\n          location = d2;\n          break;\n        }\n      }\n\n      if (global[document]) {\n        for ($CONST d3 in global[document][location]) {\n          if (d3[len] === (#8#) && d3[cCA1](#7#) === (#101#) && d3[cCA](#0#) === (#104#)) {\n            hostname = d3;\n            break;\n          }\n        }\n      }\n    }\n\n    if (document && global[document]) {\n      $CONST documentDomain = global[document][domain];\n      $CONST documentLocationHostName = !!global[document][location] && global[document][location][hostname];\n      $CONST currentDomain = documentDomain || documentLocationHostName;\n      {{fence}}[{{getProtector}}]()[{{domainResult}}] = #23#;\n\n      if (currentDomain) {\n        $CONST domainSpec = {{domainSpec}}\n\n        function hashString(str) {\n          $LET hash = #0#;\n          $CONST cCA = $charCodeAt$;\n          if (!str[len]) return hash;\n          for ($LET i = #0#; i < str[len]; i++) {\n            $CONST ch = str[cCA](i);\n            hash = (hash << (#5#)) - hash + ch;\n            hash = hash & hash;\n          }\n          return hash;\n        }\n\n        function ok(\n          currDmn,\n          spec,\n          mul1,\n          mul2\n        ) {\n          $CONST parts = currDmn[$split$]($.$).map(e => e[$toLowerCase$]());\n          $CONST negValue = global[$Math$][$sign$]((#6#)-(#7#))*(spec[len]+mul2);\n          for ($LET i = #0#; i < spec[len]; i++) {\n            $CONST currSpec = spec[i];\n            if (currSpec[len] < parts[len]) continue;\n            if (currSpec[#0#] === (#0#) && currSpec[len] !== parts[len] + (#1#)) continue;\n            $LET match = #4# < (#5#);\n            $CONST posValue = (currSpec[len] + (#1#)) * mul1;\n            for ($LET j = currSpec[len] - (#1#), k = parts[len] - (#1#); j > (#0#); j--, k--) {\n              if (currSpec[j] !== hashString(parts[k])) {\n                match = (#3#) === #5#;\n                break;\n              }\n            }\n            if (match) return posValue;\n          }\n          return negValue;\n        }\n\n        $CONST isOk = ok(currentDomain, domainSpec, #17#, #1#);\n        $PROT[{{sentinel}}](global[$parseInt$]({{fence}}[{{getProtector}}]()[{{domainResult}}] = isOk), #11#,\n        {{mirror}}[{{domainLockHandlerLeft}}+{{domainLockHandlerRight}}]);\n        refreshResults();\n      }\n    }\n  });\n\n  domainLockFunctionName();\n}\ncheckDomainLock()";
pub const domain_error = "\n{{fence}}[{{getProtector}}]()[{{domainLockHandler}}] = function() {\n  {{errorScript}}\n}\n";
pub const date_check = "\nfunction testDateLock() {\n  $CONST global = {{getGlobalObject}}();\n  $CONST result1 = global[decodeString({{Date}})][decodeString({{now}})]()\n    - global[$parseInt$](decodeString({{startDate}}), {{radixExpr}});\n  {{fence}}[{{getProtector}}]()[{{sentinel}}](($PROT[{{dateResultLeft}}+{{dateResultRight}}] = result1), #17#,\n    $PROT[{{dateLockHandlerLeft}}+{{dateLockHandlerRight}}]);\n  $CONST result2 = global[$parseInt$](decodeString({{endDate}}), {{radixExpr}})\n    - global[decodeString({{Date}})][decodeString({{now}})]();\n  $PROT[{{sentinel}}](global[$parseInt$]({{mirror}}[{{dateResult}}] = result2), #23#,\n    {{fence}}[{{getProtector}}]()[{{dateLockHandlerLeft}}+{{dateLockHandlerRight}}]);\n    refreshResults();\n}\n\nfunction decodeString(inp) {\n  $LET result = $hah$[$substr$](#5#);\n  $LET tail = #0#;\n  for ($LET i = #0#; i < inp[$length$]; i++) {\n    $CONST keyByte = ({{key}} >> ((#8#) * (i % (#3#)))) & (#255#);\n    inp[i] = (inp[i] + (#291#)) ^ (#540#) ^ keyByte;\n    if (i === (#0#)) {\n      tail = inp[i] - (#99#);\n    }\n    result += {{getString}}()[$fromCharCode$](inp[i]);\n  }\n  return result[$substr$](#1#, result[$length$] - (#1#) - tail);\n}\n$PROT[$wChkrUytWeR$] = testDateLock();\n";
pub const date_error = "\n{{fence}}[{{getProtector}}]()[{{dateLockHandler}}] = function() {\n  {{errorScript}}\n}\n";
pub const devtools = "\n(function () {\n  $CONST global = {{getGlobal}}();\n  $CONST dbCountName = \"dtWb$_$UsW\";\n  $CONST _fromCharCode = $fromCharCode$;\n  $CONST _charCodeAt = $charCodeAt$;\n  $CONST _debugFunc = new Function(decode({{debuggerEncoded}}));\n  if (!global[dbCountName]) {\n    global[dbCountName] = 0;\n  } else if (global[dbCountName] > {{patience}}) {\n    {{protector}}.{{valid}} = false;\n  }\n\n  debugCheck();\n\n  function debugCheck() {\n    $CONST startTime = Date.now();\n    _debugFunc();\n    $CONST stopTime = Date.now();\n    if ((stopTime - startTime) > 100) {\n      checkDebugCounter();\n    }\n  \n    setTimeout(debugCheck, {{checkInterval}});\n\n    function checkDebugCounter() {\n      global[dbCountName]++;\n      if (global[dbCountName] > {{patience}}) {\n        {{protector}}.{{valid}} = false;\n      }\n    }\n  }\n\n  function decode(input) {\n    $LET result = \"\";\n    for ($LET i = input.length - 1; i >= 0; i--) {\n      result += {{getString}}()[_fromCharCode](input[_charCodeAt](i) ^ {{key}});\n    }\n    return result;\n  }\n})()\n";
pub const console_start = "\nfunction hideConsoleMethods() {\n  $CONST global = {{getGlobalObject}}();\n";
pub const console_end = "\n}\n\nhideConsoleMethods();\n";
pub const console_targets = [_][]const u8{
    "$webkitEventStorage$",
    "$web$+$kitEventStorage$",
    "$we$+$bkitEvent$+$Storage$",
    "$webki$+$tEvent$+$Storage$",
    "$webkitEv$+$entSt$+$orage$",
};

pub const console_replacements = [_][]const u8{
    "$AbortSignalRenderer$",
    "$Abort$+$SignalRenderer$",
    "$Ab$+$ortSignalR$+$enderer$",
    "$AbortSig$+$nalR$+$enderer$",
};

pub const console_methods = [_][]const u8{
    "assert",
    "clear",
    "count",
    "countReset",
    "debug",
    "dir",
    "dirxml",
    "error",
    "group",
    "groupCollapsed",
    "groupEnd",
    "info",
    "log",
    "profile",
    "profileEnd",
    "table",
    "time",
    "timeEnd",
    "timeLog",
    "timeStamp",
    "trace",
    "warn",
};

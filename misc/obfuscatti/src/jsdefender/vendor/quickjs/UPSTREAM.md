# Standalone regexp dependency

Source: https://github.com/bellard/quickjs/tree/84e723f1ace5e3823cef8149dd0f890fe74b77ce

Only `libregexp`, its Unicode tables and C utilities are compiled. The QuickJS
JavaScript execution engine is not included. Original MIT notices and LICENSE
are retained in this directory. Used for native ECMAScript regular-expression
matching with UTF-16 inputs and no flags, as required by `excludeIds: "r:..."`.

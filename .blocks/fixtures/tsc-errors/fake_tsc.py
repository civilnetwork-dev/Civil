"""Stand-in for `bunx tsc --noEmit` with three errors in two files."""
import sys

print("src/components/Tab.tsx(12,5): error TS2322: Type 'string' is not assignable to type 'number'.")
print("src/components/Tab.tsx(40,9): error TS2339: Property 'tabIndex' does not exist on type 'Props'.")
print("misc/http.ts:7:3 - error TS7006: Parameter 'c' implicitly has an 'any' type.")
print("")
print("Found 3 errors in 2 files.")
sys.exit(2)

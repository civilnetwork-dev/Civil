"""Stand-in for `bun run format:check` finding one unformatted file."""
import sys

print("Checking formatting...")
print("")
print("src/components/Tab.tsx (3ms)")
print("")
print("Format issues found in above 1 files. Run without `--check` to fix.")
sys.exit(1)

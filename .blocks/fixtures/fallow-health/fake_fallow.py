"""Stand-in for `bunx fallow health ...`: prints a trimmed real report."""
import json

print(json.dumps({
    "kind": "health",
    "findings": [
        {"path": "src/a.ts", "name": "short", "line": 3, "line_count": 12},
        {"path": "src/b.tsx", "name": "Panel", "line": 40, "line_count": 61},
        {"path": "tests/c.test.ts", "name": "<arrow>", "line": 9, "line_count": 88},
    ],
    "health_score": {
        "formula_version": 3,
        "score": 99.8,
        "grade": "A",
        "penalties": {"unit_size": 0.2, "coupling": 0.0},
    },
}))

"""Stand-in for zig: `version`, or a failing `build test --summary all` like a real toolchain mismatch."""
import sys

if sys.argv[1:2] == ["version"]:
    print("0.17.0")
    sys.exit(0)
print("zig-pkg\\yuku-0.24.1\\src\\util\\simd.zig:40:48: error: no field or member function named 'isAarch64' in 'Target.Cpu.Arch'")
print("error: 1 compilation errors")
print("Build Summary: 2/5 steps succeeded (1 failed); 0/0 tests passed")
sys.exit(1)

"""Prints a pytest-like run with one failure and exits 1. Fixture data for test-summary, not a test."""
import sys

OUTPUT = """\
============================= test session starts ==============================
platform linux -- Python 3.12.3, pytest-8.3.2, pluggy-1.5.0
rootdir: /work/app
collected 5 items

tests/test_math.py ..F.s                                                 [100%]

=================================== FAILURES ===================================
_________________________________ test_divide __________________________________

    def test_divide():
>       assert divide(6, 3) == 3
E       assert 2.0 == 3
E        +  where 2.0 = divide(6, 3)

tests/test_math.py:14: AssertionError
=========================== short test summary info ============================
FAILED tests/test_math.py::test_divide - assert 2.0 == 3
=================== 1 failed, 3 passed, 1 skipped in 0.04s ====================
"""

sys.stdout.write(OUTPUT)
sys.exit(1)

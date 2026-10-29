# A long-lived test worker (Ronin job tests-5, 29 Oct 2026; see WORKERS in testlib.py). run_tests.py starts one per CPU and hands it
# test after test: one JSON line on stdin, {"test": "<path of the test file>", "args": [], "log": "logs_tests/road_test.log"}.
# The worker runs the test in this process (runpy, as `python3 <test> <args>` would, from the game's folder), its output going to the log,
# then cleans up (the warm tab reset, everything else the test opened closed, the game's and the framework's modules it imported
# unloaded) and answers one JSON line, {"rc": <exit code>}, on its own channel (the stdout it started with). The Python, the Playwright
# driver and the Chromium stay up.
import json, os, runpy, sys, traceback
TESTKIT = os.path.dirname(os.path.abspath(__file__)); FW = os.path.dirname(TESTKIT)
sys.path.insert(0, TESTKIT)
reply = os.fdopen(os.dup(1), 'w', buffering=1)   # the answers to run_tests.py; fd 1 and 2 go to each test's log while it runs
import testlib
ROOT = testlib.ROOT; os.chdir(ROOT)
from playwright.sync_api import sync_playwright
pw = sync_playwright().start()
w = testlib.worker_start(pw, pw.chromium.launch(args=testlib.WORKER_ARGS))
keep = set(sys.modules)   # modules loaded before any test (the standard library, Playwright, testlib, gamepaths) stay loaded
reply.write(json.dumps({'ready': True}) + '\n')
for line in sys.stdin:
    job = json.loads(line)
    path = job['test']
    log = os.open(job['log'], os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
    sys.stdout.flush(); sys.stderr.flush()
    out, err = os.dup(1), os.dup(2); os.dup2(log, 1); os.dup2(log, 2); os.close(log)
    sys.argv = [path] + job.get('args', [])
    added = os.path.dirname(path) not in sys.path
    if added: sys.path.insert(0, os.path.dirname(path))   # as `python3 <test>` would: the test's own folder first
    rc = 0
    try:
        runpy.run_path(path, run_name='__main__')
    except SystemExit as e:
        code = e.code
        if code is None: rc = 0
        elif isinstance(code, int): rc = int(code)   # SystemExit(True) is 1, as in a process of its own
        else: print(code, file=sys.stderr); rc = 1
    except BaseException:
        traceback.print_exc(); rc = 1
    finally:
        try: w.end_test()
        except Exception: traceback.print_exc()
        if added and sys.path and sys.path[0] == os.path.dirname(path): sys.path.pop(0)
        for name in [m for m in sys.modules if m not in keep]:   # a test's own imports (cine_shots, review_page, ...) start fresh next time
            f = getattr(sys.modules[name], '__file__', None) or ''
            if f.startswith(ROOT) or f.startswith(FW): del sys.modules[name]
        sys.stdout.flush(); sys.stderr.flush()
        os.dup2(out, 1); os.dup2(err, 2); os.close(out); os.close(err)
    reply.write(json.dumps({'rc': rc}) + '\n')

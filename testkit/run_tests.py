# The test runner (Eraforge test kit; Ronin jobs 11, tests-2, ci-parallel, tests-3, tests-5, tests-6, fw-F5a).
#   npx eraforge test [group|test ...] [-j N] [--isolated] [--shots] [--list] [--shard I/N]      (or the game's own `python3 run_tests.py ...`)
# The tests run the game on a TEST CLOCK (testlib.py + the TEST_CLOCK hook in core/08_main.js): the test steps frames itself instead of
# waiting for the game's 60 fps clock, so they are pure CPU work and running as many at once as there are CPUs is safe. Every test serves
# its pages on a free port of its own, so none can clash. Logs go to logs_tests/<test>.log in the game's folder; the summary prints one line
# per test with its result and time.
# THE GAME'S CATALOGUE, tests.json (eraforge.json `tests`, default tests.json beside game.json):
#   { "groups": { name: [test, ...] }, "default": group run with no argument, "weights": { test: seconds }, "realclock": [test, ...] }
# A test is `name.py` or `name.py arg ...`; the file is looked up in the game's tests/ folder, then in the framework's testkit/tests/
# (the framework's own checks, which a game may list too). `realclock` tests run on the real clock: one at a time, beside the workers.
# `--shard I/N` runs only shard I (1-based) of N of the selected tests (longest first onto the lightest shard, using the weights; a test
# that is not in the table counts as DEFAULT_WEIGHT); `--list` prints the selected tests (after sharding) and exits.
import subprocess, sys, time, os, re, glob, json
TESTKIT = os.path.dirname(os.path.abspath(__file__)); FW = os.path.dirname(TESTKIT)
sys.path.insert(0, os.path.join(FW, 'tools')); import gamepaths
ROOT = gamepaths.GAME_ROOT; os.chdir(ROOT)
os.environ['ERAFORGE_GAME'] = ROOT; os.environ['ERAFORGE_ROOT'] = FW
# a test file runs as `python3 <file>` from the game's folder; testlib (testkit/) and the framework's tools/ are importable from it
os.environ['PYTHONPATH'] = os.pathsep.join([TESTKIT, os.path.join(FW, 'tools')] + ([os.environ['PYTHONPATH']] if os.environ.get('PYTHONPATH') else []))
def test_path(name):
    for d in (os.path.join(ROOT, 'tests'), os.path.join(TESTKIT, 'tests')):
        if os.path.isfile(os.path.join(d, name)): return os.path.join(d, name)
    return name if os.path.isfile(name) else os.path.join(ROOT, 'tests', name)
def test_cmd(t):
    name, *rest = t.split()
    return [sys.executable, test_path(name)] + rest
args = sys.argv[1:]; J = os.cpu_count() or 2   # one test per CPU (on the test clock a busy machine only makes a test slower, never wrong; the real-time smoke test has slack)
if '-j' in args: i = args.index('-j'); J = int(args[i + 1]); del args[i:i + 2]
SHARD = None
if '--shard' in args: i = args.index('--shard'); SHARD = tuple(int(x) for x in args[i + 1].split('/')); del args[i:i + 2]
LIST_ONLY = '--list' in args
if LIST_ONLY: args.remove('--list')
GAME = gamepaths.pop_game(args)
CATALOGUE = json.load(open(gamepaths.tests_json(GAME), encoding='utf-8'))
GROUPS = {k: list(v) for k, v in CATALOGUE['groups'].items()}; DEFAULT_GROUP = CATALOGUE.get('default', 'quick')
SHOTS = '--shots' in args   # job tests-6: take the review screenshots (off by default: ERAFORGE_SHOTS=0, see testlib.SHOTS)
if SHOTS: args.remove('--shots')
if not SHOTS: os.environ['ERAFORGE_SHOTS'] = '0'
ISOLATED = '--isolated' in args   # job tests-5: every test as its own process (the old way), instead of the warm workers
if ISOLATED: args.remove('--isolated')
todo = []
for a in args or [DEFAULT_GROUP]: todo += GROUPS.get(a, [a])
todo = list(dict.fromkeys(todo))
WEIGHTS = dict(CATALOGUE.get('weights', {}))
DEFAULT_WEIGHT = 40
# SOLO (shard mode only): tests on the real clock run alone, before anything else on their runner. A busy CPU makes them miss key-press
# timings (realtime_smoke_test failed 'C opens the menu' on CI run 40416466495 when it shared a runner with the heaviest tests).
SOLO = {'realtime_smoke_test.py'} if SHARD else set()
# Job tests-5: the real-clock tests no longer run alone: they run side by side with the workers, one real-clock test at a time. On a
# shard they still go to the lightest shard.
REALCLOCK = set(CATALOGUE.get('realclock', []))
SOLO = REALCLOCK
if SHARD:
    k, n = SHARD; assert 1 <= k <= n, '--shard I/N needs 1 <= I <= N'
    load, mine = [0] * n, []
    for t in sorted((t for t in todo if t not in SOLO), key=lambda t: (-WEIGHTS.get(t, DEFAULT_WEIGHT), t)):
        j = load.index(min(load)); load[j] += WEIGHTS.get(t, DEFAULT_WEIGHT)
        if j == k - 1: mine.append(t)   # longest first: the slow tests start early and the short ones fill the gaps
    for t in (t for t in todo if t in SOLO):   # real-clock tests go last onto the lightest shard, and run first and alone (see SOLO)
        j = load.index(min(load)); load[j] += WEIGHTS.get(t, DEFAULT_WEIGHT)
        if j == k - 1: mine.insert(0, t)
    todo = mine
    print(f"shard {k}/{n}: {len(todo)} tests, about {load[k - 1]} weight units (all shards: {load})", flush=True)
# Job tests-3 (29 Oct 2026; Ash: 'minutes is too long for each iteration'): outside CI shards the slowest tests start first, so no long
# test starts last and runs alone at the end. 'Slowest' is the time each test took on this machine's last run (logs_tests/times.json,
# written below), or its WEIGHTS entry when it has not run here yet.
TIMES_FILE = os.path.join('logs_tests', 'times.json')
try: LAST = json.load(open(TIMES_FILE))
except (OSError, ValueError): LAST = {}
if not SHARD: todo.sort(key=lambda t: -LAST.get(t, WEIGHTS.get(t, DEFAULT_WEIGHT)))
if LIST_ONLY: print('\n'.join(todo)); sys.exit(0)
# RUNNING (job tests-5, 29 Oct 2026; Ash: 'not acceptable. improve it somehow. first principles thinking'). Test-clock tests run in J long-lived
# workers (tests/worker.py: one Python, one Playwright driver, one Chromium each, and a warm game tab, see WORKERS in testlib.py), so a test
# no longer pays about 3.5 s to start a process, a driver and a browser and to boot the game cold. Workers run at nice 15: the test clock
# only advances when the test steps it, so a slow CPU never changes a result, while a real-clock test (its own process, normal priority,
# one at a time, beside the workers) is never starved. --isolated: each test-clock test as its own process (still niced), as before.
import selectors
NICE = 0   # see below: no lower priority (Chromium, run as root, raises its own threads anyway, and a niced driver then starves)
os.makedirs('logs_tests', exist_ok=True)
def log_path(t): return f"logs_tests/{os.path.basename(t.split()[0])[:-3]}.log"
done, t0 = [], time.time()
def finish(t, rc, started):
    out = open(log_path(t), errors='replace').read(); fails = [l for l in out.splitlines() if l.startswith('FAIL') or 'RESULT: FAIL' in l or 'Traceback' in l]
    ok = rc == 0 and not fails
    done.append((t, ok, time.time() - started, fails[:3]))
    print(f"{'OK  ' if ok else 'FAIL'} {t:<40} {time.time() - started:6.0f} s" + ('' if ok else '   ' + ' | '.join(f[:120] for f in fails[:3])), flush=True)
real = [t for t in todo if t in REALCLOCK]; queue = [t for t in todo if t not in REALCLOCK]
niced = (lambda: os.nice(NICE)) if NICE else None
sel = selectors.DefaultSelector()
class Worker:
    def __init__(self):
        self.p = subprocess.Popen([sys.executable, os.path.join(TESTKIT, 'worker.py')], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1, preexec_fn=niced)
        self.ready = False; self.job = None
        sel.register(self.p.stdout, selectors.EVENT_READ, self)
    def give(self, t):
        name, *rest = t.split(); self.job = (t, time.time())
        self.p.stdin.write(json.dumps({'test': test_path(name), 'args': rest, 'log': log_path(t)}) + '\n'); self.p.stdin.flush()
    def stop(self):
        sel.unregister(self.p.stdout)
        try: self.p.stdin.close(); self.p.wait(timeout=20)
        except Exception: self.p.kill()
workers = [] if ISOLATED else [Worker() for _ in range(min(J, len(queue)))]
procs = []   # (test, process, started, log file): real-clock tests, and every test-clock test with --isolated
rt_running = None
while queue or real or rt_running or procs or any(w.job for w in workers):
    if real and rt_running is None:   # one real-clock test at a time, at normal priority, beside the workers
        t = real.pop(0); f = open(log_path(t), 'w'); rt_running = (t, subprocess.Popen(test_cmd(t), stdout=f, stderr=subprocess.STDOUT), time.time(), f)
    if ISOLATED:
        while queue and len(procs) < J:
            t = queue.pop(0); f = open(log_path(t), 'w'); procs.append((t, subprocess.Popen(test_cmd(t), stdout=f, stderr=subprocess.STDOUT, preexec_fn=niced), time.time(), f))
    for w in workers:
        if w.ready and w.job is None and queue: w.give(queue.pop(0))
    for key, _ in sel.select(timeout=0.1):
        w = key.data; line = w.p.stdout.readline()
        if not line:   # the worker died (a crashed browser, a killed process): its test fails, a new worker takes its place
            if w.job: f = open(log_path(w.job[0]), 'a'); f.write('\nTraceback: the test worker died\n'); f.close(); finish(w.job[0], 1, w.job[1])
            sel.unregister(w.p.stdout); workers.remove(w)
            if queue: workers.append(Worker())
            continue
        msg = json.loads(line)
        if msg.get('ready'): w.ready = True
        elif w.job: t, started = w.job; w.job = None; finish(t, msg['rc'], started)
    if rt_running and rt_running[1].poll() is not None:
        t, pr, started, f = rt_running; f.close(); rt_running = None; finish(t, pr.returncode, started)
    for r in procs[:]:
        if r[1].poll() is not None: r[3].close(); procs.remove(r); finish(r[0], r[1].returncode, r[2])
for w in workers: w.stop()
for d in done:
    if d[1]: LAST[d[0]] = round(d[2], 1)   # only passing runs: a test that fails early is not a fast test
json.dump(LAST, open(TIMES_FILE, 'w'), indent=0, sort_keys=True)
bad = [d for d in done if not d[1]]
print(f"\n{len(done) - len(bad)}/{len(done)} passed in {time.time() - t0:.0f} s" + (f"; failed: {', '.join(d[0] for d in bad)} (logs in logs_tests/)" if bad else ''))
sys.exit(1 if bad else 0)

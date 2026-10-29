# Shared helper for the Playwright tests (Eraforge test kit; Ronin job tests-2, 21 Oct 2026: 'can we make these tests faster, like MUCH faster').
#
# WHY: the tests used to drive the real game in real time: every beat waited on the game's own 60 fps clock, via fixed
# `wait_for_timeout` pauses and polling loops. Now a test page sets window.TEST_CLOCK before it loads (see core/08_main.js): the real-time
# loop stops, and this helper advances the game itself, `testStep(n)` = n x (update(); inputEndFrame()) with no rendering. A test that
# used to wait 100 ms now simulates 6 frames in about a millisecond; the game logic is the same code, only the clock is ours.
#
# USE (the three lines a test needs):
#     import testlib
#     PORT = testlib.serve('pub_ch1')                       # in-process server on a free port (no subprocess, no port clashes)
#     pg = testlib.page(browser, viewport={'width': 1300, 'height': 760})   # a page on the test clock
#     pg.goto(f'http://localhost:{PORT}/test.html')         # returns when every image is loaded and the title is up
# After that the test is written as before: `pg.wait_for_timeout(ms)` now STEPS ms * 0.06 frames (min 1), `pg.wait_for_function(expr)` steps one
# frame at a time until expr is true (timeout counted in simulated ms), `pg.keyboard.down/up` still send real key events (they land on the
# next step), and `pg.locator('#screen').screenshot(...)` renders the current frame first. `pg.draw` picks the rendering while stepping:
# 0 = none (default), 1 = the last frame of each step, 2 = every frame (for a test that reads what render() records).
# Real-time tests (audio, the Suno song player, the dance clock) do NOT use this: they keep running on the real clock.
import functools, http.server, os, sys, threading, types
from pathlib import Path
from playwright.sync_api import TimeoutError as PWTimeout

# Eraforge (job fw-F5): this file lives in the framework's testkit/; ROOT is the GAME's folder (its pages are served from there; see
# tools/gamepaths.py for how the game is found), FW the framework's. The framework's tools/ and the game's tools/ are put on the import
# path, so a test can import a tool module (cinema_test: cine_shots; animation_review_test: make_animation_category_review).
# The game's eraforge.json may set `testlib`: { "envAliases": { its own variable: the framework's }, "legacyFileRoots": [file:// URL prefixes] }.
FW = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if os.path.join(FW, 'tools') not in sys.path: sys.path.append(os.path.join(FW, 'tools'))
import gamepaths
ROOT = gamepaths.GAME_ROOT
if os.path.join(ROOT, 'tools') not in sys.path: sys.path.append(os.path.join(ROOT, 'tools'))
SETTINGS = gamepaths.SETTINGS.get('testlib', {})
for _old, _new in SETTINGS.get('envAliases', {}).items():
    if os.environ.get(_old) is not None: os.environ.setdefault(_new, os.environ[_old])
# file:// URLs a game's older tests hard-coded (a sandbox path of their day): pg.goto serves the game's folder instead
LEGACY_FILE_ROOTS = list(SETTINGS.get('legacyFileRoots', []))

# A machine whose Playwright has no Chromium of its own (CI runners, Windows checkouts) names its Chrome here.
if os.environ.get('ERAFORGE_CHROMIUM_EXECUTABLE'):
    from playwright.sync_api import BrowserType
    _launch = BrowserType.launch
    def _runner_browser(self, *args, **kwargs):
        if self.name == 'chromium' and not kwargs.get('executable_path') and not kwargs.get('channel'):
            kwargs['executable_path'] = os.environ['ERAFORGE_CHROMIUM_EXECUTABLE']
        return _launch(self, *args, **kwargs)
    BrowserType.launch = _runner_browser

FRAME_MS = 1000 / 60
_servers = []


class _Handler(http.server.SimpleHTTPRequestHandler):
    # Reuse asset connections: HTTP/1.0 exhausts Windows ports across repeated 400-image boots.
    protocol_version = 'HTTP/1.1'
    def handle(self):
        try: super().handle()
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass   # a browser may close a reused connection while the server waits for its next request
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map, **{'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8'})   # the pages have no <meta charset> (the host wraps them)
    def log_message(self, *a): pass
    def do_GET(self):
        # Full Chrome requests this independently even for fragment test pages with a data icon.
        if self.path == '/favicon.ico':
            self.send_response(204); self.end_headers(); return
        super().do_GET()
    def send_error(self, code, message=None, explain=None):
        print(f'HTTP {code}: {self.path}', flush=True)
        super().send_error(code, message, explain)
    def copyfile(self, source, outputfile):
        # Browsers cancel asset downloads when a test navigates or closes a page; that is not a game failure.
        try: super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError): pass
    cache_assets = False   # serve(..., cache=True), the default: the shared image and audio files may be cached (pages stay no-store)
    def end_headers(self):
        cacheable = self.cache_assets and self.path.startswith(('/img/', '/audio/', '/assets/'))   # /assets/: the root test pages' images (job tests-4)
        self.send_header('Cache-Control', 'public, max-age=600' if cacheable else 'no-store'); super().end_headers()


# SHOTS (job tests-6, 29 Oct 2026; Ash: 'fewer screenshots in routine runs'). Most screenshots are for review, not for checks, and each costs
# 150-250 ms of capture and PNG encoding. run_tests.py runs with ERAFORGE_SHOTS=0 (its --shots flag, or running a test file by itself, takes
# them); a screenshot that a check reads back is taken with check=True (`pg.locator('#screen').screenshot(path=..., check=True)`).
SHOTS = os.environ.get('ERAFORGE_SHOTS', '1') != '0'
_by_dir = {}


def serve(directory, cache=True):
    """Serve `directory` (relative to the repo root) on a free port in a background thread of this process; returns the port.
    cache=True (the default since job tests-4) lets the browser keep the shared /img/ and /audio/ files between page loads (a test that loads
    the game twice no longer fetches its ~120 MB of images twice); the pages themselves are always no-store, so a test still sees the build it
    was given. One server per directory: a second serve() of the same directory returns the same port, so the cache also holds across them."""
    d = directory if os.path.isabs(directory) else os.path.join(ROOT, directory)
    if _W and cache: return _W.serve(d)   # job tests-5: in a worker, one origin for every folder (see WORKERS)
    key = (os.path.realpath(d), bool(cache))
    if key in _by_dir: return _by_dir[key]
    handler = type('_CachingHandler', (_Handler,), {'cache_assets': True}) if cache else _Handler
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(handler, directory=d))
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    _servers.append(srv)
    _by_dir[key] = srv.server_address[1]
    return srv.server_address[1]


def frames(ms):
    return max(1, int(round(ms / FRAME_MS)))


# IN-PAGE HELPERS (job tests-4, 29 Oct 2026; Ash: 'minutes is too long for each iteration'). Every pg.evaluate / pg.step / key event is a
# round trip Python -> Playwright -> Chromium -> back, about 1.5 ms of CPU, and a test's polling loop made thousands of them. `pg.js(source,
# arg)` runs a whole loop in the page in ONE round trip, using these helpers (all async, so `await` them):
#   __T.step(n)            testStep(n) at pg.draw          __T.wait(ms)        step frames(ms), exactly as pg.wait_for_timeout(ms)
#   __T.tap(code, h, a)    as testlib.tap                  __T.down/up(code)   as pg.keyboard.down/up      __T.press(code)   as keyboard.press
#   __T.until(fn, arg, n, hasArg)   check fn, step 1 frame, ... at most n frames; true once fn passed (as pg.wait_for_function, which uses it)
#   __T.untilJs(js, n)     the same with a JS expression string (Python: pg.until(js, n))   __T.frames(ms)   as testlib.frames
# Keys are KeyboardEvents sent to the focused element, as Playwright's are (every game listener is on window and reads e.code / e.repeat).
# After every step and key event the helpers yield one macrotask (__T.pause), the same chance to run promise callbacks and timers the page
# had between two Python calls, so a loop moved into the page steps exactly the frames and keys it stepped before, with the same results.
IN_PAGE = r'''window.__T = (() => {
  const FRAME_MS = 1000 / 60;
  const pyRound = x => { const f = Math.floor(x), d = x - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 === 0 ? f : f + 1); };   // Python's round()
  const frames = ms => Math.max(1, pyRound(ms / FRAME_MS));
  const ch = new MessageChannel(), waiting = [];
  ch.port1.onmessage = () => waiting.shift()();
  const pause = () => new Promise(r => { waiting.push(r); ch.port2.postMessage(0); });
  const held = new Set();
  const keyName = c => /^Key[A-Z]$/.test(c) ? c.slice(3).toLowerCase() : /^Digit[0-9]$/.test(c) ? c.slice(5) : c === 'Space' ? ' ' : c;
  const send = (type, code) => {
    const repeat = type === 'keydown' && held.has(code);
    if (type === 'keydown') held.add(code); else held.delete(code);
    (document.activeElement || document.body || window).dispatchEvent(new KeyboardEvent(type, { code, key: keyName(code), repeat, bubbles: true, cancelable: true, composed: true }));
  };
  const pyTruthy = v => {   // what `if pg.evaluate(...)` saw in Python: [], {}, '', 0, null are false; NaN is true
    if (v === null || v === undefined || v === false || v === '') return false;
    if (typeof v === 'number') return v !== 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object' && !(v instanceof Date)) return Object.keys(v).length > 0;
    return true;
  };
  const T = {
    draw: 0, frames, pause, pyTruthy,
    async down(code) { send('keydown', code); await pause(); },
    async up(code) { send('keyup', code); await pause(); },
    async press(code) { send('keydown', code); send('keyup', code); await pause(); },
    async step(n, d) { const f = testStep(n, d === undefined ? T.draw : d); await pause(); return f; },
    wait(ms, d) { return T.step(frames(ms), d); },
    async tap(code, hold = 4, after = 3, d) { await T.down(code); await T.step(hold, d); await T.up(code); return T.step(after, d); },
    async until(fn, arg, n, hasArg, d) {
      for (let i = 0; i < n; i++) {
        if (pyTruthy(hasArg ? fn(arg) : fn())) return true;
        await T.step(1, d);
        // every 60 test frames a real animation frame too: page tools (test-tools.js) set their flags from requestAnimationFrame, which the
        // old Python loop let run between round trips; the game's own loop does not run on a test-clock page, so its state is untouched
        if (i % 60 === 59) await new Promise(r => requestAnimationFrame(r));
      }
      return false;
    },
    untilJs(js, n) { return T.until(new Function('return (' + js + ')'), undefined, n, false); },   // pg.until: a test's own until(js, n) loop
    untilSrc(src, arg, n, hasArg) {   // pg.wait_for_function: src is a function's source, or an expression Playwright would re-evaluate each time
      const ev = () => (0, eval)('(' + src + ')'), first = ev();
      return typeof first === 'function' ? T.until(first, arg, n, hasArg) : T.until(ev, undefined, n, false);
    },
  };
  return T;
})();'''


def tab_url(pg, url):
    """The URL pg.goto() really opens. Job tests-5: the worker's warm tab opens every localhost page on 127.0.0.1 (one host, one site,
    see WORKERS). localStorage belongs to the origin, so a test that opens a page another way (Playwright's own Page.goto) and expects
    the game to see what it stored there must open tab_url(pg, url) (job tests-7, 29 Oct 2026)."""
    if _W and pg is _W.tab and url.startswith('http://localhost:'):
        return 'http://127.0.0.1:' + url[len('http://localhost:'):]
    return url


def page(browser, viewport=None, clock=True, draw=0, seed=20261021, **kw):
    """A Playwright page whose game runs on the test clock (clock=False gives a normal real-time page)."""
    vp = viewport or {'width': 1300, 'height': 760}
    pg = (_W.acquire(browser, vp, clock, kw) if _W else None) or browser.new_page(viewport=vp, **kw)   # job tests-5: a worker's warm tab
    if not clock:
        pg.add_init_script(HALF_RATE)
        return pg
    # TEST_CLOCK: the game does not run by itself. Math.random is a seeded generator (mulberry32), so a run is repeatable: the same
    # inputs give the same fights and the same flakes-or-not every time (a test may still replace Math.random itself).
    pg.add_init_script('window.TEST_CLOCK = true; (() => { let a = %d >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();' % seed)
    # Job tests-4: the ambience starts at a random point once its file has decoded, from a real-time timer (ambTick). Drawn from the seeded
    # Math.random, that shifted the game's random sequence by a machine-speed-dependent amount; audio gets its own seeded stream instead.
    pg.add_init_script('(() => { let a = %d >>> 0; window.AUDIO_RANDOM = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();' % (seed + 1))
    pg.add_init_script(IN_PAGE)
    pg.draw = draw
    o_goto, o_reload, o_wff, o_locator = _orig(pg, 'goto'), _orig(pg, 'reload'), _orig(pg, 'wait_for_function'), _orig(pg, 'locator')   # the class's own, never an earlier test's wrapper

    def ready():
        o_wff('window.TEST_READY === true', timeout=120000, polling=20)
        bad = pg.evaluate('window.ASSET_FAIL || []')
        return bad

    def load(fn, *a, **k):
        for legacy in LEGACY_FILE_ROOTS:
            if a and isinstance(a[0], str) and a[0].startswith(legacy):
                # Legacy scene checks use an old sandbox path. Serve this checkout on any host.
                a = (f'http://localhost:{serve(ROOT)}/' + a[0][len(legacy):],) + a[1:]
        if a and isinstance(a[0], str): a = (tab_url(pg, a[0]),) + a[1:]
        for attempt in range(3):   # an image that fails to load (a dropped connection under load) is retried, never ignored
            r = fn(*a, **k); bad = ready()
            if not bad: return r
            print('testlib: images failed to load, retrying:', bad[:5])
            fn = o_reload; a = (); k = {}
        raise RuntimeError('images failed to load: ' + ', '.join(bad[:10]))

    def step(n=1, draw=None):
        return pg.evaluate('([n, d]) => testStep(n, d)', [int(n), pg.draw if draw is None else draw])

    def wait_for_timeout(ms):
        step(frames(ms))

    def js(source, arg=None):
        """Run a JavaScript function (source text, may be async) in the page in ONE round trip, with the in-page helpers `__T`
        (see IN_PAGE) stepping at this page's `pg.draw`. Use it for a test's own loops: `await __T.tap('KeyZ', 4, 8)`, `await __T.step(30)`."""
        return pg.evaluate('([__d, __a]) => { __T.draw = __d; return (' + source + ')(__a); }', [pg.draw, arg])

    def wait_for_function(expression, arg=None, timeout=30000, polling=None):
        # Job tests-4: the whole wait runs in the page (one round trip): check, step one frame, check... exactly as the old Python loop did.
        if not pg.evaluate('window.TEST_READY === true'):
            return o_wff(expression, arg=arg, timeout=timeout, polling=polling)
        head = expression.lstrip()[:60]
        src = expression if ('=>' in head or head.startswith('function')) else '() => !!(' + expression + ')'
        if js('([src, arg, n, hasArg]) => __T.untilSrc(src, arg, n, hasArg)', [src, arg, max(1, int(timeout / FRAME_MS)), arg is not None]):
            return True
        raise PWTimeout(f'wait_for_function timed out after {timeout} simulated ms: {expression[:120]}')

    class _Loc:
        def __init__(self, loc, screen): self._l, self._screen = loc, screen
        def screenshot(self, *a, check=False, **k):
            if self._screen: pg.evaluate('testRender()')   # the frame is drawn either way: a check that reads the canvas sees the same picture
            if not (SHOTS or check): return b''   # job tests-6: review screenshots are skipped in routine runs (see SHOTS)
            return self._l.screenshot(*a, **k)
        def __getattr__(self, name): return getattr(self._l, name)

    def locator(sel, *a, **k):
        return _Loc(o_locator(sel, *a, **k), sel == '#screen')

    o_shot = _orig(pg, 'screenshot')
    def screenshot(*a, check=False, **k):
        return o_shot(*a, **k) if (SHOTS or check) else b''
    pg.screenshot = screenshot

    pg.goto = lambda *a, **k: load(o_goto, *a, **k)
    pg.reload = lambda *a, **k: load(o_reload, *a, **k)
    pg.wait_for_timeout = wait_for_timeout
    pg.wait_for_function = wait_for_function
    pg.locator = locator
    pg.step = step
    pg.js = js
    # pg.until(js, n): the loop many tests wrote as `for _ in range(n): if ev(js): return True; pg.step(1)` / `return False`, in one round trip
    pg.until = lambda expr, n: js('([j, n]) => __T.untilJs(j, n)', [expr, n])
    pg.render = lambda: pg.evaluate('testRender()')
    return pg


def _orig(pg, name):
    return types.MethodType(getattr(type(pg), name), pg)


# WORKERS (job tests-5, 29 Oct 2026; Ash: 'not acceptable. improve it somehow. first principles thinking'). Started as its own process, a test
# paid for a Python, a Playwright driver and a Chromium (about 1.2 s) and for booting the game cold (about 2.5 s, most of it streaming the
# ~120 MB of images into the new page). testkit/worker.py keeps one Python, one driver and one Chromium alive and runs test after test in it;
# each test's testlib.page() gets the worker's WARM TAB: the same tab navigates to the test's page, so the game boots in a fresh document
# (fresh JS state, the test's own init scripts) while the renderer's memory cache hands it every image at once (about 0.3 s a boot).
# Between tests the tab is reset: the test's init scripts (added through CDP so they can be removed), event listeners and testlib wrappers
# are removed, it goes to about:blank, and the storage of every origin it visited is cleared. Anything else a test opens (extra pages,
# contexts, browsers launched with special arguments) is closed when the test ends. `python3 run_tests.py --isolated` runs every test as
# its own process, as before.
# HALF_RATE (job tests-5; Ash: '30fps is more than ok'): a real-clock test page draws at 30 fps. Only every other animation frame reaches
# the game; its fixed-step loop still runs the logic 60 times a second (two updates a draw, the catch-up path realtime_smoke covers). Drawing
# in software at 60 fps kept about 1.4 CPUs busy for each real-clock test, beside everything else.
HALF_RATE = "(() => { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => { let skip = true; const tick = ts => { if (skip) { skip = false; raf(tick); } else cb(ts); }; return raf(tick); }; })();"
_W = None
WORKER_ARGS = ['--autoplay-policy=no-user-gesture-required']   # the workers' Chromium; a test launching with these (wakeup) shares it
_TAB_ATTRS = ('goto', 'reload', 'wait_for_timeout', 'wait_for_function', 'locator', 'screenshot', 'step', 'js', 'until', 'render', 'draw', 'add_init_script', 'on', 'close')
_RELEASE_KEYS = ('ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'Enter', 'Escape', 'Space', 'Shift', 'Tab')


class _BrowserProxy:
    """What a test running in a worker gets from p.chromium.launch(): the worker's Chromium, whose close() leaves it running."""
    def __init__(self, w): self._w = w
    def new_context(self, **kw):
        c = self._w.browser.new_context(**kw); self._w.extra.append(c); return c
    def new_page(self, **kw):
        return self.new_context(**kw).new_page()
    def close(self, **kw): self._w.end_test()   # what the test opened closes (cine_shots launches and closes a browser per scene); the worker's stays up
    def __getattr__(self, name): return getattr(self._w.browser, name)


class _Worker:
    def __init__(self, pw, browser):
        self.pw, self.browser = pw, browser
        self.proxy = _BrowserProxy(self)
        self.ctx = self.tab = self.cdp = None
        self.in_use = False; self.origins = set(); self.scripts = []; self.listeners = []; self.extra = []
        # ONE ORIGIN: the warm tab stays warm only while it stays on one origin (another port, or localhost after 127.0.0.1, is a cold boot:
        # about 10 CPU s with the fonts). So the worker serves every folder from one server on one port: testlib.serve(dir) points it at the
        # test's folder (a worker runs one test at a time). The image and sound files are the same files in every folder (hard links), so
        # /img/x.png is the same picture whichever folder is served; pages and scripts are never cached.
        self.root = None; self.root_port = None
        holder = self
        class _Shared(_Handler):
            cache_assets = True
            def __init__(self, *a, **k): super().__init__(*a, directory=holder.root or ROOT, **k)
            def translate_path(self, path):   # per request: a kept-alive connection outlives the test that opened it (HTTP/1.1)
                self.directory = holder.root or ROOT; return super().translate_path(path)
        srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), _Shared); srv.daemon_threads = True
        threading.Thread(target=srv.serve_forever, daemon=True).start(); _servers.append(srv)
        self.port = srv.server_address[1]

    def serve(self, d):
        d = os.path.realpath(d)
        if self.root in (None, d): self.root = d; return self.port
        key = (d, True)   # a second folder in the same test: a server of its own, as outside a worker
        if key not in _by_dir:
            srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(type('_C', (_Handler,), {'cache_assets': True}), directory=d))
            srv.daemon_threads = True; threading.Thread(target=srv.serve_forever, daemon=True).start(); _servers.append(srv)
            _by_dir[key] = srv.server_address[1]
        return _by_dir[key]

    def _new_tab(self):
        try:
            if self.ctx: self.ctx.close()
        except Exception: pass
        self.ctx = self.browser.new_context(viewport={'width': 1300, 'height': 760})
        self.tab = self.ctx.new_page(); self.cdp = self.ctx.new_cdp_session(self.tab); self.cdp.send('Page.enable')   # (its init scripts only run with Page enabled)
        from urllib.parse import urlsplit
        def seen(frame):
            u = urlsplit(frame.url)
            if frame == self.tab.main_frame and u.scheme in ('http', 'https'): self.origins.add(f'{u.scheme}://{u.netloc}')
        self.tab.on('framenavigated', seen)

    def acquire(self, browser, viewport, clock, kw):
        if browser is not self.proxy or kw or not clock or self.in_use: return None   # a second page at once, or special options: a fresh one
        if self.tab is None or self.tab.is_closed(): self._new_tab()
        t = self.tab; self.in_use = True
        t.set_viewport_size(viewport)
        def add_init_script(script=None, path=None):
            src = script if script is not None else open(path, encoding='utf-8').read()
            self.scripts.append(self.cdp.send('Page.addScriptToEvaluateOnNewDocument', {'source': src})['identifier'])
        def on(event, f):
            self.listeners.append((event, f)); return type(t).on(t, event, f)
        t.add_init_script, t.on, t.close = add_init_script, on, (lambda **k: self.release())
        return t

    def release(self):
        if not self.in_use: return
        t, self.in_use = self.tab, False
        for event, f in self.listeners:
            try: t.remove_listener(event, f)
            except Exception: pass
        for name in _TAB_ATTRS: vars(t).pop(name, None)
        try:
            for sid in self.scripts: self.cdp.send('Page.removeScriptToEvaluateOnNewDocument', {'identifier': sid})
            t.goto('about:blank')   # the game's document goes; its images stay in the renderer's memory cache for the next test
            for k in _RELEASE_KEYS: t.keyboard.up(k)   # no key left held for the next test
            for o in self.origins:
                self.cdp.send('Storage.clearDataForOrigin', {'origin': o, 'storageTypes': 'local_storage,indexeddb,websql,cookies,cache_storage,service_workers,file_systems'})
        except Exception:
            self.tab = None   # a broken tab is replaced (a cold boot) rather than reused
        self.scripts.clear(); self.listeners.clear(); self.origins.clear()

    def end_test(self):
        self.release(); self.root = None
        for x in self.extra:
            try: x.close()
            except Exception: pass
        self.extra.clear()


def worker_start(pw, browser):
    """Called once by testkit/worker.py: tests' sync_playwright() and chromium.launch() now hand out this worker's driver and browser."""
    global _W
    _W = _Worker(pw, browser)
    import playwright.sync_api as api
    from playwright.sync_api import BrowserType
    class _Keep:   # `with sync_playwright() as p:` in a test: the worker's driver, left running at the end
        def __enter__(self): return pw
        def __exit__(self, *a): _W.end_test(); return False
        def start(self): return pw
    api.sync_playwright = lambda: _Keep()
    launch = BrowserType.launch
    def worker_launch(self, *a, **kw):
        if self.name == 'chromium' and not a and set(kw) <= {'headless', 'args'} and kw.get('headless', True) and set(kw.get('args') or []) <= set(WORKER_ARGS): return _W.proxy
        b = launch(self, *a, **kw); _W.extra.append(b); return b   # special arguments (wakeup's autoplay flag): a browser of its own
    BrowserType.launch = worker_launch
    return _W


def tap(pg, code, hold=4, after=3):
    """Press and release a key for exact frame counts (hold frames down, `after` frames up); one round trip (job tests-4)."""
    pg.js('([c, h, a]) => __T.tap(c, h, a)', [code, hold, after])

# STORY ADVANCE (job tests-4): the "press through dialogs, cards, stamps, fights and the dance until the scene is idle again" loop that
# ch1_test, fugitive_test and chronicle_test each wrote in Python, in the page: frame for frame and key for key the same, one round trip
# (plus one per screenshot: the dance intro, and the forge with forge=True). `until` is a JS expression over `st` (the test's ST object),
# e.g. "st.st === 'battle'"; a test whose until / pick is a Python function keeps its own Python loop for that call.
# road=True adds ch1's branch for the travel map (Z through it). New lines go into `seen` and `log` exactly as the Python loops wrote them.
STORY_ADVANCE = r"""async ([STsrc, ch, limit, untilSrc, seenList, i0, resume, forge, road]) => {
  const T = __T, ok = T.pyTruthy, s = new Function('return ' + STsrc), seen = new Set(seenList), newSeen = [];
  const until = untilSrc ? new Function('st', 'return (' + untilSrc + ')') : null;
  const tap = (k, ms = 60) => T.tap(k, T.frames(ms), T.frames(40));
  for (let i = i0; i < limit; i++) {
    if (resume === 'dance') { resume = null; await tap('KeyZ'); await T.wait(800); continue; }
    if (resume === 'forge') { resume = null; forgeFinish('sound'); await T.wait(200); continue; }
    const st = s();
    if (until && ok(until(st))) return { st, newSeen, ch };
    if (ok(st.dlg) && !seen.has(st.txt)) { seen.add(st.txt); newSeen.push([st.id, st.who, st.txt]); }
    if (st.st === 'dance') {
      if (st.dance === 'intro') { await T.wait(900); return { shot: 'dance', i, newSeen, ch }; }
      if (st.dance === 'ready' || st.dance === 'play') { danceFinish(); await T.wait(300); continue; }
      await tap('KeyZ'); await T.wait(200); continue;
    }
    if (forge && st.st === 'mini' && st.mini === 'forge') { await T.wait(600); return { shot: 'forge', i, newSeen, ch }; }   // Job 16b: here it ends Sound
    if (ok(st.item)) { await T.wait(1800); await tap('KeyZ'); continue; }
    if (ok(st.card) || ok(st.stamp)) { await T.wait(ok(st.stamp) ? 450 : 350); await tap('KeyZ'); continue; }
    if (st.st === 'battle') {
      if (st.bphase === 'cmd') { while (s().bsel !== 0) await tap('ArrowUp'); await tap('KeyZ'); await T.wait(250); await tap('KeyZ'); continue; }
      if (st.bphase === 'win' || st.bphase === 'lose') { await T.wait(200); await tap('KeyZ'); continue; }
      await T.wait(120); continue;
    }
    if (st.st === 'shop') { await tap('KeyX'); await T.wait(200); continue; }
    if (road && st.st === 'road') { await T.wait(250); await tap('KeyZ'); continue; }
    if (ok(st.dlg)) {
      if (st.ch != null && ch.length) { const want = ch.shift(); await T.wait(300); for (let j = 0; j < want; j++) await tap('ArrowDown'); await tap('KeyZ'); continue; }
      await T.wait(180); await tap('KeyZ'); continue;
    }
    if (ok(st.scr) || ok(st.warp) || ok(st.fade)) { await T.wait(150); continue; }
    let st2;
    if (st.st === 'scene' || st.st === 'world') { await T.wait(250); st2 = s(); }
    else { await T.wait(150); continue; }
    if (!(ok(st2.dlg) || ok(st2.scr) || ok(st2.card) || ok(st2.warp) || ok(st2.fade) || !(st2.st === 'scene' || st2.st === 'world'))) return { st: st2, newSeen, ch };
  }
  return { st: s(), newSeen, ch };
}"""


def story_advance(pg, ST, seen, log, shot, choices=(), limit=900, until=None, forge=False, road=False):
    r = pg.js(STORY_ADVANCE, [ST, list(choices), limit, until, list(seen), 0, None, forge, road])
    while True:
        for id_, who, txt in r['newSeen']: seen.add(txt); log.append(f"  [{id_}] {who or '-'}: {txt[:100]}")
        if 'shot' not in r: return r['st']
        shot(r['shot'])
        r = pg.js(STORY_ADVANCE, [ST, r['ch'], limit, until, list(seen), r['i'], r['shot'], forge, road])

"""The engine names no Ronin person, place or thing (job fw-F5a, 29 Oct 2026).

Builds the framework's sample game (sample-game/, Cincinnatus) into a scratch folder and greps the WHOLE built page, comments included, for every name of
Ronin's cast, places and content. A single hit fails the test; the hit's line is printed so it can be moved out of the engine into
the game's own files (the engine is core/, systems/, kits/ and the shell; a game's files are its src/). Nothing is skipped or allow-listed: if a name shows
up, the engine (or the theme, or the shell) is still carrying it.
"""
import ast, glob, os, re, sys, tempfile
import testlib
import buildlib

# Ronin's people, places and content words. Matched case-insensitively, as whole words (letters on either side do not count, so
# 'hayato_22' and 'Hayato's' hit, 'Argentina' does not hit 'genta').
NAMES = [
    # the cast
    'Hayato', 'Konishi', 'Tsuru', 'Gonzo', 'Gonzō', 'Kichi', 'Magobei', 'Omitsu', 'Oyone', 'Kihei', 'Heisuke', 'Ohana', 'Yasubei', 'Ofusa',
    'Genta', 'Ryokai', 'Ryōkai', 'Gohei', 'Tetsu', 'Kaneharu', 'Renji', 'Sobei', 'Yukinaga', 'Ieyasu', 'Ishida', 'Mitsunari',
    # the places
    'Sekigahara', 'Ibuki', 'Matsuo', 'Mikawa', 'honjin', 'Seki',
    # the game and its content words
    'Ronin', 'katana', 'onigiri', 'umeboshi', 'Iai', 'quench', 'Wake Song', 'Sute-gamari', 'bon-odori', 'kinzei',
]
rx = re.compile(r'(?<![A-Za-z])(' + '|'.join(re.escape(n) for n in NAMES) + r')(?![a-z])', re.I)

out = tempfile.mkdtemp(prefix='pub_cincinnatus_names_')
buildlib.build('cincinnatus', out)
fails = []
for page in ('index.html', 'test.html', 'tests.html'):
    html = open(os.path.join(out, page), encoding='utf-8').read()   # (tests.html: the generated test page, job fw-F7)
    hits = {}
    for i, line in enumerate(html.splitlines(), 1):
        for m in rx.finditer(line):
            hits.setdefault(m.group(1).lower(), []).append((i, line.strip()[:140]))
    n = sum(len(v) for v in hits.values())
    print(('OK   ' if not n else 'FAIL ') + f'{page}: {n} Ronin names in {len(html)} bytes')
    for name, rows in sorted(hits.items()):
        print(f'     {name}: {len(rows)}')
        for i, l in rows[:4]: print(f'        line {i}: {l}')
    if n: fails.append(page)

# ---- the framework's own tools and templates (job fw-F7, 30 Oct 2026): what the tools write into a game's pages and what they print is made
# from the game's files (game.json, its settings), so no Ronin name stands in the files a page or a site is made from, and none in the
# strings the tools' code builds (comments and docstrings may credit where a tool came from and give usage examples).
FW = testlib.FW if hasattr(testlib, 'FW') else os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
templates = [f for pat in ('tools/site/*', 'kits/topdown/painters/*', 'kits/topdown/editor.html', 'core/shell.html', 'themes/plain/*') for f in glob.glob(os.path.join(FW, pat)) if os.path.isfile(f)]
n = 0
for f in sorted(templates):
    for i, line in enumerate(open(f, encoding='utf-8').read().splitlines(), 1):
        for m in rx.finditer(line):
            n += 1; print(f'     {os.path.relpath(f, FW)} line {i}: {m.group(1)}: {line.strip()[:120]}')
print(('OK   ' if not n else 'FAIL ') + f'{len(templates)} template and site files: {n} Ronin names')
if n: fails.append('templates')

def code_strings(path):
    """The string constants of a Python file that are not docstrings (comments are not in the syntax tree at all)."""
    tree = ast.parse(open(path, encoding='utf-8').read())
    docs = {id(node.body[0].value) for node in ast.walk(tree)
            if isinstance(node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and node.body
            and isinstance(node.body[0], ast.Expr) and isinstance(node.body[0].value, ast.Constant) and isinstance(node.body[0].value.value, str)}
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str) and id(node) not in docs: yield node.lineno, node.value
tools = sorted(glob.glob(os.path.join(FW, 'tools', '*.py')) + glob.glob(os.path.join(FW, 'testkit', '*.py')))
n = 0
for f in tools:
    for ln, v in code_strings(f):
        for m in rx.finditer(v):
            n += 1; print(f'     {os.path.relpath(f, FW)} line {ln}: {m.group(1)}: {v.strip()[:120]!r}')
print(('OK   ' if not n else 'FAIL ') + f'{len(tools)} tools and test-kit files: {n} Ronin names in their strings')
if n: fails.append('tools')
sys.exit(1 if fails else 0)

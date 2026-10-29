"""The engine names no Ronin person, place or thing (job fw-F5a, 29 Oct 2026).

Builds the framework's sample game (sample-game/, Cincinnatus) into a scratch folder and greps the WHOLE built page, comments included, for every name of
Ronin's cast, places and content. A single hit fails the test; the hit's line is printed so it can be moved out of the engine into
the game's own files (the engine is core/, systems/, kits/ and the shell; a game's files are its src/). Nothing is skipped or allow-listed: if a name shows
up, the engine (or the theme, or the shell) is still carrying it.
"""
import os, re, sys, tempfile
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
for page in ('index.html', 'test.html'):
    html = open(os.path.join(out, page), encoding='utf-8').read()
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
sys.exit(1 if fails else 0)

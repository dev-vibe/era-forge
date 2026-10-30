"""The framework checks itself (Eraforge release gate; job fw-F5, 29 Oct 2026): the package a game installs has everything, the command runs,
and the engine's files are laid out as the build expects. No browser.

    the engine: core/, systems/ and every kits/<kit>/ hold .js files with unique names; only core/ has names starting with 01
    the command: `node bin/eraforge.js path` prints this checkout; `help` lists the commands; FW_PATH points it at a checkout
    the package: `npm pack --dry-run` ships bin/, core/, systems/, kits/, themes/plain, tools/, testkit/, skills/, playbooks/ and sample-game/
                 (a game installs it from a git tag, so a folder missing from package.json `files` would be missing in every game)
    the sample game: gamepaths finds it in the checkout; its code is the engine's files plus its src/, in file-name order
"""
import json, os, subprocess, sys
import testlib, gamepaths

FW = gamepaths.FW
fails = []
def check(ok, label):
    print(('OK   ' if ok else 'FAIL ') + label, flush=True)
    if not ok: fails.append(label)

# ---- the engine's files
names = {}
for d in ['core', 'systems'] + [os.path.join('kits', k) for k in sorted(os.listdir(os.path.join(FW, 'kits')))]:
    for f in sorted(os.listdir(os.path.join(FW, d))):
        if f.endswith('.js'): names.setdefault(f, []).append(d)
check(all(len(v) == 1 for v in names.values()), 'every engine file name is unique across core/, systems/ and kits/' + ''.join(f' ({k}: {v})' for k, v in names.items() if len(v) > 1))
check(all(v == ['core'] for k, v in names.items() if k.startswith('01')), 'only core/ has files whose names start with 01 (they open the page, before the theme)')
check(set(gamepaths.KIT_DIRS) == set(os.listdir(os.path.join(FW, 'kits'))), f'gamepaths.KIT_DIRS names the kits: {sorted(os.listdir(os.path.join(FW, "kits")))}')
check(os.path.isfile(os.path.join(FW, 'core', 'shell.html')) and '<!--GAME_NAME-->' in open(os.path.join(FW, 'core', 'shell.html'), encoding='utf-8').read(), 'core/shell.html has the game-name slot')
check(os.path.isfile(os.path.join(FW, 'themes', 'plain', 'theme.json')), 'the plain theme is in themes/plain/')

# ---- the command
env = {k: v for k, v in os.environ.items() if k not in ('FW_PATH', 'ERAFORGE_GAME')}
r = subprocess.run(['node', os.path.join(FW, 'bin', 'eraforge.js'), 'path'], capture_output=True, text=True, env=env, cwd=FW)
check(r.returncode == 0 and os.path.realpath(r.stdout.strip()) == os.path.realpath(FW), f'`eraforge path` prints this checkout ({r.stdout.strip() or r.stderr.strip()[:120]})')
r = subprocess.run(['node', os.path.join(FW, 'bin', 'eraforge.js'), 'help'], capture_output=True, text=True, env=env, cwd=FW)
check(r.returncode == 0 and all(c in r.stdout for c in ('build', 'site', 'test', 'scene', 'run')), '`eraforge help` lists build, site, test, scene and run')
r = subprocess.run(['node', os.path.join(FW, 'bin', 'eraforge.js'), 'path'], capture_output=True, text=True, env=dict(env, FW_PATH=os.path.join(FW, 'no-such-checkout')), cwd=FW)
check(r.returncode != 0 and 'FW_PATH' in r.stderr, 'FW_PATH is honoured: a wrong one is refused, naming FW_PATH')

# ---- the package
# as a game's `npm ci` sees it: a clone holds only the files git tracks (and new ones not ignored), never built pages or logs
import shutil, tempfile
clone = tempfile.mkdtemp(prefix='eraforge_pack_')
listed = subprocess.run(['git', 'ls-files', '-co', '--exclude-standard'], capture_output=True, text=True, cwd=FW).stdout.split('\n')
for f in filter(None, listed):
    if os.path.isfile(os.path.join(FW, f)): os.makedirs(os.path.dirname(os.path.join(clone, f)), exist_ok=True); shutil.copy2(os.path.join(FW, f), os.path.join(clone, f))
r = subprocess.run(['npm', 'pack', '--dry-run', '--json', '--ignore-scripts'], capture_output=True, text=True, cwd=clone)
shutil.rmtree(clone, ignore_errors=True)
try: files = {f['path'] for f in json.loads(r.stdout)[0]['files']}
except (ValueError, IndexError, KeyError): files = set(); print(r.stdout[-500:], r.stderr[-500:])
for need in ('bin/eraforge.js', 'core/01_core.js', 'core/08_main.js', 'core/shell.html', 'systems/05_items.js', 'kits/topdown/05c_scene.js', 'kits/topdown/editor.html',
             'kits/battle-turn/07_battle.js', 'kits/minigame/05a_minigame.js', 'themes/plain/theme.json', 'tools/eraforge.py', 'tools/buildlib.py', 'tools/build_site.py',
             'tools/gamepaths.py', 'tools/scene_tool.py', 'testkit/testlib.py', 'testkit/run_tests.py', 'testkit/worker.py', 'sample-game/game.json',
             'skills/next-job/SKILL.md', 'skills/fw-upgrade/SKILL.md', 'playbooks/testing.md', 'README.md',
             'tools/cine_shots.py', 'tools/theme_shots.py', 'tools/review_page.py', 'tools/bal_sim.py', 'tools/bal_dump.py', 'tools/site/test-tools.js',
             'tools/site/test-tools.css', 'tools/site/saves.html', 'kits/topdown/painters/gp_foreground_painter_template.html',
             'kits/topdown/painters/road_ground_painter_template.html', 'sample-game/animation_reviews.json'):
    check(need in files, f'the package ships {need}')
check(not any(f.startswith(('sample-game/assets/raw/', 'sample-game/pub_')) or '/pub_' in f or f.endswith('.pyc') for f in files), 'the package ships no raw art, built pages or caches')
version = json.load(open(os.path.join(FW, 'package.json'), encoding='utf-8'))['version']
check(f'## {version}' in open(os.path.join(FW, 'CHANGELOG.md'), encoding='utf-8').read(), f'CHANGELOG.md has a section for {version}')
# job fw-F7: the upgrade table says, per release, whether a game must change something; each section says what
import re
log = open(os.path.join(FW, 'CHANGELOG.md'), encoding='utf-8').read()
rows = re.findall(r'(?m)^\| (\d+\.\d+\.\d+) \([^)]*\) \| `([^`]*)` \| ([^|]+) \|', log)
check(any(r[0] == version for r in rows), f'the CHANGELOG upgrade table has a row for {version}')
check(all(re.fullmatch(r'[0-9a-f]{40}', sha) for v, sha, _ in rows if v != version), 'every earlier release in the upgrade table names its full commit sha')
sections = re.findall(r'(?m)^## (\d+\.\d+\.\d+) ', log)
check(sections[:1] == [version] and [r[0] for r in rows] == sections, 'the upgrade table lists the releases in the order of their sections, the newest first')
body = log.split(f'## {version} ', 1)[1].split('\n## ', 1)[0] if f'## {version} ' in log else ''
check(version == '0.1.0' or '### What a game must change' in body, f'the {version} section says what a game must change')

# ---- the sample game
sample = gamepaths.game_dir(gamepaths.SAMPLE_ID)
check(os.path.realpath(sample) == os.path.realpath(os.path.join(FW, 'sample-game')), 'gamepaths finds the sample game in sample-game/')
src = [os.path.basename(f) for f in gamepaths.source_files(gamepaths.SAMPLE_ID)]
check(src == sorted(src) and set(src) >= {f for f, d in names.items() if d[0] in ('core', 'systems')}, 'the sample game\'s code: the engine\'s files and its own, in file-name order')

print('RESULT:', 'FAIL' if fails else 'PASS', f'({len(fails)} failures)')
sys.exit(1 if fails else 0)

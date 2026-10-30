# The shared steps of the review and test pages (make_<name>_page.py; Ronin job fw-C2b, 28 Oct 2026; framework since job fw-F7, 30 Oct 2026).
# Each page is a copy of the game's built page (its pub folder, see gamepaths; run the build first) with its own jump buttons and the script that
# sets up each scenario; those stay in the game's own make_<name>_page.py (they are the page), and only the wrapping lives here. The
# page's title is whatever the built page carries (its first <title>): a game's own page builder names it. catalogue.json lists the pages the site hosts.
import os
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gamepaths

# `--game <id>` on any make_<name>_page.py (read here, at import) wraps that game's build instead: its pub folder.
GAME = gamepaths.pop_game()
ROOT = Path(gamepaths.game_dir(GAME))   # the game's folder: the pages are written under it
CH1 = Path(gamepaths.pub_dir(GAME))     # the built game (the variable keeps the tools' old spelling)
NAME = gamepaths.game_json(GAME).get('name') or GAME


def chapter_one(page='index.html'):
    """The built game page: index.html (the page fragment the hosted site wraps) or test.html (the full document Playwright loads)."""
    src = (CH1 / page).read_text(encoding='utf-8')
    assert re.search(r'<title>[^<]*</title>', src[:400]), f'{CH1.name}/{page} is not a built {NAME} page (run the build{"" if GAME == gamepaths.DEFAULT else " --game " + GAME} first)'
    return src


def page_title(page='index.html'):
    """The built page's own title element, as written in the page (the string bar_page and controls_page replace)."""
    return re.search(r'<title>[^<]*</title>', (CH1 / page).read_text(encoding='utf-8')[:400]).group(0)


def bar_page(src, title, bar, js, page='index.html'):
    """Retitle the page, put the jump bar right under the game frame and append the page's script."""
    out = src.replace(page_title(page), f'<title>{title}</title>', 1)
    i = out.index('<div class="frame">'); j = out.index('</div>', i) + len('</div>')
    return out[:j] + bar + out[j:] + js


def write(path, text):
    path = ROOT / path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')
    return path


def controls_page(title, controls, folder, alias, save_key=None):
    """The newer pages (duelists, lessons, minigames, road): the Chapter One page retitled, its own save slot, the review controls appended.
    Writes <folder>/index.html (hosted) and pub_ch1/<alias> (a full document beside the game's img/ and audio/, for Playwright)."""
    source = chapter_one().replace(page_title(), f'<title>{title}</title>', 1)
    if save_key: source = source.replace('<script>', f'<script>window.GAME_SAVE_KEY="{save_key}";', 1)
    write(f'{folder}/index.html', source + controls)
    write(f'{CH1.name}/{alias}', '<!doctype html><html><head><meta charset="utf-8"></head><body>' + source + controls + '</body></html>')


def link_assets(folder):
    """Give a standalone page folder the same img/ and audio/ as pub_ch1: hard links (copies where links fail), stale files replaced."""
    for sub in ('img', 'audio'):
        dest = ROOT / folder / sub
        dest.mkdir(parents=True, exist_ok=True)
        for original in (CH1 / sub).iterdir():
            target = dest / original.name
            if target.exists():
                if os.path.samefile(original, target): continue
                target.unlink()
            try: os.link(original, target)
            except OSError: shutil.copy2(original, target)


def symlink_assets(folder):
    """Point <folder>/img and <folder>/audio at pub_ch1's (local use; the hosted site serves one shared /img and /audio)."""
    for sub in ('img', 'audio'):
        link = ROOT / folder / sub
        if os.path.islink(link) or os.path.exists(link): continue
        os.symlink(os.path.abspath(CH1 / sub), link)

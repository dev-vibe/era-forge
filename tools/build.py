"""Build a game: `npx eraforge build [--game <id>] [--linked]` (Eraforge, job fw-F5, 29 Oct 2026).

The game's own page builder when its eraforge.json names one (`build`: run in the game's folder with the remaining arguments), else the
framework's pages (buildlib.build: pub_<id>/index.html, test.html, img/, audio/). What goes into a page: buildlib's docstring.
"""
import os, runpy, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import buildlib, gamepaths


def main(argv):
    gid = gamepaths.pop_game(argv)
    own = gamepaths.settings(gid).get('build')
    if own:
        gdir = gamepaths.game_dir(gid); os.chdir(gdir)
        script = os.path.join(gdir, own)
        sys.argv = [script] + argv[1:]
        sys.path.insert(0, os.path.dirname(script))
        runpy.run_path(script, run_name='__main__')
    else:
        buildlib.build(gid)


if __name__ == '__main__':
    main(sys.argv)

"""The `eraforge` command (bin/eraforge.js runs this file with python3; a game's own entry points may run it directly).

    npx eraforge build [--game <id>] [--linked]     build the game's pages (tools/build.py)
    npx eraforge site                               build the hosted site, site/ (tools/build_site.py)
    npx eraforge test [group|test ...] [-j N] [--isolated] [--shots] [--list]   run the game's tests (testkit/run_tests.py)
    npx eraforge scene <step> <scene> [...]         the top-down kit's scene steps: mask, painter, fg, link, trace, list (tools/scene_tool.py)
    npx eraforge run <tool> [args]                  any framework tool, e.g. `run make_char hayato_22`, `run theme_shots shoot out/`
                                                    (cine_shots <scene>, theme_shots shoot|compare, bal_dump, ... take their settings from the game's config folder)
    npx eraforge path                               print the framework folder (the package, or FW_PATH)

The game is the folder at or above the working directory that holds game.json (in the framework's own checkout: sample-game/).
FW_PATH=<framework checkout> runs that checkout's tools instead of the installed package's (bin/eraforge.js applies it).
"""
import os, runpy, sys

FW = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMMANDS = {'build': 'tools/build.py', 'site': 'tools/build_site.py', 'test': 'testkit/run_tests.py', 'scene': 'tools/scene_tool.py'}


def run(script, args):
    sys.path.insert(0, os.path.join(FW, 'tools'))
    import gamepaths   # finds the game (ERAFORGE_GAME, or game.json at or above the working directory)
    os.environ['ERAFORGE_GAME'] = gamepaths.GAME_ROOT; os.environ['ERAFORGE_ROOT'] = FW
    os.chdir(gamepaths.GAME_ROOT)
    path = os.path.join(FW, script)
    sys.argv = [path] + list(args)
    sys.path.insert(0, os.path.dirname(path))
    runpy.run_path(path, run_name='__main__')


def main(argv):
    if not argv or argv[0] in ('-h', '--help', 'help'):
        print(__doc__.strip()); return 0
    cmd, args = argv[0], argv[1:]
    if cmd == 'path': print(FW); return 0
    if cmd == 'run':
        if not args: raise SystemExit('eraforge run <tool> [args]: tools are ' + ', '.join(sorted(f[:-3] for f in os.listdir(os.path.join(FW, 'tools')) if f.endswith('.py'))))
        tool = args[0] if args[0].endswith('.py') else args[0] + '.py'
        for d in ('tools', 'testkit'):
            if os.path.isfile(os.path.join(FW, d, tool)): return run(f'{d}/{tool}', args[1:])
        raise SystemExit(f'eraforge run: no tool {args[0]!r} in {FW}/tools')
    if cmd not in COMMANDS: raise SystemExit(f'eraforge: unknown command {cmd!r} (build, site, test, scene, run, path)')
    return run(COMMANDS[cmd], args)


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]) or 0)

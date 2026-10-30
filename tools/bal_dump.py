# Dumps the battle data the balance simulator (bal_sim.py) needs from the game's built page: `npx eraforge run bal_dump [--game <id>]`
# (Ronin's bal/dump.py; framework tool since job fw-F7, 30 Oct 2026). Build the game first. Writes <game>/bal/data.json.
import json, os, socket, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gamepaths
from playwright.sync_api import sync_playwright
GAME = gamepaths.use_game()   # cwd is now the game's folder
with socket.socket() as s: s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '-d', gamepaths.pub(GAME)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); pg.goto(f'http://localhost:{port}/test.html'); pg.wait_for_timeout(1500)
        d = pg.evaluate("""() => {
          const out = { ENEMIES, TECHS, ITEMS, WEAPONS, ARMORS, LEVEL_TECHS: levelTechs(), xp: [], hero: {}, parties: {} };   // (levelTechs() replaced the LEVEL_TECHS constant in job fw-F2; the old dump stopped working then)
          for (let l = 1; l <= 15; l++) out.xp.push(xpToReach(l));
          const h = newHero();
          for (const w of Object.keys(WEAPONS)) for (const a of Object.keys(ARMORS)) for (let l = 1; l <= 12; l++) { h.lv = l; h.weapon = w; h.armor = a; out.hero[w + '|' + a + '|' + l] = heroStats(h); }
          for (const k of Object.keys(PARTIES)) { const seen = {}; for (let i = 0; i < 400; i++) { const s = PARTIES[k]().join(','); seen[s] = (seen[s] || 0) + 1; } out.parties[k] = seen; }
          out.allies = {}; for (const id of Object.keys(ALLY_DEFS)) { out.allies[id] = []; for (let l = 1; l <= 12; l++) out.allies[id].push(ALLY_DEFS[id].stat(l)); }
          out.shops = typeof SHOPS === 'object' ? SHOPS : null;
          return out; }""")
        os.makedirs('bal', exist_ok=True)
        json.dump(d, open('bal/data.json', 'w'), indent=1, default=str)
        b.close()
finally: srv.kill()
print('ok')

# Battle balance simulator (Ronin job 9 polish, 11 Oct 2026; framework tool since job fw-F7, 30 Oct 2026).
# Replays the battle kit's rules (kits/battle-turn/07_battle.js: damage, crits, dodge, evade, guard/cover, boss double turns and the HP
# scaling in startBattle) in Python, so solo and party fights can be compared over thousands of runs. The rules are the framework's; the
# player POLICY is the game's: who does what, with which technique, when (it is the part that knows the cast). A game's bal/ folder holds
#   policy module   defines act(m, party, foes, items, used, boss) and make_party(lv, w, a, allies, hp_frac, atk_bonus, ki_bonus), then
#                   hands them over:  import bal_sim; bal_sim.act = act; bal_sim.make_party = make_party
#   scenarios       any script that imports the policy module and calls run(...), table(...), fmt(...)
#   data.json       the game's battle data: `npx eraforge run bal_dump` after a build (the game's bal/data.json)
# Tunables (CFG) are overridden by importing and changing them before run(...).
import json, random, statistics as stt, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gamepaths
D = json.load(open(os.path.join(gamepaths.GAME_ROOT, 'bal', 'data.json')))
E, T = D['ENEMIES'], D['TECHS']

# ---- tunables (the live values from the game; override to test changes) ----
CFG = dict(scale=0.35, boss_scale=0.7, boss_double=3, ally=None, cover=3)   # cover: enemy phases a cover technique lasts
def ally_stat(id, lv):
    if CFG['ally'] and id in CFG['ally']: return CFG['ally'][id](lv)
    return D['allies'][id][lv - 1]

def hero_stat(w, a, lv, atk_bonus=0, ki_bonus=0):
    s = dict(D['hero'][f'{w}|{a}|{lv}']); s['atk'] += atk_bonus; s['maxKi'] += ki_bonus; return s

class M:   # a party member
    def __init__(s, id, st, techs, hp=None, ki=None):
        s.id, s.st, s.techs = id, st, techs; s.hp = st['maxHp'] if hp is None else hp; s.ki = st['maxKi'] if ki is None else ki
        s.guard = s.cover = s.debuff = 0
    up = property(lambda s: s.hp > 0)

def dmg_member(m, e, mult, pierce):
    atk = m.st['atk'] * (0.75 if m.debuff > 0 else 1) * mult
    d = (atk - (0 if pierce else E[e['id']]['def'] * 0.5)) * random.uniform(0.88, 1.12)
    if random.random() < 0.08: d *= 1.75
    return max(1, round(d))

def strike(m, targets, mult=1, pierce=False):
    for e in targets:
        if not e['alive']: continue
        ev = E[e['id']].get('evade')
        if ev and random.random() < ev: continue
        e['hp'] -= dmg_member(m, e, mult, pierce)
        if e['hp'] <= 0: e['hp'] = 0; e['alive'] = False

def fight(party, ids, items, boss=False, max_rounds=60):
    np_ = len(party)
    foes = []
    for id in ids:
        d = E[id]; hp = round(d['hp'] * (1 + (CFG['boss_scale'] if d.get('boss') else CFG['scale']) * (np_ - 1)))
        foes.append(dict(id=id, hp=hp, max=hp, alive=True))
    alive = lambda: [e for e in foes if e['alive']]
    standing = lambda: [m for m in party if m.up]
    used = dict(items=0, ki=0)
    for rnd in range(1, max_rounds + 1):
        # the party, in order
        for m in party:
            if not m.up or not alive(): continue
            act(m, party, alive(), items, used, boss)
        if not alive(): return dict(win=True, rounds=rnd, used=used)
        for e in alive():
            d = E[e['id']]; acts = 2 if d.get('boss') and np_ >= CFG['boss_double'] else 1
            for _ in range(acts):
                st = standing()
                if not st: break
                skill = None
                for sk in d.get('skills', []):
                    if random.random() < sk['chance']: skill = sk; break
                cov = [m for m in st if m.cover > 0]; tgt = cov[0] if cov else random.choice(st)
                if skill and skill.get('debuff'): tgt.debuff = 3; continue
                if random.random() < 0.05 + max(0, tgt.st['spd'] - d['spd']) * 0.01: continue
                if skill and skill.get('dmg'): dm = random.randint(*skill['dmg'])
                else: dm = (d['atk'] * (skill.get('mult', 1) if skill else 1) - tgt.st['def'] * 0.5) * random.uniform(0.88, 1.12)
                if tgt.guard > 0 or tgt.cover > 0: dm *= 0.5
                tgt.hp = max(0, tgt.hp - max(1, round(dm)))
                if tgt.hp <= 0: tgt.guard = tgt.cover = tgt.debuff = 0
        for m in party:
            m.guard = max(0, m.guard - 1); m.debuff = max(0, m.debuff - 1); m.cover = max(0, m.cover - 1)
        if not standing(): return dict(win=False, rounds=rnd, used=used)
    return dict(win=False, rounds=max_rounds, used=used)

def spend(m, t, used): m.ki -= T[t]['ki']; used['ki'] += T[t]['ki']

act = make_party = None   # the game's policy (see the header): bal_sim.act = ..., bal_sim.make_party = ...


def run(label, lv, w, a, allies, ids_fn, items=None, boss=False, n=3000, hp_frac=1.0, atk_bonus=0, ki_bonus=0):
    wins, rounds, hploss, itm, downs = 0, [], [], [], 0
    for _ in range(n):
        p = make_party(lv, w, a, allies, hp_frac, atk_bonus, ki_bonus)
        start = sum(m.hp for m in p); mx = sum(m.st['maxHp'] for m in p)
        it = dict(items or {})
        r = fight(p, ids_fn(), it, boss)
        wins += r['win']; rounds.append(r['rounds']); itm.append(r['used']['items'])
        if r['win']: hploss.append((start - sum(m.hp for m in p)) / mx); downs += sum(1 for m in p if not m.up)
    q = sorted(rounds)
    return dict(label=label, win=wins / n, rounds=stt.mean(rounds), r90=q[int(0.9 * n)], hp=stt.mean(hploss) if hploss else 1, items=stt.mean(itm), downs=downs / max(1, wins))

def group(kind):
    opts = D['parties'].get(kind)
    if not opts: return lambda: [kind]
    keys = list(opts); wts = [opts[k] for k in keys]
    return lambda: random.choices(keys, wts)[0].split(',')

def fmt(r): return f"{r['label']:<44} win {r['win']*100:5.1f}%  rounds {r['rounds']:4.1f} (90%: {r['r90']:2d})  HP lost {r['hp']*100:4.0f}%  items {r['items']:.2f}  down/win {r['downs']:.2f}"

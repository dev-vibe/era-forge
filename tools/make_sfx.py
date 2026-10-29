"""Job 9b: turn the ElevenLabs ambience loops and sound effects into game files.

Originals: assets/raw/amb/<name>__<generation id>.mp3 and assets/raw/sfx/<name>__<generation id>.mp3 (2 takes per
ambience, 3 per effect; takes are lettered A, B, C by creation time). Picks: audio_picks.json ({"amb_river": "A", ...};
missing = A). Output: assets/game/amb_<key>.mp3 and assets/game/sfx_<key>.mp3 (+ sfx_<key>_2/_3 for the RANDOM ones,
the other takes, so repeated steps/hits vary). Prints the AMB_LOOPS table (loop points) for src/01_core.js.

Ambience (ElevenLabs made them with loop: true): the whole take repeats, [last PAD s] + take + [first PAD s] like
make_music.py --whole, at AMB_LUFS. Each take gets a seam score (the jump at the wrap compared with the take's own
sample-to-sample movement) so a bad loop shows up.
Effects: leading silence trimmed (first sample above -40 dB, minus 5 ms), cut to the length asked for plus 40%, a 30 ms
fade at the end, levelled to SFX_RMS (peaks kept under -1 dBFS; the per-group level lives in SFX_VOL in 01_core.js), 48 kHz, 128 kbps.

    python3 tools/make_sfx.py            # all
    python3 tools/make_sfx.py sfx_hit    # one
"""
import glob, json, os, subprocess, sys
import numpy as np

SR = 48000
PAD = 1.0
AMB_LUFS = -22
SFX_RMS = -20   # every effect at the same loudness (RMS of its sounding part, dBFS; peaks capped at -1 dBFS)
RANDOM = {'sfx_step', 'sfx_hit', 'sfx_slash'}
# the length asked for in the prompt doc (s); takes come back at least 0.5 s
WANT = {'cursor': .3, 'ok': .5, 'back': .4, 'deny': .5, 'talk': .15, 'menu_open': .6, 'card_turn': .7, 'item': .8, 'coin': .5,
        'save': 1.2, 'step': .3, 'step_wood': .3, 'stairs': 1.0, 'door': .8, 'door_heavy': 1.5, 'bump': .3, 'splash': .6,
        'pickup': .6, 'warp': 1.5, 'echo': 1.5, 'encounter': 1.2, 'slash': .6, 'hit': .5, 'crit': .8, 'miss': .5, 'guard': .5,
        'spear': .6, 'blow': .7, 'heal': 1.2, 'dance': 1.5, 'ki': 1.0, 'fire': 1.2, 'down': .8, 'flee': .8, 'stamp': 1.0,
        'levelup': 1.5, 'bell': 4.0, 'taiko': 2.0, 'arrow': .8, 'crows': 2.5,
        'clap': .6, 'thud': .6, 'roar': 2.0}   # Job 16c: the festival sumo


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def encode(x, out, kbps=128):
    tmp = out + '.f32'; x.astype(np.float32).tofile(tmp)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', tmp,
                    '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', out], check=True)
    os.remove(tmp)


def lufs(x):
    tmp = '/tmp/_l.f32'; x.astype(np.float32).tofile(tmp)
    m = subprocess.run(['ffmpeg', '-v', 'info', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', tmp, '-af',
                        'loudnorm=print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(json.loads(m[m.rindex('{'):m.rindex('}') + 1])['input_i'])


def takes():
    gens = json.load(open('audio_work/gens.json')) if os.path.exists('audio_work/gens.json') else {}
    by = {}
    for f in glob.glob('assets/raw/amb/*.mp3') + glob.glob('assets/raw/sfx/*.mp3'):
        name, gid = os.path.basename(f)[:-4].split('__')
        by.setdefault(name, []).append((gens.get(gid, {}).get('t') or 0, gid, f))
    return {n: [f for _, _, f in sorted(v)] for n, v in by.items()}


def seam(x):
    """jump at the wrap (last sample -> first sample) in units of the take's typical sample-to-sample step"""
    d = np.abs(np.diff(x, axis=0)).mean()
    return float(np.abs(x[0] - x[-1]).mean() / max(d, 1e-9))


def do_amb(name, files, pick):
    out, rep = {}, []
    for i, f in enumerate(files):
        x = decode(f)
        rep.append((chr(65 + i), round(len(x) / SR, 2), round(seam(x), 2)))
    i = ord(pick) - 65
    x = decode(files[i]); n = len(x); p = int(PAD * SR)
    full = np.concatenate([x[-p:], x, x[:p]])
    g = 10 ** ((AMB_LUFS - lufs(x)) / 20); pk = np.abs(full).max()
    if pk * g > 0.89: g = 0.89 / pk
    encode(full * g, f'assets/game/{name}.mp3', 96)
    out = {'loopStart': PAD, 'loopEnd': round(PAD + n / SR, 4)}
    print(name, 'pick', pick, 'takes (letter, s, seam):', rep, '->', out)
    return out


def do_sfx(name, files, pick):
    key = name[4:]; want = WANT.get(key, 1.0)
    order = [ord(pick) - 65] + [i for i in range(len(files)) if i != ord(pick) - 65]
    for k, i in enumerate(order if name in RANDOM else order[:1]):
        x = decode(files[i])
        a = np.abs(x).max(axis=1); thr = a.max() * 10 ** (-40 / 20)
        s = max(0, int(np.argmax(a > thr)) - int(0.005 * SR))
        e = min(len(x), s + int(max(want * 1.4, want + 0.1) * SR))
        y = x[s:e].copy(); f = min(len(y), int(0.03 * SR))
        y[-f:] *= np.linspace(1, 0, f)[:, None]
        act = y[np.abs(y).max(axis=1) > thr]; rms = float(np.sqrt((act ** 2).mean())) if len(act) else 1e-9
        g = min(10 ** (SFX_RMS / 20) / max(rms, 1e-9), 10 ** (-1 / 20) / max(np.abs(y).max(), 1e-9))
        y *= g
        outn = f'assets/game/{name}.mp3' if k == 0 else f'assets/game/{name}_{k + 1}.mp3'
        encode(y, outn)
        print(os.path.basename(outn), 'take', chr(65 + i), f'{len(y) / SR:.2f}s')


if __name__ == '__main__':
    picks = json.load(open('tools/audio_picks.json')) if os.path.exists('tools/audio_picks.json') else {}
    only = sys.argv[1:]
    T = takes(); loops = {}
    for name in sorted(T):
        if only and name not in only: continue
        if name.startswith('amb_'): loops[name] = do_amb(name, T[name], picks.get(name, 'A'))
        else: do_sfx(name, T[name], picks.get(name, 'A'))
    if loops: print('AMB_LOOPS', json.dumps(loops))

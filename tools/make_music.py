"""Job 9a: turn a music original (ElevenLabs mp3, Suno wav/mp3) into a seamless game loop.

Two modes.

A) Tail overlap (default; for through-composed takes with no steady beat, like the ElevenLabs takes):
   python3 tools/make_music.py <original> <out.mp3> [--lufs -16] [--tail 6]
   * the leading silence is trimmed (start s = first sample above -45 dB, minus 30 ms);
   * the last TAIL seconds (the piece's own decay, faded out further with a cosine) are mixed over the first TAIL
     seconds, so when the loop wraps, the tail keeps ringing into the opening exactly as it would have;
   * the file is [last PAD s of the body] + body + [first PAD s of the body], so loopStart = PAD, loopEnd = PAD + LOOP
     and the track starts at loopStart. MP3 priming silence shifts both loop points equally, so the seam stays clean.

B) Loop points inside the song (for songs with a beat or a form, like Suno takes; an intro that plays once):
   python3 tools/make_music.py <original> <out.mp3> --loop A B [--lufs -16] [--xfade 0.12]
   * A and B are seconds in the original where the music matches (find them with find_loop.py: same chords and sound,
     B - A a whole number of bars);
   * B is refined by +-15 ms so the note onsets after A and after B line up (rhythm);
   * the last XFADE s before B are crossfaded into the XFADE s before A, so at B the audio is already A's audio;
   * the file is x[0 : B] + x[A : A + PAD] (post-roll): play from 0 (start: 0 in TRACKS), loop A..B.

C) The song was made to loop (Ash's Suno takes can be 'built to loop'): ASK or listen first, then
   python3 tools/make_music.py <original> <out.mp3> --whole [--lufs -19]
   * the whole file repeats end into start, nothing trimmed or cut; [last PAD s] + song + [first PAD s],
     start = loopStart = PAD, loopEnd = PAD + length.

D) A one-shot that plays once and stops (Job 8g-r3, Oyone's planting song; TRACKS entry loop: false, start: 0):
   python3 tools/make_music.py <original> <out.mp3> --once [--lufs -19] [--fade S | --fade-from T]
   * the lead silence is trimmed: the first 200 ms window above -35 dBFS RMS marks sustained sound (an isolated click in
     the first frames, as Suno exports sometimes have, does not count), the take starts at its onset (first 10 ms above
     -45 dBFS) minus 50 ms, with a 10 ms fade-in;
   * the end: if the export still sounds in its last 50 ms (above -50 dBFS, a held note cut off), a cosine fade closes it,
     over the last S s (default 1.5) or from T s in the original; otherwise trailing silence below -60 dBFS is trimmed with
     a 50 ms fade; 0.1 s of silence is added after.

All: loudness set to the target LUFS with ONE static gain (peaks kept under -1 dBFS), 128 kbps stereo 48 kHz.
Prints a JSON line with start / loopStart / loopEnd for the TRACKS entry.
"""
import subprocess, sys, json, os, numpy as np

PAD = 1.0
SR = 48000


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def write(full, out, lufs):
    tmp = out + '.f32'
    full.astype(np.float32).tofile(tmp)
    m = subprocess.run(['ffmpeg', '-v', 'info', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', tmp, '-af',
                        f'loudnorm=I={lufs}:TP=-1.5:LRA=14:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    js = json.loads(m[m.rindex('{'):m.rindex('}') + 1])
    # static gain only (a dynamic normaliser would treat the two sides of the seam differently)
    g = 10 ** ((lufs - float(js['input_i'])) / 20)
    pk = float(np.abs(full).max())
    if pk * g > 0.89: g = 0.89 / pk
    (full * g).astype(np.float32).tofile(tmp)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', tmp,
                    '-c:a', 'libmp3lame', '-b:a', '128k', out], check=True)
    os.remove(tmp)
    return js['input_i'], 20 * np.log10(g)


def tail_overlap(x, tail):
    mono = np.abs(x).max(axis=1)
    nz = np.nonzero(mono > 10 ** (-45 / 20))[0]
    s = max(0, nz[0] - int(0.03 * SR)); L = nz[-1] + 1; T = int(tail * SR)
    body = x[s:L - T].copy()
    fade = (np.cos(np.linspace(0, np.pi / 2, T, dtype=np.float32)) ** 2)[:, None]
    body[:T] += x[L - T:L] * fade
    P = int(PAD * SR)
    full = np.concatenate([body[-P:], body, body[:P]])
    return full, {'start': PAD, 'loopStart': PAD, 'loopEnd': round(PAD + len(body) / SR, 4), 'loop_s': round(len(body) / SR, 3)}


def inner_loop(x, A, B, xf):
    a, b = int(A * SR), int(B * SR)
    # refine b on the rhythm: the note onsets in the 4 s after b should line up with those after a (+-15 ms, 2.5 ms
    # steps). Raw-waveform correlation is unreliable on full mixes (it once pulled a seam 18 ms off the beat).
    m = x.mean(1); h, n = 120, 1024
    def onset(seg):
        fr = np.lib.stride_tricks.sliding_window_view(seg, n)[::h] * np.hanning(n)
        S = np.log1p(np.abs(np.fft.rfft(fr, axis=1)) * 10); o = np.maximum(0, np.diff(S, axis=0)).sum(1)
        return (o - o.mean()) / (o.std() + 1e-9)
    W = 4 * SR; oa = onset(m[a:a + W]); best, bo = -9, 0
    for d in range(-int(0.015 * SR), int(0.015 * SR) + 1, h):
        ob = onset(m[b + d:b + d + W]); k = min(len(oa), len(ob))
        c = float(np.dot(oa[:k], ob[:k]) / k)
        if c > best: best, bo = c, d
    b += bo
    F = int(xf * SR)
    body = x[:b].copy()
    t = np.linspace(0, np.pi / 2, F, dtype=np.float32)[:, None]
    body[b - F:b] = x[b - F:b] * np.cos(t) + x[a - F:a] * np.sin(t)   # equal-power: at b we are already on a's audio
    P = int(PAD * SR)
    full = np.concatenate([body, x[a:a + P]])
    return full, {'start': 0, 'loopStart': round(a / SR, 4), 'loopEnd': round(b / SR, 4), 'loop_s': round((b - a) / SR, 3),
                  'refine_ms': round(bo / SR * 1000, 2), 'onset_match': round(best, 3)}


def one_shot(x, fade=None, fade_from=None):
    m = x.mean(1); W = int(0.05 * SR); W2 = int(0.2 * SR); W1 = int(0.01 * SR)
    rms = lambda w: np.sqrt(np.convolve(m ** 2, np.ones(w) / w, 'valid'))
    c = int(np.argmax(rms(W2) > 10 ** (-35 / 20)))                      # sustained sound (a lone click can't hold 200 ms)
    r1 = rms(W1)[c:c + W2]; s = max(0, c + int(np.argmax(r1 > 10 ** (-45 / 20))) - W)   # its onset, minus 50 ms
    def lvl(seg): return 20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-12)
    cut = lvl(m[-W:]) > -50
    if cut:   # the export stops while the take still sounds: fade it closed
        e = len(x); f0 = int(fade_from * SR) if fade_from is not None else e - int((fade or 1.5) * SR)
    else:     # it ends in silence: trim the silent tail
        nz = np.nonzero(np.abs(x).max(1) > 10 ** (-60 / 20))[0]; e = nz[-1] + 1; f0 = max(s, e - int(0.05 * SR))
    y = x[s:e].copy(); F = e - f0
    y[-F:] *= (np.cos(np.linspace(0, np.pi / 2, F, dtype=np.float32)) ** 2)[:, None]
    I = int(0.01 * SR); y[:I] *= np.linspace(0, 1, I, dtype=np.float32)[:, None]
    y = np.concatenate([y, np.zeros((int(0.1 * SR), 2), np.float32)])
    return y, {'start': 0, 'loop': False, 'length': round(len(y) / SR, 3), 'trim_start': round(s / SR, 3),
               'end_was_cut': bool(cut), 'fade_from': round(f0 / SR, 3), 'fade_s': round(F / SR, 3)}


def main():
    a = sys.argv[1:]
    src, out = a[0], a[1]
    lufs = float(a[a.index('--lufs') + 1]) if '--lufs' in a else -16.0
    x = decode(src)
    if '--whole' in a:
        # C) the song was made to loop (Suno 'built to loop'): the whole file repeats, end into start, nothing cut;
        # 1 s pre/post-roll so mp3 priming can't shift the seam
        P = int(PAD * SR); M = int(0.004 * SR)
        x = x.copy(); r = np.linspace(0, 1, M, dtype=np.float32)[:, None]
        x[:M] *= r; x[-M:] *= r[::-1]   # 4 ms in/out: an export cut mid-wave would otherwise click at the wrap
        full = np.concatenate([x[-P:], x, x[:P]])
        info = {'start': PAD, 'loopStart': PAD, 'loopEnd': round(PAD + len(x) / SR, 4), 'loop_s': round(len(x) / SR, 3)}
    elif '--once' in a:
        full, info = one_shot(x, float(a[a.index('--fade') + 1]) if '--fade' in a else None,
                              float(a[a.index('--fade-from') + 1]) if '--fade-from' in a else None)
    elif '--loop' in a:
        i = a.index('--loop'); xf = float(a[a.index('--xfade') + 1]) if '--xfade' in a else 0.12
        full, info = inner_loop(x, float(a[i + 1]), float(a[i + 2]), xf)
    else:
        full, info = tail_overlap(x, float(a[a.index('--tail') + 1]) if '--tail' in a else 6.0)
    pk = np.abs(full).max()
    if pk > 0.99: full *= 0.99 / pk
    meas, gain = write(full, out, lufs)
    info.update({'file': out, 'measured_lufs': meas, 'gain_db': round(float(gain), 2)})
    print(json.dumps(info))


if __name__ == '__main__':
    main()

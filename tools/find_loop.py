"""Job 9a: find loop points inside a song (for make_music.py --loop A B).

python3 tools/find_loop.py <audio> <a_from> <a_to> <b_from> <b_to> [bar_seconds]

Compares every A in [a_from, a_to] with every B in [b_from, b_to] (seconds): 3 s before and after each point, using
mean-centred chroma (which chords) + 16 band energies (which instruments) per 23 ms frame, plus onset agreement
(rhythm). Prints the best 8 pairs. With bar_seconds it also prints the best pairs whose length B - A is a whole number
of bars (within 2%): prefer those for anything with a beat. Tip: if the top unconstrained pairs keep coming out at
lengths like 91.14 / 114.01 s, their differences give the true bar length (114.01 / 40 = 2.850 s).
Pick B well before the song's outro and A after its intro; longer loops repeat less.
"""
import subprocess, sys, numpy as np
from scipy.signal import fftconvolve

SR, N, H = 22050, 4096, 512
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', sys.argv[1], '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
x = np.frombuffer(raw, np.float32); fps = SR / H
fr = np.lib.stride_tricks.sliding_window_view(x, N)[::H] * np.hanning(N)
S = np.abs(np.fft.rfft(fr, axis=1)).astype(np.float32)
f = np.fft.rfftfreq(N, 1 / SR); keep = (f > 60) & (f < 5000)
pc = np.round(12 * np.log2(f[keep] / 440)) % 12
C = np.log1p(np.stack([S[:, keep][:, pc == i].sum(1) for i in range(12)], 1))
edges = np.geomspace(60, 8000, 17)
B = np.stack([np.log1p(S[:, (f >= edges[i]) & (f < edges[i + 1])].sum(1)) for i in range(16)], 1)
fl = np.concatenate([[0], np.maximum(0, np.diff(np.log1p(S), axis=0)).sum(1)]); fl = (fl - fl.mean()) / fl.std()
F = np.concatenate([C / np.linalg.norm(C, axis=1, keepdims=True), 0.7 * B / np.linalg.norm(B, axis=1, keepdims=True)], 1)
F = F - F.mean(0); F = F / F.std(0); F = F / np.linalg.norm(F, axis=1, keepdims=True)
t = lambda s: int(float(s) * fps)
a0, a1, b0, b1 = (t(v) for v in sys.argv[2:6]); W = t(3)
Fa, Fb = F[a0 - W:a1 + W], F[b0 - W:b1 + W]
K = np.eye(2 * W, dtype=np.float32)
sc = fftconvolve(Fa @ Fb.T, K, mode='valid') / (2 * W)
rf = fftconvolve(np.outer(fl[a0 - W:a1 + W], fl[b0 - W:b1 + W]), K, mode='valid') / (2 * W)
score = sc + 0.15 * rf
ai = (a0 + np.arange(score.shape[0])) / fps; bi = (b0 + np.arange(score.shape[1])) / fps


def top(sco, label, bar=None):
    print(label); seen = []
    for idx in np.argsort(sco.ravel())[::-1][:40000]:
        i, j = np.unravel_index(idx, sco.shape); A, Bt = ai[i], bi[j]
        if any(abs(A - p) < 2 and abs(Bt - q) < 2 for p, q in seen): continue
        seen.append((A, Bt))
        print('  A %.3f  B %.3f  len %.2f%s  match %.4f' % (A, Bt, Bt - A, '  bars %.2f' % ((Bt - A) / bar) if bar else '', sc[i, j]))
        if len(seen) >= 8: break


top(score, 'best pairs')
if len(sys.argv) > 6:
    bar = float(sys.argv[6]); D = (bi[None, :] - ai[:, None]) / bar
    top(np.where(np.abs(D - np.round(D)) < 0.02, score, -9), f'bar-aligned pairs (bar {bar} s)', bar)

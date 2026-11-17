"""Generates the bundled alarm tones (assets/sounds/*.wav). Run: python3 scripts/make-sounds.py"""
import math
import os
import struct
import wave

RATE = 22050
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sounds')


def write(name, samples):
    os.makedirs(OUT, exist_ok=True)
    peak = max(1e-9, max(abs(s) for s in samples))
    with wave.open(os.path.join(OUT, f'{name}.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(s / peak * 0.85 * 32767)) for s in samples))


def note(freq, dur, decay=3.0, partials=((1, 1.0), (2, 0.25), (3, 0.08))):
    n = int(dur * RATE)
    out = []
    for i in range(n):
        t = i / RATE
        attack = min(1.0, t / 0.015)
        env = attack * math.exp(-decay * t)
        out.append(env * sum(a * math.sin(2 * math.pi * freq * k * t) for k, a in partials))
    return out


def mix_at(buf, start, samples, gain):
    i0 = int(start * RATE)
    for i, s in enumerate(samples):
        if i0 + i < len(buf):
            buf[i0 + i] += s * gain


def sanft(seconds=24):
    """Soft rising arpeggio that slowly gets louder."""
    buf = [0.0] * (seconds * RATE)
    seq = [523.25, 659.25, 783.99, 1046.5]
    t, k = 0.0, 0
    while t < seconds - 1:
        gain = 0.25 + 0.75 * min(1.0, t / (seconds * 0.7))
        mix_at(buf, t, note(seq[k % 4], 1.6, decay=2.2), gain)
        t += 0.42 if k % 4 != 3 else 1.3
        k += 1
    return buf


def glocke(seconds=24):
    """Bell with inharmonic partials, every two seconds."""
    buf = [0.0] * (seconds * RATE)
    bell = ((1, 1.0), (2.76, 0.45), (5.4, 0.22), (8.93, 0.1))
    t = 0.0
    while t < seconds - 1:
        gain = 0.35 + 0.65 * min(1.0, t / (seconds * 0.6))
        mix_at(buf, t, note(440.0, 2.4, decay=1.6, partials=bell), gain)
        t += 2.0
    return buf


def klar(seconds=20):
    """Clear double beep pattern."""
    buf = [0.0] * (seconds * RATE)
    t = 0.0
    while t < seconds - 1:
        for off, f in ((0.0, 880.0), (0.18, 1318.5)):
            mix_at(buf, t + off, note(f, 0.14, decay=6, partials=((1, 1.0), (2, 0.1))), 1.0)
        t += 1.0
    return buf


if __name__ == '__main__':
    write('sanft', sanft())
    write('glocke', glocke())
    write('klar', klar())
    print('ok')

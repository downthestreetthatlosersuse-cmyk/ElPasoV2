/* Procedural WebAudio SFX — no assets, all synthesized. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

export function initAudio() {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return;
  }
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
    const len = ctx.sampleRate;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  } catch {
    ctx = null;
  }
}

function osc(
  type: OscillatorType,
  f0: number,
  f1: number,
  dur: number,
  vol: number,
  delay = 0
) {
  if (!ctx || !master) return;
  const now = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(1, f0), now);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), now + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g);
  g.connect(master);
  o.start(now);
  o.stop(now + dur + 0.05);
}

function noise(
  dur: number,
  vol: number,
  freq: number,
  delay = 0,
  type: BiquadFilterType = "lowpass"
) {
  if (!ctx || !master || !noiseBuffer) return;
  const now = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, now);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.3), now + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(now);
  src.stop(now + dur + 0.05);
}

export const sfx = {
  smg() {
    noise(0.08, 0.5, 3400);
    osc("square", 240, 80, 0.06, 0.22);
  },
  magnum() {
    noise(0.24, 0.9, 1500);
    osc("sine", 160, 42, 0.28, 0.85);
    osc("square", 950, 110, 0.09, 0.18);
  },
  dry() {
    osc("square", 900, 650, 0.05, 0.14);
  },
  reload() {
    osc("square", 480, 300, 0.05, 0.18);
    osc("square", 620, 420, 0.05, 0.18, 0.5);
    osc("square", 800, 520, 0.06, 0.2, 1.15);
  },
  hit() {
    osc("square", 1500, 950, 0.045, 0.16);
  },
  squish() {
    osc("sawtooth", 320, 70, 0.12, 0.26);
    noise(0.1, 0.28, 900);
  },
  alienDie() {
    osc("sawtooth", 540, 55, 0.42, 0.32);
    osc("square", 270, 40, 0.36, 0.18);
    noise(0.25, 0.3, 1200);
  },
  bruteDie() {
    osc("sawtooth", 210, 30, 0.65, 0.5);
    noise(0.55, 0.5, 520);
    osc("sine", 90, 28, 0.5, 0.4, 0.05);
  },
  spit() {
    osc("sine", 280, 720, 0.13, 0.24);
  },
  splat() {
    noise(0.13, 0.36, 700);
    osc("sine", 220, 55, 0.11, 0.2);
  },
  hurt() {
    osc("sine", 130, 48, 0.22, 0.6);
    noise(0.16, 0.4, 420);
  },
  pickup() {
    osc("square", 660, 660, 0.07, 0.22);
    osc("square", 990, 990, 0.09, 0.22, 0.08);
  },
  heal() {
    osc("sine", 440, 880, 0.22, 0.28);
  },
  wave() {
    osc("sawtooth", 110, 110, 0.55, 0.38);
    osc("sawtooth", 165, 165, 0.55, 0.28, 0.02);
    osc("sawtooth", 220, 150, 0.8, 0.24, 0.3);
  },
  clear() {
    osc("square", 523, 523, 0.1, 0.22);
    osc("square", 659, 659, 0.1, 0.22, 0.11);
    osc("square", 784, 784, 0.22, 0.22, 0.22);
  },
  gameover() {
    osc("sawtooth", 300, 38, 1.5, 0.5);
    osc("sawtooth", 150, 26, 1.7, 0.4, 0.12);
    noise(1.2, 0.25, 300, 0.1);
  },
  rumble() {
    osc("sine", 92, 24, 0.95, 0.7);
    osc("sine", 46, 20, 1.1, 0.5, 0.04);
    noise(0.8, 0.3, 240, 0.02);
  },
  jump() {
    osc("sine", 240, 520, 0.12, 0.16);
  },
  portal() {
    osc("sine", 1400, 220, 0.35, 0.3);
    osc("sawtooth", 2200, 320, 0.3, 0.14);
    noise(0.28, 0.2, 2600, 0, "highpass");
  },
  headshot() {
    osc("square", 1800, 2400, 0.06, 0.2);
    osc("square", 2400, 3100, 0.08, 0.16, 0.05);
  },
  boom() {
    osc("sine", 120, 26, 0.7, 0.8);
    noise(0.6, 0.5, 700);
    osc("sawtooth", 60, 22, 0.8, 0.4, 0.04);
  },
  land() {
    noise(0.08, 0.24, 480);
  },
  crack() {
    noise(0.06, 0.5, 5200, 0, "highpass");
    osc("square", 720, 90, 0.055, 0.22);
  },
  step() {
    noise(0.05, 0.1, 520);
    osc("sine", 92, 58, 0.05, 0.09);
  },
  switch() {
    osc("square", 340, 720, 0.06, 0.18);
  },
  start() {
    osc("square", 392, 392, 0.09, 0.26);
    osc("square", 523, 523, 0.09, 0.26, 0.1);
    osc("square", 659, 659, 0.2, 0.26, 0.2);
  },
  evolve() {
    osc("square", 330, 330, 0.08, 0.22);
    osc("square", 494, 494, 0.08, 0.22, 0.09);
    osc("square", 659, 659, 0.08, 0.22, 0.18);
    osc("square", 988, 988, 0.18, 0.24, 0.27);
    osc("sawtooth", 1976, 2700, 0.28, 0.09, 0.3);
    noise(0.32, 0.14, 2800, 0.27, "highpass");
  },
  well() {
    osc("sine", 420, 90, 0.4, 0.3);
    osc("sawtooth", 210, 55, 0.45, 0.14, 0.03);
  },
  ric() {
    osc("square", 1500, 520, 0.07, 0.16);
    osc("sine", 2300, 950, 0.05, 0.11);
  },
  fanfare() {
    osc("square", 660, 660, 0.08, 0.24);
    osc("square", 880, 880, 0.08, 0.24, 0.08);
    osc("square", 1320, 1320, 0.16, 0.24, 0.16);
  },
  launch() {
    noise(0.5, 0.6, 1500);
    osc("sine", 240, 950, 0.42, 0.3);
  },
  shotgun() {
    noise(0.32, 1.0, 1100);
    osc("sine", 140, 38, 0.3, 0.8);
    osc("square", 700, 90, 0.1, 0.2);
  },
  nuke() {
    osc("sine", 70, 22, 1.6, 0.9);
    noise(1.5, 0.6, 900);
    osc("sawtooth", 130, 36, 1.2, 0.35, 0.12);
  },
  charge() {
    osc("sawtooth", 80, 230, 0.5, 0.3);
    noise(0.4, 0.2, 500);
  },
  boss() {
    osc("sawtooth", 62, 62, 0.8, 0.5);
    osc("sawtooth", 93, 93, 0.8, 0.4, 0.05);
    osc("sawtooth", 124, 60, 1.2, 0.35, 0.4);
    noise(1.4, 0.3, 240, 0.2);
  },
};

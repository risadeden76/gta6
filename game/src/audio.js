// Synthesised sound with plain WebAudio: no audio files, no network. Engine
// hum follows the car's speed, the siren wails while the police are after
// you, and a quiet synthwave loop plays under everything.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let started = false;
  let musicOn = true;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function blip(freq, duration, type, volume, slideTo) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  // A slow synthwave loop: bass notes with a soft pad on top.
  const bassLine = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
  const padChords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [146.83, 220, 293.66]];
  let beat = 0;

  function musicStep() {
    if (!ctx || !musicOn) return;
    const bass = bassLine[beat % bassLine.length];
    blip(bass, 0.42, 'triangle', 0.16);
    if (beat % 4 === 0) {
      const chord = padChords[(beat / 4 | 0) % padChords.length];
      chord.forEach((freq) => blip(freq, 1.6, 'sine', 0.045));
    }
    if (beat % 8 === 4) blip(880, 0.18, 'sine', 0.05, 1320);
    beat += 1;
  }

  return {
    start() {
      if (started) return;
      if (!ensure()) return;
      started = true;
      if (ctx.state === 'suspended') ctx.resume();
      // Engine: a low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: two alternating tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      let sirenHigh = false;
      setInterval(() => {
        if (!ctx || !sirenOsc) return;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 650, ctx.currentTime, 0.05);
      }, 420);
      musicTimer = setInterval(musicStep, 460);
    },
    engine(speed01, driving) {
      if (!ctx || !engineGain) return;
      const target = driving ? 0.05 + speed01 * 0.11 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(48 + speed01 * 130, ctx.currentTime, 0.08);
    },
    siren(on) {
      if (!ctx || !sirenGain) return;
      sirenGain.gain.setTargetAtTime(on ? 0.05 : 0, ctx.currentTime, 0.2);
    },
    shot() {
      if (!ctx) return;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(0.14);
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 900;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
      blip(180, 0.08, 'square', 0.2, 60);
    },
    pickup() { blip(660, 0.12, 'sine', 0.22, 990); },
    cash() { blip(880, 0.1, 'sine', 0.2); setTimeout(() => blip(1318, 0.16, 'sine', 0.2), 90); },
    jingle() {
      [523, 659, 784, 1046].forEach((freq, i) => setTimeout(() => blip(freq, 0.22, 'triangle', 0.22), i * 110));
    },
    crash() {
      if (!ctx) return;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(0.3);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.6, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    },
    toggleMusic() {
      musicOn = !musicOn;
      return musicOn;
    },
  };
}

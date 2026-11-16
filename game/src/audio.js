export function createAudio() {
  let context = null;
  let master = null;

  function unlock() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.18;
    master.connect(context.destination);
  }

  function tone(startHz, endHz, duration, type = 'triangle', volume = 0.22) {
    if (!context) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startHz, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endHz), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  function noise(duration, volume, lowpass) {
    if (!context) return;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  return {
    unlock,
    shot(kind = 'rifle') {
      if (!context) return;
      noise(kind === 'shotgun' ? 0.19 : 0.12, kind === 'shotgun' ? 0.44 : 0.31, 1500);
      tone(kind === 'shotgun' ? 110 : 150, 42, 0.16, 'sawtooth', 0.11);
    },
    hit() { tone(880, 480, 0.09, 'sine', 0.18); },
    plant() { tone(430, 770, 0.34, 'triangle', 0.19); },
    defuse() { tone(640, 250, 0.5, 'sine', 0.18); },
    round(won) {
      tone(won ? 520 : 220, won ? 920 : 120, 0.65, won ? 'triangle' : 'sawtooth', 0.22);
    },
    grenade() { tone(270, 60, 0.32, 'sawtooth', 0.24); },
  };
}

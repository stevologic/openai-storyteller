/** A tiny asset-free ambient soundscape: a slow, warm pad built from detuned
 *  oscillators with a gentle wandering filter. Kept intentionally quiet. */
export class Ambient {
  private ctx: AudioContext | null = null;
  private nodes: AudioNode[] = [];
  private master: GainNode | null = null;
  playing = false;

  start() {
    if (this.playing) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.master = master;

    // A soft low-pass to keep it dreamy.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.6;
    filter.connect(master);

    // Chord: a warm suspended pad (C, G, D, E).
    const freqs = [130.81, 196.0, 293.66, 329.63];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      osc.detune.value = (i - 1.5) * 4;

      const g = ctx.createGain();
      g.gain.value = 0.12 / freqs.length;

      // Slow tremolo so the pad breathes.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.017;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.05 / freqs.length;
      lfo.connect(lfoGain).connect(g.gain);

      osc.connect(g).connect(filter);
      osc.start();
      lfo.start();
      this.nodes.push(osc, lfo, g, lfoGain);
    });

    // Wandering filter cutoff for movement.
    const fLfo = ctx.createOscillator();
    fLfo.frequency.value = 0.03;
    const fLfoGain = ctx.createGain();
    fLfoGain.gain.value = 260;
    fLfo.connect(fLfoGain).connect(filter.frequency);
    fLfo.start();
    this.nodes.push(fLfo, fLfoGain, filter);

    // Fade in.
    master.gain.setTargetAtTime(0.5, ctx.currentTime, 1.5);
    this.playing = true;
  }

  stop() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    setTimeout(() => {
      this.nodes.forEach((n) => {
        try {
          (n as OscillatorNode).stop?.();
        } catch {
          /* ignore */
        }
        n.disconnect();
      });
      this.nodes = [];
      ctx.close();
      this.ctx = null;
      this.master = null;
    }, 700);
    this.playing = false;
  }

  toggle(): boolean {
    if (this.playing) this.stop();
    else this.start();
    return this.playing;
  }
}

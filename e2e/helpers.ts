import { Page } from '@playwright/test';

/** Mock AudioContext so audio-dependent flows work in headless browser */
export async function mockAudioContext(page: Page) {
  await page.addInitScript(() => {
    const noop = () => {};
    const mockNode = {
      connect: () => mockNode,
      disconnect: noop,
      start: noop,
      stop: noop,
      gain: { value: 1, setValueAtTime: noop, linearRampToValueAtTime: noop, exponentialRampToValueAtTime: noop, cancelScheduledValues: noop },
      frequency: { value: 440 },
      type: 'sine',
      buffer: null,
      fftSize: 256,
      smoothingTimeConstant: 0.8,
      frequencyBinCount: 128,
      getByteTimeDomainData: noop,
      Q: { value: 0 },
    };
    (window as any).AudioContext = class {
      state = 'running';
      currentTime = 0;
      sampleRate = 44100;
      destination = mockNode;
      createGain() { return { ...mockNode }; }
      createOscillator() { return { ...mockNode }; }
      createBuffer() { return {}; }
      createBufferSource() { return { ...mockNode }; }
      createAnalyser() { return { ...mockNode }; }
      createBiquadFilter() { return { ...mockNode }; }
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
    };
    (window as any).webkitAudioContext = (window as any).AudioContext;
  });
}

/** Set state with FRE complete + optional flags */
export async function setState(page: Page, overrides: Record<string, any> = {}) {
  await page.evaluate((opts) => {
    const raw = localStorage.getItem('ear-trainer-state');
    const state = raw ? JSON.parse(raw) : {};
    if (!state.settings) state.settings = {};
    state.settings.hasCompletedFRE = true;
    Object.assign(state.settings, opts);
    state.version = 4;
    localStorage.setItem('ear-trainer-state', JSON.stringify(state));
  }, overrides);
}

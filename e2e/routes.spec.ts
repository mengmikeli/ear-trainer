import { test, expect } from '@playwright/test';
import { mockAudioContext } from './helpers';

const routes = [
  '/',
  '/quiz',
  '/quiz/intervals',
  '/quiz/chords',
  '/quiz/scales',
  '/quiz/modes',
  '/quiz/adaptive',
  '/quiz/path/beginner',
  '/quiz/path/blues',
  '/quiz/path/jazz',
  '/quiz/path/advanced',
  '/progress',
  '/settings',
  '/welcome',
  '/lab',
  '/lab/ascii',
  '/lab/chords',
  '/lab/scales',
];

const defaultState = {
  version: 4,
  settings: {
    hasCompletedFRE: true,
    devMode: true,
    toneType: 'epiano',
    sessionLength: 20,
    theme: 'dark',
    enabledModes: { ascending: true, descending: true, harmonic: true },
    enabledVoicings: { root: true, first: false, second: false },
    unlockedPacks: ['advanced'],
  },
  definitions: { intervals: {}, chords: {}, scales: {}, modes: {} },
  stats: {},
  globalStats: {
    totalSessions: 0,
    totalQuestions: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastPractice: 0,
  },
  sessionHistory: [],
};

for (const route of routes) {
  test(`route ${route} renders content`, async ({ page }) => {
    await mockAudioContext(page);

    // For /welcome, set hasCompletedFRE: false so it actually renders the welcome page
    const state =
      route === '/welcome'
        ? {
            ...defaultState,
            settings: { ...defaultState.settings, hasCompletedFRE: false },
          }
        : defaultState;

    await page.addInitScript((s) => {
      localStorage.setItem('ear-trainer-state', JSON.stringify(s));
    }, state);

    await page.goto(route);
    await page.waitForTimeout(2000);

    // Page should have meaningful content (more than just the bootstrap script)
    const elementCount = await page.evaluate(
      () => document.querySelectorAll('*').length,
    );
    expect(elementCount).toBeGreaterThan(50); // blank pages have ~46 elements (bootstrap only)
  });
}

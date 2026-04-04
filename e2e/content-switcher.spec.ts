import { test, expect } from '@playwright/test';
import { mockAudioContext } from './helpers';

// Helper: set state before navigation via addInitScript
async function setupDevMode(page: import('@playwright/test').Page, activeContent = 'adaptive') {
	await mockAudioContext(page);
	await page.addInitScript((content) => {
		const state = {
			version: 4,
			settings: { hasCompletedFRE: true, devMode: true, activeContent: content, toneType: 'epiano', sessionLength: 20, theme: 'dark', enabledModes: { ascending: true, descending: true, harmonic: true }, enabledVoicings: { root: true, first: false, second: false } },
			definitions: { intervals: {}, chords: {}, scales: {}, modes: {} },
			stats: {},
			globalStats: { totalSessions: 0, totalQuestions: 0, currentStreak: 0, bestStreak: 0, lastPractice: 0 },
			sessionHistory: [],
		};
		localStorage.setItem('ear-trainer-state', JSON.stringify(state));
	}, activeContent);
}

test('content switcher toggles in dev mode', async ({ page }) => {
	await setupDevMode(page);
	await page.goto('/');

	await expect(page.locator('.home')).toBeVisible({ timeout: 10000 });

	const chordTile = page.locator('.content-tile', { hasText: 'CHORDS' });
	await expect(chordTile).toBeVisible({ timeout: 5000 });

	await chordTile.click();
	await expect(chordTile).toHaveClass(/active/);

	await chordTile.click();
	await expect(chordTile).not.toHaveClass(/active/);
});

test('GO routes to /quiz/intervals when INTERVALS selected', async ({ page }) => {
	await setupDevMode(page, 'intervals');
	await page.goto('/');

	await expect(page.locator('.go-btn')).toBeVisible({ timeout: 10000 });
	await page.locator('.go-btn').click();
	await page.waitForURL('**/quiz/intervals', { timeout: 10000 });
});

test('GO routes to /quiz/chords when CHORDS selected', async ({ page }) => {
	await setupDevMode(page, 'chords');
	await page.goto('/');

	await expect(page.locator('.go-btn')).toBeVisible({ timeout: 10000 });
	await page.locator('.go-btn').click();
	await page.waitForURL('**/quiz/chords', { timeout: 10000 });
});

test('GO routes to /quiz (adaptive) when nothing selected', async ({ page }) => {
	await setupDevMode(page, 'adaptive');
	await page.goto('/');

	await expect(page.locator('.go-btn')).toBeVisible({ timeout: 10000 });
	await page.locator('.go-btn').click();
	await page.waitForURL(/\/quiz$/, { timeout: 10000 });
});

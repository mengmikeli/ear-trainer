import { test, expect } from '@playwright/test';
import { mockAudioContext } from './helpers';

test('FRE redirects new user to welcome', async ({ page }) => {
	await mockAudioContext(page);
	await page.goto('/');
	await page.evaluate(() => localStorage.clear());
	await page.goto('/');
	await page.waitForURL('**/welcome');
	await expect(page.locator('.terminal-line').first()).toBeVisible({ timeout: 10000 });
});

test.skip('FRE completes and goes to quiz', async ({ page }) => {
	// TODO: Audio mock not complete enough for full FRE flow in headless.
	// The controller's play() requires AudioContext to produce real nodes.
	// Skipped until we have a proper audio mock or test fixture.
	await mockAudioContext(page);
	await page.goto('/');
	await page.evaluate(() => localStorage.clear());
	await page.goto('/');
	await page.waitForURL('**/welcome');

	// Dismiss terminal
	await expect(page.locator('.terminal-screen')).toBeVisible({ timeout: 10000 });
	await page.locator('.terminal-screen').click({ force: true });

	// Play
	await expect(page.locator('.play-tap')).toBeVisible({ timeout: 5000 });
	await page.locator('.play-tap').click();
	await page.waitForTimeout(2000);

	// Answer Q1 — answers may need time to enable after audio plays
	const answers = page.locator('.answer:not([disabled])');
	await expect(answers.first()).toBeVisible({ timeout: 10000 });
	await answers.first().click();
	await page.waitForTimeout(2500);

	// Dismiss terminal if shown
	const terminal = page.locator('.terminal-screen');
	if (await terminal.isVisible()) {
		await terminal.click({ force: true });
		await page.waitForTimeout(500);
	}

	// Play Q2
	await page.locator('.play-tap').click();
	await page.waitForTimeout(1000);

	// Answer Q2
	await page.locator('.answer:not([disabled])').first().click();

	// Should navigate to /quiz
	await page.waitForURL('**/quiz', { timeout: 15000 });
});

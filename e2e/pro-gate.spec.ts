import { test, expect } from '@playwright/test';

test('locked items show LockedCard on progress page', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => {
		const raw = localStorage.getItem('ear-trainer-state');
		const state = raw ? JSON.parse(raw) : {};
		if (!state.settings) state.settings = {};
		state.settings.hasCompletedFRE = true;
		state.settings.devMode = false;
		state.settings.proUnlocked = false;
		localStorage.setItem('ear-trainer-state', JSON.stringify(state));
	});
	await page.goto('/progress');

	// Should have at least one LockedCard (tier 3+ intervals are pro-gated)
	await expect(page.locator('.locked-card').first()).toBeVisible({ timeout: 10000 });
	await expect(page.locator('.lock-label').first()).toContainText('PRO');
});

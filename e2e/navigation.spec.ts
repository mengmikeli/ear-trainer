import { test, expect } from '@playwright/test';

async function skipFRE(page: import('@playwright/test').Page) {
	await page.goto('/');
	await page.evaluate(() => {
		const raw = localStorage.getItem('ear-trainer-state');
		const state = raw ? JSON.parse(raw) : {};
		if (!state.settings) state.settings = {};
		state.settings.hasCompletedFRE = true;
		localStorage.setItem('ear-trainer-state', JSON.stringify(state));
	});
}

test('navigate between pages', async ({ page }) => {
	await skipFRE(page);
	await page.goto('/');

	// Home page visible
	await expect(page.locator('.home')).toBeVisible({ timeout: 10000 });

	// Navigate to progress via bottom nav (mobile viewport — side-nav is hidden)
	await page.locator('.bottom-nav a:has-text("PROGRESS")').click();
	await expect(page.locator('.progress-page')).toBeVisible({ timeout: 5000 });

	// Navigate to settings
	await page.locator('.bottom-nav a:has-text("SETTINGS")').click();
	await expect(page.locator('.settings-page')).toBeVisible({ timeout: 5000 });

	// Navigate back to home
	await page.locator('.bottom-nav a:has-text("PRACTICE")').click();
	await expect(page.locator('.home')).toBeVisible({ timeout: 5000 });
});

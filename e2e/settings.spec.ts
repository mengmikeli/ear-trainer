import { test, expect } from '@playwright/test';

test('settings persist across reload', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => {
		const raw = localStorage.getItem('ear-trainer-state');
		const state = raw ? JSON.parse(raw) : {};
		if (!state.settings) state.settings = {};
		state.settings.hasCompletedFRE = true;
		localStorage.setItem('ear-trainer-state', JSON.stringify(state));
	});
	await page.goto('/settings');

	// Session length section — toggle buttons are inside .toggle-group
	// Default is 20, click 10
	const btn10 = page.locator('.toggle-group button:has-text("10")');
	await expect(btn10).toBeVisible({ timeout: 10000 });
	await btn10.click();

	// Should become active
	await expect(btn10).toHaveClass(/active/);

	// Reload
	await page.reload();

	// Should still be 10 (persisted via localStorage)
	await expect(page.locator('.toggle-group button:has-text("10")')).toHaveClass(/active/, { timeout: 5000 });
});

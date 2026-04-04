import { test, expect } from '@playwright/test';

test('content switcher toggles in dev mode', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => {
		const raw = localStorage.getItem('ear-trainer-state');
		const state = raw ? JSON.parse(raw) : {};
		if (!state.settings) state.settings = {};
		state.settings.hasCompletedFRE = true;
		state.settings.devMode = true;
		localStorage.setItem('ear-trainer-state', JSON.stringify(state));
	});
	await page.goto('/');

	// Wait for home page to load
	await expect(page.locator('.home')).toBeVisible({ timeout: 10000 });

	// Content tiles should be visible — find the CHORDS tile by its full label text
	const chordTile = page.locator('.content-tile', { hasText: 'CHORDS' });
	await expect(chordTile).toBeVisible({ timeout: 5000 });

	// Click CHORDS — should become active
	await chordTile.click();
	await expect(chordTile).toHaveClass(/active/);

	// Click CHORDS again — should deselect (back to adaptive)
	await chordTile.click();
	await expect(chordTile).not.toHaveClass(/active/);
});

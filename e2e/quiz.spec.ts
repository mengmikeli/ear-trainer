import { test, expect } from '@playwright/test';
import { mockAudioContext, setState } from './helpers';

test('quiz loads and shows play button', async ({ page }) => {
	await mockAudioContext(page);
	await page.goto('/');
	await setState(page);
	await page.goto('/quiz');

	await expect(page.locator('.play-tap')).toBeVisible({ timeout: 10000 });
	await expect(page.locator('.heading')).toHaveText(/PRACTICE/i);
});

test('quiz play and answer flow', async ({ page }) => {
	await mockAudioContext(page);
	await page.goto('/');
	await setState(page);
	await page.goto('/quiz');

	// Click play
	await expect(page.locator('.play-tap')).toBeVisible({ timeout: 10000 });
	await page.locator('.play-tap').click();
	await page.waitForTimeout(1000);

	// Answer buttons should be enabled
	const answers = page.locator('.answer:not([disabled])');
	await expect(answers.first()).toBeVisible({ timeout: 5000 });

	// Click an answer
	await answers.first().click();

	// Should see feedback
	await expect(page.locator('.play-tap')).toHaveClass(/feedback/, { timeout: 5000 });
});

import { test, expect } from '@playwright/test';

test.describe('Slime Game - Smoke Tests', () => {

  test('game loads successfully', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('link', { name: 'Start Playing ➔' })
    ).toBeVisible();
  });

  test('Cozy Garden can be opened', async ({ page }) => {
    await page.goto('/');

    await page
      .getByRole('link', { name: 'Start Playing ➔' })
      .click();

    await page
      .getByRole('button', { name: '▶ PLAY COZY GARDEN' })
      .click();

    await expect(
      page.getByRole('button', {
        name: 'PLAY SINGLE PLAYER ➔'
      })
    ).toBeVisible();
  });

});
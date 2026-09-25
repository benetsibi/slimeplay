import { test, expect } from '@playwright/test';

test.describe('Cozy Garden', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        await page
            .getByRole('link', { name: 'Start Playing ➔' })
            .click();

        await page
            .getByRole('button', {
                name: '▶ PLAY COZY GARDEN'
            })
            .click();

        await page
            .getByRole('button', {
                name: 'PLAY SINGLE PLAYER ➔'
            })
            .click();
    });

    test('game canvas is displayed', async ({ page }) => {
        const canvas = page.locator('#game-canvas');

        await expect(canvas).toBeVisible();
    });

    test('player can interact with game', async ({ page }) => {
        const canvas = page.locator('#game-canvas');

        await expect(canvas).toBeVisible();

        await canvas.click({
            position: {
                x: 638,
                y: 365
            }
        });

        await page.waitForTimeout(1000);

        await expect(canvas).toBeVisible();
    });

    test('opening room link auto-fills code and connects in Cozy Garden', async ({ page }) => {
        await page.goto('/?room=SLIME-BUDDY');
        const joinInput = page.locator('#join-code-input');
        await expect(joinInput).toHaveValue('SLIME-BUDDY');
        const guestBox = page.locator('#guest-join-status');
        await expect(guestBox).toBeVisible();
    });

});
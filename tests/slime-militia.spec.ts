import { test, expect } from '@playwright/test';

test.describe('Slime Militia', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        await page
            .getByRole('link', { name: 'Start Playing ➔' })
            .click();

        await page
            .getByRole('button', {
                name: '▶ PLAY SLIME MILITIA'
            })
            .click();
    });

    test('battle room can be created and link can be copied', async ({ page }) => {
        await page
            .getByRole('button', {
                name: 'CREATE BATTLE ROOM 🔥'
            })
            .click();

        await expect(
            page.getByRole('button', {
                name: /DEPLOY BATTLE/
            })
        ).toBeVisible();

        const copyBtn = page.locator('#militia-copy-link-btn');
        await expect(copyBtn).toBeVisible();
    });

    test('militia canvas is displayed', async ({ page }) => {
        const canvas = page.locator('#militia-canvas');
        await expect(canvas).toBeVisible();
    });

    test('opening invite URL automatically fills room code and connects', async ({ page }) => {
        await page.goto('/?militia=MILITIA-SQUAD');
        const joinInput = page.locator('#militia-join-input');
        await expect(joinInput).toHaveValue('MILITIA-SQUAD');
        const guestStatus = page.locator('#militia-guest-status');
        await expect(guestStatus).toBeVisible();
    });

    test('mobile touch controls: bottom-left joystick and bottom-right shoot button are visible', async ({ page }) => {
        await page.setViewportSize({ width: 844, height: 390 }); // iPhone landscape
        await page.evaluate(() => {
            document.body.classList.add('mobile-device');
        });

        const touchOverlay = page.locator('#militia-touch-overlay');
        await expect(touchOverlay).toBeVisible();

        const joystick = page.locator('#militia-virtual-joystick');
        await expect(joystick).toBeVisible();

        const shootBtn = page.locator('#militia-touch-shoot');
        await expect(shootBtn).toBeVisible();

        const jetpackBtn = page.locator('#militia-touch-jetpack');
        await expect(jetpackBtn).toBeVisible();

        const grenadeBtn = page.locator('#militia-touch-grenade');
        await expect(grenadeBtn).toBeVisible();
    });

});
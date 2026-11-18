import { test, expect } from '@playwright/test';

test.describe('Connection Status Card, Telemetry & Auto-Recovery Flow', () => {
  test('displays real-time Connected status, popover diagnostics, single socket across route changes, and auto-recovers on reconnect', async ({
    page,
    context,
  }) => {
    let socketConnectionsCount = 0;

    page.on('websocket', (ws) => {
      if (ws.url().includes('socket.io')) {
        socketConnectionsCount++;
      }
    });

    // 1. Visit Login Page & Sign In
    console.log('[Spec] 1. Logging in...');
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@proctoriq.io');
    await page.fill('input[type="password"]', 'ProctorIQ#2026');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/home**', { timeout: 15000 });
    console.log('[Spec] 1. Logged in successfully.');

    // 2. Assert Status Card displays CONNECTED with emerald dot and live MySQL version
    console.log('[Spec] 2. Checking status card...');
    const statusCard = page.locator('[data-testid="sidebar-status-card"]');
    await expect(statusCard).toBeVisible({ timeout: 10000 });
    await expect(statusCard).toContainText('CONNECTED');
    await expect(statusCard).toContainText('MySQL');
    await expect(statusCard).toContainText('WSS');

    // Verify emerald pulsing dot is rendered
    const emeraldDot = statusCard.locator('.bg-emerald-500');
    await expect(emeraldDot).toBeVisible();
    console.log('[Spec] 2. Status card verified.');

    // 3. Click status card to open solid diagnostics popover
    console.log('[Spec] 3. Testing diagnostics popover...');
    await statusCard.click();
    const popover = page.locator('[data-testid="connection-status-popover"]');
    await expect(popover).toBeVisible({ timeout: 5000 });
    await expect(popover).toContainText('Node Telemetry');
    await expect(popover).toContainText('Socket.IO');
    await expect(popover).toContainText('REST API');
    await expect(popover).toContainText('200 OK');
    await expect(popover).toContainText('MySQL DBMS');

    // Close popover via escape
    await page.keyboard.press('Escape');
    await expect(popover).not.toBeVisible();
    console.log('[Spec] 3. Diagnostics popover verified and closed.');

    // 4. Test Route Changes: Verify exactly ONE socket connection is maintained (no duplicates on route navigation)
    console.log('[Spec] 4. Testing route changes...');
    const initialSocketCount = socketConnectionsCount;
    expect(initialSocketCount).toBeGreaterThanOrEqual(1);

    await page.locator('aside a[href="/proctor"]').first().click();
    await page.waitForURL('**/proctor**');
    await page.locator('aside a[href="/admin"]').first().click();
    await page.waitForURL('**/admin**');
    await page.locator('aside a[href="/home"]').first().click();
    await page.waitForURL('**/home**');

    // Socket connections count should remain identical (no duplicate socket on route change)
    expect(socketConnectionsCount).toBe(initialSocketCount);
    console.log('[Spec] 4. Route changes tested. Socket count kept constant:', initialSocketCount);

    // 5. Simulate Network Disconnect / Drop
    console.log('[Spec] 5. Simulating network disconnect...');
    await context.setOffline(true);

    // Status card should transition to RECONNECTING or DISCONNECTED (amber or rose)
    await expect(statusCard).toContainText(/RECONNECTING|DISCONNECTED/, { timeout: 15000 });
    console.log('[Spec] 5. Disconnect detected.');

    // 6. Simulate Network Recovery
    console.log('[Spec] 6. Simulating network recovery...');
    await context.setOffline(false);

    // Status card should automatically recover to CONNECTED without page reload
    await expect(statusCard).toContainText('CONNECTED', { timeout: 15000 });
    await expect(statusCard.locator('.bg-emerald-500')).toBeVisible();
    console.log('[Spec] 6. Recovery verified.');
  });
});

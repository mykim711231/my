import { expect, test } from '@playwright/test';

// REQ-00: 수용 기준마다 E2E 하나(기준 구현 예시)
test('첫 화면이 열린다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.+/);
});

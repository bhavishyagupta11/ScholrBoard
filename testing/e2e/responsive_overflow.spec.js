import { test, expect } from '@playwright/test';
import { loginViaUI } from '../helpers/auth.js';

const viewports = [
  { name: 'Mobile (320px)', width: 320, height: 568 },
  { name: 'Mobile (375px)', width: 375, height: 667 },
  { name: 'Mobile (390px)', width: 390, height: 844 },
  { name: 'Tablet (768px)', width: 768, height: 1024 },
  { name: 'Laptop (1024px)', width: 1024, height: 768 },
  { name: 'Desktop (1440px)', width: 1440, height: 900 }
];

test.describe('Responsive Design Layout and Overflow Audits', () => {
  
  test('Landing Page Responsive Flow', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200); // allow layout reflow

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      console.log(`Landing Page at ${vp.name}: overflow = ${hasOverflow}`);
      expect(hasOverflow).toBe(false);
    }
  });

  test('Student Dashboard Responsive Flow', async ({ page }) => {
    await loginViaUI(page, 'student');
    await page.goto('/student/dashboard');
    await page.waitForTimeout(1000);

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200);

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      console.log(`Student Dashboard at ${vp.name}: overflow = ${hasOverflow}`);
      expect(hasOverflow).toBe(false);
    }
  });

  test('Student Developer Dashboard Responsive Flow', async ({ page }) => {
    await loginViaUI(page, 'student');
    await page.goto('/student/developer');
    await page.waitForTimeout(1000);

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200);

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      console.log(`Developer Dashboard at ${vp.name}: overflow = ${hasOverflow}`);
      expect(hasOverflow).toBe(false);
    }
  });

  test('Admin Talent Discovery Responsive Flow', async ({ page }) => {
    await loginViaUI(page, 'admin');
    await page.goto('/admin/talent-discovery');
    await page.waitForSelector('table', { timeout: 15000 });

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(500); // Allow reflow

      const overflowData = await page.evaluate(() => {
        const hasOverflow = document.documentElement.scrollWidth > window.innerWidth;
        const elements = [];
        if (hasOverflow) {
          document.querySelectorAll('*').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.right > window.innerWidth + 1) { // 1px threshold for subpixel rounding
              const classNameStr = typeof el.className === 'string' ? el.className : (el.className.animVal || '');
              elements.push({
                tag: el.tagName.toLowerCase(),
                id: el.id ? `#${el.id}` : '',
                classes: classNameStr ? `.${classNameStr.trim().replace(/\s+/g, '.')}` : '',
                width: rect.width,
                right: rect.right
              });
            }
          });
        }
        return { hasOverflow, elements };
      });

      console.log(`Talent Discovery at ${vp.name}: overflow = ${overflowData.hasOverflow}`);
      if (overflowData.hasOverflow) {
        console.log('Overflowing elements details:', JSON.stringify(overflowData.elements.slice(0, 10), null, 2));
      }
      expect(overflowData.hasOverflow).toBe(false);
    }
  });
});

import { expect, test } from '@playwright/test';

test.describe('Public smoke', () => {
  test('landing page renders CTA', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText(/Orchestrate Your Life/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Begin Journey/i })).toBeVisible();
  });

  test('login page renders form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
    await expect(page.getByPlaceholder('Enter your email')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
  });

  test('register page shows pricing plans', async ({ page }) => {
    await page.goto('/register');

    await expect(page.getByRole('heading', { name: /Create Account/i })).toBeVisible();
    await expect(page.getByText('Explorer')).toBeVisible();
    await expect(page.getByText('Ultra')).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Account/i })).toBeVisible();
  });

  test('protected route redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';

test('add a product immediately, update quantities, remove items, and retain the cart after reload', async ({
  page,
}) => {
  await page.goto('/products');
  await expect(page.locator('#qty-1')).toHaveText('1');
  await expect(page.locator('#add-to-cart-1')).toBeEnabled();
  await page.locator('#add-to-cart-1').click();

  await expect(page.getByRole('link', { name: 'View cart, 1 item' })).toBeVisible();
  await page.getByRole('link', { name: 'View cart, 1 item' }).click();

  const cartItem = page.locator('[data-cart-product-id="1"]');
  await expect(cartItem).toContainText('SmartFeeder One');
  await expect(page.getByTestId('cart-total')).toHaveText('$97.49');

  await page.getByRole('button', { name: 'Increase quantity of SmartFeeder One' }).click();
  await expect(page.getByTestId('cart-total')).toHaveText('$194.98');

  await page.reload();
  await expect(page.locator('[data-cart-product-id="1"]')).toContainText('2');
  await expect(page.getByTestId('cart-total')).toHaveText('$194.98');

  await page.getByRole('button', { name: 'Remove SmartFeeder One' }).click();
  await expect(page.getByText('Your cart is empty')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View cart, 0 items' })).toBeVisible();
});

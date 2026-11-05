/**
 * Playwright E2E Tests for Universal Prensados
 */

import { test, expect } from '@playwright/test';

test.describe('Universal Prensados - Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should load homepage successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/Universal Prensados/);
    await expect(page.locator('h1')).toContainText('dog prensado');
  });

  test('should have working navigation', async ({ page }) => {
    // No mobile os links ficam atrás do botão de menu
    if (await page.locator('#menu-toggle').isVisible()) {
      await page.click('#menu-toggle');
    }
    // Check navigation links exist
    await expect(page.locator('nav a[href="#cardapio"]')).toBeVisible();
    await expect(page.locator('nav a[href="#diferenciais"]')).toBeVisible();
    await expect(page.locator('nav a[href="#avaliacoes"]')).toBeVisible();
    await expect(page.locator('nav a[href="#contato"]')).toBeVisible();
  });

  test('should display hero showcase with real product photos', async ({ page }) => {
    const main = page.locator('.hero-stage__main img');
    await expect(main).toBeVisible();
    await expect.poll(() => main.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(page.locator('#store-status-text')).toHaveText(/Aberto|Fechado/);
  });

  test('should display product categories tabs', async ({ page }) => {
    await page.locator('#cardapio').scrollIntoViewIfNeeded();
    await expect(page.locator('.menu-tab-btn')).toHaveCount(6);
    await expect(page.locator('.menu-tab-btn[data-category="todos"]')).toHaveClass(/active/);
  });

  test('should filter products by category', async ({ page }) => {
    await page.locator('#cardapio').scrollIntoViewIfNeeded();
    
    // Click on "Especiais" tab
    await page.click('.menu-tab-btn[data-category="especiais"]');
    await expect(page.locator('.menu-tab-btn[data-category="especiais"]')).toHaveClass(/active/);
    
    // Wait for products to render
    await page.waitForTimeout(500);
    
    // Chicken, Chickão, Egg e Eggzão
    await expect(page.locator('.product-card:visible')).toHaveCount(4);
  });

  test('should open cart drawer when clicking cart button', async ({ page }) => {
    await page.click('#cart-open-btn');
    await expect(page.locator('#cart-drawer')).toHaveClass(/active/);
    await expect(page.locator('#cart-overlay')).toHaveClass(/active/);
  });

  test('should show empty cart message initially', async ({ page }) => {
    await page.click('#cart-open-btn');
    await expect(page.locator('.cart-empty-state')).toBeVisible();
    await expect(page.locator('.cart-empty-state h4')).toContainText('vazio');
  });

  test('should toggle theme', async ({ page }) => {
    const initialTheme = await page.getAttribute('html', 'data-theme');
    
    await page.click('#theme-toggle');
    await page.waitForTimeout(200);
    
    const newTheme = await page.getAttribute('html', 'data-theme');
    expect(newTheme).not.toBe(initialTheme);
    expect(['light', 'dark']).toContain(newTheme);
  });

  test('should have WhatsApp FAB button', async ({ page }) => {
    const fab = page.locator('.whatsapp-fab');
    await expect(fab).toBeVisible();
    await expect(fab).toHaveAttribute('href', /wa\.me/);
  });

  test('should display contact information', async ({ page }) => {
    await page.locator('#contato').scrollIntoViewIfNeeded();
    await expect(page.locator('#contato')).toBeVisible();
    await expect(page.locator('#contato').getByText('Monsenhor Gercino').first()).toBeVisible();
    await expect(page.locator('#contato').getByText('Joinville').first()).toBeVisible();
  });

  test('should have working coupon banner', async ({ page }) => {
    await expect(page.locator('.coupon-banner')).toBeVisible();
    await expect(page.locator('#copy-coupon-btn')).toBeVisible();
    await expect(page.locator('#copy-coupon-btn')).toContainText('Copiar Cupom');
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    
    // Mobile menu toggle should be visible
    await expect(page.locator('#menu-toggle')).toBeVisible();
    
    // Desktop nav should be hidden
    await expect(page.locator('.header__nav')).not.toHaveClass(/open/);
    
    // Click mobile menu toggle
    await page.click('#menu-toggle');
    await expect(page.locator('.header__nav')).toHaveClass(/open/);
  });
});

test.describe('Universal Prensados - Cart & Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should open product customization modal', async ({ page }) => {
    await page.locator('#cardapio').scrollIntoViewIfNeeded();
    
    // Wait for products to render
    await page.waitForTimeout(500);
    
    // Click first "Adicionar ao Pedido" button
    await page.click('.btn--add-cart:first-of-type');
    
    // Modal should open
    await expect(page.locator('#custom-modal-backdrop')).toHaveClass(/active/);
    await expect(page.locator('#modal-item-title')).toBeVisible();
  });

  test('should add item to cart from modal', async ({ page }) => {
    await page.locator('#cardapio').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    
    // Open first product modal
    await page.click('.btn--add-cart:first-of-type');
    
    // Click confirm add button
    await page.click('#modal-confirm-add-btn');
    
    // Modal should close
    await expect(page.locator('#custom-modal-backdrop')).not.toHaveClass(/active/);
    
    // Cart badge should show 1 item
    await expect(page.locator('#cart-count')).toContainText('1');
  });

  test('should apply coupon code', async ({ page }) => {
    // Add item to cart first
    await page.locator('#cardapio').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.click('.btn--add-cart:first-of-type');
    await page.click('#modal-confirm-add-btn');
    
    // Open cart
    await page.click('#cart-open-btn');
    
    // Apply coupon
    await page.fill('#cart-coupon-input', 'BEMVINDO10');
    await page.click('#cart-coupon-apply');
    
    // Should show success message
    await expect(page.locator('#coupon-feedback-msg')).toHaveClass(/success/);
    await expect(page.locator('#coupon-feedback-msg')).toContainText('aplicado');
  });

  test('should proceed to checkout', async ({ page }) => {
    // Add item to cart first
    await page.locator('#cardapio').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.click('.btn--add-cart:first-of-type');
    await page.click('#modal-confirm-add-btn');
    
    // Open cart
    await page.click('#cart-open-btn');
    
    // Click checkout button
    await page.click('#proceed-to-checkout-btn');
    
    // Checkout modal should open
    await expect(page.locator('#checkout-modal-backdrop')).toHaveClass(/active/);
    await expect(page.locator('#checkout-modal-title')).toContainText('Finalizar Pedido');
  });
});

test.describe('Universal Prensados - PWA Features', () => {
  test('should have manifest.json', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response.status()).toBe(200);
    
    const manifest = await response.json();
    expect(manifest.name).toBe('Universal Prensados');
    expect(manifest.short_name).toBe('Univ. Prensados');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
  });

  test('should register service worker', async ({ page }) => {
    await page.goto('/');
    
    // Check if service worker registration is attempted
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        return !!registration;
      }
      return false;
    });
    
    expect(swRegistered).toBe(true);
  });
});
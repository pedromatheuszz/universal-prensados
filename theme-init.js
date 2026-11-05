/**
 * Theme Initialization - FOUC Prevention
 * Runs before any other scripts to prevent flash of unstyled content
 * This script is loaded as a module with nonce for CSP compliance
 */

function initTheme() {
  try {
    const savedTheme = localStorage.getItem("color-scheme");
    const meta = document.querySelector('meta[name="color-scheme"]');
    
    if (savedTheme) {
      if (meta) meta.content = savedTheme;
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } catch (e) {
    // Silently fail - theme will be initialized by main script
    console.warn('[Theme] FOUC prevention failed:', e);
  }
}

// Run immediately
initTheme();

// Listen for storage changes (multi-tab sync)
window.addEventListener('storage', (e) => {
  if (e.key === 'color-scheme' && e.newValue) {
    document.documentElement.setAttribute('data-theme', e.newValue);
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.content = e.newValue;
  }
});

// Export for testing
export { initTheme };
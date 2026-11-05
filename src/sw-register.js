// Registro do Service Worker (antes inline no index.html, o que a CSP bloqueava)
// Só no site publicado: em desenvolvimento o cache do SW serviria código desatualizado
if ('serviceWorker' in navigator && !import.meta.env.PROD) {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        // Verificar atualizações a cada hora
        setInterval(() => registration.update(), 60 * 60 * 1000);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              if (confirm('Uma nova versão do site está disponível. Atualizar agora?')) {
                window.location.reload();
              }
            }
          });
        });
      })
      .catch((error) => {
        console.error('[SW] Falha no registro do Service Worker:', error);
      });
  });
}

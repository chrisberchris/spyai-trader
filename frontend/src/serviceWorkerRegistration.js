export function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((reg) => {
          console.log('SW registered:', reg.scope);

          // Check for updates every 60 seconds
          setInterval(() => reg.update(), 60000);

          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker?.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available — could show a toast here in future
                console.log('New app version available — refresh to update.');
              }
            });
          });
        })
        .catch((err) => console.error('SW registration failed:', err));
    });
  }
}

export function unregisterSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => reg.unregister())
      .catch((err) => console.error(err));
  }
}

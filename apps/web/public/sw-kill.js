// AjitSir Academy — Service Worker Kill-Switch
// Served when NEXT_PUBLIC_DISABLE_SW=true is set in environment.
// Immediately unregisters itself and reloads all clients — cleans up
// any stuck SW within a single browser refresh for all users.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => {
  self.registration.unregister().then(() => {
    self.clients.matchAll({ type: 'window' }).then((clients) =>
      clients.forEach((c) => c.navigate(c.url))
    );
  });
});

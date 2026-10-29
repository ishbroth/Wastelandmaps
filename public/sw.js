// WastelandMaps service worker: lets the app show "Discovered: ..." as a system notification, also when the page is in the background.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((all) => (all[0] ? all[0].focus() : self.clients.openWindow('./'))));
});

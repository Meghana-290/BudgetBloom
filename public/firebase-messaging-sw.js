// Service Worker for Firebase Cloud Messaging (FCM) and Web Push notifications
self.addEventListener('install', (event) => {
  console.log('FCM Service Worker installed.');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('FCM Service Worker activated.');
  event.waitUntil(self.clients.claim());
});

// Handle background notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked: ', event.notification);
  event.notification.close();

  // Enforce tapping notification opens/focuses the BudgetBloom app page
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          // Send message to client to switch page to NOTIFICATIONS
          client.postMessage({ action: 'navigate', page: 'notifications' });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Fallback message listener
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'showNotification') {
    const { title, body, tag } = event.data;
    self.registration.showNotification(title || 'BudgetBloom Reminder', {
      body: body || 'You have an active financial reminder due.',
      icon: '/assets/logo.png',
      badge: '/assets/logo.png',
      tag: tag || 'budgetbloom-reminder',
      requireInteraction: true,
      data: { url: '/notifications' }
    });
  }
});

// Handle background FCM push events
self.addEventListener('push', (event) => {
  console.log('Push event received: ', event);
  let payload = { title: 'BudgetBloom Alert', body: 'New notification from BudgetBloom' };
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      payload = { title: 'BudgetBloom Reminder', body: event.data.text() };
    }
  }

  const title = payload.title || 'BudgetBloom Alert';
  const options = {
    body: payload.body || 'You have an active reminder.',
    icon: '/assets/logo.png',
    badge: '/assets/logo.png',
    tag: payload.tag || 'budgetbloom-alert',
    requireInteraction: true,
    data: { url: '/notifications' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

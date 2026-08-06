/**
 * FCM and Web Push notification client utilities
 */

export async function registerFCM(): Promise<ServiceWorkerRegistration | null> {
  let hasServiceWorker = false;
  try {
    hasServiceWorker = 'serviceWorker' in navigator;
  } catch (e) {
    console.warn('serviceWorker check blocked or failed:', e);
  }

  if (hasServiceWorker) {
    try {
      // Register our custom service worker
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('FCM Service Worker registered successfully with scope:', registration.scope);
      return registration;
    } catch (err) {
      console.error('FCM Service Worker registration failed:', err);
    }
  }
  return null;
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    let hasNotification = false;
    try {
      hasNotification = 'Notification' in window;
    } catch (e) {
      console.warn('Notification check in window failed:', e);
    }

    if (!hasNotification) {
      console.warn('This browser does not support desktop/mobile notification center.');
      return false;
    }

    let permission;
    try {
      permission = Notification.permission;
    } catch (e) {
      console.warn('Blocked reading Notification.permission in iframe sandbox:', e);
      return false;
    }

    if (permission === 'granted') {
      return true;
    }
    if (permission !== 'denied') {
      const result = await Notification.requestPermission();
      return result === 'granted';
    }
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
  }
  return false;
}

export async function triggerPushNotification(title: string, body: string, tag?: string) {
  try {
    let hasNotification = false;
    try {
      hasNotification = 'Notification' in window;
    } catch (e) {
      console.warn('Notification check in window failed:', e);
    }

    if (!hasNotification) {
      console.log('Skipping push notification (unsupported):', title);
      return;
    }

    let permission;
    try {
      permission = Notification.permission;
    } catch (e) {
      console.warn('Blocked reading Notification.permission in iframe sandbox:', e);
      return;
    }

    if (permission !== 'granted') {
      console.log('Skipping push notification (permission not granted):', title);
      return;
    }

    // Prefer using service worker registration so it can run outside active focus context
    let hasServiceWorker = false;
    try {
      hasServiceWorker = 'serviceWorker' in navigator;
    } catch (e) {
      console.warn('serviceWorker check failed:', e);
    }

    if (hasServiceWorker) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && 'showNotification' in registration) {
          registration.showNotification(title, {
            body,
            tag: tag || 'budgetbloom-alert',
            icon: '/assets/logo.png',
            badge: '/assets/logo.png',
            requireInteraction: true,
            data: { url: '/notifications' }
          });
          return;
        }
      } catch (e) {
        console.warn('Failed to trigger notification via Service Worker, falling back to standard web Notification:', e);
      }
    }

    // Standalone fallback
    try {
      new Notification(title, {
        body,
        tag: tag || 'budgetbloom-alert',
        requireInteraction: true
      });
    } catch (err) {
      console.error('Error launching browser notification:', err);
    }
  } catch (outerErr) {
    console.error('Error triggering push notification:', outerErr);
  }
}

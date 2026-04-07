/* global self, clients */

self.addEventListener('push', (event) => {
  const fallback = {
    title: 'Mad Vapers Approvals',
    body: 'A new approval request needs your review.',
    url: '/approvals',
    tag: 'mv-approvals',
  };

  let payload = { ...fallback };
  try {
    if (event.data) {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        payload = { ...fallback, ...parsed };
      }
    }
  } catch {
    try {
      const textBody = event.data ? String(event.data.text() ?? '').trim() : '';
      if (textBody) {
        payload.body = textBody;
      }
    } catch {
      // Ignore malformed payloads and use fallback message.
    }
  }

  const targetUrl = String(payload.url || payload?.data?.path || '/approvals');
  const notificationOptions = {
    body: String(payload.body || fallback.body),
    icon: String(payload.icon || '/icons/notif/notifIcon.png'),
    badge: String(payload.badge || '/icons/notif/notifIcon.png'),
    tag: String(payload.tag || fallback.tag),
    data: {
      ...(payload.data && typeof payload.data === 'object' ? payload.data : {}),
      url: targetUrl,
    },
  };

  event.waitUntil(
    self.registration.showNotification(
      String(payload.title || fallback.title),
      notificationOptions
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const rawUrl = String(data.url || data.path || '/approvals');
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }

      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            return client.navigate(targetUrl).then(() => client.focus());
          }
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});

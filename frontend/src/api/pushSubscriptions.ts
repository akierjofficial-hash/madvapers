import { api } from '../lib/http';

export type PushSubscriptionKeys = {
  p256dh: string;
  auth: string;
};

export type RegisterPushSubscriptionInput = {
  endpoint: string;
  keys: PushSubscriptionKeys;
  content_encoding?: 'aesgcm' | 'aes128gcm';
};

export async function registerPushSubscription(input: RegisterPushSubscriptionInput) {
  const { data } = await api.post<{ status: string; subscription_id?: number }>('/push-subscriptions', input);
  return data;
}

export async function removePushSubscription(endpoint: string) {
  const { data } = await api.delete<{ status: string }>('/push-subscriptions', {
    data: { endpoint },
  });
  return data;
}


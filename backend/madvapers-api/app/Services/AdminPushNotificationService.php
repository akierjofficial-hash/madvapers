<?php

namespace App\Services;

use App\Models\PushSubscription;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

class AdminPushNotificationService
{
    public function sendApprovalRequestNotification(string $body, array $meta = []): void
    {
        $payload = [
            'title' => 'Mad Vapers Approvals',
            'body' => trim($body) !== '' ? trim($body) : 'A new approval request needs review.',
            'url' => '/approvals',
            'tag' => 'mv-approvals',
            'data' => $meta,
            'timestamp' => now()->toIso8601String(),
        ];

        $this->sendToAdminUsers($payload);
    }

    public function sendToAdminUsers(array $payload): void
    {
        if (!config('web_push.enabled', true)) {
            return;
        }

        $subject = trim((string) config('web_push.vapid.subject', ''));
        $publicKey = trim((string) config('web_push.vapid.public_key', ''));
        $privateKey = trim((string) config('web_push.vapid.private_key', ''));

        if ($subject === '' || $publicKey === '' || $privateKey === '') {
            Log::warning('Web Push skipped: missing VAPID configuration.');
            return;
        }

        $adminIds = User::query()
            ->where('is_active', true)
            ->whereHas('role', function ($q) {
                $q->where('code', 'ADMIN');
            })
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if (empty($adminIds)) {
            return;
        }

        $subscriptions = PushSubscription::query()
            ->whereIn('user_id', $adminIds)
            ->orderBy('id')
            ->get();

        if ($subscriptions->isEmpty()) {
            return;
        }

        $webPush = new WebPush([
            'VAPID' => [
                'subject' => $subject,
                'publicKey' => $publicKey,
                'privateKey' => $privateKey,
            ],
        ], [
            'TTL' => 300,
            'urgency' => 'high',
            'topic' => 'mv-approvals',
        ]);
        $webPush->setReuseVAPIDHeaders(true);

        $now = Carbon::now();
        $payloadJson = json_encode($payload, JSON_UNESCAPED_SLASHES);
        if ($payloadJson === false) {
            $payloadJson = json_encode([
                'title' => 'Mad Vapers Approvals',
                'body' => 'A new approval request needs review.',
                'url' => '/approvals',
                'tag' => 'mv-approvals',
            ], JSON_UNESCAPED_SLASHES) ?: null;
        }

        if ($payloadJson === null) {
            return;
        }

        $byEndpointHash = [];

        foreach ($subscriptions as $record) {
            $endpoint = trim((string) $record->endpoint);
            $public = trim((string) $record->public_key);
            $auth = trim((string) $record->auth_token);
            $encoding = trim((string) ($record->content_encoding ?? 'aes128gcm'));
            if ($encoding === '') {
                $encoding = 'aes128gcm';
            }

            if ($endpoint === '' || $public === '' || $auth === '') {
                continue;
            }

            try {
                $subscription = Subscription::create([
                    'endpoint' => $endpoint,
                    'publicKey' => $public,
                    'authToken' => $auth,
                    'contentEncoding' => $encoding,
                ]);

                $webPush->queueNotification($subscription, $payloadJson);
                $byEndpointHash[(string) $record->endpoint_hash] = (int) $record->id;
            } catch (\Throwable $e) {
                Log::warning('Failed to queue web push notification for subscription.', [
                    'subscription_id' => $record->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if (empty($byEndpointHash)) {
            return;
        }

        foreach ($webPush->flush() as $report) {
            $endpoint = (string) $report->getEndpoint();
            $endpointHash = hash('sha256', $endpoint);
            $subscriptionId = $byEndpointHash[$endpointHash] ?? null;

            if (!$report->isSuccess()) {
                if ($report->isSubscriptionExpired()) {
                    PushSubscription::query()
                        ->where('endpoint_hash', $endpointHash)
                        ->delete();
                }

                Log::warning('Web push delivery failed.', [
                    'subscription_id' => $subscriptionId,
                    'endpoint_hash' => $endpointHash,
                    'reason' => $report->getReason(),
                ]);
                continue;
            }

            if ($subscriptionId) {
                PushSubscription::query()
                    ->whereKey($subscriptionId)
                    ->update(['last_used_at' => $now]);
            }
        }
    }
}


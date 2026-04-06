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

        $summary = $this->dispatchToAdminUsers($payload, false);
        $this->logDispatchSummary($summary, 'approval_request');
    }

    public function sendToAdminUsers(array $payload): void
    {
        $summary = $this->dispatchToAdminUsers($payload, false);
        $this->logDispatchSummary($summary, 'custom_payload');
    }

    public function sendTestNotification(string $message, array $meta = []): array
    {
        $path = trim((string) ($meta['path'] ?? '/approvals'));
        if ($path === '' || !str_starts_with($path, '/')) {
            $path = '/approvals';
        }

        $payload = [
            'title' => 'Mad Vapers Push Test',
            'body' => trim($message) !== '' ? trim($message) : 'Test push message from Mad Vapers.',
            'url' => $path,
            'tag' => 'mv-push-test',
            'data' => $meta,
            'timestamp' => now()->toIso8601String(),
        ];

        $summary = $this->dispatchToAdminUsers($payload, true);
        $this->logDispatchSummary($summary, 'manual_test');

        return $summary;
    }

    public function diagnostics(?int $requestingAdminId = null): array
    {
        $subject = trim((string) config('web_push.vapid.subject', ''));
        $publicKey = trim((string) config('web_push.vapid.public_key', ''));
        $privateKey = trim((string) config('web_push.vapid.private_key', ''));

        $adminIds = User::query()
            ->where('is_active', true)
            ->whereHas('role', function ($q) {
                $q->where('code', 'ADMIN');
            })
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $subscriptionQuery = PushSubscription::query()
            ->when(!empty($adminIds), fn ($q) => $q->whereIn('user_id', $adminIds));

        $totalSubscriptions = (int) (clone $subscriptionQuery)->count();
        $activeRecentlyCount = (int) (clone $subscriptionQuery)
            ->where('last_used_at', '>=', now()->subDays(7))
            ->count();
        $lastUsedAt = (clone $subscriptionQuery)->max('last_used_at');

        $requesterSubscriptionCount = 0;
        if ($requestingAdminId && $requestingAdminId > 0) {
            $requesterSubscriptionCount = (int) PushSubscription::query()
                ->where('user_id', $requestingAdminId)
                ->count();
        }

        return [
            'enabled' => (bool) config('web_push.enabled', true),
            'vapid' => [
                'subject_set' => $subject !== '',
                'public_key_set' => $publicKey !== '',
                'private_key_set' => $privateKey !== '',
                'public_key_prefix' => $publicKey !== '' ? substr($publicKey, 0, 12) : null,
            ],
            'admins' => [
                'active_count' => count($adminIds),
                'ids' => $adminIds,
            ],
            'subscriptions' => [
                'admin_total' => $totalSubscriptions,
                'requesting_admin_total' => $requesterSubscriptionCount,
                'used_in_last_7_days' => $activeRecentlyCount,
                'latest_last_used_at' => $lastUsedAt ? Carbon::parse($lastUsedAt)->toIso8601String() : null,
            ],
            'generated_at' => now()->toIso8601String(),
        ];
    }

    private function dispatchToAdminUsers(array $payload, bool $includeFailureReasons): array
    {
        $summary = [
            'status' => 'skipped',
            'reason' => null,
            'error' => null,
            'admin_count' => 0,
            'subscription_count' => 0,
            'queued' => 0,
            'delivered' => 0,
            'failed' => 0,
            'expired_removed' => 0,
            'invalid_subscriptions' => 0,
            'queue_errors' => 0,
            'failures' => [],
            'generated_at' => now()->toIso8601String(),
        ];

        if (!config('web_push.enabled', true)) {
            $summary['reason'] = 'web_push_disabled';
            return $summary;
        }

        $subject = trim((string) config('web_push.vapid.subject', ''));
        $publicKey = trim((string) config('web_push.vapid.public_key', ''));
        $privateKey = trim((string) config('web_push.vapid.private_key', ''));

        if ($subject === '' || $publicKey === '' || $privateKey === '') {
            Log::warning('Web Push skipped: missing VAPID configuration.');
            $summary['reason'] = 'missing_vapid_configuration';
            return $summary;
        }

        $adminIds = User::query()
            ->where('is_active', true)
            ->whereHas('role', function ($q) {
                $q->where('code', 'ADMIN');
            })
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $summary['admin_count'] = count($adminIds);
        if (empty($adminIds)) {
            $summary['reason'] = 'no_active_admin_users';
            return $summary;
        }

        $subscriptions = PushSubscription::query()
            ->whereIn('user_id', $adminIds)
            ->orderBy('id')
            ->get();

        $summary['subscription_count'] = (int) $subscriptions->count();
        if ($subscriptions->isEmpty()) {
            $summary['reason'] = 'no_admin_subscriptions';
            return $summary;
        }

        try {
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
        } catch (\Throwable $e) {
            $summary['status'] = 'failed';
            $summary['reason'] = 'web_push_init_failed';
            $summary['error'] = $this->sanitizeErrorMessage($e);
            Log::error('Web Push initialization failed.', [
                'reason' => $summary['reason'],
                'error' => $summary['error'],
            ]);
            return $summary;
        }

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
            $summary['reason'] = 'invalid_payload';
            return $summary;
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
                $summary['invalid_subscriptions']++;
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
                $summary['queue_errors']++;
                Log::warning('Failed to queue web push notification for subscription.', [
                    'subscription_id' => $record->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $summary['queued'] = count($byEndpointHash);
        if (empty($byEndpointHash)) {
            $summary['reason'] = 'no_queueable_subscriptions';
            return $summary;
        }

        try {
            foreach ($webPush->flush() as $report) {
                $endpoint = (string) $report->getEndpoint();
                $endpointHash = hash('sha256', $endpoint);
                $subscriptionId = $byEndpointHash[$endpointHash] ?? null;

                if (!$report->isSuccess()) {
                    $summary['failed']++;
                    if ($report->isSubscriptionExpired()) {
                        PushSubscription::query()
                            ->where('endpoint_hash', $endpointHash)
                            ->delete();
                        $summary['expired_removed']++;
                    }

                    if ($includeFailureReasons) {
                        $summary['failures'][] = [
                            'subscription_id' => $subscriptionId,
                            'reason' => $report->getReason(),
                            'expired' => $report->isSubscriptionExpired(),
                        ];
                    }

                    Log::warning('Web push delivery failed.', [
                        'subscription_id' => $subscriptionId,
                        'endpoint_hash' => $endpointHash,
                        'reason' => $report->getReason(),
                    ]);
                    continue;
                }

                $summary['delivered']++;
                if ($subscriptionId) {
                    PushSubscription::query()
                        ->whereKey($subscriptionId)
                        ->update(['last_used_at' => $now]);
                }
            }
        } catch (\Throwable $e) {
            $summary['status'] = 'failed';
            $summary['reason'] = 'web_push_flush_failed';
            $summary['error'] = $this->sanitizeErrorMessage($e);
            Log::error('Web Push flush failed unexpectedly.', [
                'reason' => $summary['reason'],
                'error' => $summary['error'],
                'queued' => (int) ($summary['queued'] ?? 0),
            ]);
            return $summary;
        }

        if ((int) $summary['delivered'] > 0 && (int) $summary['failed'] === 0) {
            $summary['status'] = 'sent';
            return $summary;
        }

        if ((int) $summary['delivered'] > 0) {
            $summary['status'] = 'partial';
            $summary['reason'] = 'some_deliveries_failed';
            return $summary;
        }

        $summary['status'] = 'failed';
        $summary['reason'] = 'all_deliveries_failed';
        return $summary;
    }

    private function sanitizeErrorMessage(\Throwable $e): string
    {
        $message = trim((string) $e->getMessage());
        if ($message === '') {
            $message = 'Unknown push error';
        }
        return substr($message, 0, 260);
    }

    private function logDispatchSummary(array $summary, string $event): void
    {
        $context = [
            'event' => $event,
            'status' => (string) ($summary['status'] ?? 'unknown'),
            'reason' => $summary['reason'] ?? null,
            'error' => $summary['error'] ?? null,
            'admin_count' => (int) ($summary['admin_count'] ?? 0),
            'subscription_count' => (int) ($summary['subscription_count'] ?? 0),
            'queued' => (int) ($summary['queued'] ?? 0),
            'delivered' => (int) ($summary['delivered'] ?? 0),
            'failed' => (int) ($summary['failed'] ?? 0),
            'expired_removed' => (int) ($summary['expired_removed'] ?? 0),
            'invalid_subscriptions' => (int) ($summary['invalid_subscriptions'] ?? 0),
            'queue_errors' => (int) ($summary['queue_errors'] ?? 0),
        ];

        $status = (string) ($summary['status'] ?? '');
        if (in_array($status, ['failed', 'partial'], true)) {
            Log::warning('Admin web push dispatch completed with failures.', $context);
            return;
        }

        Log::info('Admin web push dispatch summary.', $context);
    }
}

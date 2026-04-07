<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use App\Services\AdminPushNotificationService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PushSubscriptionController extends Controller
{
    /**
     * @return string[]
     */
    private function allowedEndpointHostPatterns(): array
    {
        $raw = trim((string) env(
            'WEB_PUSH_ALLOWED_ENDPOINT_HOSTS',
            'fcm.googleapis.com,updates.push.services.mozilla.com,web.push.apple.com,*.push.apple.com'
        ));

        if ($raw === '') {
            return [];
        }

        return array_values(array_filter(array_map(
            static function (string $value): string {
                return strtolower(trim($value));
            },
            explode(',', $raw)
        )));
    }

    private function hostMatchesPattern(string $host, string $pattern): bool
    {
        if ($pattern === '') {
            return false;
        }

        if (str_starts_with($pattern, '*.')) {
            $base = substr($pattern, 2);
            if ($base === '') {
                return false;
            }

            return $host === $base || str_ends_with($host, '.' . $base);
        }

        return $host === $pattern;
    }

    private function validatePushEndpoint(string $endpoint): ?string
    {
        $parsed = parse_url($endpoint);
        if (!is_array($parsed)) {
            return 'Invalid push endpoint URL.';
        }

        $scheme = strtolower((string) ($parsed['scheme'] ?? ''));
        $host = strtolower((string) ($parsed['host'] ?? ''));

        if ($scheme !== 'https') {
            return 'Push endpoint must use HTTPS.';
        }

        if ($host === '') {
            return 'Push endpoint host is required.';
        }

        $patterns = $this->allowedEndpointHostPatterns();
        if (empty($patterns)) {
            return null;
        }

        foreach ($patterns as $pattern) {
            if ($this->hostMatchesPattern($host, $pattern)) {
                return null;
            }
        }

        return 'Push endpoint host is not allowed.';
    }

    public function store(Request $request)
    {
        $actor = $request->user();
        if (!$this->isAdmin($actor?->role?->code)) {
            return response()->json([
                'message' => 'Only admin accounts can register push notifications.',
            ], 403);
        }

        $data = $request->validate([
            'endpoint' => ['required', 'string', 'url', 'max:4000'],
            'keys' => ['required', 'array'],
            'keys.p256dh' => ['required', 'string'],
            'keys.auth' => ['required', 'string'],
            'content_encoding' => ['nullable', Rule::in(['aesgcm', 'aes128gcm'])],
        ]);

        $endpoint = trim((string) $data['endpoint']);
        if ($endpointError = $this->validatePushEndpoint($endpoint)) {
            return response()->json([
                'message' => $endpointError,
            ], 422);
        }

        $endpointHash = hash('sha256', $endpoint);

        $record = PushSubscription::query()->updateOrCreate(
            ['endpoint_hash' => $endpointHash],
            [
                'user_id' => (int) $actor->id,
                'endpoint' => $endpoint,
                'public_key' => (string) ($data['keys']['p256dh'] ?? ''),
                'auth_token' => (string) ($data['keys']['auth'] ?? ''),
                'content_encoding' => (string) ($data['content_encoding'] ?? 'aes128gcm'),
                'user_agent' => substr((string) $request->userAgent(), 0, 1024) ?: null,
            ]
        );

        return response()->json([
            'status' => 'ok',
            'subscription_id' => (int) $record->id,
        ]);
    }

    public function destroy(Request $request)
    {
        $actor = $request->user();
        if (!$this->isAdmin($actor?->role?->code)) {
            return response()->json([
                'message' => 'Only admin accounts can remove push notifications.',
            ], 403);
        }

        $data = $request->validate([
            'endpoint' => ['required', 'string', 'url', 'max:4000'],
        ]);

        $endpoint = trim((string) $data['endpoint']);
        if ($endpointError = $this->validatePushEndpoint($endpoint)) {
            return response()->json([
                'message' => $endpointError,
            ], 422);
        }

        $endpointHash = hash('sha256', $endpoint);

        PushSubscription::query()
            ->where('endpoint_hash', $endpointHash)
            ->where('user_id', (int) $actor->id)
            ->delete();

        return response()->json(['status' => 'ok']);
    }

    public function debug(Request $request, AdminPushNotificationService $pushService)
    {
        $actor = $request->user();
        if (!$this->isAdmin($actor?->role?->code)) {
            return response()->json([
                'message' => 'Only admin accounts can view push diagnostics.',
            ], 403);
        }

        return response()->json([
            'status' => 'ok',
            'debug' => $pushService->diagnostics((int) $actor->id),
        ]);
    }

    public function sendTest(Request $request, AdminPushNotificationService $pushService)
    {
        $actor = $request->user();
        if (!$this->isAdmin($actor?->role?->code)) {
            return response()->json([
                'message' => 'Only admin accounts can send push test notifications.',
            ], 403);
        }

        $data = $request->validate([
            'message' => ['nullable', 'string', 'max:180'],
            'path' => ['nullable', 'string', 'max:120'],
        ]);

        $message = trim((string) ($data['message'] ?? ''));
        $path = trim((string) ($data['path'] ?? '/approvals'));
        if ($path === '' || !str_starts_with($path, '/')) {
            $path = '/approvals';
        }

        $summary = $pushService->sendTestNotification(
            $message !== '' ? $message : 'Test approval request from Mad Vapers',
            [
                'type' => 'manual_debug_test',
                'path' => $path,
                'triggered_by_user_id' => (int) $actor->id,
            ]
        );

        return response()->json([
            'status' => 'ok',
            'result' => $summary,
        ]);
    }

    private function isAdmin(?string $roleCode): bool
    {
        return strtoupper((string) $roleCode) === 'ADMIN';
    }
}

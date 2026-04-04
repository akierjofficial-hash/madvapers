<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PushSubscriptionController extends Controller
{
    public function store(Request $request)
    {
        $actor = $request->user();
        if (!$this->isAdmin($actor?->role?->code)) {
            return response()->json([
                'message' => 'Only admin accounts can register push notifications.',
            ], 403);
        }

        $data = $request->validate([
            'endpoint' => ['required', 'string', 'max:4000'],
            'keys' => ['required', 'array'],
            'keys.p256dh' => ['required', 'string'],
            'keys.auth' => ['required', 'string'],
            'content_encoding' => ['nullable', Rule::in(['aesgcm', 'aes128gcm'])],
        ]);

        $endpoint = trim((string) $data['endpoint']);
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
            'endpoint' => ['required', 'string', 'max:4000'],
        ]);

        $endpointHash = hash('sha256', trim((string) $data['endpoint']));

        PushSubscription::query()
            ->where('endpoint_hash', $endpointHash)
            ->where('user_id', (int) $actor->id)
            ->delete();

        return response()->json(['status' => 'ok']);
    }

    private function isAdmin(?string $roleCode): bool
    {
        return strtoupper((string) $roleCode) === 'ADMIN';
    }
}


<?php

namespace Tests\Feature;

use App\Models\PushSubscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PushSubscriptionApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function actingAsEmail(string $email): User
    {
        $user = User::query()->where('email', $email)->firstOrFail();
        Sanctum::actingAs($user);
        return $user;
    }

    public function test_admin_can_register_and_remove_push_subscription(): void
    {
        $admin = $this->actingAsEmail('admin@madvapers.local');
        $endpoint = 'https://fcm.googleapis.com/fcm/send/test-subscription-abc123';

        $this->postJson('/api/push-subscriptions', [
            'endpoint' => $endpoint,
            'keys' => [
                'p256dh' => 'test-p256dh',
                'auth' => 'test-auth',
            ],
            'content_encoding' => 'aes128gcm',
        ])->assertOk()
            ->assertJsonPath('status', 'ok');

        $this->assertDatabaseHas('push_subscriptions', [
            'user_id' => $admin->id,
            'endpoint_hash' => hash('sha256', $endpoint),
            'content_encoding' => 'aes128gcm',
        ]);

        $this->deleteJson('/api/push-subscriptions', [
            'endpoint' => $endpoint,
        ])->assertOk()
            ->assertJsonPath('status', 'ok');

        $this->assertDatabaseMissing('push_subscriptions', [
            'endpoint_hash' => hash('sha256', $endpoint),
        ]);
    }

    public function test_non_admin_cannot_register_push_subscription(): void
    {
        $this->actingAsEmail('clerk@madvapers.local');

        $this->postJson('/api/push-subscriptions', [
            'endpoint' => 'https://example.push.service/subscription/not-allowed',
            'keys' => [
                'p256dh' => 'test-p256dh',
                'auth' => 'test-auth',
            ],
        ])->assertStatus(403);

        $this->assertSame(0, PushSubscription::query()->count());
    }

    public function test_admin_can_view_push_diagnostics_and_send_test_notification(): void
    {
        $admin = $this->actingAsEmail('admin@madvapers.local');

        PushSubscription::query()->create([
            'user_id' => $admin->id,
            'endpoint_hash' => hash('sha256', 'https://example.push.service/subscription/diag1'),
            'endpoint' => 'https://example.push.service/subscription/diag1',
            'public_key' => 'test-public-key',
            'auth_token' => 'test-auth-token',
            'content_encoding' => 'aes128gcm',
        ]);

        $this->getJson('/api/push-subscriptions/debug')
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('debug.enabled', true)
            ->assertJsonPath('debug.subscriptions.requesting_admin_total', 1);

        $this->postJson('/api/push-subscriptions/test', [
            'message' => 'Debug ping',
            'path' => '/approvals',
        ])->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonStructure([
                'result' => [
                    'status',
                    'reason',
                    'admin_count',
                    'subscription_count',
                    'queued',
                    'delivered',
                    'failed',
                ],
            ]);
    }

    public function test_non_admin_cannot_access_push_debug_endpoints(): void
    {
        $this->actingAsEmail('clerk@madvapers.local');

        $this->getJson('/api/push-subscriptions/debug')->assertStatus(403);
        $this->postJson('/api/push-subscriptions/test')->assertStatus(403);
    }
}

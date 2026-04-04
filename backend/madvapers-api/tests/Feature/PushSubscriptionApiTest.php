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
        $admin = $this->actingAsEmail('admin@madvapers.com');
        $endpoint = 'https://example.push.service/subscription/abc123';

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
}


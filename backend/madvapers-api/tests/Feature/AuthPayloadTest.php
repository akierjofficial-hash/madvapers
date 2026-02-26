<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

class AuthPayloadTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_login_returns_permissions_and_role(): void
    {
        $res = $this->postJson('/api/auth/login', [
            'email' => 'admin@madvapers.local',
            'password' => 'password123',
        ]);

        $res->assertOk()
            ->assertJsonStructure([
                'token',
                'user' => ['id','email','role' => ['code']],
                'permissions',
            ])
            ->assertJsonPath('user.email', 'admin@madvapers.local');

        $perms = $res->json('permissions', []);
        $this->assertContains('INVENTORY_VIEW', $perms);
        $this->assertContains('LEDGER_VIEW', $perms);
    }

    public function test_me_returns_permissions_for_cashier_and_is_limited(): void
    {
        $cashier = User::where('email', 'cashier@madvapers.local')->firstOrFail();
        Sanctum::actingAs($cashier);

        $res = $this->getJson('/api/auth/me');

        $res->assertOk()
            ->assertJsonPath('user.email', 'cashier@madvapers.local')
            ->assertJsonPath('user.role.code', 'CASHIER');

        $perms = $res->json('permissions', []);
        $this->assertContains('INVENTORY_VIEW', $perms);
        $this->assertNotContains('ADJUSTMENT_POST', $perms);
        $this->assertNotContains('PO_APPROVE', $perms);
    }
}
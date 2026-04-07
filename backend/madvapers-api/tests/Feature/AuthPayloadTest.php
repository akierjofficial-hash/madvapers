<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Laravel\Sanctum\PersonalAccessToken;

class AuthPayloadTest extends TestCase
{
    use RefreshDatabase;

    private function setEnvValue(string $key, string $value): void
    {
        putenv("{$key}={$value}");
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }

    private function tokenIdFromPlainText(string $plainTextToken): int
    {
        [$id] = explode('|', $plainTextToken, 2);
        return (int) $id;
    }

    private function seededAdminEmail(): string
    {
        $fromEnv = trim((string) env('SEED_ADMIN_EMAIL', ''));
        if ($fromEnv !== '') {
            return $fromEnv;
        }

        return 'admin@madvapers.local';
    }

    private function seededAdminPassword(): string
    {
        $fromAdminEnv = trim((string) env('SEED_ADMIN_PASSWORD', ''));
        if ($fromAdminEnv !== '') {
            return $fromAdminEnv;
        }

        $fromEnv = trim((string) env('SEED_DEFAULT_PASSWORD', ''));
        if ($fromEnv !== '') {
            return $fromEnv;
        }

        return 'password123';
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_login_returns_permissions_and_role(): void
    {
        $adminEmail = $this->seededAdminEmail();

        $res = $this->postJson('/api/auth/login', [
            'email' => $adminEmail,
            'password' => $this->seededAdminPassword(),
        ]);

        $res->assertOk()
            ->assertJsonStructure([
                'user' => ['id','email','role' => ['code']],
                'permissions',
            ])
            ->assertJsonPath('user.email', $adminEmail);

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
        $this->assertContains('PRODUCT_VIEW', $perms);
        $this->assertContains('SALES_VIEW', $perms);
        $this->assertContains('SALES_CREATE', $perms);
        $this->assertContains('SALES_VOID_REQUEST', $perms);
        $this->assertNotContains('SALES_VOID', $perms);
        $this->assertNotContains('ADJUSTMENT_POST', $perms);
        $this->assertNotContains('PO_APPROVE', $perms);
        $this->assertNotContains('INVENTORY_VIEW', $perms);
        $this->assertNotContains('EXPENSE_VIEW', $perms);
    }

    public function test_logout_does_not_crash_for_cookie_or_transient_auth(): void
    {
        $admin = User::where('email', $this->seededAdminEmail())->firstOrFail();
        Sanctum::actingAs($admin);

        $res = $this->postJson('/api/auth/logout');
        $res->assertOk()->assertJsonPath('status', 'ok');
    }

    public function test_admin_login_token_can_be_non_expiring_for_installed_app(): void
    {
        config(['sanctum.expiration' => null]);
        $this->setEnvValue('ADMIN_TOKEN_TTL_MINUTES', 'null');
        $this->setEnvValue('NON_ADMIN_TOKEN_TTL_MINUTES', '120');

        $res = $this->postJson('/api/auth/login', [
            'email' => $this->seededAdminEmail(),
            'password' => $this->seededAdminPassword(),
        ])->assertOk();

        $plainTextToken = (string) $res->json('access_token');
        $tokenId = $this->tokenIdFromPlainText($plainTextToken);
        $token = PersonalAccessToken::query()->findOrFail($tokenId);

        $this->assertNull($token->expires_at);
    }

    public function test_non_admin_login_token_keeps_standard_expiration_window(): void
    {
        config(['sanctum.expiration' => null]);
        $this->setEnvValue('ADMIN_TOKEN_TTL_MINUTES', 'null');
        $this->setEnvValue('NON_ADMIN_TOKEN_TTL_MINUTES', '120');

        $res = $this->postJson('/api/auth/login', [
            'email' => 'cashier@madvapers.local',
            'password' => 'password123',
        ])->assertOk();

        $plainTextToken = (string) $res->json('access_token');
        $tokenId = $this->tokenIdFromPlainText($plainTextToken);
        $token = PersonalAccessToken::query()->findOrFail($tokenId);

        $this->assertNotNull($token->expires_at);
        $minutesUntilExpiry = now()->diffInMinutes($token->expires_at, false);
        $this->assertGreaterThanOrEqual(110, $minutesUntilExpiry);
        $this->assertLessThanOrEqual(121, $minutesUntilExpiry);
    }
}

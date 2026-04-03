<?php

namespace Tests\Feature;

use Tests\TestCase;

class LoginOriginProtectionTest extends TestCase
{
    private ?string $originalLoginAllowedOrigins = null;

    protected function setUp(): void
    {
        parent::setUp();
        $current = getenv('LOGIN_ALLOWED_ORIGINS');
        $this->originalLoginAllowedOrigins = $current === false ? null : (string) $current;
    }

    protected function tearDown(): void
    {
        $this->setLoginAllowedOrigins($this->originalLoginAllowedOrigins);
        parent::tearDown();
    }

    public function test_production_login_rejects_untrusted_origin(): void
    {
        $this->forceAppEnv('production');
        $this->setLoginAllowedOrigins('https://app.example.com');

        $res = $this->postJson(
            '/api/auth/login',
            [],
            ['Origin' => 'https://evil.example.com']
        );

        $res->assertForbidden()
            ->assertJsonPath('message', 'Forbidden origin.');
    }

    public function test_production_login_allows_trusted_origin_and_reaches_validation(): void
    {
        $this->forceAppEnv('production');
        $this->setLoginAllowedOrigins('https://app.example.com');

        $res = $this->postJson(
            '/api/auth/login',
            [],
            ['Origin' => 'https://app.example.com']
        );

        $res->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password']);
    }

    private function forceAppEnv(string $env): void
    {
        config()->set('app.env', $env);
        $this->app['env'] = $env;
    }

    private function setLoginAllowedOrigins(?string $value): void
    {
        if ($value === null) {
            putenv('LOGIN_ALLOWED_ORIGINS');
            unset($_ENV['LOGIN_ALLOWED_ORIGINS'], $_SERVER['LOGIN_ALLOWED_ORIGINS']);
            return;
        }

        putenv("LOGIN_ALLOWED_ORIGINS={$value}");
        $_ENV['LOGIN_ALLOWED_ORIGINS'] = $value;
        $_SERVER['LOGIN_ALLOWED_ORIGINS'] = $value;
    }
}

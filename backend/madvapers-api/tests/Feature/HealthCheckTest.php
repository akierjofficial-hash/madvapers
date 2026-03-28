<?php

namespace Tests\Feature;

use Tests\TestCase;

class HealthCheckTest extends TestCase
{
    public function test_health_live_endpoint_returns_ok(): void
    {
        $response = $this->getJson('/api/health/live');

        $response
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('type', 'live')
            ->assertJsonPath('checks.app', 'ok');
    }

    public function test_health_ready_endpoint_returns_database_check(): void
    {
        $response = $this->getJson('/api/health/ready');

        $response
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('type', 'ready')
            ->assertJsonPath('checks.app', 'ok')
            ->assertJsonPath('checks.database', 'ok');
    }

    public function test_health_index_endpoint_includes_operational_links(): void
    {
        $response = $this->getJson('/api/health');

        $response
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('checks.app', 'ok')
            ->assertJsonPath('checks.database', 'ok')
            ->assertJsonPath('endpoints.live', '/api/health/live')
            ->assertJsonPath('endpoints.ready', '/api/health/ready');
    }
}


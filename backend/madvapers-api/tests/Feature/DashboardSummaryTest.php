<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DashboardSummaryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function actingAsUser(string $email): User
    {
        $user = User::query()->where('email', $email)->firstOrFail();
        Sanctum::actingAs($user);
        return $user;
    }

    public function test_admin_can_load_dashboard_summary(): void
    {
        $this->actingAsUser('admin@madvapers.local');
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();

        $this->getJson('/api/dashboard/summary?' . http_build_query([
            'branch_id' => $branch->id,
            'date_from' => now()->subDays(14)->toDateString(),
            'date_to' => now()->toDateString(),
        ]))
            ->assertOk()
            ->assertJsonStructure([
                'filters',
                'kpis' => [
                    'low_stock_count',
                    'out_of_stock_count',
                    'pending_adjustments',
                    'pending_po_approvals',
                    'pending_transfers',
                    'inventory_value',
                    'missing_cost_count',
                ],
                'kpi_details' => [
                    'low_stock',
                    'out_of_stock',
                    'inventory_value',
                    'missing_cost',
                ],
                'approval_queue' => [
                    'adjustments',
                    'transfers',
                    'purchase_orders',
                ],
                'alerts',
                'branch_health',
                'activity_feed',
                'trends',
                'quick_actions',
            ]);
    }

    public function test_admin_can_load_paginated_kpi_details(): void
    {
        $this->actingAsUser('admin@madvapers.local');
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();

        $this->getJson('/api/dashboard/kpi-details?' . http_build_query([
            'type' => 'low_stock',
            'branch_id' => $branch->id,
            'page' => 1,
            'per_page' => 5,
            'search' => 'demo',
        ]))
            ->assertOk()
            ->assertJsonPath('current_page', 1)
            ->assertJsonPath('per_page', 5)
            ->assertJsonStructure([
                'current_page',
                'data',
                'from',
                'last_page',
                'per_page',
                'to',
                'total',
            ]);
    }
}

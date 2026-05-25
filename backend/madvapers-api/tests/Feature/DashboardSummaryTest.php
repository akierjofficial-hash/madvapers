<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\InventoryBalance;
use App\Models\Product;
use App\Models\ProductVariant;
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
                    'pending_void_requests',
                    'inventory_value',
                    'retail_inventory_value',
                    'potential_margin',
                    'missing_cost_count',
                    'missing_retail_price_count',
                    'tracked_variant_count',
                ],
                'kpi_details' => [
                    'low_stock',
                    'out_of_stock',
                    'inventory_value',
                    'retail_value',
                    'missing_cost',
                    'missing_retail_price',
                ],
                'finance' => [
                    'revenue',
                    'cash_in',
                    'cogs',
                    'gross_profit',
                    'restock_spend',
                    'net_cashflow',
                    'expense_total',
                    'net_income',
                    'voided_sales_count',
                    'voided_sales_amount',
                    'voided_paid_amount',
                ],
                'voided_sales_by_branch',
                'top_selling_products',
                'approval_queue' => [
                    'adjustments',
                    'transfers',
                    'purchase_orders',
                    'void_requests',
                ],
                'alerts',
                'branch_health',
                'activity_feed',
                'trends',
                'quick_actions',
            ]);
    }

    public function test_dashboard_summary_includes_retail_value_and_potential_margin(): void
    {
        $this->actingAsUser('admin@madvapers.local');

        $branch = Branch::query()->create([
            'code' => 'RETAIL-KPI',
            'name' => 'Retail KPI Branch',
            'is_active' => true,
        ]);

        $product = Product::query()->create([
            'name' => 'Retail KPI Product',
            'product_type' => 'DEVICE',
            'base_price' => 150,
            'is_active' => true,
        ]);

        $variant = ProductVariant::query()->create([
            'product_id' => $product->id,
            'sku' => 'RETAIL-KPI-SKU',
            'variant_name' => 'Retail KPI Variant',
            'default_cost' => 100,
            'default_price' => 150,
            'is_active' => true,
        ]);

        InventoryBalance::query()->create([
            'branch_id' => $branch->id,
            'product_variant_id' => $variant->id,
            'qty_on_hand' => 3,
        ]);

        $response = $this->getJson('/api/dashboard/summary?' . http_build_query([
            'branch_id' => $branch->id,
            'date_from' => now()->startOfMonth()->toDateString(),
            'date_to' => now()->endOfMonth()->toDateString(),
        ]))
            ->assertOk()
            ->json();

        $this->assertSame(300.0, (float) ($response['kpis']['inventory_value'] ?? 0));
        $this->assertSame(450.0, (float) ($response['kpis']['retail_inventory_value'] ?? 0));
        $this->assertSame(150.0, (float) ($response['kpis']['potential_margin'] ?? 0));
        $this->assertSame(0, (int) ($response['kpis']['missing_retail_price_count'] ?? -1));

        $retailRows = $response['kpi_details']['retail_value'] ?? [];
        $this->assertNotEmpty($retailRows);
        $this->assertSame(150.0, (float) ($retailRows[0]['default_price'] ?? 0));
        $this->assertSame(450.0, (float) ($retailRows[0]['retail_value'] ?? 0));
        $this->assertSame(150.0, (float) ($retailRows[0]['potential_margin'] ?? 0));
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

    public function test_dashboard_finance_reports_voided_sales_signals(): void
    {
        $this->actingAsUser('admin@madvapers.local');
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $unitPrice = 345.0;

        $sale = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [
                [
                    'product_variant_id' => $balance->product_variant_id,
                    'qty' => 1,
                    'unit_price' => $unitPrice,
                ],
            ],
        ])->assertCreated()->json();

        $saleId = (int) ($sale['id'] ?? 0);
        $this->assertGreaterThan(0, $saleId);

        $this->postJson("/api/sales/{$saleId}/post")->assertOk();
        $this->postJson("/api/sales/{$saleId}/payments", [
            'method' => 'CASH',
            'amount' => $unitPrice,
        ])->assertOk();
        $this->postJson("/api/sales/{$saleId}/void")->assertOk();

        $response = $this->getJson('/api/dashboard/summary?' . http_build_query([
            'branch_id' => $branch->id,
            'date_from' => now()->startOfMonth()->toDateString(),
            'date_to' => now()->endOfMonth()->toDateString(),
        ]))
            ->assertOk()
            ->json();

        $finance = $response['finance'] ?? [];
        $byBranch = $response['voided_sales_by_branch'] ?? [];

        $this->assertSame(1, (int) ($finance['voided_sales_count'] ?? 0));
        $this->assertSame(round($unitPrice, 2), (float) ($finance['voided_sales_amount'] ?? 0));
        $this->assertSame(round($unitPrice, 2), (float) ($finance['voided_paid_amount'] ?? 0));
        $this->assertCount(1, $byBranch);
        $this->assertSame($branch->id, (int) ($byBranch[0]['branch_id'] ?? 0));
        $this->assertSame(1, (int) ($byBranch[0]['voided_sales_count'] ?? 0));
    }

    public function test_dashboard_approval_queue_includes_pending_sale_void_requests(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $this->actingAsUser('admin@madvapers.local');

        $sale = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [
                [
                    'product_variant_id' => $balance->product_variant_id,
                    'qty' => 1,
                    'unit_price' => 199,
                ],
            ],
        ])->assertCreated()->json();

        $saleId = (int) ($sale['id'] ?? 0);
        $this->assertGreaterThan(0, $saleId);
        $this->postJson("/api/sales/{$saleId}/post")->assertOk();

        $this->actingAsUser('cashier@madvapers.local');
        $this->postJson("/api/sales/{$saleId}/void-request", [
            'notes' => 'Customer cancel before release',
        ])
            ->assertOk()
            ->assertJsonPath('sale.void_request_status', 'PENDING');

        $this->actingAsUser('admin@madvapers.local');
        $response = $this->getJson('/api/dashboard/summary?' . http_build_query([
            'branch_id' => $branch->id,
            'date_from' => now()->startOfMonth()->toDateString(),
            'date_to' => now()->endOfMonth()->toDateString(),
        ]))
            ->assertOk()
            ->json();

        $this->assertSame(1, (int) ($response['kpis']['pending_void_requests'] ?? 0));
        $voidQueue = $response['approval_queue']['void_requests'] ?? [];
        $this->assertNotEmpty($voidQueue);
        $this->assertSame($saleId, (int) ($voidQueue[0]['id'] ?? 0));
        $this->assertSame('PENDING', (string) ($voidQueue[0]['void_request_status'] ?? ''));
    }
}

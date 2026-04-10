<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockLedger;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LedgerFilterTest extends TestCase
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

    public function test_ledger_supports_variant_and_date_range_filters(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $this->actingAsUser('admin@madvapers.local');

        $product = Product::query()->create([
            'name' => 'Ledger Filter Product ' . uniqid(),
            'product_type' => 'POD',
            'is_active' => true,
        ]);

        $variant = ProductVariant::query()->create([
            'product_id' => $product->id,
            'sku' => 'LEDGER-' . strtoupper(substr(uniqid(), -8)),
            'variant_name' => 'History Line',
            'flavor' => 'Mint',
            'default_cost' => 120,
            'default_price' => 180,
            'is_active' => true,
        ]);

        StockLedger::query()->create([
            'posted_at' => '2030-01-01 09:00:00',
            'branch_id' => $branch->id,
            'product_variant_id' => $variant->id,
            'qty_delta' => 10,
            'movement_type' => 'ADJUSTMENT',
            'reason_code' => 'OPENING',
            'unit_cost' => 120,
        ]);

        StockLedger::query()->create([
            'posted_at' => '2030-01-02 11:00:00',
            'branch_id' => $branch->id,
            'product_variant_id' => $variant->id,
            'qty_delta' => -2,
            'movement_type' => 'SALE',
            'reason_code' => 'SALE_PAYMENT',
            'unit_price' => 180,
        ]);

        StockLedger::query()->create([
            'posted_at' => '2030-01-03 15:30:00',
            'branch_id' => $branch->id,
            'product_variant_id' => $variant->id,
            'qty_delta' => 5,
            'movement_type' => 'PO_RECEIVE',
            'reason_code' => 'PO_RECEIVE',
            'unit_cost' => 118,
        ]);

        $response = $this->getJson("/api/ledger?branch_id={$branch->id}&product_variant_id={$variant->id}&date_from=2030-01-02&date_to=2030-01-02")
            ->assertOk();

        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.movement_type', 'SALE');
        $response->assertJsonPath('data.0.product_variant_id', $variant->id);
    }
}

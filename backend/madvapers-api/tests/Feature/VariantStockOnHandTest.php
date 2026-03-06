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

class VariantStockOnHandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function actingAsAdmin(): void
    {
        $admin = User::where('email', 'admin@madvapers.local')->firstOrFail();
        Sanctum::actingAs($admin);
    }

    public function test_variants_index_returns_branch_specific_and_total_on_hand(): void
    {
        $this->actingAsAdmin();

        $product = Product::create([
            'name' => 'Stock Visibility Product ' . uniqid(),
            'product_type' => 'DEVICE',
            'is_active' => true,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'STOCK-' . strtoupper(substr(uniqid(), -8)),
            'variant_name' => 'Standard',
            'default_cost' => 0,
            'default_price' => 0,
            'is_active' => true,
        ]);

        $branches = Branch::query()->orderBy('id')->take(2)->get();
        $this->assertCount(2, $branches, 'Expected at least 2 branches from seed data.');

        $branchA = $branches[0];
        $branchB = $branches[1];

        InventoryBalance::updateOrCreate(
            ['branch_id' => $branchA->id, 'product_variant_id' => $variant->id],
            ['qty_on_hand' => 5.5]
        );
        InventoryBalance::updateOrCreate(
            ['branch_id' => $branchB->id, 'product_variant_id' => $variant->id],
            ['qty_on_hand' => 12.25]
        );

        $branchResp = $this->getJson('/api/variants?search=' . urlencode($variant->sku) . '&branch_id=' . $branchA->id)
            ->assertOk();

        $branchRow = collect($branchResp->json('data'))->firstWhere('id', $variant->id);
        $this->assertNotNull($branchRow);
        $this->assertEquals(5.5, (float) ($branchRow['qty_on_hand'] ?? -1), '', 0.0001);

        $totalResp = $this->getJson('/api/variants?search=' . urlencode($variant->sku))
            ->assertOk();

        $totalRow = collect($totalResp->json('data'))->firstWhere('id', $variant->id);
        $this->assertNotNull($totalRow);
        $this->assertEquals(17.75, (float) ($totalRow['qty_on_hand'] ?? -1), '', 0.0001);
    }
}


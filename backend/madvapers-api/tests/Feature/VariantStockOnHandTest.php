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

    public function test_variants_index_excludes_inactive_by_default_but_can_include_them(): void
    {
        $this->actingAsAdmin();

        $activeProduct = Product::query()->create([
            'name' => 'Variant Filter Active Product ' . uniqid(),
            'product_type' => 'DEVICE',
            'is_active' => true,
        ]);

        $inactiveProduct = Product::query()->create([
            'name' => 'Variant Filter Inactive Product ' . uniqid(),
            'product_type' => 'DEVICE',
            'is_active' => false,
        ]);

        $inactiveVariant = ProductVariant::query()->create([
            'product_id' => $activeProduct->id,
            'sku' => 'VAR-INACTIVE-VAR-' . strtoupper(substr(uniqid(), -6)),
            'variant_name' => 'Inactive Variant',
            'default_cost' => 0,
            'default_price' => 0,
            'is_active' => false,
        ]);

        $inactiveProductVariant = ProductVariant::query()->create([
            'product_id' => $inactiveProduct->id,
            'sku' => 'VAR-INACTIVE-PROD-' . strtoupper(substr(uniqid(), -6)),
            'variant_name' => 'Inactive Product Variant',
            'default_cost' => 0,
            'default_price' => 0,
            'is_active' => true,
        ]);

        $defaultHiddenVariant = $this->getJson('/api/variants?search=' . urlencode($inactiveVariant->sku))
            ->assertOk();
        $this->assertCount(0, $defaultHiddenVariant->json('data', []));

        $defaultHiddenProduct = $this->getJson('/api/variants?search=' . urlencode($inactiveProductVariant->sku))
            ->assertOk();
        $this->assertCount(0, $defaultHiddenProduct->json('data', []));

        $withInactiveVariant = $this->getJson(
            '/api/variants?include_inactive=1&search=' . urlencode($inactiveVariant->sku)
        )->assertOk();
        $this->assertNotEmpty($withInactiveVariant->json('data', []));

        $withInactiveProduct = $this->getJson(
            '/api/variants?include_inactive=1&search=' . urlencode($inactiveProductVariant->sku)
        )->assertOk();
        $this->assertNotEmpty($withInactiveProduct->json('data', []));
    }

    public function test_variants_index_can_return_only_inactive_variants(): void
    {
        $this->actingAsAdmin();

        $product = Product::query()->create([
            'name' => 'Inactive Variant Filter Product ' . uniqid(),
            'product_type' => 'DEVICE',
            'is_active' => true,
        ]);

        $activeVariant = ProductVariant::query()->create([
            'product_id' => $product->id,
            'sku' => 'VAR-ACTIVE-' . strtoupper(substr(uniqid(), -6)),
            'variant_name' => 'Active Variant',
            'default_cost' => 0,
            'default_price' => 0,
            'is_active' => true,
        ]);

        $inactiveVariant = ProductVariant::query()->create([
            'product_id' => $product->id,
            'sku' => 'VAR-ONLY-INACTIVE-' . strtoupper(substr(uniqid(), -6)),
            'variant_name' => 'Inactive Variant',
            'default_cost' => 0,
            'default_price' => 0,
            'is_active' => false,
        ]);

        $response = $this->getJson('/api/variants?only_inactive=1')
            ->assertOk();

        $ids = collect($response->json('data', []))->pluck('id')->all();

        $this->assertContains($inactiveVariant->id, $ids);
        $inactiveProduct = Product::query()->create([
            'name' => 'Only Inactive Product ' . uniqid(),
            'product_type' => 'DEVICE',
            'is_active' => false,
        ]);
        $inactiveProductVariant = ProductVariant::query()->create([
            'product_id' => $inactiveProduct->id,
            'sku' => 'VAR-INACTIVE-PRODUCT-' . strtoupper(substr(uniqid(), -6)),
            'variant_name' => 'Active Variant Hidden By Product',
            'default_cost' => 0,
            'default_price' => 0,
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/variants?only_inactive=1')
            ->assertOk();

        $ids = collect($response->json('data', []))->pluck('id')->all();

        $this->assertContains($inactiveVariant->id, $ids);
        $this->assertContains($inactiveProductVariant->id, $ids);
        $this->assertNotContains($activeVariant->id, $ids);
    }
}

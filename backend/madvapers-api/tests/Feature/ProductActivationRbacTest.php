<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductActivationRbacTest extends TestCase
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

    private function makeProduct(array $attrs = []): Product
    {
        return Product::create(array_merge([
            'name' => 'Test Product ' . uniqid(),
            'product_type' => 'DEVICE',
            'is_active' => true,
        ], $attrs));
    }

    private function makeVariant(Product $product, array $attrs = []): ProductVariant
    {
        return ProductVariant::create(array_merge([
            'product_id' => $product->id,
            'sku' => 'TV-' . strtoupper(substr(uniqid(), -8)),
            'variant_name' => 'Default',
            'default_cost' => 0,
            'default_price' => 0,
            'is_active' => true,
        ], $attrs));
    }

    public function test_product_update_cannot_toggle_is_active(): void
    {
        $this->actingAsAdmin();
        $product = $this->makeProduct(['is_active' => false]);

        $this->putJson("/api/products/{$product->id}", [
            'name' => 'Updated Name',
            'is_active' => true,
        ])->assertOk();

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'name' => 'Updated Name',
            'is_active' => 0,
        ]);
    }

    public function test_product_enable_endpoint_reactivates_product(): void
    {
        $this->actingAsAdmin();
        $product = $this->makeProduct(['is_active' => false]);

        $this->postJson("/api/products/{$product->id}/enable")
            ->assertOk()
            ->assertJson(['status' => 'ok']);

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'is_active' => 1,
        ]);
    }

    public function test_variant_update_cannot_toggle_is_active(): void
    {
        $this->actingAsAdmin();
        $product = $this->makeProduct();
        $variant = $this->makeVariant($product, ['is_active' => false]);

        $this->putJson("/api/variants/{$variant->id}", [
            'variant_name' => 'Updated Variant',
            'is_active' => true,
        ])->assertOk();

        $this->assertDatabaseHas('product_variants', [
            'id' => $variant->id,
            'variant_name' => 'Updated Variant',
            'is_active' => 0,
        ]);
    }

    public function test_variant_enable_endpoint_reactivates_variant(): void
    {
        $this->actingAsAdmin();
        $product = $this->makeProduct();
        $variant = $this->makeVariant($product, ['is_active' => false]);

        $this->postJson("/api/variants/{$variant->id}/enable")
            ->assertOk()
            ->assertJson(['status' => 'ok']);

        $this->assertDatabaseHas('product_variants', [
            'id' => $variant->id,
            'is_active' => 1,
        ]);
    }
}


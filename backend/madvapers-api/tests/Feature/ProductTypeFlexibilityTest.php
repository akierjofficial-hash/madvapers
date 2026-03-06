<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductTypeFlexibilityTest extends TestCase
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

    private function makeBrand(): Brand
    {
        return Brand::create([
            'name' => 'Type Test Brand ' . uniqid(),
            'is_active' => true,
        ]);
    }

    public function test_can_create_product_with_custom_product_type(): void
    {
        $this->actingAsAdmin();
        $brand = $this->makeBrand();

        $response = $this->postJson('/api/products', [
            'name' => 'Custom Type Product',
            'brand_id' => $brand->id,
            'product_type' => 'pod refill-pro',
        ])->assertCreated();

        $productId = (int) $response->json('id');

        $this->assertDatabaseHas('products', [
            'id' => $productId,
            'product_type' => 'POD_REFILL_PRO',
        ]);
    }

    public function test_can_update_product_to_custom_product_type(): void
    {
        $this->actingAsAdmin();
        $brand = $this->makeBrand();
        $product = Product::create([
            'name' => 'Product To Update',
            'brand_id' => $brand->id,
            'product_type' => 'DEVICE',
            'is_active' => true,
        ]);

        $this->putJson("/api/products/{$product->id}", [
            'product_type' => 'liq pod',
        ])->assertOk();

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'product_type' => 'LIQ_POD',
        ]);
    }
}

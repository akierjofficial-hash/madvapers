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

class InventoryBranchAccessTest extends TestCase
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

    public function test_clerk_can_only_access_assigned_branch_inventory(): void
    {
        $motong = Branch::query()->where('code', 'MOTONG')->firstOrFail();
        $bagacay = Branch::query()->where('code', 'BAGACAY')->firstOrFail();

        $this->actingAsUser('clerk@madvapers.local');

        $own = $this->getJson("/api/inventory?branch_id={$motong->id}");
        $own->assertOk();
        $items = $own->json('data', []);
        $this->assertNotEmpty($items, 'Expected seeded inventory data for clerk branch.');
        foreach ($items as $row) {
            $this->assertSame($motong->id, (int) ($row['branch_id'] ?? 0));
        }

        $forbidden = $this->getJson("/api/inventory?branch_id={$bagacay->id}");
        $forbidden->assertStatus(403)
            ->assertJsonPath('message', 'Forbidden branch access.');
    }

    public function test_admin_can_access_inventory_across_branches(): void
    {
        $bagacay = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $motong = Branch::query()->where('code', 'MOTONG')->firstOrFail();

        $this->actingAsUser('admin@madvapers.local');

        $this->getJson("/api/inventory?branch_id={$bagacay->id}")->assertOk();
        $this->getJson("/api/inventory?branch_id={$motong->id}")->assertOk();
    }

    public function test_inventory_excludes_inactive_items_by_default_but_can_include_them(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $this->actingAsUser('admin@madvapers.local');

        $activeProduct = Product::query()->create([
            'name' => 'Inventory Active Product ' . uniqid(),
            'product_type' => 'DEVICE',
            'is_active' => true,
        ]);

        $inactiveProduct = Product::query()->create([
            'name' => 'Inventory Inactive Product ' . uniqid(),
            'product_type' => 'DEVICE',
            'is_active' => false,
        ]);

        $inactiveVariant = ProductVariant::query()->create([
            'product_id' => $activeProduct->id,
            'sku' => 'INV-INACTIVE-VAR-' . strtoupper(substr(uniqid(), -6)),
            'variant_name' => 'Inactive Variant',
            'default_cost' => 0,
            'default_price' => 100,
            'is_active' => false,
        ]);

        $inactiveProductVariant = ProductVariant::query()->create([
            'product_id' => $inactiveProduct->id,
            'sku' => 'INV-INACTIVE-PROD-' . strtoupper(substr(uniqid(), -6)),
            'variant_name' => 'Inactive Product Variant',
            'default_cost' => 0,
            'default_price' => 100,
            'is_active' => true,
        ]);

        InventoryBalance::query()->updateOrCreate(
            ['branch_id' => $branch->id, 'product_variant_id' => $inactiveVariant->id],
            ['qty_on_hand' => 5]
        );
        InventoryBalance::query()->updateOrCreate(
            ['branch_id' => $branch->id, 'product_variant_id' => $inactiveProductVariant->id],
            ['qty_on_hand' => 7]
        );

        $defaultHiddenVariant = $this->getJson(
            '/api/inventory?branch_id=' . $branch->id . '&search=' . urlencode($inactiveVariant->sku)
        )->assertOk();
        $this->assertCount(0, $defaultHiddenVariant->json('data', []));

        $defaultHiddenProduct = $this->getJson(
            '/api/inventory?branch_id=' . $branch->id . '&search=' . urlencode($inactiveProductVariant->sku)
        )->assertOk();
        $this->assertCount(0, $defaultHiddenProduct->json('data', []));

        $withInactiveVariant = $this->getJson(
            '/api/inventory?branch_id=' . $branch->id . '&include_inactive=1&search=' . urlencode($inactiveVariant->sku)
        )->assertOk();
        $this->assertNotEmpty($withInactiveVariant->json('data', []));

        $withInactiveProduct = $this->getJson(
            '/api/inventory?branch_id=' . $branch->id . '&include_inactive=1&search=' . urlencode($inactiveProductVariant->sku)
        )->assertOk();
        $this->assertNotEmpty($withInactiveProduct->json('data', []));
    }
}

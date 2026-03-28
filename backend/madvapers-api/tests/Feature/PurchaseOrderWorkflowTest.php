<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Brand;
use App\Models\InventoryBalance;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockLedger;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PurchaseOrderWorkflowTest extends TestCase
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

    private function ensureSeedVariantId(): int
    {
        $existing = ProductVariant::query()->value('id');
        if ($existing) {
            return (int) $existing;
        }

        $brand = Brand::query()->firstOrCreate(['name' => 'Feature Test Brand']);
        $product = Product::query()->create([
            'brand_id' => $brand->id,
            'name' => 'Feature Test Product ' . now()->timestamp,
            'product_type' => 'DEVICE',
            'is_active' => true,
        ]);

        $variant = ProductVariant::query()->create([
            'product_id' => $product->id,
            'sku' => 'FT-' . strtoupper(uniqid()),
            'variant_name' => 'Standard',
            'default_cost' => 0,
            'default_price' => 100,
            'is_active' => true,
        ]);

        return (int) $variant->id;
    }

    public function test_manager_can_create_submit_approve_and_receive_po(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->orderBy('id')
            ->first();
        if (!$balance) {
            $seedVariantId = $this->ensureSeedVariantId();
            $balance = InventoryBalance::query()->create([
                'branch_id' => $branch->id,
                'product_variant_id' => $seedVariantId,
                'qty_on_hand' => 0,
            ]);
        }
        $variantId = (int) $balance->product_variant_id;

        $supplier = Supplier::query()->create([
            'name' => 'Feature Test Supplier',
            'is_active' => true,
        ]);

        $beforeQty = (float) $balance->qty_on_hand;
        $qtyOrdered = 2.0;
        $unitCost = 25.0;

        $variant = ProductVariant::query()->findOrFail($variantId);
        $variant->update(['default_cost' => 10]);
        $beforeGlobalQty = (float) InventoryBalance::query()
            ->where('product_variant_id', $variantId)
            ->sum('qty_on_hand');

        $manager = $this->actingAsUser('manager@madvapers.local');

        $created = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'branch_id' => $branch->id,
            'notes' => 'Feature test PO',
            'items' => [
                [
                    'product_variant_id' => $variantId,
                    'qty_ordered' => $qtyOrdered,
                    'unit_cost' => $unitCost,
                ],
            ],
        ])->assertCreated()->json();

        $poId = (int) ($created['id'] ?? 0);
        $this->assertGreaterThan(0, $poId);

        $this->postJson("/api/purchase-orders/{$poId}/submit")->assertOk();
        $this->postJson("/api/purchase-orders/{$poId}/approve")->assertOk();
        $this->postJson("/api/purchase-orders/{$poId}/receive")->assertOk();

        $this->assertDatabaseHas('purchase_orders', [
            'id' => $poId,
            'status' => 'RECEIVED',
            'branch_id' => $branch->id,
        ]);

        $afterQty = (float) InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $variantId)
            ->value('qty_on_hand');

        $this->assertSame($beforeQty + $qtyOrdered, $afterQty);

        $expectedDefaultCost = round((($beforeGlobalQty * 10.0) + ($qtyOrdered * $unitCost)) / ($beforeGlobalQty + $qtyOrdered), 2);
        $actualDefaultCost = (float) ProductVariant::query()->findOrFail($variantId)->default_cost;
        $this->assertSame($expectedDefaultCost, $actualDefaultCost);

        $this->assertTrue(
            StockLedger::query()
                ->where('branch_id', $branch->id)
                ->where('product_variant_id', $variantId)
                ->where('movement_type', 'PO_RECEIVE')
                ->where('ref_type', 'purchase_orders')
                ->where('ref_id', $poId)
                ->exists()
        );

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'PO_DRAFT_CREATED',
            'entity_type' => 'purchase_order',
            'entity_id' => $poId,
            'branch_id' => $branch->id,
            'user_id' => $manager->id,
        ]);

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'PO_SUBMITTED',
            'entity_type' => 'purchase_order',
            'entity_id' => $poId,
            'branch_id' => $branch->id,
            'user_id' => $manager->id,
        ]);

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'PO_APPROVED',
            'entity_type' => 'purchase_order',
            'entity_id' => $poId,
            'branch_id' => $branch->id,
            'user_id' => $manager->id,
        ]);

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'PO_RECEIVED',
            'entity_type' => 'purchase_order',
            'entity_id' => $poId,
            'branch_id' => $branch->id,
            'user_id' => $manager->id,
        ]);
    }

    public function test_clerk_cannot_approve_purchase_order(): void
    {
        $branch = Branch::query()->where('code', 'MOTONG')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->orderBy('id')
            ->first();
        if (!$balance) {
            $seedVariantId = $this->ensureSeedVariantId();
            $balance = InventoryBalance::query()->create([
                'branch_id' => $branch->id,
                'product_variant_id' => $seedVariantId,
                'qty_on_hand' => 0,
            ]);
        }
        $variantId = (int) $balance->product_variant_id;

        $supplier = Supplier::query()->create([
            'name' => 'Clerk PO Supplier',
            'is_active' => true,
        ]);

        $this->actingAsUser('clerk@madvapers.local');

        $created = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'branch_id' => $branch->id,
            'items' => [
                [
                    'product_variant_id' => $variantId,
                    'qty_ordered' => 1,
                    'unit_cost' => 0,
                ],
            ],
        ])->assertCreated()->json();

        $poId = (int) ($created['id'] ?? 0);
        $this->assertGreaterThan(0, $poId);

        $this->postJson("/api/purchase-orders/{$poId}/submit")->assertOk();

        $this->postJson("/api/purchase-orders/{$poId}/approve")
            ->assertStatus(403)
            ->assertJsonPath('required', 'PO_APPROVE');

        $this->assertDatabaseHas('purchase_orders', [
            'id' => $poId,
            'status' => 'SUBMITTED',
        ]);
    }
}

<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\InventoryBalance;
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

    public function test_manager_can_create_submit_approve_and_receive_po(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->orderBy('id')
            ->firstOrFail();
        $variantId = (int) $balance->product_variant_id;

        $supplier = Supplier::query()->create([
            'name' => 'Feature Test Supplier',
            'is_active' => true,
        ]);

        $beforeQty = (float) $balance->qty_on_hand;
        $qtyOrdered = 2.0;

        $this->actingAsUser('manager@madvapers.local');

        $created = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'branch_id' => $branch->id,
            'notes' => 'Feature test PO',
            'items' => [
                [
                    'product_variant_id' => $variantId,
                    'qty_ordered' => $qtyOrdered,
                    'unit_cost' => 25,
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

        $this->assertTrue(
            StockLedger::query()
                ->where('branch_id', $branch->id)
                ->where('product_variant_id', $variantId)
                ->where('movement_type', 'PO_RECEIVE')
                ->where('ref_type', 'purchase_orders')
                ->where('ref_id', $poId)
                ->exists()
        );
    }

    public function test_clerk_cannot_approve_purchase_order(): void
    {
        $branch = Branch::query()->where('code', 'MOTONG')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->orderBy('id')
            ->firstOrFail();
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

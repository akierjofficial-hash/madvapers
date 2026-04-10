<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Brand;
use App\Models\InventoryBalance;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockAdjustment;
use App\Models\StockLedger;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdjustmentWorkflowTest extends TestCase
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

    public function test_admin_can_create_submit_approve_and_post_adjustment(): void
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

        $beforeQty = (float) $balance->qty_on_hand;
        $variantId = (int) $balance->product_variant_id;
        $qtyDelta = 2;
        $unitCost = 10.0;

        $variant = ProductVariant::query()->findOrFail($variantId);
        $variant->update(['default_cost' => 8]);
        $beforeGlobalQty = (float) InventoryBalance::query()
            ->where('product_variant_id', $variantId)
            ->sum('qty_on_hand');

        $admin = $this->actingAsUser('admin@madvapers.local');

        $created = $this->postJson('/api/adjustments', [
            'branch_id' => $branch->id,
            'reason_code' => 'CORRECTION',
            'reference_no' => null,
            'notes' => 'Feature test adjustment flow',
            'items' => [
                [
                    'product_variant_id' => $variantId,
                    'qty_delta' => $qtyDelta,
                    'unit_cost' => $unitCost,
                    'notes' => null,
                ],
            ],
        ])->assertCreated()->json();

        $adjustmentId = (int) ($created['id'] ?? 0);
        $this->assertGreaterThan(0, $adjustmentId);

        $this->postJson("/api/adjustments/{$adjustmentId}/submit")->assertOk();
        $this->postJson("/api/adjustments/{$adjustmentId}/approve")->assertOk();
        $this->postJson("/api/adjustments/{$adjustmentId}/post")->assertOk();

        $this->assertDatabaseHas('stock_adjustments', [
            'id' => $adjustmentId,
            'status' => 'POSTED',
            'branch_id' => $branch->id,
        ]);

        $afterQty = (float) InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $variantId)
            ->value('qty_on_hand');

        $this->assertSame($beforeQty + $qtyDelta, $afterQty);

        $expectedDefaultCost = round((($beforeGlobalQty * 8.0) + ($qtyDelta * $unitCost)) / ($beforeGlobalQty + $qtyDelta), 2);
        $actualDefaultCost = (float) ProductVariant::query()->findOrFail($variantId)->default_cost;
        $this->assertSame($expectedDefaultCost, $actualDefaultCost);

        $this->assertTrue(
            StockLedger::query()
                ->where('branch_id', $branch->id)
                ->where('product_variant_id', $variantId)
                ->where('movement_type', 'ADJUSTMENT')
                ->where('ref_type', 'stock_adjustments')
                ->where('ref_id', $adjustmentId)
                ->exists()
        );

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'ADJUSTMENT_DRAFT_CREATED',
            'entity_type' => 'adjustment',
            'entity_id' => $adjustmentId,
            'branch_id' => $branch->id,
            'user_id' => $admin->id,
        ]);

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'ADJUSTMENT_SUBMITTED',
            'entity_type' => 'adjustment',
            'entity_id' => $adjustmentId,
            'branch_id' => $branch->id,
            'user_id' => $admin->id,
        ]);

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'ADJUSTMENT_APPROVED',
            'entity_type' => 'adjustment',
            'entity_id' => $adjustmentId,
            'branch_id' => $branch->id,
            'user_id' => $admin->id,
        ]);

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'ADJUSTMENT_POSTED',
            'entity_type' => 'adjustment',
            'entity_id' => $adjustmentId,
            'branch_id' => $branch->id,
            'user_id' => $admin->id,
        ]);
    }

    public function test_clerk_cannot_view_or_create_adjustments(): void
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

        $this->actingAsUser('clerk@madvapers.local');

        $this->getJson('/api/adjustments')->assertStatus(403);

        $this->postJson('/api/adjustments', [
            'branch_id' => $branch->id,
            'reason_code' => 'CORRECTION',
            'items' => [
                [
                    'product_variant_id' => (int) $balance->product_variant_id,
                    'qty_delta' => 1,
                    'unit_cost' => 0,
                ],
            ],
        ])->assertStatus(403);
    }

    public function test_cashier_cannot_view_adjustments(): void
    {
        $this->actingAsUser('cashier@madvapers.local');
        $this->getJson('/api/adjustments')->assertStatus(403);
    }

    public function test_adjustment_submit_blocks_negative_qty_when_stock_is_insufficient(): void
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

        $onHand = (float) ($balance->qty_on_hand ?? 0);
        $required = $onHand + 1.0;

        $this->actingAsUser('admin@madvapers.local');

        $created = $this->postJson('/api/adjustments', [
            'branch_id' => $branch->id,
            'reason_code' => 'CORRECTION',
            'items' => [
                [
                    'product_variant_id' => (int) $balance->product_variant_id,
                    'qty_delta' => -1 * $required,
                    'unit_cost' => 0,
                ],
            ],
        ])->assertCreated()->json();

        $adjustmentId = (int) ($created['id'] ?? 0);
        $this->assertGreaterThan(0, $adjustmentId);

        $this->postJson("/api/adjustments/{$adjustmentId}/submit")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['stock', 'details']);

        $this->assertDatabaseHas('stock_adjustments', [
            'id' => $adjustmentId,
            'status' => 'DRAFT',
        ]);
    }
}

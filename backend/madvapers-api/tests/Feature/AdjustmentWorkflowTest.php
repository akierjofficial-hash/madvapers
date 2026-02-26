<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\InventoryBalance;
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

    public function test_manager_can_create_submit_approve_and_post_adjustment(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->orderBy('id')
            ->firstOrFail();

        $beforeQty = (float) $balance->qty_on_hand;
        $variantId = (int) $balance->product_variant_id;
        $qtyDelta = 2;

        $this->actingAsUser('manager@madvapers.local');

        $created = $this->postJson('/api/adjustments', [
            'branch_id' => $branch->id,
            'reason_code' => 'CORRECTION',
            'reference_no' => null,
            'notes' => 'Feature test adjustment flow',
            'items' => [
                [
                    'product_variant_id' => $variantId,
                    'qty_delta' => $qtyDelta,
                    'unit_cost' => 10,
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

        $this->assertTrue(
            StockLedger::query()
                ->where('branch_id', $branch->id)
                ->where('product_variant_id', $variantId)
                ->where('movement_type', 'ADJUSTMENT')
                ->where('ref_type', 'stock_adjustments')
                ->where('ref_id', $adjustmentId)
                ->exists()
        );
    }

    public function test_clerk_can_submit_but_cannot_approve_adjustment(): void
    {
        $branch = Branch::query()->where('code', 'MOTONG')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->orderBy('id')
            ->firstOrFail();

        $this->actingAsUser('clerk@madvapers.local');

        $created = $this->postJson('/api/adjustments', [
            'branch_id' => $branch->id,
            'reason_code' => 'CORRECTION',
            'items' => [
                [
                    'product_variant_id' => (int) $balance->product_variant_id,
                    'qty_delta' => 1,
                    'unit_cost' => 0,
                ],
            ],
        ])->assertCreated()->json();

        $adjustmentId = (int) ($created['id'] ?? 0);
        $this->assertGreaterThan(0, $adjustmentId);

        $this->postJson("/api/adjustments/{$adjustmentId}/submit")->assertOk();

        $this->postJson("/api/adjustments/{$adjustmentId}/approve")
            ->assertStatus(403)
            ->assertJsonPath('required', 'ADJUSTMENT_APPROVE');

        $this->assertDatabaseHas('stock_adjustments', [
            'id' => $adjustmentId,
            'status' => 'SUBMITTED',
        ]);
    }

    public function test_cashier_cannot_view_adjustments(): void
    {
        $this->actingAsUser('cashier@madvapers.local');
        $this->getJson('/api/adjustments')->assertStatus(403);
    }
}


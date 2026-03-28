<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\InventoryBalance;
use App\Models\ProductVariant;
use App\Models\StockLedger;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TransferWorkflowTest extends TestCase
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

    public function test_transfer_workflow_request_approve_dispatch_receive(): void
    {
        $fromBranch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $toBranch = Branch::query()->where('code', 'MOTONG')->firstOrFail();

        $sourceBalance = InventoryBalance::query()
            ->where('branch_id', $fromBranch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $variantId = (int) $sourceBalance->product_variant_id;
        $qty = 1.0;

        $beforeFrom = (float) InventoryBalance::query()
            ->where('branch_id', $fromBranch->id)
            ->where('product_variant_id', $variantId)
            ->value('qty_on_hand');

        $beforeTo = (float) InventoryBalance::query()
            ->where('branch_id', $toBranch->id)
            ->where('product_variant_id', $variantId)
            ->value('qty_on_hand');

        $manager = $this->actingAsUser('manager@madvapers.local');
        $created = $this->postJson('/api/transfers', [
            'from_branch_id' => $fromBranch->id,
            'to_branch_id' => $toBranch->id,
            'notes' => 'Feature test transfer',
            'items' => [
                [
                    'product_variant_id' => $variantId,
                    'qty' => $qty,
                    'unit_cost' => 0,
                ],
            ],
        ])->assertCreated()->json();

        $transferId = (int) ($created['id'] ?? 0);
        $this->assertGreaterThan(0, $transferId);

        $this->postJson("/api/transfers/{$transferId}/request")->assertOk();
        $this->postJson("/api/transfers/{$transferId}/approve")->assertOk();
        $this->postJson("/api/transfers/{$transferId}/dispatch")->assertOk();

        $clerk = $this->actingAsUser('clerk@madvapers.local');
        $this->postJson("/api/transfers/{$transferId}/receive")->assertOk();

        $this->assertDatabaseHas('transfers', [
            'id' => $transferId,
            'status' => 'RECEIVED',
        ]);

        $afterFrom = (float) InventoryBalance::query()
            ->where('branch_id', $fromBranch->id)
            ->where('product_variant_id', $variantId)
            ->value('qty_on_hand');

        $afterTo = (float) InventoryBalance::query()
            ->where('branch_id', $toBranch->id)
            ->where('product_variant_id', $variantId)
            ->value('qty_on_hand');

        $this->assertSame($beforeFrom - $qty, $afterFrom);
        $this->assertSame($beforeTo + $qty, $afterTo);

        $this->assertTrue(
            StockLedger::query()
                ->where('branch_id', $fromBranch->id)
                ->where('product_variant_id', $variantId)
                ->where('movement_type', 'TRANSFER_OUT')
                ->where('ref_type', 'transfers')
                ->where('ref_id', $transferId)
                ->exists()
        );

        $this->assertTrue(
            StockLedger::query()
                ->where('branch_id', $toBranch->id)
                ->where('product_variant_id', $variantId)
                ->where('movement_type', 'TRANSFER_IN')
                ->where('ref_type', 'transfers')
                ->where('ref_id', $transferId)
                ->exists()
        );

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'TRANSFER_DRAFT_CREATED',
            'entity_type' => 'transfer',
            'entity_id' => $transferId,
            'branch_id' => $fromBranch->id,
            'user_id' => $manager->id,
        ]);

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'TRANSFER_REQUESTED',
            'entity_type' => 'transfer',
            'entity_id' => $transferId,
            'branch_id' => $fromBranch->id,
            'user_id' => $manager->id,
        ]);

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'TRANSFER_APPROVED',
            'entity_type' => 'transfer',
            'entity_id' => $transferId,
            'branch_id' => $toBranch->id,
            'user_id' => $manager->id,
        ]);

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'TRANSFER_DISPATCHED',
            'entity_type' => 'transfer',
            'entity_id' => $transferId,
            'branch_id' => $fromBranch->id,
            'user_id' => $manager->id,
        ]);

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'TRANSFER_RECEIVED',
            'entity_type' => 'transfer',
            'entity_id' => $transferId,
            'branch_id' => $toBranch->id,
            'user_id' => $clerk->id,
        ]);
    }

    public function test_clerk_cannot_create_transfer_from_unassigned_branch(): void
    {
        $bagacay = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $motong = Branch::query()->where('code', 'MOTONG')->firstOrFail();
        $variant = ProductVariant::query()->orderBy('id')->firstOrFail();

        $this->actingAsUser('clerk@madvapers.local');

        $this->postJson('/api/transfers', [
            'from_branch_id' => $bagacay->id,
            'to_branch_id' => $motong->id,
            'items' => [
                [
                    'product_variant_id' => $variant->id,
                    'qty' => 1,
                    'unit_cost' => 0,
                ],
            ],
        ])->assertStatus(403)
            ->assertJsonPath('message', 'Forbidden branch access.');
    }
}

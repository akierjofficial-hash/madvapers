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

        $admin = $this->actingAsUser('admin@madvapers.local');
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
            'user_id' => $admin->id,
        ]);

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'TRANSFER_REQUESTED',
            'entity_type' => 'transfer',
            'entity_id' => $transferId,
            'branch_id' => $fromBranch->id,
            'user_id' => $admin->id,
        ]);

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'TRANSFER_APPROVED',
            'entity_type' => 'transfer',
            'entity_id' => $transferId,
            'branch_id' => $toBranch->id,
            'user_id' => $admin->id,
        ]);

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'TRANSFER_DISPATCHED',
            'entity_type' => 'transfer',
            'entity_id' => $transferId,
            'branch_id' => $fromBranch->id,
            'user_id' => $admin->id,
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

    public function test_clerk_branch_options_allow_all_active_destination_branches(): void
    {
        $clerk = $this->actingAsUser('clerk@madvapers.local');

        $assignedBranchIds = $clerk->branches()->pluck('branches.id')->map(fn ($id) => (int) $id)->all();
        if ($clerk->branch_id) {
            $assignedBranchIds[] = (int) $clerk->branch_id;
        }

        $assignedBranchIds = array_values(array_unique(array_filter($assignedBranchIds, fn ($id) => $id > 0)));
        sort($assignedBranchIds);

        $activeBranchIds = Branch::query()
            ->where('is_active', true)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
        sort($activeBranchIds);

        $payload = $this->getJson('/api/transfers/branch-options')
            ->assertOk()
            ->json();

        $fromBranchIds = collect($payload['from_branches'] ?? [])
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->sort()
            ->values()
            ->all();

        $toBranchIds = collect($payload['to_branches'] ?? [])
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->sort()
            ->values()
            ->all();

        $this->assertSame($assignedBranchIds, $fromBranchIds);
        $this->assertSame($activeBranchIds, $toBranchIds);
    }

    public function test_clerk_can_see_incoming_transfer_in_from_branch_filtered_list(): void
    {
        $clerk = User::query()->where('email', 'clerk@madvapers.local')->firstOrFail();

        $assignedBranchIds = $clerk->branches()->pluck('branches.id')->map(fn ($id) => (int) $id)->all();
        if ($clerk->branch_id) {
            $assignedBranchIds[] = (int) $clerk->branch_id;
        }
        $assignedBranchIds = array_values(array_unique(array_filter($assignedBranchIds, fn ($id) => $id > 0)));
        sort($assignedBranchIds);

        $toBranchId = $assignedBranchIds[0] ?? 0;
        $this->assertGreaterThan(0, $toBranchId, 'Clerk must have at least one assigned branch.');

        $fromBranchId = (int) Branch::query()
            ->where('is_active', true)
            ->where('id', '!=', $toBranchId)
            ->orderBy('id')
            ->value('id');
        $this->assertGreaterThan(0, $fromBranchId);

        $sourceBalance = InventoryBalance::query()
            ->where('branch_id', $fromBranchId)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $this->actingAsUser('admin@madvapers.local');
        $created = $this->postJson('/api/transfers', [
            'from_branch_id' => $fromBranchId,
            'to_branch_id' => $toBranchId,
            'notes' => 'Incoming transfer visibility test',
            'items' => [
                [
                    'product_variant_id' => (int) $sourceBalance->product_variant_id,
                    'qty' => 1,
                    'unit_cost' => 0,
                ],
            ],
        ])->assertCreated()->json();

        $transferId = (int) ($created['id'] ?? 0);
        $this->assertGreaterThan(0, $transferId);

        $this->postJson("/api/transfers/{$transferId}/request")->assertOk();
        $this->postJson("/api/transfers/{$transferId}/approve")->assertOk();
        $this->postJson("/api/transfers/{$transferId}/dispatch")->assertOk();

        $this->actingAsUser('clerk@madvapers.local');
        $rows = $this->getJson("/api/transfers?from_branch_id={$toBranchId}&status=IN_TRANSIT")
            ->assertOk()
            ->json('data');

        $hasTransfer = collect(is_array($rows) ? $rows : [])->contains(function ($row) use ($transferId, $toBranchId) {
            return (int) ($row['id'] ?? 0) === $transferId
                && (int) ($row['to_branch_id'] ?? 0) === $toBranchId
                && strtoupper((string) ($row['status'] ?? '')) === 'IN_TRANSIT';
        });

        $this->assertTrue($hasTransfer, 'Incoming IN_TRANSIT transfer should be visible in clerk list.');
    }

    public function test_transfer_request_blocks_when_source_stock_is_insufficient(): void
    {
        $sourceBalance = InventoryBalance::query()
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $fromBranchId = (int) $sourceBalance->branch_id;
        $variantId = (int) $sourceBalance->product_variant_id;
        $onHand = (float) $sourceBalance->qty_on_hand;
        $requestedQty = $onHand + 1.0;

        $toBranchId = (int) Branch::query()
            ->where('is_active', true)
            ->where('id', '!=', $fromBranchId)
            ->orderBy('id')
            ->value('id');

        $this->assertGreaterThan(0, $toBranchId);

        $this->actingAsUser('admin@madvapers.local');

        $created = $this->postJson('/api/transfers', [
            'from_branch_id' => $fromBranchId,
            'to_branch_id' => $toBranchId,
            'notes' => 'Insufficient stock transfer request',
            'items' => [
                [
                    'product_variant_id' => $variantId,
                    'qty' => $requestedQty,
                    'unit_cost' => 0,
                ],
            ],
        ])->assertCreated()->json();

        $transferId = (int) ($created['id'] ?? 0);
        $this->assertGreaterThan(0, $transferId);

        $this->postJson("/api/transfers/{$transferId}/request")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['stock', 'details']);

        $this->assertDatabaseHas('transfers', [
            'id' => $transferId,
            'status' => 'DRAFT',
        ]);
    }
}

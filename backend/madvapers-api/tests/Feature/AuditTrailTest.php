<?php

namespace Tests\Feature;

use App\Models\AuditEvent;
use App\Models\Branch;
use App\Models\InventoryBalance;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuditTrailTest extends TestCase
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

    public function test_cashier_cannot_view_audit_events(): void
    {
        $this->actingAsUser('cashier@madvapers.local');

        $this->getJson('/api/audit/events')
            ->assertStatus(403)
            ->assertJsonPath('required', 'AUDIT_VIEW');
    }

    public function test_auditor_can_view_filtered_audit_events(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $this->actingAsUser('manager@madvapers.local');

        $expense = $this->postJson('/api/expenses', [
            'branch_id' => $branch->id,
            'category' => 'OPERATIONS',
            'amount' => 123.45,
            'notes' => 'Audit trail filter test',
        ])
            ->assertCreated()
            ->json();

        $expenseId = (int) ($expense['id'] ?? 0);
        $this->assertGreaterThan(0, $expenseId);

        $this->actingAsUser('auditor@madvapers.local');

        $response = $this->getJson('/api/audit/events?' . http_build_query([
            'event_type' => 'expense_created',
            'entity_type' => 'expense',
            'entity_id' => $expenseId,
        ]))
            ->assertOk()
            ->json();

        $rows = $response['data'] ?? [];
        $this->assertNotEmpty($rows);
        $this->assertSame('EXPENSE_CREATED', $rows[0]['event_type'] ?? null);
        $this->assertSame('expense', $rows[0]['entity_type'] ?? null);
        $this->assertSame($expenseId, (int) ($rows[0]['entity_id'] ?? 0));
        $this->assertSame($branch->id, (int) ($rows[0]['branch_id'] ?? 0));
    }

    public function test_sale_void_flow_writes_expected_audit_events(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $manager = $this->actingAsUser('manager@madvapers.local');
        $sale = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [
                [
                    'product_variant_id' => (int) $balance->product_variant_id,
                    'qty' => 1,
                    'unit_price' => 150,
                ],
            ],
        ])->assertCreated()->json();

        $saleId = (int) ($sale['id'] ?? 0);
        $this->assertGreaterThan(0, $saleId);

        $this->postJson("/api/sales/{$saleId}/post")->assertOk();
        $this->postJson("/api/sales/{$saleId}/payments", [
            'method' => 'CASH',
            'amount' => 150,
        ])->assertOk();

        $cashier = $this->actingAsUser('cashier@madvapers.local');
        $this->postJson("/api/sales/{$saleId}/void-request", [
            'notes' => 'Customer return test',
        ])->assertOk();

        $this->actingAsUser('manager@madvapers.local');
        $this->postJson("/api/sales/{$saleId}/void-approve", [
            'notes' => 'Approved by manager',
        ])->assertOk();

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'SALE_POSTED',
            'entity_type' => 'sale',
            'entity_id' => $saleId,
            'branch_id' => $branch->id,
            'user_id' => $manager->id,
        ]);

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'SALE_PAYMENT_ADDED',
            'entity_type' => 'sale',
            'entity_id' => $saleId,
            'branch_id' => $branch->id,
            'user_id' => $manager->id,
        ]);

        $paymentAudit = AuditEvent::query()
            ->where('event_type', 'SALE_PAYMENT_ADDED')
            ->where('entity_type', 'sale')
            ->where('entity_id', $saleId)
            ->latest('id')
            ->first();
        $this->assertNotNull($paymentAudit);

        $paymentMeta = (array) ($paymentAudit?->meta ?? []);
        $this->assertSame(150.0, (float) ($paymentMeta['amount'] ?? 0));
        $this->assertSame(150.0, (float) ($paymentMeta['sale_grand_total'] ?? 0));
        $this->assertSame(1.0, (float) ($paymentMeta['sale_total_qty'] ?? 0));
        $this->assertSame(1, (int) ($paymentMeta['sale_item_count'] ?? 0));
        $this->assertIsArray($paymentMeta['items_sold'] ?? null);
        $this->assertNotEmpty($paymentMeta['items_sold'] ?? []);
        $this->assertSame(
            (int) $balance->product_variant_id,
            (int) (($paymentMeta['items_sold'][0]['product_variant_id'] ?? 0))
        );
        $this->assertStringContainsString('150.00', (string) ($paymentAudit?->summary ?? ''));

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'SALE_VOID_REQUESTED',
            'entity_type' => 'sale',
            'entity_id' => $saleId,
            'branch_id' => $branch->id,
            'user_id' => $cashier->id,
        ]);

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'SALE_VOID_APPROVED',
            'entity_type' => 'sale',
            'entity_id' => $saleId,
            'branch_id' => $branch->id,
            'user_id' => $manager->id,
        ]);

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'SALE_VOIDED',
            'entity_type' => 'sale',
            'entity_id' => $saleId,
            'branch_id' => $branch->id,
            'user_id' => $manager->id,
        ]);
    }

    public function test_auditor_cannot_query_unassigned_branch_events(): void
    {
        $motong = Branch::query()->where('code', 'MOTONG')->firstOrFail();
        $this->actingAsUser('auditor@madvapers.local');

        $this->getJson('/api/audit/events?branch_id=' . $motong->id)
            ->assertStatus(403)
            ->assertJsonPath('message', 'Forbidden branch access.');
    }
}

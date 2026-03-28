<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Expense;
use App\Models\InventoryBalance;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ExpenseWorkflowTest extends TestCase
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

    public function test_manager_can_create_update_and_void_expense(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $manager = $this->actingAsUser('manager@madvapers.local');

        $created = $this->postJson('/api/expenses', [
            'branch_id' => $branch->id,
            'category' => 'Utilities',
            'amount' => 450.75,
            'notes' => 'Power bill',
        ])
            ->assertCreated()
            ->json();

        $expenseId = (int) ($created['id'] ?? 0);
        $this->assertGreaterThan(0, $expenseId);
        $this->assertNotEmpty($created['expense_number'] ?? null);

        $this->putJson("/api/expenses/{$expenseId}", [
            'amount' => 500.25,
            'notes' => 'Updated utility expense',
        ])
            ->assertOk()
            ->assertJsonPath('amount', 500.25);

        $this->postJson("/api/expenses/{$expenseId}/void")
            ->assertOk()
            ->assertJsonPath('expense.status', 'VOIDED');

        $this->assertDatabaseHas('expenses', [
            'id' => $expenseId,
            'status' => 'VOIDED',
        ]);

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'EXPENSE_CREATED',
            'entity_type' => 'expense',
            'entity_id' => $expenseId,
            'branch_id' => $branch->id,
            'user_id' => $manager->id,
        ]);

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'EXPENSE_UPDATED',
            'entity_type' => 'expense',
            'entity_id' => $expenseId,
            'branch_id' => $branch->id,
            'user_id' => $manager->id,
        ]);

        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'EXPENSE_VOIDED',
            'entity_type' => 'expense',
            'entity_id' => $expenseId,
            'branch_id' => $branch->id,
            'user_id' => $manager->id,
        ]);
    }

    public function test_dashboard_finance_subtracts_posted_expense(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $this->actingAsUser('admin@madvapers.local');

        $sale = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [
                [
                    'product_variant_id' => $balance->product_variant_id,
                    'qty' => 1,
                    'unit_price' => 300,
                ],
            ],
        ])->assertCreated()->json();

        $saleId = (int) ($sale['id'] ?? 0);
        $this->assertGreaterThan(0, $saleId);

        $this->postJson("/api/sales/{$saleId}/post")->assertOk();
        $this->postJson("/api/sales/{$saleId}/payments", [
            'method' => 'CASH',
            'amount' => 300,
        ])->assertOk();

        $expenseAmount = 75.5;
        $this->postJson('/api/expenses', [
            'branch_id' => $branch->id,
            'category' => 'OPERATIONS',
            'amount' => $expenseAmount,
            'notes' => 'Internet bill',
        ])->assertCreated();

        $response = $this->getJson('/api/dashboard/summary?' . http_build_query([
            'branch_id' => $branch->id,
            'date_from' => now()->subDay()->toDateString(),
            'date_to' => now()->addDay()->toDateString(),
        ]))
            ->assertOk()
            ->json();

        $finance = $response['finance'] ?? [];
        $revenue = (float) ($finance['revenue'] ?? 0);
        $cashIn = (float) ($finance['cash_in'] ?? 0);
        $cogs = (float) ($finance['cogs'] ?? 0);
        $grossProfit = (float) ($finance['gross_profit'] ?? 0);
        $restockSpend = (float) ($finance['restock_spend'] ?? 0);
        $expenseTotal = (float) ($finance['expense_total'] ?? 0);
        $netCashflow = (float) ($finance['net_cashflow'] ?? 0);
        $netIncome = (float) ($finance['net_income'] ?? 0);

        $this->assertSame(round($expenseAmount, 2), $expenseTotal);
        $this->assertSame(round($revenue - $cogs, 2), $grossProfit);
        $this->assertSame(round($grossProfit - $expenseTotal, 2), $netIncome);
        $this->assertSame(round($cashIn - $restockSpend - $expenseTotal, 2), $netCashflow);
    }

    public function test_cashier_cannot_view_expenses(): void
    {
        $this->actingAsUser('cashier@madvapers.local');

        $this->getJson('/api/expenses')->assertStatus(403);
    }
}

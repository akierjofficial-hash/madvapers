<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\InventoryBalance;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Models\StockLedger;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SalesWorkflowTest extends TestCase
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

    public function test_manager_can_create_post_and_pay_sale(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $beforeQty = (float) $balance->qty_on_hand;
        $qtySold = 1.0;
        $unitPrice = 199.0;

        $this->actingAsUser('admin@madvapers.local');

        $created = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [
                [
                    'product_variant_id' => $balance->product_variant_id,
                    'qty' => $qtySold,
                    'unit_price' => $unitPrice,
                ],
            ],
        ])->assertCreated()->json();

        $saleId = (int) ($created['id'] ?? 0);
        $this->assertGreaterThan(0, $saleId);

        $this->postJson("/api/sales/{$saleId}/post")
            ->assertOk()
            ->assertJsonPath('sale.status', 'POSTED');

        $afterPostQty = (float) InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $balance->product_variant_id)
            ->value('qty_on_hand');

        $this->assertSame($beforeQty - $qtySold, $afterPostQty);

        $this->assertTrue(
            StockLedger::query()
                ->where('branch_id', $branch->id)
                ->where('product_variant_id', $balance->product_variant_id)
                ->where('movement_type', 'SALE')
                ->where('ref_type', 'sales')
                ->where('ref_id', $saleId)
                ->exists()
        );

        $this->postJson("/api/sales/{$saleId}/payments", [
            'method' => 'cash',
            'amount' => $qtySold * $unitPrice,
        ])
            ->assertOk()
            ->assertJsonPath('sale.payment_status', 'PAID');

        $afterPaidQty = (float) InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $balance->product_variant_id)
            ->value('qty_on_hand');

        $this->assertSame($afterPostQty, $afterPaidQty);

        $this->assertSame(
            1,
            StockLedger::query()
                ->where('branch_id', $branch->id)
                ->where('product_variant_id', $balance->product_variant_id)
                ->where('movement_type', 'SALE')
                ->where('ref_type', 'sales')
                ->where('ref_id', $saleId)
                ->count()
        );

        $this->assertDatabaseHas('sales', [
            'id' => $saleId,
            'status' => 'POSTED',
            'payment_status' => 'PAID',
        ]);
    }

    public function test_payment_can_settle_sale_even_if_branch_balance_changes_after_posting(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $balance->qty_on_hand = 2;
        $balance->save();

        $this->actingAsUser('admin@madvapers.local');

        $sale = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [
                [
                    'product_variant_id' => $balance->product_variant_id,
                    'qty' => 1,
                    'unit_price' => 100,
                ],
            ],
        ])->assertCreated()->json();

        $saleId = (int) ($sale['id'] ?? 0);
        $this->assertGreaterThan(0, $saleId);

        $this->postJson("/api/sales/{$saleId}/post")
            ->assertOk()
            ->assertJsonPath('sale.status', 'POSTED');

        $afterPostQty = (float) InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $balance->product_variant_id)
            ->value('qty_on_hand');
        $this->assertSame(1.0, $afterPostQty);

        InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $balance->product_variant_id)
            ->update(['qty_on_hand' => 0]);

        $this->postJson("/api/sales/{$saleId}/payments", [
            'method' => 'CASH',
            'amount' => 100,
        ])
            ->assertOk()
            ->assertJsonPath('sale.payment_status', 'PAID');

        $this->assertDatabaseHas('sales', [
            'id' => $saleId,
            'status' => 'POSTED',
            'payment_status' => 'PAID',
        ]);

        $this->assertSame(
            1,
            StockLedger::query()
                ->where('ref_type', 'sales')
                ->where('ref_id', $saleId)
                ->where('movement_type', 'SALE')
                ->count()
        );
    }

    public function test_admin_can_filter_sales_by_cashier_and_date_range(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balances = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->take(2)
            ->get();

        $this->assertCount(2, $balances);

        $cashier = User::query()->where('email', 'cashier@madvapers.local')->firstOrFail();
        $cashier->branch_id = $branch->id;
        $cashier->save();
        $cashier->branches()->syncWithoutDetaching([$branch->id]);

        Sanctum::actingAs($cashier->fresh());
        $cashierSale = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [[
                'product_variant_id' => $balances[0]->product_variant_id,
                'qty' => 1,
                'unit_price' => 100,
            ]],
        ])->assertCreated()->json();
        $cashierSaleId = (int) ($cashierSale['id'] ?? 0);
        $this->postJson("/api/sales/{$cashierSaleId}/post")->assertOk();
        Sale::query()->whereKey($cashierSaleId)->update([
            'created_at' => '2030-01-05 09:00:00',
            'updated_at' => '2030-01-05 09:00:00',
            'posted_at' => '2030-01-05 09:15:00',
        ]);

        $admin = User::query()->where('email', 'admin@madvapers.local')->firstOrFail();
        Sanctum::actingAs($admin);
        $adminSale = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [[
                'product_variant_id' => $balances[1]->product_variant_id,
                'qty' => 1,
                'unit_price' => 120,
            ]],
        ])->assertCreated()->json();
        $adminSaleId = (int) ($adminSale['id'] ?? 0);
        $this->postJson("/api/sales/{$adminSaleId}/post")->assertOk();
        Sale::query()->whereKey($adminSaleId)->update([
            'created_at' => '2030-01-10 09:00:00',
            'updated_at' => '2030-01-10 09:00:00',
            'posted_at' => '2030-01-10 09:15:00',
        ]);

        $this->actingAsUser('admin@madvapers.local');

        $this->getJson("/api/sales?branch_id={$branch->id}&cashier_search=Cashier&date_from=2030-01-01&date_to=2030-01-07")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $cashierSaleId)
            ->assertJsonPath('data.0.cashier.name', 'Cashier');

        $this->getJson("/api/sales?branch_id={$branch->id}&cashier_search=Admin&date_from=2030-01-08&date_to=2030-01-31")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $adminSaleId)
            ->assertJsonPath('data.0.cashier.name', 'Admin');
    }

    public function test_admin_can_view_daily_totals_filtered_by_cashier_and_date_range(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balances = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->take(3)
            ->get();

        $this->assertCount(3, $balances);

        $cashier = User::query()->where('email', 'cashier@madvapers.local')->firstOrFail();
        $cashier->branch_id = $branch->id;
        $cashier->save();
        $cashier->branches()->syncWithoutDetaching([$branch->id]);

        Sanctum::actingAs($cashier->fresh());

        $cashierSaleOne = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [[
                'product_variant_id' => $balances[0]->product_variant_id,
                'qty' => 1,
                'unit_price' => 100,
                'line_discount' => 10,
            ]],
        ])->assertCreated()->json();
        $cashierSaleOneId = (int) ($cashierSaleOne['id'] ?? 0);
        $this->postJson("/api/sales/{$cashierSaleOneId}/post")->assertOk();
        $this->postJson("/api/sales/{$cashierSaleOneId}/payments", [
            'method' => 'CASH',
            'amount' => 90,
        ])->assertOk();
        Sale::query()->whereKey($cashierSaleOneId)->update([
            'created_at' => '2030-01-05 08:00:00',
            'updated_at' => '2030-01-05 08:30:00',
            'posted_at' => '2030-01-05 08:15:00',
        ]);

        $cashierSaleTwo = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [[
                'product_variant_id' => $balances[1]->product_variant_id,
                'qty' => 2,
                'unit_price' => 50,
            ]],
        ])->assertCreated()->json();
        $cashierSaleTwoId = (int) ($cashierSaleTwo['id'] ?? 0);
        $this->postJson("/api/sales/{$cashierSaleTwoId}/post")->assertOk();
        Sale::query()->whereKey($cashierSaleTwoId)->update([
            'created_at' => '2030-01-05 17:00:00',
            'updated_at' => '2030-01-05 17:05:00',
            'posted_at' => '2030-01-05 17:05:00',
        ]);

        $admin = User::query()->where('email', 'admin@madvapers.local')->firstOrFail();
        Sanctum::actingAs($admin);

        $adminSale = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [[
                'product_variant_id' => $balances[2]->product_variant_id,
                'qty' => 1,
                'unit_price' => 120,
            ]],
        ])->assertCreated()->json();
        $adminSaleId = (int) ($adminSale['id'] ?? 0);
        $this->postJson("/api/sales/{$adminSaleId}/post")->assertOk();
        Sale::query()->whereKey($adminSaleId)->update([
            'created_at' => '2030-01-10 09:00:00',
            'updated_at' => '2030-01-10 09:15:00',
            'posted_at' => '2030-01-10 09:15:00',
        ]);

        $this->actingAsUser('admin@madvapers.local');

        $this->getJson("/api/sales/daily-totals?branch_id={$branch->id}&cashier_search=Cashier&date_from=2030-01-01&date_to=2030-01-07")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.sale_date', '2030-01-05')
            ->assertJsonPath('data.0.transactions_count', 2)
            ->assertJsonPath('data.0.items_sold', 3)
            ->assertJsonPath('data.0.gross_total', 200)
            ->assertJsonPath('data.0.discount_total', 10)
            ->assertJsonPath('data.0.net_sales', 190)
            ->assertJsonPath('data.0.paid_total', 90)
            ->assertJsonPath('data.0.unpaid_total', 100);
    }

    public function test_cannot_post_sale_when_stock_was_already_consumed_by_previous_posted_sale(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $balance->qty_on_hand = 1;
        $balance->save();

        $this->actingAsUser('admin@madvapers.local');

        $firstSale = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [
                [
                    'product_variant_id' => $balance->product_variant_id,
                    'qty' => 1,
                    'unit_price' => 150,
                ],
            ],
        ])->assertCreated()->json();

        $firstSaleId = (int) ($firstSale['id'] ?? 0);
        $this->assertGreaterThan(0, $firstSaleId);
        $this->postJson("/api/sales/{$firstSaleId}/post")
            ->assertOk()
            ->assertJsonPath('sale.status', 'POSTED');

        $afterFirstPostQty = (float) InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $balance->product_variant_id)
            ->value('qty_on_hand');
        $this->assertSame(0.0, $afterFirstPostQty);

        $secondSale = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [
                [
                    'product_variant_id' => $balance->product_variant_id,
                    'qty' => 1,
                    'unit_price' => 155,
                ],
            ],
        ])->assertCreated()->json();

        $secondSaleId = (int) ($secondSale['id'] ?? 0);
        $this->assertGreaterThan(0, $secondSaleId);

        $this->postJson("/api/sales/{$secondSaleId}/post")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['stock']);

        $this->assertDatabaseHas('sales', [
            'id' => $secondSaleId,
            'status' => 'DRAFT',
        ]);
    }

    public function test_cannot_add_payment_when_sale_is_fully_paid(): void
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
        ])
            ->assertOk()
            ->assertJsonPath('sale.payment_status', 'PAID');

        $this->postJson("/api/sales/{$saleId}/payments", [
            'method' => 'CASH',
            'amount' => 10,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['amount']);
    }

    public function test_payment_can_apply_discount_to_settle_sale(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $startingQty = 5.0;
        $unitPrice = 600.0;
        $discountedFinalTotal = 550.0;

        $balance->qty_on_hand = $startingQty;
        $balance->save();

        $this->actingAsUser('admin@madvapers.local');

        $sale = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [
                [
                    'product_variant_id' => $balance->product_variant_id,
                    'qty' => 1,
                    'unit_price' => $unitPrice,
                ],
            ],
        ])->assertCreated()->json();

        $saleId = (int) ($sale['id'] ?? 0);
        $this->assertGreaterThan(0, $saleId);

        $this->postJson("/api/sales/{$saleId}/post")->assertOk();

        $paymentResponse = $this->postJson("/api/sales/{$saleId}/payments", [
            'method' => 'CASH',
            'amount' => $discountedFinalTotal,
            'apply_discount_to_settle' => true,
        ])->assertOk()
            ->assertJsonPath('sale.payment_status', 'PAID');

        $paidSale = $paymentResponse->json('sale');
        $this->assertSame($discountedFinalTotal, (float) ($paidSale['grand_total'] ?? 0));
        $this->assertSame($discountedFinalTotal, (float) ($paidSale['paid_total'] ?? 0));
        $this->assertSame($unitPrice - $discountedFinalTotal, (float) ($paidSale['discount_total'] ?? 0));

        $afterPaidQty = (float) InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $balance->product_variant_id)
            ->value('qty_on_hand');
        $this->assertSame($startingQty - 1.0, $afterPaidQty);

        $this->assertDatabaseHas('sales', [
            'id' => $saleId,
            'status' => 'POSTED',
            'payment_status' => 'PAID',
            'grand_total' => $discountedFinalTotal,
            'paid_total' => $discountedFinalTotal,
            'discount_total' => $unitPrice - $discountedFinalTotal,
        ]);

        $this->assertDatabaseHas('sale_payments', [
            'sale_id' => $saleId,
            'amount' => $discountedFinalTotal,
        ]);

        $this->assertTrue(
            StockLedger::query()
                ->where('branch_id', $branch->id)
                ->where('product_variant_id', $balance->product_variant_id)
                ->where('movement_type', 'SALE')
                ->where('ref_type', 'sales')
                ->where('ref_id', $saleId)
                ->exists()
        );
    }

    public function test_cashier_can_create_post_and_pay_sale_in_hayahay_branch(): void
    {
        $branch = Branch::query()->where('code', 'HAYAHAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $startingQty = (float) $balance->qty_on_hand;

        $cashier = User::query()->where('email', 'cashier@madvapers.local')->firstOrFail();
        $cashier->branch_id = $branch->id;
        $cashier->save();
        $cashier->branches()->sync([$branch->id]);

        Sanctum::actingAs($cashier->fresh());

        $sale = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [
                [
                    'product_variant_id' => $balance->product_variant_id,
                    'qty' => 1,
                    'unit_price' => 125,
                ],
            ],
        ])->assertCreated()->json();

        $saleId = (int) ($sale['id'] ?? 0);
        $this->assertGreaterThan(0, $saleId);

        $this->postJson("/api/sales/{$saleId}/post")
            ->assertOk()
            ->assertJsonPath('sale.status', 'POSTED');

        $afterPostQty = (float) InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $balance->product_variant_id)
            ->value('qty_on_hand');
        $this->assertSame($startingQty - 1, $afterPostQty);

        $this->postJson("/api/sales/{$saleId}/payments", [
            'method' => 'CASH',
            'amount' => 125,
        ])
            ->assertOk()
            ->assertJsonPath('sale.payment_status', 'PAID');

        $afterPaidQty = (float) InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $balance->product_variant_id)
            ->value('qty_on_hand');

        $this->assertSame($afterPostQty, $afterPaidQty);
    }

    public function test_voiding_paid_sale_restores_stock_and_prevents_double_reversal(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $startingQty = 5.0;
        $qtySold = 2.0;
        $unitPrice = 175.0;

        $balance->qty_on_hand = $startingQty;
        $balance->save();

        $manager = $this->actingAsUser('admin@madvapers.local');

        $sale = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [
                [
                    'product_variant_id' => $balance->product_variant_id,
                    'qty' => $qtySold,
                    'unit_price' => $unitPrice,
                ],
            ],
        ])->assertCreated()->json();

        $saleId = (int) ($sale['id'] ?? 0);
        $this->assertGreaterThan(0, $saleId);

        $this->postJson("/api/sales/{$saleId}/post")->assertOk();
        $this->postJson("/api/sales/{$saleId}/payments", [
            'method' => 'CASH',
            'amount' => $qtySold * $unitPrice,
        ])->assertOk();

        $afterPaidQty = (float) InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $balance->product_variant_id)
            ->value('qty_on_hand');
        $this->assertSame($startingQty - $qtySold, $afterPaidQty);

        $this->postJson("/api/sales/{$saleId}/void", [
            'notes' => 'Customer canceled order',
        ])
            ->assertOk()
            ->assertJsonPath('sale.status', 'VOIDED');

        $afterVoidQty = (float) InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $balance->product_variant_id)
            ->value('qty_on_hand');
        $this->assertSame($startingQty, $afterVoidQty);

        $voidCount = StockLedger::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $balance->product_variant_id)
            ->where('movement_type', 'SALE_VOID')
            ->where('ref_type', 'sales')
            ->where('ref_id', $saleId)
            ->count();
        $this->assertSame(1, $voidCount);

        $this->postJson("/api/sales/{$saleId}/void")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);

        $voidCountAfterSecondAttempt = StockLedger::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $balance->product_variant_id)
            ->where('movement_type', 'SALE_VOID')
            ->where('ref_type', 'sales')
            ->where('ref_id', $saleId)
            ->count();
        $this->assertSame(1, $voidCountAfterSecondAttempt);

        $this->assertDatabaseHas('sales', [
            'id' => $saleId,
            'status' => 'VOIDED',
            'voided_by_user_id' => $manager->id,
        ]);
    }

    public function test_cannot_add_payment_after_sale_is_voided(): void
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
                    'unit_price' => 150,
                ],
            ],
        ])->assertCreated()->json();

        $saleId = (int) ($sale['id'] ?? 0);
        $this->assertGreaterThan(0, $saleId);

        $this->postJson("/api/sales/{$saleId}/post")->assertOk();
        $this->postJson("/api/sales/{$saleId}/void")->assertOk();

        $this->postJson("/api/sales/{$saleId}/payments", [
            'method' => 'CASH',
            'amount' => 150,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    public function test_cashier_cannot_void_sale_without_sales_void_permission(): void
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
                    'unit_price' => 100,
                ],
            ],
        ])->assertCreated()->json();

        $saleId = (int) ($sale['id'] ?? 0);
        $this->assertGreaterThan(0, $saleId);
        $this->postJson("/api/sales/{$saleId}/post")->assertOk();

        $this->actingAsUser('cashier@madvapers.local');

        $this->postJson("/api/sales/{$saleId}/void")
            ->assertStatus(403);
    }

    public function test_cashier_can_request_void_and_manager_can_approve(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $startingQty = (float) $balance->qty_on_hand;

        $manager = $this->actingAsUser('admin@madvapers.local');
        $sale = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [
                [
                    'product_variant_id' => $balance->product_variant_id,
                    'qty' => 1,
                    'unit_price' => 100,
                ],
            ],
        ])->assertCreated()->json();

        $saleId = (int) ($sale['id'] ?? 0);
        $this->assertGreaterThan(0, $saleId);
        $this->postJson("/api/sales/{$saleId}/post")->assertOk();
        $this->postJson("/api/sales/{$saleId}/payments", [
            'method' => 'CASH',
            'amount' => 100,
        ])->assertOk();

        $qtyAfterPaid = (float) InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $balance->product_variant_id)
            ->value('qty_on_hand');
        $this->assertSame($startingQty - 1, $qtyAfterPaid);

        $cashier = $this->actingAsUser('cashier@madvapers.local');
        $this->postJson("/api/sales/{$saleId}/void-request", [
            'notes' => 'Customer returned sealed product',
        ])
            ->assertOk()
            ->assertJsonPath('sale.status', 'POSTED')
            ->assertJsonPath('sale.void_request_status', 'PENDING');

        $this->assertDatabaseHas('sales', [
            'id' => $saleId,
            'status' => 'POSTED',
            'void_request_status' => 'PENDING',
            'void_requested_by_user_id' => $cashier->id,
        ]);

        $this->actingAsUser('admin@madvapers.local');
        $this->postJson("/api/sales/{$saleId}/void-approve")
            ->assertOk()
            ->assertJsonPath('sale.status', 'VOIDED')
            ->assertJsonPath('sale.void_request_status', 'APPROVED');

        $qtyAfterApprovedVoid = (float) InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $balance->product_variant_id)
            ->value('qty_on_hand');
        $this->assertSame($startingQty, $qtyAfterApprovedVoid);

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

    public function test_manager_can_reject_void_request(): void
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
                    'unit_price' => 100,
                ],
            ],
        ])->assertCreated()->json();

        $saleId = (int) ($sale['id'] ?? 0);
        $this->assertGreaterThan(0, $saleId);
        $this->postJson("/api/sales/{$saleId}/post")->assertOk();

        $this->actingAsUser('cashier@madvapers.local');
        $this->postJson("/api/sales/{$saleId}/void-request", [
            'notes' => 'Wrong item selected',
        ])
            ->assertOk()
            ->assertJsonPath('sale.void_request_status', 'PENDING');

        $manager = $this->actingAsUser('admin@madvapers.local');
        $this->postJson("/api/sales/{$saleId}/void-reject", [
            'notes' => 'Proceed with sale',
        ])
            ->assertOk()
            ->assertJsonPath('sale.status', 'POSTED')
            ->assertJsonPath('sale.void_request_status', 'REJECTED');

        $this->assertDatabaseHas('sales', [
            'id' => $saleId,
            'status' => 'POSTED',
            'void_request_status' => 'REJECTED',
            'void_rejected_by_user_id' => $manager->id,
        ]);
    }

    public function test_requester_cannot_approve_own_void_request(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $manager = $this->actingAsUser('admin@madvapers.local');
        $sale = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [
                [
                    'product_variant_id' => $balance->product_variant_id,
                    'qty' => 1,
                    'unit_price' => 100,
                ],
            ],
        ])->assertCreated()->json();

        $saleId = (int) ($sale['id'] ?? 0);
        $this->assertGreaterThan(0, $saleId);
        $this->postJson("/api/sales/{$saleId}/post")->assertOk();
        $this->postJson("/api/sales/{$saleId}/void-request", [
            'notes' => 'Requesting manual void',
        ])->assertOk();

        $this->postJson("/api/sales/{$saleId}/void-approve")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['void_request_status']);

        $this->assertDatabaseHas('sales', [
            'id' => $saleId,
            'status' => 'POSTED',
            'void_request_status' => 'PENDING',
            'void_requested_by_user_id' => $manager->id,
        ]);
    }

    public function test_requester_cannot_reject_own_void_request(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $manager = $this->actingAsUser('admin@madvapers.local');
        $sale = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [
                [
                    'product_variant_id' => $balance->product_variant_id,
                    'qty' => 1,
                    'unit_price' => 100,
                ],
            ],
        ])->assertCreated()->json();

        $saleId = (int) ($sale['id'] ?? 0);
        $this->assertGreaterThan(0, $saleId);
        $this->postJson("/api/sales/{$saleId}/post")->assertOk();
        $this->postJson("/api/sales/{$saleId}/void-request", [
            'notes' => 'Requesting manual void',
        ])->assertOk();

        $this->postJson("/api/sales/{$saleId}/void-reject")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['void_request_status']);

        $this->assertDatabaseHas('sales', [
            'id' => $saleId,
            'status' => 'POSTED',
            'void_request_status' => 'PENDING',
            'void_requested_by_user_id' => $manager->id,
        ]);
    }

    public function test_cashier_cannot_approve_or_reject_void_request(): void
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
                    'unit_price' => 100,
                ],
            ],
        ])->assertCreated()->json();

        $saleId = (int) ($sale['id'] ?? 0);
        $this->assertGreaterThan(0, $saleId);
        $this->postJson("/api/sales/{$saleId}/post")->assertOk();

        $this->actingAsUser('cashier@madvapers.local');
        $this->postJson("/api/sales/{$saleId}/void-request")->assertOk();

        $this->postJson("/api/sales/{$saleId}/void-approve")
            ->assertStatus(403);

        $this->postJson("/api/sales/{$saleId}/void-reject")
            ->assertStatus(403);
    }

    public function test_cannot_add_payment_when_void_request_is_pending(): void
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
                    'unit_price' => 100,
                ],
            ],
        ])->assertCreated()->json();

        $saleId = (int) ($sale['id'] ?? 0);
        $this->assertGreaterThan(0, $saleId);
        $this->postJson("/api/sales/{$saleId}/post")->assertOk();

        $this->actingAsUser('cashier@madvapers.local');
        $this->postJson("/api/sales/{$saleId}/void-request")->assertOk();

        $this->postJson("/api/sales/{$saleId}/payments", [
            'method' => 'CASH',
            'amount' => 100,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['void_request_status']);
    }

    public function test_add_payment_is_idempotent_when_client_txn_id_is_reused(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $startingQty = (float) $balance->qty_on_hand;
        $this->actingAsUser('admin@madvapers.local');

        $sale = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [
                [
                    'product_variant_id' => $balance->product_variant_id,
                    'qty' => 1,
                    'unit_price' => 125,
                ],
            ],
        ])->assertCreated()->json();

        $saleId = (int) ($sale['id'] ?? 0);
        $this->assertGreaterThan(0, $saleId);
        $this->postJson("/api/sales/{$saleId}/post")->assertOk();

        $clientTxnId = 'txn-idemp-001';
        $payload = [
            'method' => 'CASH',
            'amount' => 125,
            'client_txn_id' => $clientTxnId,
        ];

        $this->postJson("/api/sales/{$saleId}/payments", $payload)
            ->assertOk()
            ->assertJsonPath('sale.payment_status', 'PAID');

        $qtyAfterFirstPayment = (float) InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $balance->product_variant_id)
            ->value('qty_on_hand');
        $this->assertSame($startingQty - 1, $qtyAfterFirstPayment);

        $this->postJson("/api/sales/{$saleId}/payments", $payload)
            ->assertOk()
            ->assertJsonPath('sale.payment_status', 'PAID');

        $qtyAfterSecondPayment = (float) InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $balance->product_variant_id)
            ->value('qty_on_hand');
        $this->assertSame($startingQty - 1, $qtyAfterSecondPayment);

        $paymentCount = SalePayment::query()
            ->where('sale_id', $saleId)
            ->where('client_txn_id', $clientTxnId)
            ->count();
        $this->assertSame(1, $paymentCount);
    }

    public function test_posting_checks_total_required_qty_per_variant(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $balance->qty_on_hand = 1.0;
        $balance->save();

        $this->actingAsUser('admin@madvapers.local');

        $sale = $this->postJson('/api/sales', [
            'branch_id' => $branch->id,
            'items' => [
                [
                    'product_variant_id' => $balance->product_variant_id,
                    'qty' => 0.6,
                    'unit_price' => 100,
                ],
                [
                    'product_variant_id' => $balance->product_variant_id,
                    'qty' => 0.6,
                    'unit_price' => 100,
                ],
            ],
        ])->assertCreated()->json();

        $saleId = (int) ($sale['id'] ?? 0);
        $this->assertGreaterThan(0, $saleId);
        $this->postJson("/api/sales/{$saleId}/post")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['stock']);

        $this->assertFalse(
            StockLedger::query()
                ->where('ref_type', 'sales')
                ->where('ref_id', $saleId)
                ->where('movement_type', 'SALE')
                ->exists()
        );
    }
}

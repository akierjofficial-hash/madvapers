<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\InventoryBalance;
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

        $this->actingAsUser('manager@madvapers.local');

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

        $this->assertSame($beforeQty, $afterPostQty);

        $this->assertFalse(
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

        $this->assertSame($beforeQty - $qtySold, $afterPaidQty);

        $this->assertTrue(
            StockLedger::query()
                ->where('branch_id', $branch->id)
                ->where('product_variant_id', $balance->product_variant_id)
                ->where('movement_type', 'SALE')
                ->where('ref_type', 'sales')
                ->where('ref_id', $saleId)
                ->exists()
        );

        $this->assertDatabaseHas('sales', [
            'id' => $saleId,
            'status' => 'POSTED',
            'payment_status' => 'PAID',
        ]);
    }

    public function test_payment_fails_when_stock_is_insufficient_at_settlement(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $balance->qty_on_hand = 1;
        $balance->save();

        $this->actingAsUser('manager@madvapers.local');

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

        InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $balance->product_variant_id)
            ->update(['qty_on_hand' => 0]);

        $this->postJson("/api/sales/{$saleId}/payments", [
            'method' => 'CASH',
            'amount' => 100,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['stock']);

        $this->assertDatabaseHas('sales', [
            'id' => $saleId,
            'status' => 'POSTED',
            'payment_status' => 'UNPAID',
        ]);

        $this->assertFalse(
            StockLedger::query()
                ->where('ref_type', 'sales')
                ->where('ref_id', $saleId)
                ->where('movement_type', 'SALE')
                ->exists()
        );
    }

    public function test_cannot_post_sale_when_stock_is_already_reserved_by_other_posted_unpaid_sales(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $balance->qty_on_hand = 1;
        $balance->save();

        $this->actingAsUser('manager@madvapers.local');

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

        $this->actingAsUser('manager@madvapers.local');

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

        $manager = $this->actingAsUser('manager@madvapers.local');

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

        $this->actingAsUser('manager@madvapers.local');

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

        $this->actingAsUser('manager@madvapers.local');

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

        $manager = $this->actingAsUser('manager@madvapers.local');
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

        $this->actingAsUser('manager@madvapers.local');
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

        $this->actingAsUser('manager@madvapers.local');
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

        $manager = $this->actingAsUser('manager@madvapers.local');
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

    public function test_cashier_cannot_approve_or_reject_void_request(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $this->actingAsUser('manager@madvapers.local');
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

        $this->actingAsUser('manager@madvapers.local');
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
        $this->actingAsUser('manager@madvapers.local');

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

    public function test_payment_settlement_checks_total_required_qty_per_variant(): void
    {
        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $balance = InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('qty_on_hand', '>', 0)
            ->orderBy('id')
            ->firstOrFail();

        $balance->qty_on_hand = 1.5;
        $balance->save();

        $this->actingAsUser('manager@madvapers.local');

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
        $this->postJson("/api/sales/{$saleId}/post")->assertOk();

        InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('product_variant_id', $balance->product_variant_id)
            ->update(['qty_on_hand' => 1.0]);

        $this->postJson("/api/sales/{$saleId}/payments", [
            'method' => 'CASH',
            'amount' => 120,
        ])
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

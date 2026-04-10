<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockLedger;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StockHistoryReportTest extends TestCase
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

    public function test_monthly_stock_history_returns_daily_closing_stock_per_variant(): void
    {
        Carbon::setTestNow(Carbon::parse('2030-01-31 12:00:00', config('app.timezone')));

        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $this->actingAsUser('admin@madvapers.local');

        $product = Product::query()->create([
            'name' => 'History Test Product ' . uniqid(),
            'product_type' => 'POD',
            'is_active' => true,
        ]);

        $variant = ProductVariant::query()->create([
            'product_id' => $product->id,
            'sku' => 'HIST-' . strtoupper(substr(uniqid(), -8)),
            'variant_name' => 'Ocean Mist',
            'flavor' => 'Blueberry',
            'default_cost' => 100,
            'default_price' => 150,
            'is_active' => true,
        ]);

        StockLedger::query()->create([
            'posted_at' => '2029-12-31 09:00:00',
            'branch_id' => $branch->id,
            'product_variant_id' => $variant->id,
            'qty_delta' => 10,
            'movement_type' => 'ADJUSTMENT',
            'reason_code' => 'OPENING',
            'unit_cost' => 100,
            'notes' => 'Opening stock before month',
        ]);

        StockLedger::query()->create([
            'posted_at' => '2030-01-02 12:00:00',
            'branch_id' => $branch->id,
            'product_variant_id' => $variant->id,
            'qty_delta' => -3,
            'movement_type' => 'SALE',
            'reason_code' => 'SALE_PAYMENT',
            'unit_price' => 150,
            'notes' => 'Sale day movement',
        ]);

        StockLedger::query()->create([
            'posted_at' => '2030-01-04 14:00:00',
            'branch_id' => $branch->id,
            'product_variant_id' => $variant->id,
            'qty_delta' => 5,
            'movement_type' => 'PO_RECEIVE',
            'reason_code' => 'PO_RECEIVE',
            'unit_cost' => 98,
            'notes' => 'Inbound restock',
        ]);

        try {
            $response = $this->getJson("/api/stock-history?branch_id={$branch->id}&month=2030-01&search={$variant->sku}")
                ->assertOk();

            $response->assertJsonPath('month', '2030-01');
            $response->assertJsonPath('branch_id', $branch->id);
            $response->assertJsonCount(31, 'days');
            $response->assertJsonCount(1, 'data');

            $row = $response->json('data.0');

            $this->assertSame($variant->id, (int) ($row['product_variant_id'] ?? 0));
            $this->assertEquals(10.0, (float) ($row['opening_qty'] ?? 0));
            $this->assertEquals(12.0, (float) ($row['ending_qty'] ?? 0));
            $this->assertEquals(10.0, (float) data_get($row, 'closing_by_day.2030-01-01'));
            $this->assertEquals(7.0, (float) data_get($row, 'closing_by_day.2030-01-02'));
            $this->assertEquals(7.0, (float) data_get($row, 'closing_by_day.2030-01-03'));
            $this->assertEquals(12.0, (float) data_get($row, 'closing_by_day.2030-01-04'));
            $this->assertEquals(-3.0, (float) data_get($row, 'daily_net.2030-01-02'));
            $this->assertEquals(5.0, (float) data_get($row, 'daily_net.2030-01-04'));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_clerk_cannot_view_stock_history_for_unassigned_branch(): void
    {
        $motong = Branch::query()->where('code', 'MOTONG')->firstOrFail();
        $bagacay = Branch::query()->where('code', 'BAGACAY')->firstOrFail();

        $this->actingAsUser('clerk@madvapers.local');

        $this->getJson("/api/stock-history?branch_id={$motong->id}&month=2030-01")->assertOk();

        $this->getJson("/api/stock-history?branch_id={$bagacay->id}&month=2030-01")
            ->assertStatus(403)
            ->assertJsonPath('message', 'Forbidden branch access.');
    }

    public function test_current_month_future_dates_are_zero_and_future_only_variants_are_hidden(): void
    {
        Carbon::setTestNow(Carbon::parse('2030-01-02 23:59:59', config('app.timezone')));

        $branch = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $this->actingAsUser('admin@madvapers.local');

        $trackedProduct = Product::query()->create([
            'name' => 'History Current Month Product ' . uniqid(),
            'product_type' => 'POD',
            'is_active' => true,
        ]);

        $trackedVariant = ProductVariant::query()->create([
            'product_id' => $trackedProduct->id,
            'sku' => 'HNOW-' . strtoupper(substr(uniqid(), -8)),
            'variant_name' => 'Current Month',
            'flavor' => 'Grape',
            'default_cost' => 100,
            'default_price' => 150,
            'is_active' => true,
        ]);

        StockLedger::query()->create([
            'posted_at' => '2029-12-31 09:00:00',
            'branch_id' => $branch->id,
            'product_variant_id' => $trackedVariant->id,
            'qty_delta' => 10,
            'movement_type' => 'ADJUSTMENT',
            'reason_code' => 'OPENING',
            'unit_cost' => 100,
            'notes' => 'Opening stock before current month test',
        ]);

        StockLedger::query()->create([
            'posted_at' => '2030-01-02 12:00:00',
            'branch_id' => $branch->id,
            'product_variant_id' => $trackedVariant->id,
            'qty_delta' => -3,
            'movement_type' => 'SALE',
            'reason_code' => 'SALE_PAYMENT',
            'unit_price' => 150,
            'notes' => 'Current day sale movement',
        ]);

        StockLedger::query()->create([
            'posted_at' => '2030-01-04 14:00:00',
            'branch_id' => $branch->id,
            'product_variant_id' => $trackedVariant->id,
            'qty_delta' => 5,
            'movement_type' => 'PO_RECEIVE',
            'reason_code' => 'PO_RECEIVE',
            'unit_cost' => 98,
            'notes' => 'Future-day restock should not project forward',
        ]);

        $futureOnlyProduct = Product::query()->create([
            'name' => 'Future Only History Product ' . uniqid(),
            'product_type' => 'POD',
            'is_active' => true,
        ]);

        $futureOnlyVariant = ProductVariant::query()->create([
            'product_id' => $futureOnlyProduct->id,
            'sku' => 'HFUT-' . strtoupper(substr(uniqid(), -8)),
            'variant_name' => 'Future Only',
            'flavor' => 'Mango',
            'default_cost' => 100,
            'default_price' => 150,
            'is_active' => true,
        ]);

        StockLedger::query()->create([
            'posted_at' => '2030-01-04 09:00:00',
            'branch_id' => $branch->id,
            'product_variant_id' => $futureOnlyVariant->id,
            'qty_delta' => 6,
            'movement_type' => 'ADJUSTMENT',
            'reason_code' => 'FUTURE_ONLY',
            'unit_cost' => 100,
            'notes' => 'Future-only row should stay hidden until the day arrives',
        ]);

        try {
            $response = $this->getJson("/api/stock-history?branch_id={$branch->id}&month=2030-01&search={$trackedVariant->sku}")
                ->assertOk();

            $response->assertJsonCount(1, 'data');

            $row = $response->json('data.0');

            $this->assertEquals(10.0, (float) ($row['opening_qty'] ?? 0));
            $this->assertEquals(7.0, (float) ($row['ending_qty'] ?? 0));
            $this->assertEquals(10.0, (float) data_get($row, 'closing_by_day.2030-01-01'));
            $this->assertEquals(7.0, (float) data_get($row, 'closing_by_day.2030-01-02'));
            $this->assertEquals(0.0, (float) data_get($row, 'closing_by_day.2030-01-03'));
            $this->assertEquals(0.0, (float) data_get($row, 'closing_by_day.2030-01-04'));
            $this->assertEquals(0.0, (float) data_get($row, 'daily_net.2030-01-04'));

            $this->getJson("/api/stock-history?branch_id={$branch->id}&month=2030-01&search={$futureOnlyVariant->sku}")
                ->assertOk()
                ->assertJsonCount(0, 'data');
        } finally {
            Carbon::setTestNow();
        }
    }
}

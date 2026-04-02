<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\EnforcesBranchAccess;
use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\StockAdjustment;
use App\Models\StockLedger;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DashboardController extends Controller
{
    use EnforcesBranchAccess;

    private const KPI_DETAIL_TYPES = [
        'low_stock',
        'out_of_stock',
        'inventory_value',
        'missing_cost',
        'pending_adjustments',
        'pending_po',
        'pending_transfers',
    ];

    public function summary(Request $request)
    {
        $data = $request->validate([
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
        ]);

        $selectedBranchId = isset($data['branch_id']) ? (int) $data['branch_id'] : null;
        [$from, $to] = $this->resolveDateRange($data['date_from'] ?? null, $data['date_to'] ?? null);

        if ($selectedBranchId) {
            $this->enforceBranchAccessOrFail($request, $selectedBranchId);
        }

        $branchIds = $this->resolveBranchScope($request, $selectedBranchId);

        return response()->json([
            'filters' => [
                'branch_id' => $selectedBranchId,
                'date_from' => $from->toDateString(),
                'date_to' => $to->toDateString(),
                'applied_branch_ids' => $branchIds,
            ],
            'kpis' => $this->buildKpis($branchIds),
            'kpi_details' => $this->buildKpiDetails($branchIds),
            'finance' => $this->buildFinanceOverview($branchIds, $from, $to),
            'voided_sales_by_branch' => $this->buildVoidedSalesByBranch($branchIds, $from, $to),
            'top_selling_products' => $this->buildTopSellingProducts($branchIds, $from, $to),
            'approval_queue' => $this->buildApprovalQueue($branchIds),
            'alerts' => $this->buildAlerts($branchIds, $from, $to),
            'branch_health' => $this->buildBranchHealth($branchIds, $from, $to),
            'activity_feed' => $this->buildActivityFeed($branchIds, $from, $to),
            'trends' => $this->buildTrends($branchIds, $from, $to),
            'quick_actions' => [
                ['label' => 'Create Purchase Order', 'path' => '/purchase-orders'],
                ['label' => 'Create Sale', 'path' => '/sales'],
                ['label' => 'Record Expense', 'path' => '/expenses'],
                ['label' => 'Create Transfer', 'path' => '/transfers'],
                ['label' => 'New Stock Adjustment', 'path' => '/adjustments'],
                ['label' => 'Manage Branches', 'path' => '/branches'],
                ['label' => 'Manage Accounts', 'path' => '/accounts'],
                ['label' => 'Open Ledger', 'path' => '/ledger'],
            ],
        ]);
    }

    public function approvalQueue(Request $request)
    {
        $data = $request->validate([
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ]);

        $selectedBranchId = isset($data['branch_id']) ? (int) $data['branch_id'] : null;
        if ($selectedBranchId) {
            $this->enforceBranchAccessOrFail($request, $selectedBranchId);
        }

        $branchIds = $this->resolveBranchScope($request, $selectedBranchId);
        $approvalQueue = $this->buildApprovalQueue($branchIds);

        $adjustments = count($approvalQueue['adjustments'] ?? []);
        $transfers = count($approvalQueue['transfers'] ?? []);
        $purchaseOrders = count($approvalQueue['purchase_orders'] ?? []);
        $voidRequests = count($approvalQueue['void_requests'] ?? []);

        return response()->json([
            'filters' => [
                'branch_id' => $selectedBranchId,
                'applied_branch_ids' => $branchIds,
            ],
            'counts' => [
                'adjustments' => $adjustments,
                'transfers' => $transfers,
                'purchase_orders' => $purchaseOrders,
                'void_requests' => $voidRequests,
                'total' => $adjustments + $transfers + $purchaseOrders + $voidRequests,
            ],
            'approval_queue' => $approvalQueue,
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    public function kpiDetails(Request $request)
    {
        $data = $request->validate([
            'type' => ['required', 'string', 'in:' . implode(',', self::KPI_DETAIL_TYPES)],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'search' => ['nullable', 'string', 'max:120'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $selectedBranchId = isset($data['branch_id']) ? (int) $data['branch_id'] : null;
        if ($selectedBranchId) {
            $this->enforceBranchAccessOrFail($request, $selectedBranchId);
        }

        $branchIds = $this->resolveBranchScope($request, $selectedBranchId);
        $type = (string) $data['type'];
        $search = trim((string) ($data['search'] ?? ''));
        $page = max(1, (int) ($data['page'] ?? 1));
        $perPage = max(1, min(100, (int) ($data['per_page'] ?? 20)));

        $paginator = match ($type) {
            'low_stock' => $this->paginateInventoryKpiRows($branchIds, 'low_stock', $search, $perPage, $page),
            'out_of_stock' => $this->paginateInventoryKpiRows($branchIds, 'out_of_stock', $search, $perPage, $page),
            'inventory_value' => $this->paginateInventoryKpiRows($branchIds, 'inventory_value', $search, $perPage, $page),
            'missing_cost' => $this->paginateInventoryKpiRows($branchIds, 'missing_cost', $search, $perPage, $page),
            'pending_adjustments' => $this->paginatePendingAdjustments($branchIds, $search, $perPage, $page),
            'pending_po' => $this->paginatePendingPurchaseOrders($branchIds, $search, $perPage, $page),
            'pending_transfers' => $this->paginatePendingTransfers($branchIds, $search, $perPage, $page),
            default => null,
        };

        return response()->json($paginator);
    }

    private function resolveDateRange(?string $from, ?string $to): array
    {
        $toDate = $to ? Carbon::parse($to)->endOfDay() : now()->endOfDay();
        $fromDate = $from ? Carbon::parse($from)->startOfDay() : now()->subDays(13)->startOfDay();

        if ($fromDate->gt($toDate)) {
            [$fromDate, $toDate] = [$toDate->copy()->startOfDay(), $fromDate->copy()->endOfDay()];
        }

        return [$fromDate, $toDate];
    }

    private function resolveBranchScope(Request $request, ?int $selectedBranchId): ?array
    {
        if ($selectedBranchId) {
            return [$selectedBranchId];
        }

        if ($this->isPrivilegedUser($request->user())) {
            // null means unrestricted
            return null;
        }

        return $this->assignedBranchIds($request);
    }

    private function applyBranchFilter(QueryBuilder $query, ?array $branchIds, string $column = 'branch_id'): QueryBuilder
    {
        if ($branchIds === null) {
            return $query;
        }

        if (empty($branchIds)) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereIn($column, $branchIds);
    }

    private function applyTransferTouchBranchFilter(QueryBuilder $query, ?array $branchIds): QueryBuilder
    {
        if ($branchIds === null) {
            return $query;
        }

        if (empty($branchIds)) {
            return $query->whereRaw('1 = 0');
        }

        return $query->where(function ($w) use ($branchIds) {
            $w->whereIn('from_branch_id', $branchIds)
                ->orWhereIn('to_branch_id', $branchIds);
        });
    }

    private function buildKpis(?array $branchIds): array
    {
        $trackedVariantCount = $this->applyBranchFilter(
            DB::table('inventory_balances'),
            $branchIds
        )->count();

        $lowStock = $this->applyBranchFilter(
            DB::table('inventory_balances'),
            $branchIds
        )
            ->where('qty_on_hand', '>', 0)
            ->where('qty_on_hand', '<=', 10)
            ->count();

        $outOfStock = $this->applyBranchFilter(
            DB::table('inventory_balances'),
            $branchIds
        )
            ->where('qty_on_hand', '<=', 0)
            ->count();

        $inventoryValue = (float) $this->applyBranchFilter(
            DB::table('inventory_balances as ib')
                ->leftJoin('product_variants as pv', 'pv.id', '=', 'ib.product_variant_id')
                ->selectRaw('COALESCE(SUM(ib.qty_on_hand * COALESCE(pv.default_cost, 0)), 0) as total_value'),
            $branchIds,
            'ib.branch_id'
        )->value('total_value');

        $missingCostCount = $this->applyBranchFilter(
            DB::table('inventory_balances as ib')
                ->leftJoin('product_variants as pv', 'pv.id', '=', 'ib.product_variant_id'),
            $branchIds,
            'ib.branch_id'
        )
            ->where('ib.qty_on_hand', '>', 0)
            ->whereRaw('COALESCE(pv.default_cost, 0) <= 0')
            ->count();

        $pendingAdjustments = $this->applyBranchFilter(
            DB::table('stock_adjustments'),
            $branchIds
        )
            ->whereIn('status', ['DRAFT', 'SUBMITTED', 'APPROVED'])
            ->count();

        $pendingPoApprovals = $this->applyBranchFilter(
            DB::table('purchase_orders'),
            $branchIds
        )
            ->where('status', 'SUBMITTED')
            ->count();

        $pendingTransfers = $this->applyTransferTouchBranchFilter(
            DB::table('transfers'),
            $branchIds
        )
            ->whereIn('status', ['REQUESTED', 'APPROVED', 'IN_TRANSIT'])
            ->count();

        $pendingVoidRequests = 0;
        if (Schema::hasTable('sales') && Schema::hasColumn('sales', 'void_request_status')) {
            $pendingVoidRequests = (int) $this->applyBranchFilter(
                DB::table('sales'),
                $branchIds
            )
                ->whereIn('status', ['DRAFT', 'POSTED'])
                ->where('void_request_status', 'PENDING')
                ->count();
        }

        return [
            'low_stock_count' => $lowStock,
            'out_of_stock_count' => $outOfStock,
            'pending_adjustments' => $pendingAdjustments,
            'pending_po_approvals' => $pendingPoApprovals,
            'pending_transfers' => $pendingTransfers,
            'pending_void_requests' => $pendingVoidRequests,
            'inventory_value' => round($inventoryValue, 2),
            'missing_cost_count' => (int) $missingCostCount,
            'tracked_variant_count' => (int) $trackedVariantCount,
        ];
    }

    private function buildKpiDetails(?array $branchIds): array
    {
        $lowStock = $this->buildInventoryKpiRows($branchIds, 'low_stock', 80);
        $outOfStock = $this->buildInventoryKpiRows($branchIds, 'out_of_stock', 80);
        $inventoryValue = $this->buildInventoryKpiRows($branchIds, 'inventory_value', 80);
        $missingCost = $this->buildInventoryKpiRows($branchIds, 'missing_cost', 80);

        return [
            'low_stock' => $lowStock,
            'out_of_stock' => $outOfStock,
            'inventory_value' => $inventoryValue,
            'missing_cost' => $missingCost,
        ];
    }

    private function buildFinanceOverview(?array $branchIds, Carbon $from, Carbon $to): array
    {
        if (!Schema::hasTable('sales') || !Schema::hasTable('sale_items') || !Schema::hasTable('sale_payments')) {
            return [
                'revenue' => 0.0,
                'cash_in' => 0.0,
                'cogs' => 0.0,
                'gross_profit' => 0.0,
                'sf_charged_total' => 0.0,
                'restock_spend' => 0.0,
                'net_cashflow' => 0.0,
                'net_income' => 0.0,
                'expense_total' => 0.0,
                'sf_expense_total' => 0.0,
                'operating_expense_total' => 0.0,
                'voided_sales_count' => 0,
                'voided_sales_amount' => 0.0,
                'voided_paid_amount' => 0.0,
            ];
        }

        $revenue = (float) $this->applyBranchFilter(
            DB::table('sales')
                ->where('status', 'POSTED')
                ->whereBetween('posted_at', [$from, $to]),
            $branchIds
        )->sum('grand_total');

        $sfChargedTotal = 0.0;
        if (Schema::hasColumn('sales', 'sf_charge')) {
            $sfChargedTotal = (float) $this->applyBranchFilter(
                DB::table('sales')
                    ->where('status', 'POSTED')
                    ->whereBetween('posted_at', [$from, $to]),
                $branchIds
            )->sum('sf_charge');
        }

        $cashIn = (float) $this->applyBranchFilter(
            DB::table('sale_payments as sp')
                ->join('sales as s', 's.id', '=', 'sp.sale_id')
                ->where('s.status', 'POSTED')
                ->whereBetween('sp.paid_at', [$from, $to]),
            $branchIds,
            's.branch_id'
        )->sum('sp.amount');

        $cogs = (float) $this->applyBranchFilter(
            DB::table('sale_items as si')
                ->join('sales as s', 's.id', '=', 'si.sale_id')
                ->where('s.status', 'POSTED')
                ->whereBetween('s.posted_at', [$from, $to]),
            $branchIds,
            's.branch_id'
        )->sum('si.line_cogs');

        $restockSpend = (float) $this->applyBranchFilter(
            DB::table('purchase_order_items as poi')
                ->join('purchase_orders as po', 'po.id', '=', 'poi.purchase_order_id')
                ->whereIn('po.status', ['PARTIALLY_RECEIVED', 'RECEIVED'])
                ->whereBetween('po.received_at', [$from, $to]),
            $branchIds,
            'po.branch_id'
        )->selectRaw('COALESCE(SUM(COALESCE(poi.qty_received, 0) * COALESCE(poi.unit_cost, 0)), 0) as total_spend')
            ->value('total_spend');

        $revenue = round($revenue, 2);
        $cashIn = round($cashIn, 2);
        $cogs = round($cogs, 2);
        $restockSpend = round((float) $restockSpend, 2);

        $voidedSalesBase = $this->applyBranchFilter(
            DB::table('sales')
                ->where('status', 'VOIDED')
                ->whereNotNull('voided_at')
                ->whereBetween('voided_at', [$from, $to]),
            $branchIds
        );
        $voidedSalesCount = (int) (clone $voidedSalesBase)->count();
        $voidedSalesAmount = round((float) (clone $voidedSalesBase)->sum('grand_total'), 2);
        $voidedPaidAmount = round((float) (clone $voidedSalesBase)->sum('paid_total'), 2);

        $expenseTotal = 0.0;
        $sfExpenseTotal = 0.0;
        if (Schema::hasTable('expenses')) {
            $expenseTotal = (float) $this->applyBranchFilter(
                DB::table('expenses')
                    ->where('status', 'POSTED')
                    ->whereBetween('paid_at', [$from, $to]),
                $branchIds
            )->sum('amount');

            $sfExpenseTotal = (float) $this->applyBranchFilter(
                DB::table('expenses')
                    ->where('status', 'POSTED')
                    ->where('category', 'SF_EXPENSE')
                    ->whereBetween('paid_at', [$from, $to]),
                $branchIds
            )->sum('amount');
        }

        $expenseTotal = round($expenseTotal, 2);
        $sfChargedTotal = round($sfChargedTotal, 2);
        $sfExpenseTotal = round($sfExpenseTotal, 2);
        $operatingExpenseTotal = round(max(0, $expenseTotal - $sfExpenseTotal), 2);
        $grossProfit = round($revenue - $cogs, 2);
        $netCashflow = round($cashIn - $restockSpend - $expenseTotal, 2);
        $netIncome = round($grossProfit - $sfExpenseTotal - $operatingExpenseTotal, 2);

        return [
            'revenue' => $revenue,
            'cash_in' => $cashIn,
            'cogs' => $cogs,
            'gross_profit' => $grossProfit,
            'sf_charged_total' => $sfChargedTotal,
            'restock_spend' => $restockSpend,
            'net_cashflow' => $netCashflow,
            'expense_total' => $expenseTotal,
            'sf_expense_total' => $sfExpenseTotal,
            'operating_expense_total' => $operatingExpenseTotal,
            'net_income' => $netIncome,
            'voided_sales_count' => $voidedSalesCount,
            'voided_sales_amount' => $voidedSalesAmount,
            'voided_paid_amount' => $voidedPaidAmount,
        ];
    }

    private function buildTopSellingProducts(?array $branchIds, Carbon $from, Carbon $to): array
    {
        if (!Schema::hasTable('sales') || !Schema::hasTable('sale_items')) {
            return [];
        }

        $rows = $this->applyBranchFilter(
            DB::table('sale_items as si')
                ->join('sales as s', 's.id', '=', 'si.sale_id')
                ->leftJoin('product_variants as pv', 'pv.id', '=', 'si.product_variant_id')
                ->leftJoin('products as p', 'p.id', '=', 'pv.product_id')
                ->where('s.status', 'POSTED')
                ->whereBetween('s.posted_at', [$from, $to])
                ->groupBy('si.product_variant_id', 'pv.sku', 'pv.variant_name', 'p.name')
                ->selectRaw('
                    si.product_variant_id,
                    pv.sku,
                    pv.variant_name,
                    p.name as product_name,
                    COALESCE(SUM(si.qty), 0) as qty_sold,
                    COALESCE(SUM(si.line_total), 0) as sales_amount,
                    COALESCE(SUM(si.line_cogs), 0) as cogs,
                    COUNT(DISTINCT s.id) as sales_count
                ')
                ->orderByRaw('SUM(si.qty) DESC')
                ->orderByRaw('SUM(si.line_total) DESC')
                ->limit(12),
            $branchIds,
            's.branch_id'
        )->get();

        return $rows->map(fn ($row) => [
            'product_variant_id' => (int) ($row->product_variant_id ?? 0),
            'sku' => $row->sku,
            'product_name' => $row->product_name,
            'variant_name' => $row->variant_name,
            'qty_sold' => round((float) ($row->qty_sold ?? 0), 3),
            'sales_amount' => round((float) ($row->sales_amount ?? 0), 2),
            'cogs' => round((float) ($row->cogs ?? 0), 2),
            'gross_profit' => round((float) ($row->sales_amount ?? 0) - (float) ($row->cogs ?? 0), 2),
            'sales_count' => (int) ($row->sales_count ?? 0),
        ])->values()->all();
    }

    private function buildVoidedSalesByBranch(?array $branchIds, Carbon $from, Carbon $to): array
    {
        if (!Schema::hasTable('sales')) {
            return [];
        }

        $rows = $this->applyBranchFilter(
            DB::table('sales as s')
                ->join('branches as b', 'b.id', '=', 's.branch_id')
                ->where('s.status', 'VOIDED')
                ->whereNotNull('s.voided_at')
                ->whereBetween('s.voided_at', [$from, $to])
                ->groupBy('s.branch_id', 'b.code', 'b.name')
                ->selectRaw('
                    s.branch_id,
                    b.code as branch_code,
                    b.name as branch_name,
                    COUNT(*) as voided_sales_count,
                    COALESCE(SUM(s.grand_total), 0) as voided_sales_amount,
                    COALESCE(SUM(s.paid_total), 0) as voided_paid_amount
                ')
                ->orderByDesc('voided_sales_amount')
                ->orderByDesc('voided_sales_count'),
            $branchIds,
            's.branch_id'
        )->get();

        return $rows->map(fn ($row) => [
            'branch_id' => (int) ($row->branch_id ?? 0),
            'branch_code' => $row->branch_code,
            'branch_name' => $row->branch_name,
            'voided_sales_count' => (int) ($row->voided_sales_count ?? 0),
            'voided_sales_amount' => round((float) ($row->voided_sales_amount ?? 0), 2),
            'voided_paid_amount' => round((float) ($row->voided_paid_amount ?? 0), 2),
        ])->values()->all();
    }

    private function buildInventoryKpiRows(?array $branchIds, string $type, int $limit = 80): array
    {
        return $this->inventoryKpiBaseQuery($branchIds, $type)
            ->limit(max(1, $limit))
            ->get()
            ->map(fn ($row) => $this->mapInventoryKpiRow($row))
            ->values()
            ->all();
    }

    private function paginateInventoryKpiRows(
        ?array $branchIds,
        string $type,
        string $search,
        int $perPage,
        int $page
    ): LengthAwarePaginator {
        $query = $this->inventoryKpiBaseQuery($branchIds, $type, $search);

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);
        $paginator->setCollection(
            $paginator->getCollection()->map(fn ($row) => $this->mapInventoryKpiRow($row))
        );

        return $paginator;
    }

    private function inventoryKpiBaseQuery(?array $branchIds, string $type, string $search = ''): QueryBuilder
    {
        $query = DB::table('inventory_balances as ib')
            ->join('branches as b', 'b.id', '=', 'ib.branch_id')
            ->join('product_variants as pv', 'pv.id', '=', 'ib.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->leftJoin('brands as br', 'br.id', '=', 'p.brand_id')
            ->leftJoin('categories as c', 'c.id', '=', 'p.category_id')
            ->selectRaw('
                ib.id as inventory_balance_id,
                ib.branch_id,
                b.code as branch_code,
                b.name as branch_name,
                ib.product_variant_id,
                pv.sku,
                pv.barcode,
                pv.variant_name,
                p.name as product_name,
                br.name as brand_name,
                c.name as category_name,
                ib.qty_on_hand,
                COALESCE(pv.default_cost, 0) as default_cost,
                (ib.qty_on_hand * COALESCE(pv.default_cost, 0)) as stock_value
            ');

        $query = $this->applyBranchFilter($query, $branchIds, 'ib.branch_id');

        if ($search !== '') {
            $term = '%' . trim($search) . '%';
            $like = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';

            $query->where(function ($w) use ($term, $like) {
                $w->where('pv.sku', $like, $term)
                    ->orWhere('pv.barcode', $like, $term)
                    ->orWhere('pv.variant_name', $like, $term)
                    ->orWhere('p.name', $like, $term)
                    ->orWhere('b.name', $like, $term)
                    ->orWhere('b.code', $like, $term);
            });
        }

        return match ($type) {
            'low_stock' => $query
                ->where('ib.qty_on_hand', '>', 0)
                ->where('ib.qty_on_hand', '<=', 10)
                ->orderBy('ib.qty_on_hand')
                ->orderBy('p.name')
                ->orderBy('pv.sku'),
            'out_of_stock' => $query
                ->where('ib.qty_on_hand', '<=', 0)
                ->orderBy('ib.qty_on_hand')
                ->orderBy('p.name')
                ->orderBy('pv.sku'),
            'inventory_value' => $query
                ->where('ib.qty_on_hand', '>', 0)
                ->orderByDesc('stock_value')
                ->orderBy('p.name')
                ->orderBy('pv.sku'),
            'missing_cost' => $query
                ->where('ib.qty_on_hand', '>', 0)
                ->whereRaw('COALESCE(pv.default_cost, 0) <= 0')
                ->orderByDesc('ib.qty_on_hand')
                ->orderBy('p.name')
                ->orderBy('pv.sku'),
            default => $query->whereRaw('1 = 0'),
        };
    }

    private function mapInventoryKpiRow(object $row): array
    {
        return [
            'inventory_balance_id' => (int) $row->inventory_balance_id,
            'branch_id' => (int) $row->branch_id,
            'branch_code' => $row->branch_code,
            'branch_name' => $row->branch_name,
            'product_variant_id' => (int) $row->product_variant_id,
            'sku' => $row->sku,
            'product_name' => $row->product_name,
            'variant_name' => $row->variant_name,
            'brand_name' => $row->brand_name,
            'category_name' => $row->category_name,
            'qty_on_hand' => (float) $row->qty_on_hand,
            'default_cost' => (float) $row->default_cost,
            'stock_value' => (float) $row->stock_value,
        ];
    }

    private function paginatePendingAdjustments(
        ?array $branchIds,
        string $search,
        int $perPage,
        int $page
    ): LengthAwarePaginator {
        $query = DB::table('stock_adjustments as sa')
            ->leftJoin('branches as b', 'b.id', '=', 'sa.branch_id')
            ->leftJoin('users as u', 'u.id', '=', 'sa.created_by_user_id')
            ->leftJoin('stock_adjustment_items as sai', 'sai.stock_adjustment_id', '=', 'sa.id')
            ->whereIn('sa.status', ['DRAFT', 'SUBMITTED', 'APPROVED'])
            ->groupBy(
                'sa.id',
                'sa.status',
                'sa.branch_id',
                'sa.reason_code',
                'sa.reference_no',
                'sa.created_at',
                'b.name',
                'u.name'
            )
            ->selectRaw('
                sa.id,
                sa.status,
                sa.branch_id,
                b.name as branch_name,
                sa.reason_code,
                sa.reference_no,
                sa.created_at,
                u.name as created_by,
                COUNT(sai.id) as items_count,
                COALESCE(SUM(sai.qty_delta), 0) as total_qty_delta
            ')
            ->orderByDesc('sa.created_at')
            ->orderByDesc('sa.id');

        $query = $this->applyBranchFilter($query, $branchIds, 'sa.branch_id');

        if ($search !== '') {
            $term = '%' . trim($search) . '%';
            $like = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';

            $query->where(function ($w) use ($term, $like) {
                $w->where('sa.reference_no', $like, $term)
                    ->orWhere('sa.reason_code', $like, $term)
                    ->orWhere('b.name', $like, $term)
                    ->orWhere('u.name', $like, $term)
                    ->orWhere('sa.status', $like, $term);
            });
        }

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);
        $paginator->setCollection($paginator->getCollection()->map(fn ($row) => [
            'id' => (int) $row->id,
            'status' => (string) $row->status,
            'branch_id' => (int) $row->branch_id,
            'branch_name' => $row->branch_name,
            'reason_code' => $row->reason_code,
            'reference_no' => $row->reference_no,
            'items_count' => (int) ($row->items_count ?? 0),
            'total_qty_delta' => (float) ($row->total_qty_delta ?? 0),
            'created_at' => $row->created_at ? Carbon::parse($row->created_at)->toIso8601String() : null,
            'created_by' => $row->created_by,
        ]));

        return $paginator;
    }

    private function paginatePendingPurchaseOrders(
        ?array $branchIds,
        string $search,
        int $perPage,
        int $page
    ): LengthAwarePaginator {
        $query = DB::table('purchase_orders as po')
            ->leftJoin('branches as b', 'b.id', '=', 'po.branch_id')
            ->leftJoin('suppliers as s', 's.id', '=', 'po.supplier_id')
            ->leftJoin('users as u', 'u.id', '=', 'po.created_by_user_id')
            ->leftJoin('purchase_order_items as poi', 'poi.purchase_order_id', '=', 'po.id')
            ->where('po.status', 'SUBMITTED')
            ->groupBy(
                'po.id',
                'po.status',
                'po.branch_id',
                'po.created_at',
                'po.reference_no',
                'b.name',
                's.name',
                'u.name'
            )
            ->selectRaw('
                po.id,
                po.status,
                po.branch_id,
                po.created_at,
                po.reference_no,
                b.name as branch_name,
                s.name as supplier_name,
                u.name as created_by,
                COUNT(poi.id) as items_count,
                COALESCE(SUM(COALESCE(poi.qty_ordered, poi.qty, 0)), 0) as total_qty_ordered
            ')
            ->orderByDesc('po.created_at')
            ->orderByDesc('po.id');

        $query = $this->applyBranchFilter($query, $branchIds, 'po.branch_id');

        if ($search !== '') {
            $term = '%' . trim($search) . '%';
            $like = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';

            $query->where(function ($w) use ($term, $like) {
                $w->where('po.reference_no', $like, $term)
                    ->orWhere('s.name', $like, $term)
                    ->orWhere('b.name', $like, $term)
                    ->orWhere('u.name', $like, $term)
                    ->orWhere('po.status', $like, $term);
            });
        }

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);
        $paginator->setCollection($paginator->getCollection()->map(fn ($row) => [
            'id' => (int) $row->id,
            'status' => (string) $row->status,
            'branch_id' => (int) $row->branch_id,
            'branch_name' => $row->branch_name,
            'supplier_name' => $row->supplier_name,
            'created_at' => $row->created_at ? Carbon::parse($row->created_at)->toIso8601String() : null,
            'created_by' => $row->created_by,
            'items_count' => (int) ($row->items_count ?? 0),
            'total_qty_ordered' => (float) ($row->total_qty_ordered ?? 0),
        ]));

        return $paginator;
    }

    private function paginatePendingTransfers(
        ?array $branchIds,
        string $search,
        int $perPage,
        int $page
    ): LengthAwarePaginator {
        $query = DB::table('transfers as t')
            ->leftJoin('branches as fb', 'fb.id', '=', 't.from_branch_id')
            ->leftJoin('branches as tb', 'tb.id', '=', 't.to_branch_id')
            ->leftJoin('users as u', 'u.id', '=', 't.created_by_user_id')
            ->leftJoin('transfer_items as ti', 'ti.transfer_id', '=', 't.id')
            ->whereIn('t.status', ['REQUESTED', 'APPROVED', 'IN_TRANSIT'])
            ->groupBy(
                't.id',
                't.status',
                't.from_branch_id',
                't.to_branch_id',
                't.created_at',
                't.reference_no',
                'fb.name',
                'tb.name',
                'u.name'
            )
            ->selectRaw('
                t.id,
                t.status,
                t.from_branch_id,
                t.to_branch_id,
                t.created_at,
                t.reference_no,
                fb.name as from_branch_name,
                tb.name as to_branch_name,
                u.name as created_by,
                COUNT(ti.id) as items_count,
                COALESCE(SUM(ti.qty), 0) as total_qty
            ')
            ->orderByDesc('t.created_at')
            ->orderByDesc('t.id');

        $query = $this->applyTransferTouchBranchFilter($query, $branchIds);

        if ($search !== '') {
            $term = '%' . trim($search) . '%';
            $like = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';

            $query->where(function ($w) use ($term, $like) {
                $w->where('t.reference_no', $like, $term)
                    ->orWhere('fb.name', $like, $term)
                    ->orWhere('tb.name', $like, $term)
                    ->orWhere('u.name', $like, $term)
                    ->orWhere('t.status', $like, $term);
            });
        }

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);
        $paginator->setCollection($paginator->getCollection()->map(fn ($row) => [
            'id' => (int) $row->id,
            'status' => (string) $row->status,
            'from_branch_id' => (int) $row->from_branch_id,
            'to_branch_id' => (int) $row->to_branch_id,
            'from_branch_name' => $row->from_branch_name,
            'to_branch_name' => $row->to_branch_name,
            'created_at' => $row->created_at ? Carbon::parse($row->created_at)->toIso8601String() : null,
            'created_by' => $row->created_by,
            'items_count' => (int) ($row->items_count ?? 0),
            'total_qty' => (float) ($row->total_qty ?? 0),
        ]));

        return $paginator;
    }

    private function buildApprovalQueue(?array $branchIds): array
    {
        $adjustments = StockAdjustment::query()
            ->with(['branch:id,code,name', 'createdBy:id,name'])
            ->withCount('items')
            ->withSum('items as total_qty_delta', 'qty_delta')
            ->where('status', 'SUBMITTED')
            ->when($branchIds !== null, function ($q) use ($branchIds) {
                if (empty($branchIds)) {
                    return $q->whereRaw('1 = 0');
                }
                return $q->whereIn('branch_id', $branchIds);
            })
            ->orderByDesc('created_at')
            ->limit(10)
            ->get()
            ->map(fn ($row) => [
                'id' => $row->id,
                'status' => $row->status,
                'branch_id' => $row->branch_id,
                'branch_name' => $row->branch?->name,
                'reason_code' => $row->reason_code,
                'reference_no' => $row->reference_no,
                'items_count' => (int) ($row->items_count ?? 0),
                'total_qty_delta' => (float) ($row->total_qty_delta ?? 0),
                'created_at' => optional($row->created_at)?->toIso8601String(),
                'created_by' => $row->createdBy?->name,
            ])
            ->values();

        $transfers = $this->applyTransferTouchBranchFilter(
            DB::table('transfers as t')
                ->leftJoin('branches as fb', 'fb.id', '=', 't.from_branch_id')
                ->leftJoin('branches as tb', 'tb.id', '=', 't.to_branch_id')
                ->leftJoin('users as u', 'u.id', '=', 't.created_by_user_id')
                ->leftJoin('transfer_items as ti', 'ti.transfer_id', '=', 't.id')
                ->where('t.status', 'REQUESTED')
                ->groupBy(
                    't.id',
                    't.status',
                    't.from_branch_id',
                    't.to_branch_id',
                    't.created_at',
                    'fb.name',
                    'tb.name',
                    'u.name'
                )
                ->orderByDesc('t.created_at')
                ->limit(10)
                ->selectRaw('
                    t.id,
                    t.status,
                    t.from_branch_id,
                    t.to_branch_id,
                    t.created_at,
                    fb.name as from_branch_name,
                    tb.name as to_branch_name,
                    u.name as created_by,
                    COUNT(ti.id) as items_count,
                    COALESCE(SUM(ti.qty), 0) as total_qty
                '),
            $branchIds
        )
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'status' => (string) $row->status,
                'from_branch_id' => (int) $row->from_branch_id,
                'to_branch_id' => (int) $row->to_branch_id,
                'from_branch_name' => $row->from_branch_name,
                'to_branch_name' => $row->to_branch_name,
                'created_at' => Carbon::parse($row->created_at)->toIso8601String(),
                'created_by' => $row->created_by,
                'items_count' => (int) $row->items_count,
                'total_qty' => (float) $row->total_qty,
            ])
            ->values();

        $purchaseOrders = $this->applyBranchFilter(
            DB::table('purchase_orders as po')
                ->leftJoin('branches as b', 'b.id', '=', 'po.branch_id')
                ->leftJoin('suppliers as s', 's.id', '=', 'po.supplier_id')
                ->leftJoin('users as u', 'u.id', '=', 'po.created_by_user_id')
                ->leftJoin('purchase_order_items as poi', 'poi.purchase_order_id', '=', 'po.id')
                ->where('po.status', 'SUBMITTED')
                ->groupBy(
                    'po.id',
                    'po.status',
                    'po.branch_id',
                    'po.created_at',
                    'b.name',
                    's.name',
                    'u.name'
                )
                ->orderByDesc('po.created_at')
                ->limit(10)
                ->selectRaw('
                    po.id,
                    po.status,
                    po.branch_id,
                    po.created_at,
                    b.name as branch_name,
                    s.name as supplier_name,
                    u.name as created_by,
                    COUNT(poi.id) as items_count,
                    COALESCE(SUM(COALESCE(poi.qty_ordered, poi.qty, 0)), 0) as total_qty_ordered
                '),
            $branchIds,
            'po.branch_id'
        )
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'status' => (string) $row->status,
                'branch_id' => (int) $row->branch_id,
                'branch_name' => $row->branch_name,
                'supplier_name' => $row->supplier_name,
                'created_at' => Carbon::parse($row->created_at)->toIso8601String(),
                'created_by' => $row->created_by,
                'items_count' => (int) $row->items_count,
                'total_qty_ordered' => (float) $row->total_qty_ordered,
            ])
            ->values();

        $voidRequests = collect();
        if (Schema::hasTable('sales') && Schema::hasColumn('sales', 'void_request_status')) {
            $voidRequests = $this->applyBranchFilter(
                DB::table('sales as s')
                    ->leftJoin('branches as b', 'b.id', '=', 's.branch_id')
                    ->leftJoin('users as req', 'req.id', '=', 's.void_requested_by_user_id')
                    ->leftJoin('users as cashier', 'cashier.id', '=', 's.cashier_user_id')
                    ->whereIn('s.status', ['DRAFT', 'POSTED'])
                    ->where('s.void_request_status', 'PENDING')
                    ->orderByDesc('s.void_requested_at')
                    ->orderByDesc('s.id')
                    ->limit(10)
                    ->selectRaw('
                        s.id,
                        s.sale_number,
                        s.status,
                        s.void_request_status,
                        s.payment_status,
                        s.branch_id,
                        b.name as branch_name,
                        s.void_requested_at,
                        req.name as requested_by,
                        cashier.name as cashier_name,
                        s.grand_total,
                        s.paid_total,
                        s.void_request_notes
                    '),
                $branchIds,
                's.branch_id'
            )
                ->get()
                ->map(fn ($row) => [
                    'id' => (int) $row->id,
                    'sale_number' => $row->sale_number,
                    'status' => (string) $row->status,
                    'void_request_status' => (string) ($row->void_request_status ?? ''),
                    'payment_status' => (string) $row->payment_status,
                    'branch_id' => (int) $row->branch_id,
                    'branch_name' => $row->branch_name,
                    'void_requested_at' => $row->void_requested_at
                        ? Carbon::parse($row->void_requested_at)->toIso8601String()
                        : null,
                    'requested_by' => $row->requested_by,
                    'cashier_name' => $row->cashier_name,
                    'grand_total' => round((float) ($row->grand_total ?? 0), 2),
                    'paid_total' => round((float) ($row->paid_total ?? 0), 2),
                    'void_request_notes' => $row->void_request_notes,
                ])
                ->values();
        }

        return [
            'adjustments' => $adjustments,
            'transfers' => $transfers,
            'purchase_orders' => $purchaseOrders,
            'void_requests' => $voidRequests,
        ];
    }

    private function buildAlerts(?array $branchIds, Carbon $from, Carbon $to): array
    {
        $alerts = [];

        $negativeStockCount = $this->applyBranchFilter(
            DB::table('inventory_balances'),
            $branchIds
        )
            ->where('qty_on_hand', '<', 0)
            ->count();

        if ($negativeStockCount > 0) {
            $alerts[] = [
                'severity' => 'error',
                'code' => 'NEGATIVE_STOCK',
                'title' => 'Negative stock detected',
                'message' => "{$negativeStockCount} inventory row(s) have negative on-hand quantity.",
                'count' => $negativeStockCount,
                'path' => '/inventory',
            ];
        }

        $missingCostCount = $this->applyBranchFilter(
            DB::table('inventory_balances as ib')
                ->leftJoin('product_variants as pv', 'pv.id', '=', 'ib.product_variant_id'),
            $branchIds,
            'ib.branch_id'
        )
            ->where('ib.qty_on_hand', '>', 0)
            ->whereRaw('COALESCE(pv.default_cost, 0) <= 0')
            ->count();

        if ($missingCostCount > 0) {
            $alerts[] = [
                'severity' => 'warning',
                'code' => 'MISSING_COST_DATA',
                'title' => 'Missing unit cost data',
                'message' => "{$missingCostCount} in-stock row(s) have zero cost and are excluded from inventory valuation.",
                'count' => $missingCostCount,
                'path' => '/variants',
            ];
        }

        $staleCutoff = now()->subHours(24);

        $staleAdjustmentDrafts = $this->applyBranchFilter(
            DB::table('stock_adjustments'),
            $branchIds
        )
            ->where('status', 'DRAFT')
            ->where('created_at', '<', $staleCutoff)
            ->count();

        if ($staleAdjustmentDrafts > 0) {
            $alerts[] = [
                'severity' => 'warning',
                'code' => 'STALE_ADJUSTMENT_DRAFTS',
                'title' => 'Stale adjustment drafts',
                'message' => "{$staleAdjustmentDrafts} adjustment draft(s) are older than 24 hours.",
                'count' => $staleAdjustmentDrafts,
                'path' => '/adjustments',
            ];
        }

        $stalePoDrafts = $this->applyBranchFilter(
            DB::table('purchase_orders'),
            $branchIds
        )
            ->where('status', 'DRAFT')
            ->where('created_at', '<', $staleCutoff)
            ->count();

        if ($stalePoDrafts > 0) {
            $alerts[] = [
                'severity' => 'warning',
                'code' => 'STALE_PO_DRAFTS',
                'title' => 'Stale purchase order drafts',
                'message' => "{$stalePoDrafts} purchase order draft(s) are older than 24 hours.",
                'count' => $stalePoDrafts,
                'path' => '/purchase-orders',
            ];
        }

        $overdueTransitCount = $this->applyTransferTouchBranchFilter(
            DB::table('transfers'),
            $branchIds
        )
            ->where('status', 'IN_TRANSIT')
            ->where('dispatched_at', '<', now()->subHours(48))
            ->count();

        if ($overdueTransitCount > 0) {
            $alerts[] = [
                'severity' => 'error',
                'code' => 'OVERDUE_TRANSFERS',
                'title' => 'Overdue in-transit transfers',
                'message' => "{$overdueTransitCount} transfer(s) have been in transit for over 48 hours.",
                'count' => $overdueTransitCount,
                'path' => '/transfers',
            ];
        }

        $largeAdjustmentsBase = $this->applyBranchFilter(
            DB::table('stock_adjustments as sa')
                ->join('stock_adjustment_items as sai', 'sai.stock_adjustment_id', '=', 'sa.id')
                ->whereIn('sa.status', ['APPROVED', 'POSTED'])
                ->whereBetween('sa.created_at', [$from, $to])
                ->groupBy('sa.id')
                ->havingRaw('ABS(SUM(sai.qty_delta)) >= 100')
                ->select('sa.id'),
            $branchIds,
            'sa.branch_id'
        );

        $largeAdjustmentsCount = DB::query()
            ->fromSub($largeAdjustmentsBase, 'large_adjustments')
            ->count();

        if ($largeAdjustmentsCount > 0) {
            $alerts[] = [
                'severity' => 'warning',
                'code' => 'LARGE_ADJUSTMENTS',
                'title' => 'Large stock adjustments',
                'message' => "{$largeAdjustmentsCount} adjustment(s) changed stock by 100+ units in the selected period.",
                'count' => $largeAdjustmentsCount,
                'path' => '/adjustments',
            ];
        }

        if (empty($alerts)) {
            $alerts[] = [
                'severity' => 'success',
                'code' => 'NO_CRITICAL_ALERTS',
                'title' => 'No critical alerts',
                'message' => 'No critical inventory workflow risks were detected in the selected period.',
                'count' => 0,
                'path' => null,
            ];
        }

        return $alerts;
    }

    private function buildBranchHealth(?array $branchIds, Carbon $from, Carbon $to): array
    {
        $branches = Branch::query()
            ->select(['id', 'code', 'name', 'is_active'])
            ->when($branchIds !== null, function ($q) use ($branchIds) {
                if (empty($branchIds)) {
                    return $q->whereRaw('1 = 0');
                }
                return $q->whereIn('id', $branchIds);
            })
            ->orderBy('name')
            ->get();

        $inventoryAgg = $this->applyBranchFilter(
            DB::table('inventory_balances as ib')
                ->leftJoin('product_variants as pv', 'pv.id', '=', 'ib.product_variant_id')
                ->selectRaw("
                    ib.branch_id,
                    SUM(CASE WHEN ib.qty_on_hand > 0 AND ib.qty_on_hand <= 10 THEN 1 ELSE 0 END) as low_stock,
                    SUM(CASE WHEN ib.qty_on_hand <= 0 THEN 1 ELSE 0 END) as out_of_stock,
                    COALESCE(SUM(ib.qty_on_hand * COALESCE(pv.default_cost, 0)), 0) as stock_value
                ")
                ->groupBy('ib.branch_id'),
            $branchIds,
            'ib.branch_id'
        )
            ->get()
            ->keyBy('branch_id');

        $openAdjustments = $this->applyBranchFilter(
            DB::table('stock_adjustments')
                ->selectRaw('branch_id, COUNT(*) as total')
                ->whereIn('status', ['DRAFT', 'SUBMITTED', 'APPROVED'])
                ->groupBy('branch_id'),
            $branchIds
        )
            ->get()
            ->pluck('total', 'branch_id');

        $openPurchaseOrders = $this->applyBranchFilter(
            DB::table('purchase_orders')
                ->selectRaw('branch_id, COUNT(*) as total')
                ->whereIn('status', ['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED'])
                ->groupBy('branch_id'),
            $branchIds
        )
            ->get()
            ->pluck('total', 'branch_id');

        $transferRows = $this->applyTransferTouchBranchFilter(
            DB::table('transfers')
                ->select(['from_branch_id', 'to_branch_id'])
                ->whereIn('status', ['DRAFT', 'REQUESTED', 'APPROVED', 'IN_TRANSIT']),
            $branchIds
        )->get();

        $openTransferByBranch = [];
        foreach ($transferRows as $row) {
            $fromId = (int) $row->from_branch_id;
            $toId = (int) $row->to_branch_id;
            $openTransferByBranch[$fromId] = ($openTransferByBranch[$fromId] ?? 0) + 1;
            $openTransferByBranch[$toId] = ($openTransferByBranch[$toId] ?? 0) + 1;
        }

        $recentMovements = $this->applyBranchFilter(
            DB::table('stock_ledgers')
                ->selectRaw('branch_id, COUNT(*) as total')
                ->whereBetween('posted_at', [$from, $to])
                ->groupBy('branch_id'),
            $branchIds
        )
            ->get()
            ->pluck('total', 'branch_id');

        return $branches->map(function ($branch) use (
            $inventoryAgg,
            $openAdjustments,
            $openPurchaseOrders,
            $openTransferByBranch,
            $recentMovements,
            $from,
            $to
        ) {
            $branchInventory = $inventoryAgg->get($branch->id);
            $topItem = DB::table('stock_ledgers as sl')
                ->join('product_variants as pv', 'pv.id', '=', 'sl.product_variant_id')
                ->join('products as p', 'p.id', '=', 'pv.product_id')
                ->where('sl.branch_id', $branch->id)
                ->whereBetween('sl.posted_at', [$from, $to])
                ->groupBy('pv.id', 'pv.sku', 'pv.variant_name', 'p.name')
                ->orderByRaw('SUM(ABS(sl.qty_delta)) DESC')
                ->selectRaw('
                    pv.id as product_variant_id,
                    pv.sku,
                    pv.variant_name,
                    p.name as product_name,
                    SUM(ABS(sl.qty_delta)) as moved_qty
                ')
                ->first();

            return [
                'branch_id' => $branch->id,
                'branch_code' => $branch->code,
                'branch_name' => $branch->name,
                'is_active' => (bool) $branch->is_active,
                'low_stock_count' => (int) ($branchInventory->low_stock ?? 0),
                'out_of_stock_count' => (int) ($branchInventory->out_of_stock ?? 0),
                'stock_value' => round((float) ($branchInventory->stock_value ?? 0), 2),
                'open_workflows' => [
                    'adjustments' => (int) ($openAdjustments[$branch->id] ?? 0),
                    'purchase_orders' => (int) ($openPurchaseOrders[$branch->id] ?? 0),
                    'transfers' => (int) ($openTransferByBranch[$branch->id] ?? 0),
                ],
                'recent_movements' => (int) ($recentMovements[$branch->id] ?? 0),
                'top_moving_item' => $topItem ? [
                    'product_variant_id' => (int) $topItem->product_variant_id,
                    'sku' => $topItem->sku,
                    'product_name' => $topItem->product_name,
                    'variant_name' => $topItem->variant_name,
                    'moved_qty' => (float) $topItem->moved_qty,
                ] : null,
            ];
        })->values()->all();
    }

    private function buildActivityFeed(?array $branchIds, Carbon $from, Carbon $to): array
    {
        $rows = StockLedger::query()
            ->with([
                'branch:id,code,name',
                'performedBy:id,name',
                'variant:id,product_id,sku,variant_name',
                'variant.product:id,name',
            ])
            ->when($branchIds !== null, function ($q) use ($branchIds) {
                if (empty($branchIds)) {
                    return $q->whereRaw('1 = 0');
                }
                return $q->whereIn('branch_id', $branchIds);
            })
            ->whereBetween('posted_at', [$from, $to])
            ->orderByDesc('posted_at')
            ->limit(30)
            ->get();

        return $rows->map(fn ($row) => [
            'id' => $row->id,
            'posted_at' => optional($row->posted_at)?->toIso8601String(),
            'movement_type' => $row->movement_type,
            'reason_code' => $row->reason_code,
            'qty_delta' => (float) $row->qty_delta,
            'branch_id' => $row->branch_id,
            'branch_name' => $row->branch?->name,
            'product_variant_id' => $row->product_variant_id,
            'sku' => $row->variant?->sku,
            'product_name' => $row->variant?->product?->name,
            'variant_name' => $row->variant?->variant_name,
            'ref_type' => $row->ref_type,
            'ref_id' => $row->ref_id,
            'performed_by' => $row->performedBy?->name,
            'notes' => $row->notes,
        ])->values()->all();
    }

    private function buildTrends(?array $branchIds, Carbon $from, Carbon $to): array
    {
        $period = CarbonPeriod::create($from->copy()->startOfDay(), $to->copy()->startOfDay());
        $series = [];

        foreach ($period as $day) {
            $key = $day->toDateString();
            $series[$key] = [
                'date' => $key,
                'in_qty' => 0.0,
                'out_qty' => 0.0,
                'adjustments' => 0,
                'transfers' => 0,
                'po_created' => 0,
                'po_received' => 0,
            ];
        }

        $ledgerRows = $this->applyBranchFilter(
            DB::table('stock_ledgers')
                ->selectRaw("
                    DATE(posted_at) as d,
                    COALESCE(SUM(CASE WHEN qty_delta > 0 THEN qty_delta ELSE 0 END), 0) as in_qty,
                    COALESCE(SUM(CASE WHEN qty_delta < 0 THEN ABS(qty_delta) ELSE 0 END), 0) as out_qty
                ")
                ->whereBetween('posted_at', [$from, $to])
                ->groupBy('d'),
            $branchIds
        )->get();

        foreach ($ledgerRows as $row) {
            $d = (string) $row->d;
            if (!isset($series[$d])) {
                continue;
            }
            $series[$d]['in_qty'] = (float) $row->in_qty;
            $series[$d]['out_qty'] = (float) $row->out_qty;
        }

        $adjustmentRows = $this->applyBranchFilter(
            DB::table('stock_adjustments')
                ->selectRaw('DATE(created_at) as d, COUNT(*) as total')
                ->whereBetween('created_at', [$from, $to])
                ->groupBy('d'),
            $branchIds
        )->get();

        foreach ($adjustmentRows as $row) {
            $d = (string) $row->d;
            if (isset($series[$d])) {
                $series[$d]['adjustments'] = (int) $row->total;
            }
        }

        $transferRows = $this->applyTransferTouchBranchFilter(
            DB::table('transfers')
                ->selectRaw('DATE(created_at) as d, COUNT(*) as total')
                ->whereBetween('created_at', [$from, $to])
                ->groupBy('d'),
            $branchIds
        )->get();

        foreach ($transferRows as $row) {
            $d = (string) $row->d;
            if (isset($series[$d])) {
                $series[$d]['transfers'] = (int) $row->total;
            }
        }

        $poCreatedRows = $this->applyBranchFilter(
            DB::table('purchase_orders')
                ->selectRaw('DATE(created_at) as d, COUNT(*) as total')
                ->whereBetween('created_at', [$from, $to])
                ->groupBy('d'),
            $branchIds
        )->get();

        foreach ($poCreatedRows as $row) {
            $d = (string) $row->d;
            if (isset($series[$d])) {
                $series[$d]['po_created'] = (int) $row->total;
            }
        }

        $poReceivedRows = $this->applyBranchFilter(
            DB::table('purchase_orders')
                ->selectRaw('DATE(received_at) as d, COUNT(*) as total')
                ->whereNotNull('received_at')
                ->whereBetween('received_at', [$from, $to])
                ->groupBy('d'),
            $branchIds
        )->get();

        foreach ($poReceivedRows as $row) {
            $d = (string) $row->d;
            if (isset($series[$d])) {
                $series[$d]['po_received'] = (int) $row->total;
            }
        }

        return array_values($series);
    }
}

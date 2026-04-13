<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\EnforcesBranchAccess;
use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockHistoryController extends Controller
{
    use EnforcesBranchAccess;

    public function index(Request $request)
    {
        $data = $request->validate([
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'month' => ['nullable', 'date_format:Y-m'],
            'search' => ['nullable', 'string', 'max:120'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $branchId = (int) $data['branch_id'];
        $this->enforceBranchAccessOrFail($request, $branchId);

        $monthValue = (string) ($data['month'] ?? now()->format('Y-m'));
        $monthStart = Carbon::createFromFormat('Y-m', $monthValue, config('app.timezone'))->startOfMonth();
        $monthEnd = $monthStart->copy()->endOfMonth();
        $today = now(config('app.timezone'))->startOfDay();
        $todayEnd = $today->copy()->endOfDay();
        $historicalWindowStart = $monthStart->copy()->startOfDay();
        $historicalWindowEnd = $monthEnd->copy()->endOfDay();
        $effectiveHistoryEnd = $historicalWindowEnd->lessThan($todayEnd)
            ? $historicalWindowEnd->copy()
            : $todayEnd->copy();
        $hasHistoricalRange = $historicalWindowStart->lessThanOrEqualTo($effectiveHistoryEnd);
        $perPage = (int) ($data['per_page'] ?? 25);
        $search = trim((string) ($data['search'] ?? ''));

        $driver = DB::getDriverName();
        $like = $driver === 'pgsql' ? 'ilike' : 'like';

        $currentBalanceSub = DB::table('inventory_balances')
            ->selectRaw('product_variant_id, COALESCE(SUM(qty_on_hand), 0) as current_qty')
            ->where('branch_id', $branchId)
            ->groupBy('product_variant_id');

        $ledgerCurrentQtySub = DB::table('stock_ledgers')
            ->selectRaw('product_variant_id, COALESCE(SUM(qty_delta), 0) as ledger_current_qty')
            ->where('branch_id', $branchId)
            ->where('posted_at', '<=', $todayEnd)
            ->groupBy('product_variant_id');

        $netSinceMonthStartSub = DB::table('stock_ledgers')
            ->selectRaw('product_variant_id, COALESCE(SUM(qty_delta), 0) as net_qty_since_month_start')
            ->where('branch_id', $branchId)
            ->when(
                $monthStart->copy()->startOfDay()->lessThanOrEqualTo($todayEnd),
                fn ($query) => $query->whereBetween('posted_at', [$monthStart->copy()->startOfDay(), $todayEnd]),
                fn ($query) => $query->whereRaw('1 = 0')
            )
            ->groupBy('product_variant_id');

        $openingSub = DB::table('stock_ledgers')
            ->selectRaw('product_variant_id, COALESCE(SUM(qty_delta), 0) as ledger_opening_qty')
            ->where('branch_id', $branchId)
            ->where('posted_at', '<', $monthStart)
            ->groupBy('product_variant_id');

        $monthMovementSub = DB::table('stock_ledgers')
            ->selectRaw('
                product_variant_id,
                COALESCE(SUM(qty_delta), 0) as month_net_qty,
                COALESCE(SUM(ABS(qty_delta)), 0) as movement_volume
            ')
            ->where('branch_id', $branchId)
            ->when(
                $hasHistoricalRange,
                fn ($query) => $query->whereBetween('posted_at', [$historicalWindowStart, $effectiveHistoryEnd]),
                fn ($query) => $query->whereRaw('1 = 0')
            )
            ->groupBy('product_variant_id');

        $rowsQuery = DB::table('product_variants as pv')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->leftJoin('brands as b', 'b.id', '=', 'p.brand_id')
            ->leftJoinSub($currentBalanceSub, 'current_balances', function ($join) {
                $join->on('current_balances.product_variant_id', '=', 'pv.id');
            })
            ->leftJoinSub($ledgerCurrentQtySub, 'ledger_current', function ($join) {
                $join->on('ledger_current.product_variant_id', '=', 'pv.id');
            })
            ->leftJoinSub($netSinceMonthStartSub, 'since_month_start', function ($join) {
                $join->on('since_month_start.product_variant_id', '=', 'pv.id');
            })
            ->leftJoinSub($openingSub, 'opening', function ($join) {
                $join->on('opening.product_variant_id', '=', 'pv.id');
            })
            ->leftJoinSub($monthMovementSub, 'month_movements', function ($join) {
                $join->on('month_movements.product_variant_id', '=', 'pv.id');
            })
            ->selectRaw('
                pv.id as product_variant_id,
                pv.sku,
                pv.barcode,
                pv.variant_name,
                pv.flavor,
                pv.is_active as variant_is_active,
                p.id as product_id,
                p.name as product_name,
                p.product_type,
                p.is_active as product_is_active,
                b.name as brand_name,
                COALESCE(current_balances.current_qty, ledger_current.ledger_current_qty, 0) as current_qty,
                COALESCE(opening.ledger_opening_qty, 0) as ledger_opening_qty,
                COALESCE(
                    current_balances.current_qty,
                    ledger_current.ledger_current_qty,
                    0
                ) - COALESCE(since_month_start.net_qty_since_month_start, 0) as opening_qty,
                COALESCE(month_movements.month_net_qty, 0) as month_net_qty,
                COALESCE(month_movements.movement_volume, 0) as movement_volume
            ')
            ->where(function ($query) {
                $query
                    ->whereRaw('(
                        COALESCE(current_balances.current_qty, ledger_current.ledger_current_qty, 0)
                        - COALESCE(since_month_start.net_qty_since_month_start, 0)
                    ) <> 0')
                    ->orWhereRaw('COALESCE(month_movements.movement_volume, 0) <> 0');
            });

        if ($search !== '') {
            $term = "%{$search}%";
            $rowsQuery->where(function ($query) use ($term, $like) {
                $query
                    ->where('p.name', $like, $term)
                    ->orWhere('p.product_type', $like, $term)
                    ->orWhere('b.name', $like, $term)
                    ->orWhere('pv.sku', $like, $term)
                    ->orWhere('pv.barcode', $like, $term)
                    ->orWhere('pv.variant_name', $like, $term)
                    ->orWhere('pv.flavor', $like, $term);
            });
        }

        $paginator = $rowsQuery
            ->orderByDesc('movement_volume')
            ->orderByDesc('month_net_qty')
            ->orderBy('p.name')
            ->orderBy('pv.variant_name')
            ->orderBy('pv.flavor')
            ->orderBy('pv.sku')
            ->paginate($perPage);

        $items = collect($paginator->items());
        $variantIds = $items
            ->pluck('product_variant_id')
            ->filter(fn ($id) => (int) $id > 0)
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $dailyMovementMap = [];
        if (!empty($variantIds)) {
            $dailyMovementRows = DB::table('stock_ledgers')
                ->selectRaw('product_variant_id, DATE(posted_at) as movement_date, COALESCE(SUM(qty_delta), 0) as net_qty')
                ->where('branch_id', $branchId)
                ->whereIn('product_variant_id', $variantIds)
                ->when(
                    $hasHistoricalRange,
                    fn ($query) => $query->whereBetween('posted_at', [$historicalWindowStart, $effectiveHistoryEnd]),
                    fn ($query) => $query->whereRaw('1 = 0')
                )
                ->groupBy('product_variant_id', DB::raw('DATE(posted_at)'))
                ->orderBy('movement_date')
                ->get();

            foreach ($dailyMovementRows as $row) {
                $variantId = (int) $row->product_variant_id;
                $movementDate = (string) $row->movement_date;
                $dailyMovementMap[$variantId][$movementDate] = (float) $row->net_qty;
            }
        }

        $days = collect(CarbonPeriod::create($monthStart->copy()->startOfDay(), $monthEnd->copy()->startOfDay()))
            ->map(fn (Carbon $day) => [
                'date' => $day->toDateString(),
                'label' => $day->format('M j'),
                'day' => (int) $day->day,
                'is_future' => $day->greaterThan($today),
            ])
            ->values()
            ->all();

        $rows = $items->map(function ($row) use ($days, $dailyMovementMap) {
            $variantId = (int) $row->product_variant_id;
            $runningQty = round((float) $row->opening_qty, 3);
            $dailyNet = [];
            $closingByDay = [];
            $lastHistoricalClosing = $runningQty;
            $hasHistoricalDay = false;

            foreach ($days as $day) {
                $date = (string) $day['date'];
                if ((bool) ($day['is_future'] ?? false)) {
                    $dailyNet[$date] = 0.0;
                    $closingByDay[$date] = 0.0;
                    continue;
                }

                $netQty = round((float) ($dailyMovementMap[$variantId][$date] ?? 0), 3);
                $runningQty = round($runningQty + $netQty, 3);
                $dailyNet[$date] = $netQty;
                $closingByDay[$date] = $runningQty;
                $lastHistoricalClosing = $runningQty;
                $hasHistoricalDay = true;
            }

            return [
                'product_variant_id' => $variantId,
                'product_id' => (int) $row->product_id,
                'product_name' => (string) $row->product_name,
                'product_type' => $row->product_type,
                'brand_name' => $row->brand_name,
                'sku' => (string) $row->sku,
                'barcode' => $row->barcode,
                'variant_name' => $row->variant_name,
                'flavor' => $row->flavor,
                'product_is_active' => (bool) $row->product_is_active,
                'variant_is_active' => (bool) $row->variant_is_active,
                'opening_qty' => round((float) $row->opening_qty, 3),
                'month_net_qty' => round((float) $row->month_net_qty, 3),
                'movement_volume' => round((float) $row->movement_volume, 3),
                'ending_qty' => $hasHistoricalDay
                    ? $lastHistoricalClosing
                    : 0.0,
                'daily_net' => $dailyNet,
                'closing_by_day' => $closingByDay,
            ];
        })->values();

        return response()->json([
            'month' => $monthStart->format('Y-m'),
            'month_label' => $monthStart->format('F Y'),
            'branch_id' => $branchId,
            'days' => $days,
            'current_page' => $paginator->currentPage(),
            'data' => $rows,
            'from' => $paginator->firstItem(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'to' => $paginator->lastItem(),
            'total' => $paginator->total(),
            'first_page_url' => $paginator->url(1),
            'last_page_url' => $paginator->url($paginator->lastPage()),
            'next_page_url' => $paginator->nextPageUrl(),
            'prev_page_url' => $paginator->previousPageUrl(),
            'path' => $paginator->path(),
            'links' => method_exists($paginator, 'linkCollection')
                ? $paginator->linkCollection()->toArray()
                : [],
        ]);
    }
}

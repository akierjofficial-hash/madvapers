<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\EnforcesBranchAccess;
use App\Models\StockLedger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LedgerController extends Controller
{
    use EnforcesBranchAccess;

    public function index(Request $request)
    {
        $request->validate([
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'movement_type' => ['nullable', 'string', 'max:50'],
            'product_variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'ref_type' => ['nullable', 'string', 'max:80'],
            'ref_id' => ['nullable', 'integer'],
            'search' => ['nullable', 'string', 'max:120'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $driver = DB::getDriverName();
        $like = $driver === 'pgsql' ? 'ilike' : 'like';
        $likeSql = $driver === 'pgsql' ? 'ILIKE' : 'LIKE';
        $textCast = in_array($driver, ['mysql', 'mariadb'], true) ? 'CHAR' : 'TEXT';
        $branchId = $request->integer('branch_id');

        $this->enforceBranchAccessOrFail($request, $branchId);

        $q = StockLedger::query()
            ->with(['variant.product.brand', 'variant.product.category', 'performedBy', 'branch'])
            ->where('branch_id', $branchId)
            ->orderByDesc('id');

        if ($request->filled('date_from')) {
            $q->where('posted_at', '>=', (string) $request->input('date_from') . ' 00:00:00');
        }

        if ($request->filled('date_to')) {
            $q->where('posted_at', '<=', (string) $request->input('date_to') . ' 23:59:59');
        }

        if ($request->filled('movement_type')) {
            $q->where('movement_type', $request->string('movement_type'));
        }

        if ($request->filled('product_variant_id')) {
            $q->where('product_variant_id', $request->integer('product_variant_id'));
        }

        if ($request->filled('ref_type')) {
            $q->where('ref_type', $request->string('ref_type'));
        }

        if ($request->filled('ref_id')) {
            $q->where('ref_id', $request->integer('ref_id'));
        }

        // Optional search (SKU/barcode/name/notes + friendly refs like "Adjustment #123")
        if ($request->filled('search')) {
            $raw = trim((string) $request->input('search'));

            if ($raw !== '') {
                // Friendly "Adjustment #123" -> ref_type=stock_adjustments, ref_id=123
                if (preg_match('/^(adjustment|adj)\s*#?\s*(\d+)$/i', $raw, $m)) {
                    $q->where('ref_type', 'stock_adjustments')
                        ->where('ref_id', (int) $m[2]);
                } elseif (preg_match('/^(transfer|trf)\s*#?\s*(\d+)$/i', $raw, $m)) {
                    // Friendly "Transfer #123" -> ref_type=transfers, ref_id=123
                    $q->where('ref_type', 'transfers')
                        ->where('ref_id', (int) $m[2]);
                } else {
                    $term = "%{$raw}%";
                    $q->where(function ($w) use ($term, $like, $likeSql, $textCast) {
                        // Ledger fields
                        $w->where('movement_type', $like, $term)
                            ->orWhere('reason_code', $like, $term)
                            ->orWhere('notes', $like, $term)
                            ->orWhere('ref_type', $like, $term)
                            ->orWhereRaw("CAST(id AS {$textCast}) {$likeSql} ?", [$term])
                            ->orWhereRaw("CAST(ref_id AS {$textCast}) {$likeSql} ?", [$term]);

                        // Variant/Product fields
                        $w->orWhereHas('variant', function ($v) use ($term, $like) {
                            $v->where('sku', $like, $term)
                                ->orWhere('barcode', $like, $term)
                                ->orWhere('variant_name', $like, $term)
                                ->orWhereHas('product', function ($p) use ($term, $like) {
                                    $p->where('name', $like, $term)
                                        ->orWhereHas('brand', fn ($b) => $b->where('name', $like, $term));
                                });
                        });
                    });
                }
            }
        }

        return $q->paginate($request->integer('per_page', 30));
    }
}

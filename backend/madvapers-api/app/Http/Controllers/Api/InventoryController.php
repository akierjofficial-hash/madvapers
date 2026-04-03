<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\EnforcesBranchAccess;
use App\Models\InventoryBalance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryController extends Controller
{
    use EnforcesBranchAccess;

    // GET /api/inventory?branch_id=1&search=MV-
    public function index(Request $request)
    {
        $like = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';

        $q = InventoryBalance::query()
            ->with(['branch', 'variant.product.brand', 'variant.product.category'])
            ->orderBy('id', 'desc');

        // Non-admin/owner users are always scoped to their assigned branch.
        $this->scopeToAssignedBranch($request, $q);

        if ($request->filled('branch_id')) {
            $branchId = $request->integer('branch_id');
            $this->enforceBranchAccessOrFail($request, $branchId);
            $q->where('branch_id', $branchId);
        }

        if ($request->filled('search')) {
            $term = '%' . trim((string) $request->input('search')) . '%';
            $q->whereHas('variant', function ($v) use ($term, $like) {
                $v->where('sku', $like, $term)
                  ->orWhere('barcode', $like, $term)
                  ->orWhere('variant_name', $like, $term)
                  ->orWhere('flavor', $like, $term);
            });
        }

        return $q->paginate(50);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\EnforcesBranchAccess;
use App\Http\Controllers\Controller;
use App\Models\AuditEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AuditEventController extends Controller
{
    use EnforcesBranchAccess;

    public function index(Request $request)
    {
        $request->validate([
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'event_type' => ['nullable', 'string', 'max:80'],
            'entity_type' => ['nullable', 'string', 'max:80'],
            'entity_id' => ['nullable', 'integer'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'search' => ['nullable', 'string', 'max:120'],
            'per_page' => ['nullable', 'integer', 'min:10', 'max:100'],
        ]);

        $driver = DB::getDriverName();
        $like = $driver === 'pgsql' ? 'ilike' : 'like';
        $likeSql = $driver === 'pgsql' ? 'ILIKE' : 'LIKE';
        $textCast = in_array($driver, ['mysql', 'mariadb'], true) ? 'CHAR' : 'TEXT';

        $q = AuditEvent::query()
            ->with(['user:id,name,email', 'branch:id,code,name'])
            ->orderByDesc('id');

        $this->scopeToAssignedBranch($request, $q, 'branch_id');

        if ($request->filled('branch_id')) {
            $branchId = $request->integer('branch_id');
            $this->enforceBranchAccessOrFail($request, $branchId);
            $q->where('branch_id', $branchId);
        }

        if ($request->filled('event_type')) {
            $q->where('event_type', strtoupper(trim((string) $request->input('event_type'))));
        }

        if ($request->filled('entity_type')) {
            $q->where('entity_type', trim((string) $request->input('entity_type')));
        }

        if ($request->filled('entity_id')) {
            $q->where('entity_id', $request->integer('entity_id'));
        }

        if ($request->filled('date_from')) {
            $q->where('created_at', '>=', (string) $request->input('date_from') . ' 00:00:00');
        }

        if ($request->filled('date_to')) {
            $q->where('created_at', '<=', (string) $request->input('date_to') . ' 23:59:59');
        }

        if ($request->filled('search')) {
            $term = '%' . trim((string) $request->input('search')) . '%';
            $q->where(function ($w) use ($term, $like, $likeSql, $textCast) {
                $w->where('event_type', $like, $term)
                    ->orWhere('entity_type', $like, $term)
                    ->orWhere('summary', $like, $term)
                    ->orWhereRaw("CAST(entity_id AS {$textCast}) {$likeSql} ?", [$term]);
            });
        }

        $perPage = (int) ($request->input('per_page') ?? 30);

        return $q->paginate($perPage);
    }
}


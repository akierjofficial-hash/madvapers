<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\EnforcesBranchAccess;
use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Support\AuditTrail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ExpenseController extends Controller
{
    use EnforcesBranchAccess;

    public function index(Request $request)
    {
        $this->ensureNotCashier($request);

        $request->validate([
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'status' => ['nullable', 'string', 'max:30'],
            'category' => ['nullable', 'string', 'max:80'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'search' => ['nullable', 'string', 'max:120'],
        ]);

        $driver = DB::getDriverName();
        $like = $driver === 'pgsql' ? 'ilike' : 'like';
        $textCast = in_array($driver, ['mysql', 'mariadb'], true) ? 'CHAR' : 'TEXT';
        $likeSql = $driver === 'pgsql' ? 'ILIKE' : 'LIKE';

        $q = Expense::query()
            ->with(['branch', 'createdBy', 'voidedBy'])
            ->orderByDesc('paid_at')
            ->orderByDesc('id');

        $this->scopeToAssignedBranch($request, $q, 'branch_id');

        if ($request->filled('branch_id')) {
            $branchId = $request->integer('branch_id');
            $this->enforceBranchAccessOrFail($request, $branchId);
            $q->where('branch_id', $branchId);
        }

        if ($request->filled('status')) {
            $q->where('status', strtoupper((string) $request->input('status')));
        }

        if ($request->filled('category')) {
            $q->where('category', strtoupper(trim((string) $request->input('category'))));
        }

        if ($request->filled('date_from')) {
            $q->where('paid_at', '>=', (string) $request->input('date_from') . ' 00:00:00');
        }
        if ($request->filled('date_to')) {
            $q->where('paid_at', '<=', (string) $request->input('date_to') . ' 23:59:59');
        }

        if ($request->filled('search')) {
            $term = '%' . trim((string) $request->input('search')) . '%';
            $q->where(function ($w) use ($term, $like, $likeSql, $textCast) {
                $w->where('expense_number', $like, $term)
                    ->orWhere('category', $like, $term)
                    ->orWhere('notes', $like, $term)
                    ->orWhereRaw("CAST(id AS {$textCast}) {$likeSql} ?", [$term]);
            });
        }

        return $q->paginate(20);
    }

    public function show(Request $request, Expense $expense)
    {
        $this->ensureNotCashier($request);

        $this->enforceBranchAccessOrFail($request, (int) $expense->branch_id);

        return $expense->load(['branch', 'createdBy', 'voidedBy']);
    }

    public function store(Request $request)
    {
        $this->ensureNotCashier($request);

        $data = $request->validate([
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'category' => ['required', 'string', 'max:80'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'paid_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $this->enforceBranchAccessOrFail($request, (int) $data['branch_id']);

        return DB::transaction(function () use ($request, $data) {
            $expense = Expense::create([
                'branch_id' => (int) $data['branch_id'],
                'category' => strtoupper(trim((string) $data['category'])),
                'amount' => round((float) $data['amount'], 2),
                'paid_at' => $data['paid_at'] ?? now(),
                'status' => 'POSTED',
                'notes' => $data['notes'] ?? null,
                'created_by_user_id' => $request->user()?->id,
            ]);

            $expense->expense_number = 'EX-' . now()->format('Ymd') . '-' . str_pad((string) $expense->id, 6, '0', STR_PAD_LEFT);
            $expense->save();

            AuditTrail::record([
                'event_type' => 'EXPENSE_CREATED',
                'entity_type' => 'expense',
                'entity_id' => (int) $expense->id,
                'branch_id' => (int) $expense->branch_id,
                'user_id' => $request->user()?->id,
                'summary' => 'Expense created',
                'meta' => [
                    'expense_number' => (string) ($expense->expense_number ?? ''),
                    'category' => (string) ($expense->category ?? ''),
                    'status' => (string) ($expense->status ?? ''),
                    'amount' => (float) ($expense->amount ?? 0),
                    'paid_at' => optional($expense->paid_at)->toDateTimeString(),
                ],
            ]);

            return response()->json($expense->fresh()->load(['branch', 'createdBy']), 201);
        });
    }

    public function update(Request $request, Expense $expense)
    {
        $this->ensureNotCashier($request);

        $data = $request->validate([
            'category' => ['sometimes', 'string', 'max:80'],
            'amount' => ['sometimes', 'numeric', 'gt:0'],
            'paid_at' => ['sometimes', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        return DB::transaction(function () use ($request, $expense, $data) {
            $locked = $this->lockExpense($expense->id);
            $this->enforceBranchAccessOrFail($request, (int) $locked->branch_id);

            if ($locked->status !== 'POSTED') {
                throw ValidationException::withMessages([
                    'status' => ['Only POSTED expenses can be updated.'],
                ]);
            }

            if (array_key_exists('category', $data)) {
                $locked->category = strtoupper(trim((string) $data['category']));
            }
            if (array_key_exists('amount', $data)) {
                $locked->amount = round((float) $data['amount'], 2);
            }
            if (array_key_exists('paid_at', $data)) {
                $locked->paid_at = $data['paid_at'];
            }
            if (array_key_exists('notes', $data)) {
                $locked->notes = $data['notes'];
            }

            $locked->save();

            AuditTrail::record([
                'event_type' => 'EXPENSE_UPDATED',
                'entity_type' => 'expense',
                'entity_id' => (int) $locked->id,
                'branch_id' => (int) $locked->branch_id,
                'user_id' => $request->user()?->id,
                'summary' => 'Expense updated',
                'meta' => [
                    'expense_number' => (string) ($locked->expense_number ?? ''),
                    'category' => (string) ($locked->category ?? ''),
                    'status' => (string) ($locked->status ?? ''),
                    'amount' => (float) ($locked->amount ?? 0),
                    'paid_at' => optional($locked->paid_at)->toDateTimeString(),
                    'updated_fields' => array_keys($data),
                ],
            ]);

            return $locked->fresh()->load(['branch', 'createdBy', 'voidedBy']);
        });
    }

    public function void(Request $request, Expense $expense)
    {
        $this->ensureNotCashier($request);

        return DB::transaction(function () use ($request, $expense) {
            $locked = $this->lockExpense($expense->id);
            $this->enforceBranchAccessOrFail($request, (int) $locked->branch_id);

            if ($locked->status === 'VOIDED') {
                throw ValidationException::withMessages([
                    'status' => ['Expense is already voided.'],
                ]);
            }

            $locked->status = 'VOIDED';
            $locked->voided_by_user_id = $request->user()?->id;
            $locked->voided_at = now();
            $locked->save();

            AuditTrail::record([
                'event_type' => 'EXPENSE_VOIDED',
                'entity_type' => 'expense',
                'entity_id' => (int) $locked->id,
                'branch_id' => (int) $locked->branch_id,
                'user_id' => $request->user()?->id,
                'summary' => 'Expense voided',
                'meta' => [
                    'expense_number' => (string) ($locked->expense_number ?? ''),
                    'category' => (string) ($locked->category ?? ''),
                    'status' => 'VOIDED',
                    'amount' => (float) ($locked->amount ?? 0),
                ],
            ]);

            return response()->json([
                'status' => 'ok',
                'expense' => $locked->fresh()->load(['branch', 'createdBy', 'voidedBy']),
            ]);
        });
    }

    private function lockExpense(int $expenseId): Expense
    {
        return Expense::query()
            ->lockForUpdate()
            ->findOrFail($expenseId);
    }

    private function ensureNotCashier(Request $request): void
    {
        $roleCode = strtoupper((string) ($request->user()?->role?->code ?? ''));
        if ($roleCode === 'CASHIER') {
            abort(403, 'Cashier role cannot access expenses.');
        }
    }
}

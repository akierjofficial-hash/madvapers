<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

trait EnforcesBranchAccess
{
    protected function isPrivilegedUser(?User $user): bool
    {
        $roleCode = strtoupper((string) ($user?->role?->code ?? ''));
        return in_array($roleCode, ['ADMIN'], true);
    }

    protected function assignedBranchIds(Request $request): array
    {
        $cached = $request->attributes->get('assigned_branch_ids');
        if (is_array($cached)) {
            return $cached;
        }

        $user = $request->user();
        if (!$user) {
            return [];
        }

        $ids = [];

        if (Schema::hasTable('branch_user')) {
            try {
                if ($user->relationLoaded('branches')) {
                    $ids = $user->branches->pluck('id')->all();
                } else {
                    $ids = $user->branches()->pluck('branches.id')->all();
                }
            } catch (\Throwable $e) {
                $ids = [];
            }
        }

        if ($user->branch_id) {
            $ids[] = (int) $user->branch_id;
        }

        $ids = array_values(array_unique(array_filter(array_map(
            fn ($id) => (int) $id,
            $ids
        ), fn ($id) => $id > 0)));

        sort($ids);
        $request->attributes->set('assigned_branch_ids', $ids);

        return $ids;
    }

    protected function assignedBranchId(Request $request): ?int
    {
        $ids = $this->assignedBranchIds($request);
        return $ids[0] ?? null;
    }

    protected function enforceBranchAccessOrFail(Request $request, int $branchId, string $field = 'branch_id'): void
    {
        if ($this->isPrivilegedUser($request->user())) {
            return;
        }

        $assigned = $this->assignedBranchIds($request);
        if (empty($assigned)) {
            throw new HttpResponseException(response()->json([
                'message' => 'Branch access is not assigned for this account.',
            ], 403));
        }

        if (!in_array((int) $branchId, $assigned, true)) {
            $payload = ['message' => 'Forbidden branch access.'];
            if (!app()->environment('production')) {
                $payload['field'] = $field;
                $payload['allowed_branch_ids'] = $assigned;
                $payload['provided_branch_id'] = (int) $branchId;
            }

            throw new HttpResponseException(response()->json($payload, 403));
        }
    }

    protected function scopeToAssignedBranch(Request $request, Builder $query, string $column = 'branch_id'): Builder
    {
        if ($this->isPrivilegedUser($request->user())) {
            return $query;
        }

        $assigned = $this->assignedBranchIds($request);
        if (empty($assigned)) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereIn($column, $assigned);
    }

    protected function enforceTransferTouchAccessOrFail(Request $request, int $fromBranchId, int $toBranchId): void
    {
        if ($this->isPrivilegedUser($request->user())) {
            return;
        }

        $assigned = $this->assignedBranchIds($request);
        if (empty($assigned)) {
            throw new HttpResponseException(response()->json([
                'message' => 'Branch access is not assigned for this account.',
            ], 403));
        }

        if (!in_array((int) $fromBranchId, $assigned, true) && !in_array((int) $toBranchId, $assigned, true)) {
            $payload = ['message' => 'Forbidden transfer access for this branch.'];
            if (!app()->environment('production')) {
                $payload['allowed_branch_ids'] = $assigned;
            }

            throw new HttpResponseException(response()->json($payload, 403));
        }
    }

    protected function enforceTransferFromBranchAccessOrFail(Request $request, int $fromBranchId): void
    {
        $this->enforceBranchAccessOrFail($request, $fromBranchId, 'from_branch_id');
    }

    protected function enforceTransferToBranchAccessOrFail(Request $request, int $toBranchId): void
    {
        $this->enforceBranchAccessOrFail($request, $toBranchId, 'to_branch_id');
    }

    protected function scopeTransfersToAssignedBranch(
        Request $request,
        Builder $query,
        string $fromColumn = 'from_branch_id',
        string $toColumn = 'to_branch_id'
    ): Builder {
        if ($this->isPrivilegedUser($request->user())) {
            return $query;
        }

        $assigned = $this->assignedBranchIds($request);
        if (empty($assigned)) {
            return $query->whereRaw('1 = 0');
        }

        return $query->where(function ($w) use ($fromColumn, $toColumn, $assigned) {
            $w->whereIn($fromColumn, $assigned)
                ->orWhereIn($toColumn, $assigned);
        });
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    private const FULL_ACCESS_ROLE_CODES = ['ADMIN'];

    private function normalizeBranchIds(array $branchIds): array
    {
        $ids = array_values(array_unique(array_filter(array_map(
            fn ($id) => (int) $id,
            $branchIds
        ), fn ($id) => $id > 0)));

        return $ids;
    }

    private function prioritizeBranchId(?int $primaryBranchId, array $branchIds): array
    {
        $ids = $this->normalizeBranchIds($branchIds);

        if (!$primaryBranchId) {
            return $ids;
        }

        $ids = array_values(array_filter($ids, fn ($id) => $id !== $primaryBranchId));
        array_unshift($ids, $primaryBranchId);

        return $ids;
    }

    private function roleRequiresBranch(int $roleId): bool
    {
        $role = Role::query()->find($roleId);
        $code = strtoupper((string) ($role?->code ?? ''));
        return !in_array($code, self::FULL_ACCESS_ROLE_CODES, true);
    }

    public function index(Request $request)
    {
        $q = User::query()
            ->with(['role', 'branch', 'branches'])
            ->orderByDesc('id');

        if ($request->filled('search')) {
            $term = '%' . trim((string) $request->input('search')) . '%';
            $q->where(function ($w) use ($term) {
                $w->where('name', 'like', $term)
                    ->orWhere('email', 'like', $term);
            });
        }

        if ($request->filled('role_id')) {
            $q->where('role_id', (int) $request->input('role_id'));
        }

        if ($request->filled('branch_id')) {
            $branchId = (int) $request->input('branch_id');
            $q->where(function ($w) use ($branchId) {
                $w->where('branch_id', $branchId)
                    ->orWhereHas('branches', fn ($b) => $b->where('branches.id', $branchId));
            });
        }

        if (!$request->boolean('include_inactive', false)) {
            $q->where('is_active', true);
        }

        return $q->paginate(30);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:180', 'unique:users,email'],
            'password' => ['required', 'string', 'max:120', Password::min(10)->letters()->mixedCase()->numbers()->symbols()],
            'role_id' => ['required', 'integer', 'exists:roles,id'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'branch_ids' => ['sometimes', 'array'],
            'branch_ids.*' => ['integer', 'distinct', 'exists:branches,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $primaryBranchId = !empty($data['branch_id']) ? (int) $data['branch_id'] : null;
        $branchIds = $this->normalizeBranchIds($data['branch_ids'] ?? []);

        if ($primaryBranchId) {
            $branchIds = $this->prioritizeBranchId($primaryBranchId, $branchIds);
        }

        if (empty($branchIds) && $primaryBranchId) {
            $branchIds = [$primaryBranchId];
        }

        if ($this->roleRequiresBranch((int) $data['role_id']) && empty($branchIds)) {
            throw ValidationException::withMessages([
                'branch_ids' => ['At least one branch is required for this role.'],
            ]);
        }

        $primaryBranchId = $primaryBranchId ?? ($branchIds[0] ?? null);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'], // hashed cast on model
            'role_id' => $data['role_id'],
            'branch_id' => $primaryBranchId,
            'is_active' => $data['is_active'] ?? true,
        ]);

        $user->branches()->sync($branchIds);

        return response()->json($user->fresh()->load(['role', 'branch', 'branches']), 201);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => [
                'sometimes',
                'email',
                'max:180',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
            'role_id' => ['sometimes', 'integer', 'exists:roles,id'],
            'branch_id' => ['sometimes', 'nullable', 'integer', 'exists:branches,id'],
            'branch_ids' => ['sometimes', 'array'],
            'branch_ids.*' => ['integer', 'distinct', 'exists:branches,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $targetRoleId = array_key_exists('role_id', $data) ? (int) $data['role_id'] : (int) $user->role_id;
        $hasPrimaryBranchInput = array_key_exists('branch_id', $data);
        $primaryBranchInput = $hasPrimaryBranchInput && !empty($data['branch_id']) ? (int) $data['branch_id'] : null;
        $hasBranchIdsInput = array_key_exists('branch_ids', $data);
        $branchIdsInput = $hasBranchIdsInput
            ? $this->normalizeBranchIds((array) ($data['branch_ids'] ?? []))
            : null;

        $currentBranchIds = $this->normalizeBranchIds($user->branches()->pluck('branches.id')->all());
        if (empty($currentBranchIds) && $user->branch_id) {
            $currentBranchIds = [(int) $user->branch_id];
        }

        if ($hasBranchIdsInput) {
            $targetBranchIds = $branchIdsInput ?? [];
            if ($primaryBranchInput) {
                $targetBranchIds = $this->prioritizeBranchId($primaryBranchInput, $targetBranchIds);
            }
        } elseif ($hasPrimaryBranchInput) {
            $targetBranchIds = $primaryBranchInput ? [$primaryBranchInput] : [];
        } else {
            $targetBranchIds = $currentBranchIds;
        }

        $targetBranchIds = $this->normalizeBranchIds($targetBranchIds);
        $targetPrimaryBranchId = $hasPrimaryBranchInput ? $primaryBranchInput : ($targetBranchIds[0] ?? null);

        if ($targetPrimaryBranchId) {
            $targetBranchIds = $this->prioritizeBranchId($targetPrimaryBranchId, $targetBranchIds);
        }

        if (!$targetPrimaryBranchId && !empty($targetBranchIds)) {
            $targetPrimaryBranchId = $targetBranchIds[0];
        }

        if ($targetRoleId <= 0) {
            throw ValidationException::withMessages([
                'role_id' => ['Role is required.'],
            ]);
        }

        if ($this->roleRequiresBranch($targetRoleId) && empty($targetBranchIds)) {
            throw ValidationException::withMessages([
                'branch_ids' => ['At least one branch is required for this role.'],
            ]);
        }

        if (array_key_exists('is_active', $data) && !$data['is_active'] && $request->user()?->id === $user->id) {
            throw ValidationException::withMessages([
                'is_active' => ['You cannot deactivate your own account.'],
            ]);
        }

        $updateData = $data;
        unset($updateData['branch_ids']);
        $updateData['branch_id'] = $targetPrimaryBranchId;

        $user->update($updateData);
        $user->branches()->sync($targetBranchIds);

        if (array_key_exists('is_active', $data) && !$data['is_active']) {
            // Immediately cut off existing sessions/tokens.
            $user->tokens()->delete();
        }

        return $user->fresh()->load(['role', 'branch', 'branches']);
    }

    public function setPassword(Request $request, User $user)
    {
        $data = $request->validate([
            'password' => ['required', 'string', 'max:120', Password::min(10)->letters()->mixedCase()->numbers()->symbols()],
        ]);

        $user->password = $data['password']; // hashed cast on model
        $user->save();

        // Revoke existing tokens to force re-login on password reset.
        $user->tokens()->delete();

        return response()->json(['status' => 'ok']);
    }

    public function disable(Request $request, User $user)
    {
        if ($request->user()?->id === $user->id) {
            throw ValidationException::withMessages([
                'user' => ['You cannot disable your own account.'],
            ]);
        }

        return DB::transaction(function () use ($user) {
            $user->is_active = false;
            $user->save();
            $user->tokens()->delete();

            return response()->json([
                'status' => 'ok',
                'user' => $user->fresh()->load(['role', 'branch', 'branches']),
            ]);
        });
    }

    public function enable(Request $request, User $user)
    {
        $user->is_active = true;
        $user->save();

        return response()->json([
            'status' => 'ok',
            'user' => $user->fresh()->load(['role', 'branch', 'branches']),
        ]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private function authPayload($user): array
    {
        $user->load(['role.permissions', 'branch', 'branches']);

        $permissions = $user->role
            ? $user->role->permissions->pluck('code')->values()
            : collect();

        // Backward compatibility: ADJUSTMENT_SUBMIT is the canonical permission,
        // but some existing seeded databases may still only have ADJUSTMENT_CREATE.
        if ($permissions->contains('ADJUSTMENT_CREATE') && !$permissions->contains('ADJUSTMENT_SUBMIT')) {
            $permissions->push('ADJUSTMENT_SUBMIT');
        }

        $permissions = $permissions->unique()->values();

        $branchIds = $user->branches
            ? $user->branches->pluck('id')->map(fn ($id) => (int) $id)->values()->all()
            : [];

        if ($user->branch_id && !in_array((int) $user->branch_id, $branchIds, true)) {
            $branchIds[] = (int) $user->branch_id;
        }

        return [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_active' => (bool) ($user->is_active ?? true),
                'role_id' => $user->role_id,
                'branch_id' => $user->branch_id,
                'branch_ids' => array_values(array_unique($branchIds)),
                'role' => $user->role ? [
                    'id' => $user->role->id,
                    'code' => $user->role->code,
                    'name' => $user->role->name,
                ] : null,
                'branch' => $user->branch ? [
                    'id' => $user->branch->id,
                    'code' => $user->branch->code,
                    'name' => $user->branch->name,
                ] : null,
                'branches' => $user->branches
                    ? $user->branches
                        ->map(fn ($b) => [
                            'id' => $b->id,
                            'code' => $b->code,
                            'name' => $b->name,
                        ])
                        ->values()
                    : [],
            ],
            'permissions' => $permissions,
        ];
    }

    public function login(Request $request)
    {
        $request->validate([
            'email' => ['required','email'],
            'password' => ['required'],
        ]);

        if (!Auth::attempt($request->only('email','password'))) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        $user = $request->user();

        if (!$user->is_active) {
            Auth::logout();
            throw ValidationException::withMessages([
                'email' => ['This account is inactive. Contact an administrator.'],
            ]);
        }

        // optional: revoke old tokens
        $user->tokens()->delete();

        $token = $user->createToken('madvapers-web')->plainTextToken;

        return response()->json(array_merge(
            ['token' => $token],
            $this->authPayload($user)
        ));
    }

    public function me(Request $request)
    {
        if (!$request->user()?->is_active) {
            return response()->json(['message' => 'Account is inactive.'], 403);
        }

        return response()->json($this->authPayload($request->user()));
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['status' => 'ok']);
    }
}

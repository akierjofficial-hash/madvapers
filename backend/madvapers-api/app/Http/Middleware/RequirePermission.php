<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequirePermission
{
    private const COMPAT_ALIASES = [
        // Backward compatibility for older seeded databases.
        'ADJUSTMENT_SUBMIT' => ['ADJUSTMENT_CREATE'],
    ];

    public function handle(Request $request, Closure $next, string $permissionCode): Response
    {
        $user = $request->user();

        // Not authenticated (Sanctum)
        if (!$user) {
            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        // If user has no role assigned, deny
        if (!$user->role) {
            return response()->json([
                'message' => 'Forbidden (no role).',
                'required' => $permissionCode,
            ], 403);
        }

        if (!$user->is_active) {
            return response()->json([
                'message' => 'Forbidden (inactive account).',
            ], 403);
        }

        $allowedCodes = [$permissionCode];
        if (isset(self::COMPAT_ALIASES[$permissionCode])) {
            $allowedCodes = array_values(array_unique(array_merge(
                $allowedCodes,
                self::COMPAT_ALIASES[$permissionCode]
            )));
        }

        $authorized = false;
        foreach ($allowedCodes as $code) {
            if ($user->hasPermission($code)) {
                $authorized = true;
                break;
            }
        }

        if (!$authorized) {
            return response()->json([
                'message' => 'Forbidden (missing permission).',
                'required' => $permissionCode,
                'accepted' => $allowedCodes,
                'role' => $user->role->code,
            ], 403);
        }

        return $next($request);
    }
}

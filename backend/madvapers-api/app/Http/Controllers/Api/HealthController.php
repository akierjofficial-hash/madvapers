<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

class HealthController extends Controller
{
    public function index(): JsonResponse
    {
        $databaseStatus = $this->databaseStatus();
        $isReady = $databaseStatus === 'ok';

        return response()->json([
            'service' => 'madvapers-api',
            'status' => $isReady ? 'ok' : 'error',
            'time' => now()->toIso8601String(),
            'checks' => [
                'app' => 'ok',
                'database' => $databaseStatus,
            ],
            'endpoints' => [
                'live' => '/api/health/live',
                'ready' => '/api/health/ready',
            ],
        ], $isReady ? 200 : 503);
    }

    public function live(): JsonResponse
    {
        return response()->json([
            'service' => 'madvapers-api',
            'status' => 'ok',
            'type' => 'live',
            'time' => now()->toIso8601String(),
            'checks' => [
                'app' => 'ok',
            ],
        ]);
    }

    public function ready(): JsonResponse
    {
        $databaseStatus = $this->databaseStatus();
        $isReady = $databaseStatus === 'ok';

        return response()->json([
            'service' => 'madvapers-api',
            'status' => $isReady ? 'ok' : 'error',
            'type' => 'ready',
            'time' => now()->toIso8601String(),
            'checks' => [
                'app' => 'ok',
                'database' => $databaseStatus,
            ],
        ], $isReady ? 200 : 503);
    }

    private function databaseStatus(): string
    {
        try {
            DB::select('select 1 as ok');
            return 'ok';
        } catch (Throwable $exception) {
            report($exception);
            return 'error';
        }
    }
}

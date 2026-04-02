<?php

namespace App\Support;

use App\Models\AuditEvent;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class AuditTrail
{
    /**
     * @param array{
     *   event_type:string,
     *   entity_type?:string|null,
     *   entity_id?:int|null,
     *   branch_id?:int|null,
     *   user_id?:int|null,
     *   summary?:string|null,
     *   meta?:array|null
     * } $payload
     */
    public static function record(array $payload): void
    {
        $eventType = strtoupper(trim((string) ($payload['event_type'] ?? '')));
        if ($eventType === '') {
            return;
        }

        if (!Schema::hasTable('audit_events')) {
            Log::warning('Audit trail skipped because audit_events table is missing.', [
                'event_type' => $eventType,
            ]);
            return;
        }

        try {
            $meta = isset($payload['meta']) && is_array($payload['meta']) ? $payload['meta'] : [];
            $request = app()->bound('request') ? request() : null;
            if ($request) {
                $meta = array_merge([
                    'request_ip' => (string) ($request->ip() ?? ''),
                    'request_method' => strtoupper((string) ($request->method() ?? '')),
                    'request_path' => (string) ($request->path() ?? ''),
                    'request_user_agent' => mb_substr((string) ($request->userAgent() ?? ''), 0, 255),
                ], $meta);
            }

            AuditEvent::create([
                'event_type' => $eventType,
                'entity_type' => isset($payload['entity_type']) ? (string) $payload['entity_type'] : null,
                'entity_id' => isset($payload['entity_id']) ? (int) $payload['entity_id'] : null,
                'branch_id' => isset($payload['branch_id']) ? (int) $payload['branch_id'] : null,
                'user_id' => isset($payload['user_id']) ? (int) $payload['user_id'] : null,
                'summary' => isset($payload['summary']) ? trim((string) $payload['summary']) : null,
                'meta' => !empty($meta) ? $meta : null,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Audit trail write failed.', [
                'event_type' => $eventType,
                'message' => $e->getMessage(),
            ]);
        }
    }
}

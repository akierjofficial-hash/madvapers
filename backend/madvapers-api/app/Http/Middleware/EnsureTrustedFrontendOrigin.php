<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTrustedFrontendOrigin
{
    public function handle(Request $request, Closure $next): Response
    {
        // Keep local/testing developer workflows simple.
        if (!app()->environment('production')) {
            return $next($request);
        }

        $allowedOrigins = $this->allowedOrigins();
        $requestOrigin = $this->requestOrigin($request);

        if (!$requestOrigin || !in_array($requestOrigin, $allowedOrigins, true)) {
            return response()->json([
                'message' => 'Forbidden origin.',
            ], 403);
        }

        return $next($request);
    }

    /**
     * @return string[]
     */
    private function allowedOrigins(): array
    {
        $raw = trim((string) env('LOGIN_ALLOWED_ORIGINS', ''));
        if ($raw === '') {
            $configured = config('cors.allowed_origins', []);
            return $this->normalizeOrigins(is_array($configured) ? $configured : []);
        }

        return $this->normalizeOrigins(explode(',', $raw));
    }

    /**
     * @param array<int, mixed> $values
     * @return string[]
     */
    private function normalizeOrigins(array $values): array
    {
        $origins = [];

        foreach ($values as $value) {
            $normalized = $this->normalizeOrigin($value);
            if ($normalized !== null) {
                $origins[] = $normalized;
            }
        }

        return array_values(array_unique($origins));
    }

    private function requestOrigin(Request $request): ?string
    {
        $origin = $this->normalizeOrigin($request->headers->get('Origin'));
        if ($origin !== null) {
            return $origin;
        }

        return $this->normalizeOrigin($request->headers->get('Referer'));
    }

    private function normalizeOrigin(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $raw = trim($value);
        if ($raw === '') {
            return null;
        }

        $parts = parse_url($raw);
        if (!is_array($parts)) {
            return null;
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));
        $port = isset($parts['port']) ? ':' . (int) $parts['port'] : '';

        if ($scheme === '' || $host === '') {
            return null;
        }

        return "{$scheme}://{$host}{$port}";
    }
}


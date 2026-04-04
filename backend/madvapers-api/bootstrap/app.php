<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Enable Sanctum first-party SPA cookie authentication on API routes.
        $middleware->statefulApi();

        // Login endpoint is credential-based and rate-limited; excluding CSRF here
        // avoids cross-subdomain SPA login failures on shared hosting domains.
        $middleware->validateCsrfTokens(except: [
            'api/auth/login',
            // Push subscription endpoints are authenticated via Bearer token
            // in production token mode, where CSRF cookies are intentionally not used.
            'api/push-subscriptions',
        ]);

        $middleware->alias([
            'perm' => \App\Http\Middleware\RequirePermission::class,
            'trusted.origin' => \App\Http\Middleware\EnsureTrustedFrontendOrigin::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })
    ->create();

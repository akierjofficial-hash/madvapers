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

        // API routes are authenticated by Sanctum/Bearer tokens and permission middleware.
        // In production token mode, CSRF cookies are not used, so exclude API paths
        // from CSRF validation to prevent random 419 failures on POST/PUT/DELETE.
        $middleware->validateCsrfTokens(except: [
            'api/*',
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

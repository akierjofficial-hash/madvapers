<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('login', function (Request $request) {
            $maxAttempts = max(1, (int) env('LOGIN_RATE_LIMIT_PER_MINUTE', 5));
            $email = Str::lower((string) $request->input('email', ''));
            $key = ($email !== '' ? $email : 'anonymous') . '|' . $request->ip();

            return [Limit::perMinute($maxAttempts)->by($key)];
        });

        RateLimiter::for('api', function (Request $request) {
            $maxRequests = max(1, (int) env('API_RATE_LIMIT_PER_MINUTE', 180));
            $key = $request->user()?->id
                ? 'user:' . $request->user()->id
                : 'ip:' . $request->ip();

            return [Limit::perMinute($maxRequests)->by($key)];
        });

        RateLimiter::for('public-api', function (Request $request) {
            $maxRequests = max(1, (int) env('PUBLIC_API_RATE_LIMIT_PER_MINUTE', 120));
            return [Limit::perMinute($maxRequests)->by($request->ip())];
        });
    }
}

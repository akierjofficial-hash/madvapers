<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    protected function redirectTo(Request $request): ?string
    {
        // For APIs (expectsJson), do NOT redirect
        if ($request->expectsJson()) {
            return null;
        }

        // If you actually have a web login route, you can return it here
        return route('login');
    }
}
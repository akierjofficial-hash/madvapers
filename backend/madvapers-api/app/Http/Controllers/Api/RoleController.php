<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    public function index(Request $request)
    {
        $q = Role::query()->orderBy('name');

        if ($request->boolean('with_permissions', false)) {
            $q->with('permissions');
        }

        return $q->get();
    }
}


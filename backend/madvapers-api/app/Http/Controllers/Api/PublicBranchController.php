<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;

class PublicBranchController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => Branch::query()
                ->where('is_active', true)
                ->orderBy('code')
                ->get([
                    'id',
                    'code',
                    'name',
                    'address',
                    'locator',
                    'cellphone_no',
                ]),
        ]);
    }
}


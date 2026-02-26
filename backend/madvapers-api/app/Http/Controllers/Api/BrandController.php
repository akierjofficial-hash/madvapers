<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BrandController extends Controller
{
    public function index(Request $request)
    {
        $q = Brand::query()->orderBy('name');

        if ($request->filled('search')) {
            $like = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $q->where('name', $like, '%' . trim((string) $request->input('search')) . '%');
        }

        return $q->paginate(50);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', 'unique:brands,name'],
            'is_active' => ['boolean'],
        ]);

        $brand = Brand::create([
            'name' => $data['name'],
            'is_active' => $data['is_active'] ?? true,
        ]);

        return response()->json($brand, 201);
    }

    public function show(Brand $brand)
    {
        return $brand;
    }

    public function update(Request $request, Brand $brand)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120', 'unique:brands,name,' . $brand->id],
            'is_active' => ['boolean'],
        ]);

        $brand->update($data);

        return $brand;
    }

    public function destroy(Brand $brand)
    {
        $brand->update(['is_active' => false]);
        return response()->json(['status' => 'ok']);
    }
}

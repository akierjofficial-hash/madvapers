<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CategoryController extends Controller
{
    public function index(Request $request)
    {
        $q = Category::query()->orderBy('name');

        if ($request->filled('search')) {
            $like = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $q->where('name', $like, '%' . trim((string) $request->input('search')) . '%');
        }

        return $q->paginate(50);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', 'unique:categories,name'],
            'is_active' => ['boolean'],
        ]);

        $cat = Category::create([
            'name' => $data['name'],
            'is_active' => $data['is_active'] ?? true,
        ]);

        return response()->json($cat, 201);
    }

    public function show(Category $category)
    {
        return $category;
    }

    public function update(Request $request, Category $category)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120', 'unique:categories,name,' . $category->id],
            'is_active' => ['boolean'],
        ]);

        $category->update($data);

        return $category;
    }

    public function destroy(Category $category)
    {
        $category->update(['is_active' => false]);
        return response()->json(['status' => 'ok']);
    }
}

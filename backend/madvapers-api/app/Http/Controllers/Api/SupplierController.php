<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function index(Request $request)
    {
        $q = Supplier::query()->orderBy('name');

        if (!$request->boolean('include_inactive', false)) {
            $q->where('is_active', true);
        }

        if ($request->filled('search')) {
            $q->where('name', 'like', '%' . trim((string) $request->input('search')) . '%');
        }

        return $q->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:suppliers,name'],
            'contact_person' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:150'],
            'address' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $supplier = Supplier::create([
            ...$data,
            'is_active' => $data['is_active'] ?? true,
        ]);

        return response()->json($supplier, 201);
    }

    public function update(Request $request, Supplier $supplier)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255', 'unique:suppliers,name,' . $supplier->id],
            'contact_person' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:150'],
            'address' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $supplier->update($data);

        return $supplier->fresh();
    }

    public function destroy(Supplier $supplier)
    {
        $supplier->update(['is_active' => false]);

        return response()->json(['status' => 'ok']);
    }
}

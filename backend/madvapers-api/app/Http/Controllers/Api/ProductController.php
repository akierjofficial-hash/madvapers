<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    private function normalizeProductType(string $value): string
    {
        $normalized = strtoupper(trim($value));
        $normalized = preg_replace('/[^A-Z0-9]+/', '_', $normalized) ?? '';
        $normalized = preg_replace('/_+/', '_', $normalized) ?? '';
        $normalized = trim($normalized, '_');

        return $normalized !== '' ? $normalized : 'DEVICE';
    }

    public function index(Request $request)
    {
        $q = Product::query()
            ->with(['brand', 'category'])
            ->withCount('variants')
            ->orderBy('id', 'desc');

        if (!$request->boolean('include_inactive', false)) {
            $q->where('is_active', true);
        }

        if ($request->filled('search')) {
            $like = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $term = '%' . trim((string) $request->input('search')) . '%';
            $q->where(function ($w) use ($like, $term) {
                $w->where('name', $like, $term)
                    ->orWhere('product_type', $like, $term)
                    ->orWhereHas('brand', fn ($b) => $b->where('name', $like, $term))
                    ->orWhereHas('category', fn ($c) => $c->where('name', $like, $term));
            });
        }

        if ($request->filled('brand_id')) {
            $q->where('brand_id', $request->integer('brand_id'));
        }

        if ($request->filled('category_id')) {
            $q->where('category_id', $request->integer('category_id'));
        }

        if ($request->filled('product_type')) {
            $q->where('product_type', $this->normalizeProductType((string) $request->input('product_type')));
        }

        return $q->paginate(20);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'brand_id' => ['required', 'exists:brands,id'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:180'],
            'product_type' => ['required', 'string', 'max:40', 'regex:/^[A-Za-z][A-Za-z0-9 _-]*$/'],
            'description' => ['nullable', 'string'],
            'base_price' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['boolean'],
        ]);

        $data['product_type'] = $this->normalizeProductType((string) $data['product_type']);
        $product = Product::create($data);

        return response()->json($product->load(['brand', 'category']), 201);
    }

    public function show(Product $product)
    {
        return $product->load(['brand', 'category', 'variants']);
    }

    public function update(Request $request, Product $product)
    {
        $data = $request->validate([
            'brand_id' => ['sometimes', 'required', 'exists:brands,id'],
            'category_id' => ['sometimes', 'nullable', 'exists:categories,id'],
            'name' => ['sometimes', 'string', 'max:180'],
            'product_type' => ['sometimes', 'string', 'max:40', 'regex:/^[A-Za-z][A-Za-z0-9 _-]*$/'],
            'description' => ['nullable', 'string'],
            'base_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
        ]);

        if (array_key_exists('product_type', $data)) {
            $data['product_type'] = $this->normalizeProductType((string) $data['product_type']);
        }

        $product->update($data);

        return $product->load(['brand', 'category']);
    }

    public function destroy(Product $product)
    {
        // safer: deactivate rather than delete
        $product->update(['is_active' => false]);
        return response()->json(['status' => 'ok']);
    }

    public function enable(Product $product)
    {
        $product->update(['is_active' => true]);
        return response()->json(['status' => 'ok']);
    }

    /**
     * Permanent delete (safe purge):
     * - product must be disabled first
     * - product must have no variants
     */
    public function purge(Product $product)
    {
        if ($product->is_active) {
            return response()->json([
                'message' => 'Disable the product before deleting permanently.',
            ], 422);
        }

        if ($product->variants()->exists()) {
            return response()->json([
                'message' => 'Cannot delete product with existing variants. Delete variants first.',
            ], 422);
        }

        $product->delete();

        return response()->json(['status' => 'ok']);
    }
}

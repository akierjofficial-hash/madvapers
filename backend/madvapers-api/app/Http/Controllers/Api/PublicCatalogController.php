<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PublicCatalogController extends Controller
{
    public function index(Request $request)
    {
        $like = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';
        $perPage = (int) $request->integer('per_page', 200);
        $perPage = max(1, min($perPage, 500));

        $q = ProductVariant::query()
            ->with(['product.brand', 'product.category'])
            ->withSum('inventoryBalances as qty_on_hand', 'qty_on_hand')
            ->where('is_active', true)
            ->whereHas('product', fn ($p) => $p->where('is_active', true))
            ->orderByDesc('id');

        if ($request->filled('search')) {
            $term = '%' . trim((string) $request->input('search')) . '%';
            $q->where(function ($sub) use ($term, $like) {
                $sub->where('sku', $like, $term)
                    ->orWhere('variant_name', $like, $term)
                    ->orWhere('flavor', $like, $term)
                    ->orWhereHas('product', function ($p) use ($term, $like) {
                        $p->where('name', $like, $term)
                            ->orWhere('product_type', $like, $term)
                            ->orWhereHas('brand', fn ($b) => $b->where('name', $like, $term))
                            ->orWhereHas('category', fn ($c) => $c->where('name', $like, $term));
                    });
            });
        }

        if ($request->filled('product_type')) {
            $q->whereHas('product', fn ($p) => $p->where('product_type', strtoupper((string) $request->input('product_type'))));
        }

        if ($request->filled('brand_id')) {
            $brandId = $request->integer('brand_id');
            $q->whereHas('product', fn ($p) => $p->where('brand_id', $brandId));
        }

        $page = $q->paginate($perPage);

        return response()->json([
            'data' => $page->getCollection()->map(fn (ProductVariant $variant) => $this->toPublicVariant($variant))->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'last_page' => $page->lastPage(),
            ],
        ]);
    }

    public function show(ProductVariant $variant)
    {
        $variant
            ->load(['product.brand', 'product.category'])
            ->loadSum('inventoryBalances as qty_on_hand', 'qty_on_hand');

        if (!$variant->is_active || !$variant->product || !$variant->product->is_active) {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        return response()->json([
            'data' => $this->toPublicVariant($variant),
        ]);
    }

    private function toPublicVariant(ProductVariant $variant): array
    {
        $product = $variant->product;

        return [
            'id' => $variant->id,
            'sku' => $variant->sku,
            'qty_on_hand' => (float) ($variant->qty_on_hand ?? 0),
            'variant_name' => $variant->variant_name,
            'flavor' => $variant->flavor,
            'nicotine_strength' => $variant->nicotine_strength,
            'resistance' => $variant->resistance,
            'capacity' => $variant->capacity,
            'color' => $variant->color,
            'default_price' => $variant->default_price,
            'created_at' => $variant->created_at?->toISOString(),
            'product' => [
                'id' => $product?->id,
                'name' => $product?->name,
                'description' => $product?->description,
                'product_type' => $product?->product_type,
                'base_price' => $product?->base_price,
                'brand' => $product?->brand ? [
                    'id' => $product->brand->id,
                    'name' => $product->brand->name,
                ] : null,
                'category' => $product?->category ? [
                    'id' => $product->category->id,
                    'name' => $product->category->name,
                ] : null,
            ],
        ];
    }
}

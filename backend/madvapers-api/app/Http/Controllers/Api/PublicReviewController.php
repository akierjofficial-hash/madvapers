<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Review;
use Illuminate\Http\Request;

class PublicReviewController extends Controller
{
    public function index(Request $request)
    {
        $limit = (int) $request->integer('limit', 12);
        $limit = max(1, min($limit, 100));

        $q = Review::query()
            ->with([
                'product:id,name,is_active',
                'variant:id,product_id,variant_name,flavor,sku,is_active',
            ])
            ->where('is_active', true)
            ->orderByDesc('created_at');

        if ($request->filled('product_id')) {
            $q->where('product_id', $request->integer('product_id'));
        }

        if ($request->filled('variant_id')) {
            $q->where('product_variant_id', $request->integer('variant_id'));
        }

        $items = $q->limit($limit)->get();

        return response()->json([
            'data' => $items->map(fn (Review $review) => $this->toPublicReview($review))->values(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'customer_name' => ['required', 'string', 'min:2', 'max:120'],
            'customer_handle' => ['nullable', 'string', 'max:120'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'title' => ['nullable', 'string', 'max:180'],
            'comment' => ['required', 'string', 'min:10', 'max:1500'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'product_variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
        ]);

        $variantId = isset($data['product_variant_id']) ? (int) $data['product_variant_id'] : null;
        $productId = isset($data['product_id']) ? (int) $data['product_id'] : null;

        if ($variantId !== null) {
            $variant = ProductVariant::query()->with('product:id,is_active')->find($variantId);

            if (!$variant || !$variant->is_active || !$variant->product || !$variant->product->is_active) {
                return response()->json([
                    'message' => 'Selected variant is not available for reviews.',
                ], 422);
            }

            $productId = (int) $variant->product_id;
        } elseif ($productId !== null) {
            $product = Product::query()->find($productId);

            if (!$product || !$product->is_active) {
                return response()->json([
                    'message' => 'Selected product is not available for reviews.',
                ], 422);
            }
        }

        $customerName = trim((string) $data['customer_name']);
        $customerHandle = $this->normalizeHandle($data['customer_handle'] ?? null);
        $title = isset($data['title']) ? trim((string) $data['title']) : null;
        $comment = trim(strip_tags((string) $data['comment']));

        if ($comment === '') {
            return response()->json([
                'message' => 'Review comment cannot be empty.',
            ], 422);
        }

        $review = Review::query()->create([
            'product_id' => $productId,
            'product_variant_id' => $variantId,
            'customer_name' => $customerName,
            'customer_handle' => $customerHandle,
            'rating' => (int) $data['rating'],
            'title' => $title !== '' ? $title : null,
            'comment' => $comment,
            'is_verified_purchase' => false,
            'is_active' => true,
        ]);

        $review->load([
            'product:id,name,is_active',
            'variant:id,product_id,variant_name,flavor,sku,is_active',
        ]);

        return response()->json([
            'message' => 'Review submitted successfully.',
            'data' => $this->toPublicReview($review),
        ], 201);
    }

    private function normalizeHandle(mixed $handle): ?string
    {
        if (!is_string($handle)) {
            return null;
        }

        $value = trim($handle);
        if ($value === '') {
            return null;
        }

        if ($value[0] !== '@') {
            $value = '@' . $value;
        }

        return substr($value, 0, 120);
    }

    private function toPublicReview(Review $review): array
    {
        return [
            'id' => $review->id,
            'customer_name' => $review->customer_name,
            'customer_handle' => $review->customer_handle,
            'rating' => (int) $review->rating,
            'title' => $review->title,
            'comment' => $review->comment,
            'is_verified_purchase' => (bool) $review->is_verified_purchase,
            'created_at' => $review->created_at?->toISOString(),
            'product' => $review->product ? [
                'id' => $review->product->id,
                'name' => $review->product->name,
            ] : null,
            'variant' => $review->variant ? [
                'id' => $review->variant->id,
                'variant_name' => $review->variant->variant_name,
                'flavor' => $review->variant->flavor,
                'sku' => $review->variant->sku,
            ] : null,
        ];
    }
}


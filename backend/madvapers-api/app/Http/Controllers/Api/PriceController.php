<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductVariant;
use App\Models\PriceHistory;
use Illuminate\Http\Request;

class PriceController extends Controller
{
    // POST /api/variants/{variant}/price
    public function setVariantPrice(Request $request, ProductVariant $variant)
    {
        $data = $request->validate([
            'price' => ['required', 'numeric', 'gt:0'],
            'effective_at' => ['nullable', 'date'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $history = PriceHistory::create([
            'product_variant_id' => $variant->id,
            'price' => $data['price'],
            'effective_at' => $data['effective_at'] ?? now(),
            'changed_by_user_id' => $request->user()?->id,
            'reason' => $data['reason'] ?? null,
        ]);

        // Phase 1: apply immediately
        $variant->update(['default_price' => $data['price']]);

        return response()->json([
            'status' => 'ok',
            'variant_id' => $variant->id,
            'current_price' => $variant->default_price,
            'history' => $history,
        ]);
    }
}

<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Branch;
use App\Models\Category;
use App\Models\InventoryBalance;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\InventoryService;
use Illuminate\Database\Seeder;

class DemoCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $branches = Branch::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->get();
        if ($branches->isEmpty()) {
            return;
        }

        $admin = User::query()->where('email', 'admin@madvapers.local')->first();
        /** @var InventoryService $inventoryService */
        $inventoryService = app(InventoryService::class);

        $catalog = [
            [
                'brand' => 'Vaporesso',
                'category' => 'Devices',
                'product_name' => 'XROS 3 Pod Kit',
                'product_type' => 'DEVICE',
                'description' => 'Demo pod device for local testing.',
                'variants' => [
                    [
                        'sku' => 'MV-DEMO-XROS3-BLK',
                        'barcode' => '890000000101',
                        'variant_name' => 'Black',
                        'default_cost' => 1100,
                        'default_price' => 1490,
                        'is_battery' => true,
                        'is_consumable' => false,
                        'contains_nicotine' => false,
                        'is_age_restricted' => false,
                    ],
                    [
                        'sku' => 'MV-DEMO-XROS3-SIL',
                        'barcode' => '890000000102',
                        'variant_name' => 'Silver',
                        'default_cost' => 1100,
                        'default_price' => 1490,
                        'is_battery' => true,
                        'is_consumable' => false,
                        'contains_nicotine' => false,
                        'is_age_restricted' => false,
                    ],
                ],
            ],
            [
                'brand' => 'Mad Vapers House',
                'category' => 'E-liquids',
                'product_name' => 'Black Ice 30ml',
                'product_type' => 'JUICE_FREEBASE',
                'description' => 'Demo e-liquid for barcode and inventory workflow.',
                'variants' => [
                    [
                        'sku' => 'MV-DEMO-BLACKICE-3MG',
                        'barcode' => '890000000201',
                        'variant_name' => '3mg',
                        'flavor' => 'Black Ice',
                        'nicotine_strength' => '3mg',
                        'capacity' => '30ml',
                        'default_cost' => 140,
                        'default_price' => 250,
                    ],
                    [
                        'sku' => 'MV-DEMO-BLACKICE-6MG',
                        'barcode' => '890000000202',
                        'variant_name' => '6mg',
                        'flavor' => 'Black Ice',
                        'nicotine_strength' => '6mg',
                        'capacity' => '30ml',
                        'default_cost' => 140,
                        'default_price' => 250,
                    ],
                ],
            ],
            [
                'brand' => 'Oxbar',
                'category' => 'Disposables',
                'product_name' => 'Oxbar 9000',
                'product_type' => 'DISPOSABLE',
                'description' => 'Demo disposable device line.',
                'variants' => [
                    [
                        'sku' => 'MV-DEMO-OXBAR-MANGO',
                        'barcode' => '890000000301',
                        'variant_name' => 'Mango Peach',
                        'flavor' => 'Mango Peach',
                        'nicotine_strength' => '50mg',
                        'capacity' => '9000 puffs',
                        'default_cost' => 280,
                        'default_price' => 420,
                    ],
                    [
                        'sku' => 'MV-DEMO-OXBAR-STRAW',
                        'barcode' => '890000000302',
                        'variant_name' => 'Strawberry Kiwi',
                        'flavor' => 'Strawberry Kiwi',
                        'nicotine_strength' => '50mg',
                        'capacity' => '9000 puffs',
                        'default_cost' => 280,
                        'default_price' => 420,
                    ],
                ],
            ],
        ];

        $openingRules = [
            'MV-DEMO-XROS3-BLK' => ['base' => 6, 'step' => 1],
            'MV-DEMO-XROS3-SIL' => ['base' => 5, 'step' => 1],
            'MV-DEMO-BLACKICE-3MG' => ['base' => 40, 'step' => 5],
            'MV-DEMO-BLACKICE-6MG' => ['base' => 28, 'step' => 4],
            'MV-DEMO-OXBAR-MANGO' => ['base' => 22, 'step' => 4],
            'MV-DEMO-OXBAR-STRAW' => ['base' => 18, 'step' => 3],
        ];

        $variants = [];

        foreach ($catalog as $entry) {
            $brand = Brand::query()->updateOrCreate(
                ['name' => $entry['brand']],
                ['is_active' => true]
            );

            $category = Category::query()->firstOrCreate(
                ['name' => $entry['category']],
                ['is_active' => true]
            );

            $product = Product::query()->updateOrCreate(
                [
                    'brand_id' => $brand->id,
                    'name' => $entry['product_name'],
                ],
                [
                    'category_id' => $category->id,
                    'product_type' => $entry['product_type'] ?? 'DEVICE',
                    'description' => $entry['description'],
                    'is_active' => true,
                ]
            );

            foreach ($entry['variants'] as $variantData) {
                $sku = $variantData['sku'];
                $variants[$sku] = ProductVariant::query()->updateOrCreate(
                    ['sku' => $sku],
                    [
                        'product_id' => $product->id,
                        'barcode' => $variantData['barcode'] ?? null,
                        'variant_name' => $variantData['variant_name'] ?? null,
                        'flavor' => $variantData['flavor'] ?? null,
                        'nicotine_strength' => $variantData['nicotine_strength'] ?? null,
                        'resistance' => $variantData['resistance'] ?? null,
                        'capacity' => $variantData['capacity'] ?? null,
                        'color' => $variantData['color'] ?? null,
                        'is_age_restricted' => $variantData['is_age_restricted'] ?? true,
                        'contains_nicotine' => $variantData['contains_nicotine'] ?? true,
                        'is_battery' => $variantData['is_battery'] ?? false,
                        'is_consumable' => $variantData['is_consumable'] ?? true,
                        'default_cost' => $variantData['default_cost'] ?? 0,
                        'default_price' => $variantData['default_price'] ?? 0,
                        'is_active' => true,
                    ]
                );
            }
        }

        foreach ($variants as $sku => $variant) {
            $rule = $openingRules[$sku] ?? ['base' => 10, 'step' => 1];

            foreach ($branches as $index => $branch) {
                InventoryBalance::query()->firstOrCreate(
                    [
                        'branch_id' => $branch->id,
                        'product_variant_id' => $variant->id,
                    ],
                    ['qty_on_hand' => 0]
                );

                $targetQty = $rule['base'] + ($index * $rule['step']);
                $balance = InventoryBalance::query()
                    ->where('branch_id', $branch->id)
                    ->where('product_variant_id', $variant->id)
                    ->first();

                $currentQty = (float) ($balance?->qty_on_hand ?? 0);
                $delta = (float) $targetQty - $currentQty;

                if (abs($delta) < 0.0001) {
                    continue;
                }

                $inventoryService->postMovement([
                    'branch_id' => $branch->id,
                    'product_variant_id' => $variant->id,
                    'qty_delta' => $delta,
                    'movement_type' => 'ADJUSTMENT',
                    'reason_code' => 'OPENING',
                    'ref_type' => 'seed_demo_opening',
                    'ref_id' => ($branch->id * 1000000) + $variant->id,
                    'performed_by_user_id' => $admin?->id,
                    'unit_cost' => $variant->default_cost,
                    'notes' => 'Demo seed opening stock sync',
                ]);
            }
        }
    }
}

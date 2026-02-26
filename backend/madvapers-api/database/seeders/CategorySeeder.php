<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Category;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $names = [
            'Devices',
            'Pods',
            'Coils',
            'E-liquids',
            'Disposables',
            'Batteries',
            'Accessories',
        ];

        foreach ($names as $name) {
            Category::updateOrCreate(['name' => $name], ['is_active' => true]);
        }
    }
}
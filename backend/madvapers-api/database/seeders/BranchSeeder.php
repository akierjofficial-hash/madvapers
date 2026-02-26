<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Branch;

class BranchSeeder extends Seeder
{
    public function run(): void
    {
        $branches = [
            [
                'code' => 'BAGACAY',
                'name' => 'Bagacay Branch (Main Branch)',
                'address' => 'National Highway, Bagacay, Dumaguete City',
                'locator' => 'Bagacay, Dumaguete City',
                'cellphone_no' => '+63 900 111 1001',
                'is_active' => true,
            ],
            [
                'code' => 'MOTONG',
                'name' => 'Motong Branch',
                'address' => 'Motong Area, Dumaguete City',
                'locator' => 'Motong, Dumaguete City',
                'cellphone_no' => '+63 900 111 1002',
                'is_active' => true,
            ],
            [
                'code' => 'HAYAHAY',
                'name' => 'Hayahay Branch',
                'address' => 'Hayahay Area, Dumaguete City',
                'locator' => 'Hayahay, Dumaguete City',
                'cellphone_no' => '+63 900 111 1003',
                'is_active' => true,
            ],
        ];

        $branchCodes = array_map(fn ($b) => $b['code'], $branches);

        foreach ($branches as $b) {
            Branch::updateOrCreate(['code' => $b['code']], $b);
        }

        // Keep only these branches active for branch pickers.
        Branch::query()
            ->whereNotIn('code', $branchCodes)
            ->update(['is_active' => false]);
    }
}

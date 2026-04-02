<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Branch;

class BranchSeeder extends Seeder
{
    private function defaultTestingBranches(): array
    {
        return [
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
    }

    private function configuredBranches(): array
    {
        $raw = trim((string) env('SEED_BRANCHES_JSON', ''));
        if ($raw === '') {
            return [];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            $this->command?->warn('SEED_BRANCHES_JSON is invalid JSON. Skipping branch seed.');
            return [];
        }

        $rowsByCode = [];
        foreach ($decoded as $row) {
            if (!is_array($row)) {
                continue;
            }

            $code = strtoupper(trim((string) ($row['code'] ?? '')));
            $name = trim((string) ($row['name'] ?? ''));
            if ($code === '' || $name === '') {
                continue;
            }

            $rowsByCode[$code] = [
                'code' => $code,
                'name' => $name,
                'address' => isset($row['address']) ? (string) $row['address'] : null,
                'locator' => isset($row['locator']) ? (string) $row['locator'] : null,
                'cellphone_no' => isset($row['cellphone_no']) ? (string) $row['cellphone_no'] : null,
                'is_active' => array_key_exists('is_active', $row)
                    ? (bool) $row['is_active']
                    : true,
            ];
        }

        return array_values($rowsByCode);
    }

    public function run(): void
    {
        $branches = $this->configuredBranches();
        if (empty($branches) && app()->environment('testing')) {
            // Keep deterministic branch fixtures for automated tests.
            $branches = $this->defaultTestingBranches();
        }

        if (empty($branches)) {
            $this->command?->warn('No branches seeded. Set SEED_BRANCHES_JSON to seed branches.');
            return;
        }

        $branchCodes = array_map(fn ($b) => $b['code'], $branches);

        foreach ($branches as $b) {
            Branch::updateOrCreate(['code' => $b['code']], $b);
        }

        $deactivateUnlisted = filter_var(
            (string) env('SEED_DEACTIVATE_UNLISTED_BRANCHES', 'false'),
            FILTER_VALIDATE_BOOLEAN
        );
        if ($deactivateUnlisted) {
            Branch::query()
                ->whereNotIn('code', $branchCodes)
                ->update(['is_active' => false]);
        }
    }
}

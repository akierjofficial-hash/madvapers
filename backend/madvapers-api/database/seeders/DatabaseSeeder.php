<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            BranchSeeder::class,
            RolePermissionSeeder::class,
            AdminSeeder::class,
            CategorySeeder::class,
            UserSeeder::class,
        ]);

        $shouldSeedDemoData = app()->environment('testing')
            || filter_var((string) env('SEED_DEMO_DATA', 'false'), FILTER_VALIDATE_BOOLEAN);

        if ($shouldSeedDemoData) {
            $this->call([
                DemoCatalogSeeder::class,
            ]);
        }
    }

}

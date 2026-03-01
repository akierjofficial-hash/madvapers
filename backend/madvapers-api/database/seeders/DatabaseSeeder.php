<?php

namespace Database\Seeders;

use App\Models\User;
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
            CategorySeeder::class,
        ]);

        $seedDemoData = app()->environment(['local', 'testing'])
            || (bool) env('SEED_DEMO_DATA', false);

        if ($seedDemoData) {
            $this->call([
                AdminSeeder::class,
                UserSeeder::class,
                DemoCatalogSeeder::class,
            ]);
        }
    }

}

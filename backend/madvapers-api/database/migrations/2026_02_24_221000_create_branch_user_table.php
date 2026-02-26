<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('branch_user')) {
            Schema::create('branch_user', function (Blueprint $table) {
                $table->id();
                $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->timestamps();

                $table->unique(['branch_id', 'user_id']);
                $table->index(['user_id', 'branch_id']);
            });
        }

        if (Schema::hasTable('users') && Schema::hasColumn('users', 'branch_id')) {
            DB::table('users')
                ->select('id', 'branch_id')
                ->whereNotNull('branch_id')
                ->orderBy('id')
                ->chunk(200, function ($rows) {
                    foreach ($rows as $row) {
                        DB::table('branch_user')->updateOrInsert(
                            ['branch_id' => (int) $row->branch_id, 'user_id' => (int) $row->id],
                            ['updated_at' => now(), 'created_at' => now()]
                        );
                    }
                });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('branch_user')) {
            Schema::drop('branch_user');
        }
    }
};


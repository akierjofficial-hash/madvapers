<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            // Workflow timestamps
            if (!Schema::hasColumn('purchase_orders', 'submitted_at')) {
                $table->timestampTz('submitted_at')->nullable();
            }

            if (!Schema::hasColumn('purchase_orders', 'approved_at')) {
                $table->timestampTz('approved_at')->nullable();
            }

            if (!Schema::hasColumn('purchase_orders', 'approved_by_user_id')) {
                $table->foreignId('approved_by_user_id')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();
            }

            if (!Schema::hasColumn('purchase_orders', 'received_at')) {
                $table->timestampTz('received_at')->nullable();
            }

            // Audit (your controller uses this)
            if (!Schema::hasColumn('purchase_orders', 'created_by_user_id')) {
                $table->foreignId('created_by_user_id')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            // Postgres will drop dependent constraints when dropping the column,
            // so we can safely drop columns directly.
            $cols = [];

            foreach (['approved_by_user_id', 'created_by_user_id', 'received_at', 'approved_at', 'submitted_at'] as $c) {
                if (Schema::hasColumn('purchase_orders', $c)) $cols[] = $c;
            }

            if (!empty($cols)) {
                $table->dropColumn($cols);
            }
        });
    }
};
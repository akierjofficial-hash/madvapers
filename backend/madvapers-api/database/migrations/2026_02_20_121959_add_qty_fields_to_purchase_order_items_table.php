<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('purchase_order_items', function (Blueprint $table) {
            // Add only if missing (safe for re-runs / team sync)
            if (!Schema::hasColumn('purchase_order_items', 'qty_ordered')) {
                $table->decimal('qty_ordered', 14, 3);
            }

            if (!Schema::hasColumn('purchase_order_items', 'qty_received')) {
                $table->decimal('qty_received', 14, 3)->default(0);
            }
        });

        // OPTIONAL BACKFILL: if your old schema had `qty`, copy it into `qty_ordered`
        if (
            Schema::hasColumn('purchase_order_items', 'qty') &&
            Schema::hasColumn('purchase_order_items', 'qty_ordered')
        ) {
            DB::statement('UPDATE purchase_order_items SET qty_ordered = qty WHERE qty_ordered IS NULL');
        }
    }

    public function down(): void
    {
        Schema::table('purchase_order_items', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_order_items', 'qty_received')) {
                $table->dropColumn('qty_received');
            }
            if (Schema::hasColumn('purchase_order_items', 'qty_ordered')) {
                $table->dropColumn('qty_ordered');
            }
        });
    }
};
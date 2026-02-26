<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('purchase_orders', 'reference_no')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->string('reference_no', 50)->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('purchase_orders', 'reference_no')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->dropColumn('reference_no');
            });
        }
    }
};
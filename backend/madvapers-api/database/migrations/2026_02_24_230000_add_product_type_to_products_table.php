<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'product_type')) {
                $table->string('product_type', 40)->default('DEVICE')->after('name');
                $table->index('product_type');
            }
        });

        DB::table('products')
            ->whereNull('product_type')
            ->update(['product_type' => 'DEVICE']);
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'product_type')) {
                $table->dropIndex(['product_type']);
                $table->dropColumn('product_type');
            }
        });
    }
};


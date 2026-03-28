<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sale_payments', function (Blueprint $table) {
            $table->string('client_txn_id', 80)->nullable()->after('reference_no');
            $table->unique(['sale_id', 'client_txn_id'], 'sale_payments_sale_client_txn_unique');
        });
    }

    public function down(): void
    {
        Schema::table('sale_payments', function (Blueprint $table) {
            $table->dropUnique('sale_payments_sale_client_txn_unique');
            $table->dropColumn('client_txn_id');
        });
    }
};


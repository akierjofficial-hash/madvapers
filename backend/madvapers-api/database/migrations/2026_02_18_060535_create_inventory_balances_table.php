<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('inventory_balances', function (Blueprint $table) {
    $table->id();

    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();

    $table->decimal('qty_on_hand', 14, 3)->default(0); // supports partial qty if needed
    $table->timestamps();

    $table->unique(['branch_id', 'product_variant_id']);
    $table->index(['product_variant_id', 'branch_id']);
});

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_balances');
    }
};
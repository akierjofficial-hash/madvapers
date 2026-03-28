<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignId('product_variant_id')->constrained('product_variants')->cascadeOnDelete();

            $table->decimal('qty', 14, 3);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('line_discount', 12, 2)->default(0);
            $table->decimal('line_tax', 12, 2)->default(0);
            $table->decimal('line_total', 12, 2);

            $table->decimal('unit_cost_snapshot', 12, 2)->nullable();
            $table->decimal('line_cogs', 12, 2)->nullable();

            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['sale_id']);
            $table->index(['product_variant_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_items');
    }
};


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
        Schema::create('product_variants', function (Blueprint $table) {
    $table->id();
    $table->foreignId('product_id')->constrained()->cascadeOnDelete();

    $table->string('sku', 64)->unique();
    $table->string('barcode', 64)->nullable()->unique();

    // Vape-specific attributes (nullable, because not all apply)
    $table->string('variant_name', 180)->nullable();   // e.g. "0.8Ω - Mesh", "Strawberry Ice - 25mg"
    $table->string('flavor', 120)->nullable();
    $table->string('nicotine_strength', 40)->nullable(); // e.g. "3mg", "25mg", "50mg", "0mg"
    $table->string('resistance', 40)->nullable();        // e.g. "0.8Ω"
    $table->string('capacity', 40)->nullable();          // e.g. "30ml", "2ml", "10,000 puffs"
    $table->string('color', 60)->nullable();

    // Regulation / handling flags
    $table->boolean('is_age_restricted')->default(true);   // default true for vape shop
    $table->boolean('contains_nicotine')->default(true);   // can be false for 0mg accessories
    $table->boolean('is_battery')->default(false);
    $table->boolean('is_consumable')->default(true);       // pods/coils/liquids/disposables

    // Costing / pricing base
    $table->decimal('default_cost', 12, 2)->default(0);    // last known cost or base cost
    $table->decimal('default_price', 12, 2)->default(0);   // current selling price (optional; real history in price_histories)

    $table->boolean('is_active')->default(true);
    $table->timestamps();

    $table->index(['product_id', 'is_active']);
});

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_variants');
    }
};
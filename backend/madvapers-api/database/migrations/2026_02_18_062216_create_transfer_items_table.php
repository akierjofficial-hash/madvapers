<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('transfer_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('transfer_id')->constrained('transfers')->cascadeOnDelete();
            $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();

            $table->decimal('qty', 14, 3);
            $table->decimal('unit_cost', 12, 2)->nullable(); // optional snapshot

            $table->timestamps();

            $table->unique(['transfer_id', 'product_variant_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transfer_items');
    }
};
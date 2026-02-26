<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('price_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();

            // Phase 1: global price (later: per branch if needed)
            $table->decimal('price', 12, 2);
            $table->timestamp('effective_at')->useCurrent();

            $table->foreignId('changed_by_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->string('reason', 255)->nullable(); // e.g. Promo, Supplier increase, Price correction

            $table->timestamps();

            $table->index(['product_variant_id', 'effective_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('price_histories');
    }
};
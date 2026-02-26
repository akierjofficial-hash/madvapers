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
        Schema::create('stock_ledgers', function (Blueprint $table) {
    $table->id();

    $table->timestamp('posted_at')->useCurrent();

    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();

    // + = stock in, - = stock out
    $table->decimal('qty_delta', 14, 3);

    // movement classification
    $table->string('movement_type', 40); // RECEIVE, SALE, TRANSFER_OUT, TRANSFER_IN, ADJUSTMENT, COUNT_POST
    $table->string('reason_code', 40)->nullable(); // DAMAGE, EXPIRED, SHRINKAGE, CORRECTION, etc.

    // reference to source doc
    $table->string('ref_type', 50)->nullable(); // e.g. "adjustments", "transfers", "sales"
    $table->unsignedBigInteger('ref_id')->nullable();

    $table->foreignId('performed_by_user_id')->nullable()->constrained('users')->nullOnDelete();

    // costing hooks (Phase 1 basic)
    $table->decimal('unit_cost', 12, 2)->nullable(); // optional, for valuation later
    $table->decimal('unit_price', 12, 2)->nullable(); // optional, for sales

    $table->text('notes')->nullable();

    $table->timestamps();

    $table->index(['branch_id', 'product_variant_id', 'posted_at']);
    $table->index(['movement_type', 'posted_at']);
    $table->index(['ref_type', 'ref_id']);
});

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_ledgers');
    }
};
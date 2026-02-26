<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();

            $table->string('po_number', 50)->unique()->nullable(); // can generate later

            // TEMP: no FK yet because suppliers table does not exist
            $table->unsignedBigInteger('supplier_id')->nullable();

            // receiving branch
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();

            $table->string('status', 20)->default('DRAFT'); // DRAFT, SUBMITTED, APPROVED, RECEIVED, CLOSED, CANCELLED
            $table->text('notes')->nullable();

            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();

            $table->timestamp('received_at')->nullable();

            $table->timestamps();

            $table->index(['branch_id', 'status']);
            $table->index(['supplier_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_orders');
    }
};
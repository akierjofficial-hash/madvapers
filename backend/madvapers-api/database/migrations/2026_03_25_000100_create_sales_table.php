<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales', function (Blueprint $table) {
            $table->id();

            $table->string('sale_number', 50)->nullable()->unique();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();

            $table->string('status', 20)->default('DRAFT'); // DRAFT, POSTED, VOIDED
            $table->string('payment_status', 20)->default('UNPAID'); // UNPAID, PARTIAL, PAID

            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount_total', 12, 2)->default(0);
            $table->decimal('tax_total', 12, 2)->default(0);
            $table->decimal('grand_total', 12, 2)->default(0);
            $table->decimal('paid_total', 12, 2)->default(0);
            $table->decimal('change_given', 12, 2)->default(0);

            $table->foreignId('cashier_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('posted_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('posted_at')->nullable();
            $table->timestamp('voided_at')->nullable();

            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['branch_id', 'status']);
            $table->index(['branch_id', 'payment_status']);
            $table->index(['branch_id', 'posted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales');
    }
};


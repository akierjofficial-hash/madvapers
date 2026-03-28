<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_payments', function (Blueprint $table) {
            $table->id();

            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->string('method', 30)->default('CASH');
            $table->decimal('amount', 12, 2);
            $table->timestamp('paid_at')->useCurrent();
            $table->string('reference_no', 80)->nullable();

            $table->foreignId('received_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['sale_id', 'paid_at']);
            $table->index(['method', 'paid_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_payments');
    }
};


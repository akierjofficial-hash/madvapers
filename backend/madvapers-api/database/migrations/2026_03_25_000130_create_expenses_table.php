<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();

            $table->string('expense_number', 50)->nullable()->unique();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->string('category', 80)->default('OPERATIONS');
            $table->decimal('amount', 12, 2);
            $table->timestamp('paid_at')->useCurrent();
            $table->string('status', 20)->default('POSTED'); // POSTED, VOIDED
            $table->text('notes')->nullable();

            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('voided_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('voided_at')->nullable();

            $table->timestamps();

            $table->index(['branch_id', 'status']);
            $table->index(['branch_id', 'paid_at']);
            $table->index(['status', 'paid_at']);
            $table->index(['category', 'paid_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
    }
};


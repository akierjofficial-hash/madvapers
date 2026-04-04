<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->timestamp('scheduled_start_at')->nullable();
            $table->timestamp('clock_in_requested_at');
            $table->string('clock_in_status', 20)->default('PENDING'); // PENDING, APPROVED, REJECTED
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('clock_out_at')->nullable();
            $table->text('request_notes')->nullable();
            $table->text('review_notes')->nullable();
            $table->text('clock_out_notes')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'clock_in_requested_at']);
            $table->index(['user_id', 'clock_out_at']);
            $table->index(['branch_id', 'clock_in_requested_at']);
            $table->index(['clock_in_status', 'clock_out_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_attendances');
    }
};


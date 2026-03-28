<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_events', function (Blueprint $table) {
            $table->id();
            $table->string('event_type', 80);
            $table->string('entity_type', 80)->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('summary', 255)->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['event_type', 'created_at']);
            $table->index(['entity_type', 'entity_id']);
            $table->index(['branch_id', 'created_at']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_events');
    }
};


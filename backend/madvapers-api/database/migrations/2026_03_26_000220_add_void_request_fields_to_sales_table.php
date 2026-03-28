<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->string('void_request_status', 20)->nullable()->after('payment_status');
            $table->timestamp('void_requested_at')->nullable()->after('voided_at');
            $table->foreignId('void_requested_by_user_id')
                ->nullable()
                ->after('void_requested_at')
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('void_rejected_at')->nullable()->after('void_requested_by_user_id');
            $table->foreignId('void_rejected_by_user_id')
                ->nullable()
                ->after('void_rejected_at')
                ->constrained('users')
                ->nullOnDelete();
            $table->text('void_request_notes')->nullable()->after('void_rejected_by_user_id');
            $table->text('void_rejection_notes')->nullable()->after('void_request_notes');

            $table->index(['branch_id', 'void_request_status']);
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropIndex(['branch_id', 'void_request_status']);
            $table->dropConstrainedForeignId('void_requested_by_user_id');
            $table->dropConstrainedForeignId('void_rejected_by_user_id');
            $table->dropColumn([
                'void_request_status',
                'void_requested_at',
                'void_rejected_at',
                'void_request_notes',
                'void_rejection_notes',
            ]);
        });
    }
};

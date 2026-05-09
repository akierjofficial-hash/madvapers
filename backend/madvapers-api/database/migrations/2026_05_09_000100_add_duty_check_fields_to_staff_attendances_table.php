<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('staff_attendances', function (Blueprint $table) {
            $table->timestamp('duty_check_next_at')->nullable()->after('clock_out_at');
            $table->timestamp('duty_check_last_answered_at')->nullable()->after('duty_check_next_at');
            $table->unsignedInteger('duty_check_count')->default(0)->after('duty_check_last_answered_at');

            $table->index(['user_id', 'duty_check_next_at'], 'staff_attendances_user_duty_check_next_idx');
        });
    }

    public function down(): void
    {
        Schema::table('staff_attendances', function (Blueprint $table) {
            $table->dropIndex('staff_attendances_user_duty_check_next_idx');
            $table->dropColumn([
                'duty_check_next_at',
                'duty_check_last_answered_at',
                'duty_check_count',
            ]);
        });
    }
};

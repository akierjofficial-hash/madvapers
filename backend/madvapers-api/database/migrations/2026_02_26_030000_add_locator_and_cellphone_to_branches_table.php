<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            if (!Schema::hasColumn('branches', 'locator')) {
                $table->string('locator', 255)->nullable()->after('address');
            }
            if (!Schema::hasColumn('branches', 'cellphone_no')) {
                $table->string('cellphone_no', 40)->nullable()->after('locator');
            }
        });
    }

    public function down(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            if (Schema::hasColumn('branches', 'cellphone_no')) {
                $table->dropColumn('cellphone_no');
            }
            if (Schema::hasColumn('branches', 'locator')) {
                $table->dropColumn('locator');
            }
        });
    }
};


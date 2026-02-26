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
        Schema::create('roles', function (Blueprint $table) {
    $table->id();
    $table->string('name', 50)->unique();     // Owner/Admin, Branch Manager, Cashier, Inventory Clerk, Auditor
    $table->string('code', 50)->unique();     // ADMIN, MANAGER, CASHIER, CLERK, AUDITOR
    $table->timestamps();
});

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('roles');
    }
};
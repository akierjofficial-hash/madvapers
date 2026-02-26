<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SupplierAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_auditor_can_view_suppliers_but_cannot_manage(): void
    {
        $auditor = User::where('email', 'auditor@madvapers.local')->firstOrFail();
        Sanctum::actingAs($auditor);

        $this->getJson('/api/suppliers')->assertOk();
        $this->postJson('/api/suppliers', ['name' => 'No Access Supplier'])->assertStatus(403);
    }

    public function test_manager_delete_deactivates_supplier(): void
    {
        $manager = User::where('email', 'manager@madvapers.local')->firstOrFail();
        Sanctum::actingAs($manager);

        $created = $this->postJson('/api/suppliers', [
            'name' => 'Sample Supplier',
        ])->assertCreated()->json();

        $supplierId = (int) $created['id'];

        $this->deleteJson("/api/suppliers/{$supplierId}")
            ->assertOk()
            ->assertJson(['status' => 'ok']);

        $this->assertDatabaseHas('suppliers', [
            'id' => $supplierId,
            'is_active' => 0,
        ]);
    }
}

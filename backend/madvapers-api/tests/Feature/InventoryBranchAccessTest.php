<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InventoryBranchAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function actingAsUser(string $email): User
    {
        $user = User::query()->where('email', $email)->firstOrFail();
        Sanctum::actingAs($user);
        return $user;
    }

    public function test_clerk_can_only_access_assigned_branch_inventory(): void
    {
        $motong = Branch::query()->where('code', 'MOTONG')->firstOrFail();
        $bagacay = Branch::query()->where('code', 'BAGACAY')->firstOrFail();

        $this->actingAsUser('clerk@madvapers.local');

        $own = $this->getJson("/api/inventory?branch_id={$motong->id}");
        $own->assertOk();
        $items = $own->json('data', []);
        $this->assertNotEmpty($items, 'Expected seeded inventory data for clerk branch.');
        foreach ($items as $row) {
            $this->assertSame($motong->id, (int) ($row['branch_id'] ?? 0));
        }

        $forbidden = $this->getJson("/api/inventory?branch_id={$bagacay->id}");
        $forbidden->assertStatus(403)
            ->assertJsonPath('message', 'Forbidden branch access.');
    }

    public function test_admin_can_access_inventory_across_branches(): void
    {
        $bagacay = Branch::query()->where('code', 'BAGACAY')->firstOrFail();
        $motong = Branch::query()->where('code', 'MOTONG')->firstOrFail();

        $this->actingAsUser('admin@madvapers.local');

        $this->getJson("/api/inventory?branch_id={$bagacay->id}")->assertOk();
        $this->getJson("/api/inventory?branch_id={$motong->id}")->assertOk();
    }
}


<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VariantBranchAccessTest extends TestCase
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

    public function test_clerk_cannot_query_variant_stock_for_unassigned_branch(): void
    {
        $motong = Branch::query()->where('code', 'MOTONG')->firstOrFail();
        $bagacay = Branch::query()->where('code', 'BAGACAY')->firstOrFail();

        $this->actingAsUser('clerk@madvapers.local');

        $this->getJson("/api/variants?branch_id={$motong->id}")
            ->assertOk();

        $this->getJson("/api/variants?branch_id={$bagacay->id}")
            ->assertStatus(403)
            ->assertJsonPath('message', 'Forbidden branch access.');
    }

    public function test_admin_can_query_variant_stock_for_any_branch(): void
    {
        $motong = Branch::query()->where('code', 'MOTONG')->firstOrFail();
        $bagacay = Branch::query()->where('code', 'BAGACAY')->firstOrFail();

        $this->actingAsUser('admin@madvapers.local');

        $this->getJson("/api/variants?branch_id={$motong->id}")
            ->assertOk();

        $this->getJson("/api/variants?branch_id={$bagacay->id}")
            ->assertOk();
    }
}

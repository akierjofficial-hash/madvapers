<?php

namespace Tests\Feature;

use App\Models\StaffAttendance;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StaffAttendanceWorkflowTest extends TestCase
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

    public function test_cashier_time_in_requires_admin_approval_before_time_out(): void
    {
        $cashier = $this->actingAsUser('cashier@madvapers.local');

        $firstRequest = $this->postJson('/api/staff-attendance/time-in')
            ->assertCreated()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('attendance.user_id', $cashier->id)
            ->assertJsonPath('attendance.clock_in_status', 'PENDING')
            ->json('attendance');

        $attendanceId = (int) ($firstRequest['id'] ?? 0);
        $this->assertGreaterThan(0, $attendanceId);

        $this->postJson('/api/staff-attendance/time-in')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['attendance']);

        $this->postJson('/api/staff-attendance/time-out')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['attendance']);

        $admin = $this->actingAsUser('admin@madvapers.local');
        $this->postJson("/api/staff-attendance/{$attendanceId}/approve")
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('attendance.clock_in_status', 'APPROVED')
            ->assertJsonPath('attendance.reviewed_by_user_id', $admin->id);

        $this->actingAsUser('cashier@madvapers.local');
        $this->postJson('/api/staff-attendance/time-out')
            ->assertOk()
            ->assertJsonPath('status', 'ok');

        $attendance = StaffAttendance::query()->findOrFail($attendanceId);
        $this->assertSame('APPROVED', (string) $attendance->clock_in_status);
        $this->assertNotNull($attendance->clock_out_at);
    }

    public function test_cashier_cannot_approve_attendance_request(): void
    {
        $this->actingAsUser('cashier@madvapers.local');

        $attendanceId = (int) $this->postJson('/api/staff-attendance/time-in')
            ->assertCreated()
            ->json('attendance.id');

        $this->postJson("/api/staff-attendance/{$attendanceId}/approve")
            ->assertStatus(403);
    }

    public function test_admin_cannot_request_staff_time_in_or_time_out(): void
    {
        $this->actingAsUser('admin@madvapers.local');

        $this->postJson('/api/staff-attendance/time-in')
            ->assertStatus(403);

        $this->postJson('/api/staff-attendance/time-out')
            ->assertStatus(403);
    }

    public function test_admin_can_close_open_time_in_request_and_staff_can_time_in_again(): void
    {
        $cashier = $this->actingAsUser('cashier@madvapers.local');

        $attendanceId = (int) $this->postJson('/api/staff-attendance/time-in')
            ->assertCreated()
            ->json('attendance.id');
        $this->assertGreaterThan(0, $attendanceId);

        $this->actingAsUser('admin@madvapers.local');
        $this->postJson("/api/staff-attendance/{$attendanceId}/approve")
            ->assertOk()
            ->assertJsonPath('attendance.clock_in_status', 'APPROVED');

        $this->postJson("/api/staff-attendance/{$attendanceId}/close", [
            'notes' => 'Incorrect time-in request.',
        ])
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('attendance.clock_out_notes', 'Incorrect time-in request.');

        $closed = StaffAttendance::query()->findOrFail($attendanceId);
        $this->assertSame('APPROVED', (string) $closed->clock_in_status);
        $this->assertNotNull($closed->clock_out_at);

        Sanctum::actingAs($cashier);
        $this->postJson('/api/staff-attendance/time-in')
            ->assertCreated()
            ->assertJsonPath('attendance.clock_in_status', 'PENDING');
    }

    public function test_staff_can_view_own_attendance_logs_even_when_record_has_no_branch(): void
    {
        $cashier = $this->actingAsUser('cashier@madvapers.local');

        $attendance = StaffAttendance::query()->create([
            'user_id' => $cashier->id,
            'branch_id' => null,
            'scheduled_start_at' => now()->subHour(),
            'clock_in_requested_at' => now()->subMinutes(50),
            'clock_in_status' => 'APPROVED',
            'reviewed_at' => now()->subMinutes(40),
            'reviewed_by_user_id' => User::query()->where('email', 'admin@madvapers.local')->value('id'),
        ]);

        $this->getJson('/api/staff-attendance?mine=1')
            ->assertOk()
            ->assertJsonPath('data.0.id', $attendance->id)
            ->assertJsonPath('data.0.clock_in_status', 'APPROVED');
    }

    public function test_staff_index_accepts_mine_true_query_string(): void
    {
        $cashier = $this->actingAsUser('cashier@madvapers.local');

        $attendance = StaffAttendance::query()->create([
            'user_id' => $cashier->id,
            'branch_id' => $cashier->branch_id,
            'scheduled_start_at' => now()->subHour(),
            'clock_in_requested_at' => now()->subMinutes(50),
            'clock_in_status' => 'APPROVED',
            'reviewed_at' => now()->subMinutes(40),
            'reviewed_by_user_id' => User::query()->where('email', 'admin@madvapers.local')->value('id'),
        ]);

        $this->getJson('/api/staff-attendance?mine=true')
            ->assertOk()
            ->assertJsonPath('data.0.id', $attendance->id);
    }

    public function test_admin_index_lists_recent_time_out_records_first(): void
    {
        $cashier = $this->actingAsUser('cashier@madvapers.local');

        $older = StaffAttendance::query()->create([
            'user_id' => $cashier->id,
            'branch_id' => $cashier->branch_id,
            'scheduled_start_at' => now()->subDays(2),
            'clock_in_requested_at' => now()->subDays(2),
            'clock_in_status' => 'APPROVED',
            'reviewed_at' => now()->subDays(2)->addMinutes(5),
            'reviewed_by_user_id' => User::query()->where('email', 'admin@madvapers.local')->value('id'),
            'clock_out_at' => now()->subDays(2)->addHours(8),
        ]);

        $newerTimedOut = StaffAttendance::query()->create([
            'user_id' => $cashier->id,
            'branch_id' => $cashier->branch_id,
            'scheduled_start_at' => now()->subHour(),
            'clock_in_requested_at' => now()->subMinutes(50),
            'clock_in_status' => 'APPROVED',
            'reviewed_at' => now()->subMinutes(45),
            'reviewed_by_user_id' => User::query()->where('email', 'admin@madvapers.local')->value('id'),
            'clock_out_at' => now()->subMinutes(5),
        ]);

        $this->actingAsUser('admin@madvapers.local');
        $this->getJson('/api/staff-attendance')
            ->assertOk()
            ->assertJsonPath('data.0.id', $newerTimedOut->id)
            ->assertJsonPath('data.1.id', $older->id);
    }

    public function test_admin_can_view_monthly_attendance_summary_and_detail_for_payday_review(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-04-24 09:00:00'));

        $cashier = User::query()->where('email', 'cashier@madvapers.local')->firstOrFail();
        $admin = User::query()->where('email', 'admin@madvapers.local')->firstOrFail();

        StaffAttendance::query()->create([
            'user_id' => $cashier->id,
            'branch_id' => $cashier->branch_id,
            'scheduled_start_at' => Carbon::parse('2026-04-01 09:00:00'),
            'clock_in_requested_at' => Carbon::parse('2026-04-01 09:12:00'),
            'clock_in_status' => 'APPROVED',
            'reviewed_at' => Carbon::parse('2026-04-01 09:15:00'),
            'reviewed_by_user_id' => $admin->id,
            'clock_out_at' => Carbon::parse('2026-04-01 17:05:00'),
        ]);

        StaffAttendance::query()->create([
            'user_id' => $cashier->id,
            'branch_id' => $cashier->branch_id,
            'scheduled_start_at' => Carbon::parse('2026-04-02 09:00:00'),
            'clock_in_requested_at' => Carbon::parse('2026-04-02 08:58:00'),
            'clock_in_status' => 'APPROVED',
            'reviewed_at' => Carbon::parse('2026-04-02 09:02:00'),
            'reviewed_by_user_id' => $admin->id,
            'clock_out_at' => Carbon::parse('2026-04-02 17:00:00'),
        ]);

        StaffAttendance::query()->create([
            'user_id' => $cashier->id,
            'branch_id' => $cashier->branch_id,
            'scheduled_start_at' => Carbon::parse('2026-04-03 09:00:00'),
            'clock_in_requested_at' => Carbon::parse('2026-04-03 09:01:00'),
            'clock_in_status' => 'PENDING',
        ]);

        StaffAttendance::query()->create([
            'user_id' => $cashier->id,
            'branch_id' => $cashier->branch_id,
            'scheduled_start_at' => Carbon::parse('2026-04-04 09:00:00'),
            'clock_in_requested_at' => Carbon::parse('2026-04-04 09:20:00'),
            'clock_in_status' => 'REJECTED',
            'reviewed_at' => Carbon::parse('2026-04-04 09:25:00'),
            'reviewed_by_user_id' => $admin->id,
            'review_notes' => 'Rejected for mistake',
        ]);

        $this->actingAsUser('admin@madvapers.local');

        $summaryResponse = $this->getJson('/api/staff-attendance/monthly-summary?month=2026-04&search=cashier')
            ->assertOk()
            ->assertJsonPath('month', '2026-04')
            ->assertJsonPath('month_label', 'April 2026');

        $row = collect($summaryResponse->json('data'))->firstWhere('user_id', $cashier->id);
        $this->assertNotNull($row);
        $this->assertSame(2, $row['present_days']);
        $this->assertSame(1, $row['late_days']);
        $this->assertSame(12, $row['total_late_minutes']);
        $this->assertSame(1, $row['pending_requests']);
        $this->assertSame(1, $row['rejected_requests']);
        $this->assertSame(955, $row['worked_minutes']);

        $detailResponse = $this->getJson("/api/staff-attendance/monthly-summary/{$cashier->id}?month=2026-04")
            ->assertOk()
            ->assertJsonPath('summary.user_id', $cashier->id)
            ->assertJsonPath('summary.present_days', 2)
            ->assertJsonCount(4, 'logs');

        $this->assertSame('2026-04-04', $detailResponse->json('logs.0.attendance_date'));
        $this->assertSame('REJECTED', $detailResponse->json('logs.0.clock_in_status'));
        Carbon::setTestNow();
    }

    public function test_cashier_monthly_summary_is_limited_to_own_records(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-04-24 09:00:00'));

        $cashier = User::query()->where('email', 'cashier@madvapers.local')->firstOrFail();
        $clerk = User::query()->where('email', 'clerk@madvapers.local')->firstOrFail();

        StaffAttendance::query()->create([
            'user_id' => $cashier->id,
            'branch_id' => $cashier->branch_id,
            'scheduled_start_at' => Carbon::parse('2026-04-10 09:00:00'),
            'clock_in_requested_at' => Carbon::parse('2026-04-10 09:00:00'),
            'clock_in_status' => 'APPROVED',
        ]);

        StaffAttendance::query()->create([
            'user_id' => $clerk->id,
            'branch_id' => $clerk->branch_id,
            'scheduled_start_at' => Carbon::parse('2026-04-11 09:00:00'),
            'clock_in_requested_at' => Carbon::parse('2026-04-11 09:00:00'),
            'clock_in_status' => 'APPROVED',
        ]);

        $this->actingAsUser('cashier@madvapers.local');

        $this->getJson('/api/staff-attendance/monthly-summary?month=2026-04')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.user_id', $cashier->id);

        $this->getJson("/api/staff-attendance/monthly-summary/{$clerk->id}?month=2026-04")
            ->assertStatus(403);

        Carbon::setTestNow();
    }
}

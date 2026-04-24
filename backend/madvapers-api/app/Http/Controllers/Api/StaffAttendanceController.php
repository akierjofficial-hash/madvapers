<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\EnforcesBranchAccess;
use App\Http\Controllers\Controller;
use App\Models\StaffAttendance;
use App\Models\User;
use App\Services\AdminPushNotificationService;
use App\Support\AuditTrail;
use Carbon\Carbon;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StaffAttendanceController extends Controller
{
    use EnforcesBranchAccess;

    public function __construct(
        private readonly AdminPushNotificationService $adminPushNotifications
    ) {
    }

    public function index(Request $request)
    {
        $request->validate([
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'status' => ['nullable', 'string', Rule::in(['PENDING', 'APPROVED', 'REJECTED', 'CLOSED'])],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'search' => ['nullable', 'string', 'max:120'],
            'per_page' => ['nullable', 'integer', 'min:10', 'max:100'],
        ]);

        $mineRaw = $request->query('mine');
        if ($mineRaw !== null && $mineRaw !== '') {
            $mineValue = filter_var($mineRaw, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($mineValue === null && !in_array((string) $mineRaw, ['0', '1'], true)) {
                throw ValidationException::withMessages([
                    'mine' => ['The mine field must be true or false.'],
                ]);
            }
        }

        $q = StaffAttendance::query()
            ->with([
                'user:id,name,email',
                'branch:id,code,name',
                'reviewedBy:id,name,email',
            ])
            ->orderByRaw('COALESCE(clock_out_at, reviewed_at, clock_in_requested_at) DESC')
            ->orderByDesc('id');

        $actor = $request->user();
        $isPrivileged = $this->isPrivilegedUser($actor);
        $mineOnly = $request->boolean('mine', false);

        if (!$isPrivileged || $mineOnly) {
            $q->where('user_id', (int) ($actor?->id ?? 0));
        }

        if ($request->filled('branch_id')) {
            $branchId = (int) $request->integer('branch_id');
            if ($isPrivileged && !$mineOnly) {
                $this->enforceBranchAccessOrFail($request, $branchId);
            }
            $q->where('branch_id', $branchId);
        } elseif ($isPrivileged && !$mineOnly) {
            $this->scopeToAssignedBranch($request, $q, 'branch_id');
        }

        if ($request->filled('user_id')) {
            $userId = (int) $request->integer('user_id');
            if (!$isPrivileged && $userId !== (int) ($actor?->id ?? 0)) {
                throw ValidationException::withMessages([
                    'user_id' => ['You can only view your own attendance records.'],
                ]);
            }
            $q->where('user_id', $userId);
        }

        if ($request->filled('status')) {
            $status = strtoupper((string) $request->input('status'));
            if ($status === 'CLOSED') {
                $q->whereNotNull('clock_out_at');
            } else {
                $q->where('clock_in_status', $status);
            }
        }

        if ($request->filled('date_from')) {
            $q->where('clock_in_requested_at', '>=', (string) $request->input('date_from') . ' 00:00:00');
        }

        if ($request->filled('date_to')) {
            $q->where('clock_in_requested_at', '<=', (string) $request->input('date_to') . ' 23:59:59');
        }

        if ($request->filled('search')) {
            $term = trim((string) $request->input('search'));
            $driver = DB::getDriverName();
            $like = $driver === 'pgsql' ? 'ilike' : 'like';
            $q->whereHas('user', function ($w) use ($term, $like) {
                $needle = '%' . $term . '%';
                $w->where('name', $like, $needle)
                    ->orWhere('email', $like, $needle);
            });
        }

        $perPage = (int) ($request->input('per_page') ?? 30);

        return $q->paginate($perPage);
    }

    public function monthlySummary(Request $request)
    {
        $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'search' => ['nullable', 'string', 'max:120'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        [$monthStart, $monthEnd] = $this->resolveMonthWindow(
            (string) ($request->input('month') ?: now()->format('Y-m'))
        );

        $actor = $request->user();
        $isPrivileged = $this->isPrivilegedUser($actor);

        $q = StaffAttendance::query()
            ->with([
                'user:id,name,email,role_id,branch_id',
                'user.role:id,code,name',
                'branch:id,code,name',
            ])
            ->whereBetween('clock_in_requested_at', [
                $monthStart->copy()->startOfDay(),
                $monthEnd->copy()->endOfDay(),
            ])
            ->orderBy('clock_in_requested_at');

        if (!$isPrivileged) {
            $q->where('user_id', (int) ($actor?->id ?? 0));
        }

        if ($request->filled('branch_id')) {
            $branchId = (int) $request->integer('branch_id');
            if ($isPrivileged) {
                $this->enforceBranchAccessOrFail($request, $branchId);
            }
            $q->where('branch_id', $branchId);
        } elseif ($isPrivileged) {
            $this->scopeToAssignedBranch($request, $q, 'branch_id');
        }

        if ($request->filled('user_id')) {
            $userId = (int) $request->integer('user_id');
            if (!$isPrivileged && $userId !== (int) ($actor?->id ?? 0)) {
                throw ValidationException::withMessages([
                    'user_id' => ['You can only view your own attendance summary.'],
                ]);
            }
            $q->where('user_id', $userId);
        }

        if ($request->filled('search')) {
            $term = trim((string) $request->input('search'));
            $driver = DB::getDriverName();
            $like = $driver === 'pgsql' ? 'ilike' : 'like';
            $q->whereHas('user', function ($w) use ($term, $like) {
                $needle = '%' . $term . '%';
                $w->where('name', $like, $needle)
                    ->orWhere('email', $like, $needle);
            });
        }

        $records = $q->get();

        $summaryRows = $records
            ->groupBy('user_id')
            ->map(fn (Collection $group) => $this->buildMonthlySummaryRow($group, $monthStart))
            ->sortBy(fn (array $row) => mb_strtolower((string) data_get($row, 'user.name', '')))
            ->values();

        $perPage = (int) ($request->input('per_page') ?? 20);
        $page = max(1, (int) ($request->input('page') ?? 1));
        $paginator = $this->paginateCollection($summaryRows, $perPage, $page, $request);

        return response()->json($paginator->toArray() + [
            'month' => $monthStart->format('Y-m'),
            'month_label' => $monthStart->format('F Y'),
        ]);
    }

    public function monthlyDetail(Request $request, User $user)
    {
        $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ]);

        [$monthStart, $monthEnd] = $this->resolveMonthWindow(
            (string) ($request->input('month') ?: now()->format('Y-m'))
        );

        $actor = $request->user();
        $isPrivileged = $this->isPrivilegedUser($actor);

        if (!$isPrivileged && (int) ($actor?->id ?? 0) !== (int) $user->id) {
            abort(403, 'You are not allowed to view this attendance detail.');
        }

        $q = StaffAttendance::query()
            ->with([
                'user:id,name,email,role_id,branch_id',
                'user.role:id,code,name',
                'branch:id,code,name',
                'reviewedBy:id,name,email',
            ])
            ->where('user_id', (int) $user->id)
            ->whereBetween('clock_in_requested_at', [
                $monthStart->copy()->startOfDay(),
                $monthEnd->copy()->endOfDay(),
            ])
            ->orderByDesc('clock_in_requested_at')
            ->orderByDesc('id');

        if ($request->filled('branch_id')) {
            $branchId = (int) $request->integer('branch_id');
            if ($isPrivileged) {
                $this->enforceBranchAccessOrFail($request, $branchId);
            }
            $q->where('branch_id', $branchId);
        } elseif ($isPrivileged) {
            $this->scopeToAssignedBranch($request, $q, 'branch_id');
        }

        $records = $q->get();

        return response()->json([
            'status' => 'ok',
            'month' => $monthStart->format('Y-m'),
            'month_label' => $monthStart->format('F Y'),
            'summary' => $this->buildMonthlySummaryRow($records, $monthStart, $user),
            'logs' => $records->map(fn (StaffAttendance $attendance) => $this->serializeMonthlyDetailLog($attendance))->values(),
        ]);
    }

    public function requestTimeIn(Request $request)
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string'],
        ]);

        $notifyContext = [
            'attendance_id' => 0,
            'branch_id' => null,
            'staff_user_id' => 0,
        ];

        $response = $this->transactionWithRetry(function () use ($request, $data, &$notifyContext) {
            $actor = $request->user();
            if (!$actor) {
                abort(401, 'Unauthenticated.');
            }
            if ($this->isPrivilegedUser($actor)) {
                throw ValidationException::withMessages([
                    'attendance' => ['Admin account does not use staff attendance time-in requests.'],
                ]);
            }

            $existingOpen = StaffAttendance::query()
                ->where('user_id', $actor->id)
                ->whereNull('clock_out_at')
                ->whereIn('clock_in_status', ['PENDING', 'APPROVED'])
                ->lockForUpdate()
                ->first();

            if ($existingOpen) {
                throw ValidationException::withMessages([
                    'attendance' => ['You already have an open time-in request. Approve or close it first.'],
                ]);
            }

            $requestedAt = now();
            $scheduledStartAt = $this->resolveScheduledStartAt($requestedAt);

            $branchId = $actor->branch_id
                ? (int) $actor->branch_id
                : $this->assignedBranchId($request);
            if ($branchId) {
                $this->enforceBranchAccessOrFail($request, $branchId);
            }

            $attendance = StaffAttendance::create([
                'user_id' => (int) $actor->id,
                'branch_id' => $branchId,
                'scheduled_start_at' => $scheduledStartAt,
                'clock_in_requested_at' => $requestedAt,
                'clock_in_status' => 'PENDING',
                'request_notes' => array_key_exists('notes', $data) ? ($data['notes'] ?? null) : null,
            ]);

            $notifyContext['attendance_id'] = (int) $attendance->id;
            $notifyContext['branch_id'] = $attendance->branch_id ? (int) $attendance->branch_id : null;
            $notifyContext['staff_user_id'] = (int) $attendance->user_id;

            AuditTrail::record([
                'event_type' => 'STAFF_TIME_IN_REQUESTED',
                'entity_type' => 'staff_attendance',
                'entity_id' => (int) $attendance->id,
                'branch_id' => $attendance->branch_id ? (int) $attendance->branch_id : null,
                'user_id' => (int) $actor->id,
                'summary' => 'Staff time-in requested',
                'meta' => [
                    'staff_user_id' => (int) $attendance->user_id,
                    'requested_at' => optional($attendance->clock_in_requested_at)->toISOString(),
                    'scheduled_start_at' => optional($attendance->scheduled_start_at)->toISOString(),
                    'late_minutes' => $attendance->late_minutes,
                    'status' => (string) $attendance->clock_in_status,
                ],
            ]);

            return response()->json([
                'status' => 'ok',
                'attendance' => $attendance->fresh()->load([
                    'user:id,name,email',
                    'branch:id,code,name',
                    'reviewedBy:id,name,email',
                ]),
            ], 201);
        });

        if ((int) ($notifyContext['attendance_id'] ?? 0) > 0) {
            $this->adminPushNotifications->sendApprovalRequestNotification(
                sprintf('New staff time-in request #%d needs approval.', (int) $notifyContext['attendance_id']),
                [
                    'type' => 'staff_attendance_request',
                    'entity_type' => 'staff_attendance',
                    'entity_id' => (int) $notifyContext['attendance_id'],
                    'branch_id' => $notifyContext['branch_id'],
                    'staff_user_id' => (int) $notifyContext['staff_user_id'],
                    'path' => '/staff-attendance',
                ]
            );
        }

        return $response;
    }

    public function requestTimeOut(Request $request)
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string'],
        ]);

        return $this->transactionWithRetry(function () use ($request, $data) {
            $actor = $request->user();
            if (!$actor) {
                abort(401, 'Unauthenticated.');
            }
            if ($this->isPrivilegedUser($actor)) {
                throw ValidationException::withMessages([
                    'attendance' => ['Admin account does not use staff attendance time-out requests.'],
                ]);
            }

            $attendance = StaffAttendance::query()
                ->where('user_id', $actor->id)
                ->where('clock_in_status', 'APPROVED')
                ->whereNull('clock_out_at')
                ->orderByDesc('id')
                ->lockForUpdate()
                ->first();

            if (!$attendance) {
                throw ValidationException::withMessages([
                    'attendance' => ['No approved open time-in record found for time-out.'],
                ]);
            }

            $attendance->clock_out_at = now();
            if (array_key_exists('notes', $data)) {
                $attendance->clock_out_notes = $data['notes'] ?? null;
            }
            $attendance->save();

            AuditTrail::record([
                'event_type' => 'STAFF_TIME_OUT_RECORDED',
                'entity_type' => 'staff_attendance',
                'entity_id' => (int) $attendance->id,
                'branch_id' => $attendance->branch_id ? (int) $attendance->branch_id : null,
                'user_id' => (int) $actor->id,
                'summary' => 'Staff time-out recorded',
                'meta' => [
                    'staff_user_id' => (int) $attendance->user_id,
                    'requested_at' => optional($attendance->clock_in_requested_at)->toISOString(),
                    'clock_out_at' => optional($attendance->clock_out_at)->toISOString(),
                    'status' => (string) $attendance->clock_in_status,
                ],
            ]);

            return response()->json([
                'status' => 'ok',
                'attendance' => $attendance->fresh()->load([
                    'user:id,name,email',
                    'branch:id,code,name',
                    'reviewedBy:id,name,email',
                ]),
            ]);
        });
    }

    public function approve(Request $request, StaffAttendance $attendance)
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string'],
        ]);

        return $this->transactionWithRetry(function () use ($request, $attendance, $data) {
            $locked = $this->lockAttendance($attendance->id);
            $this->enforceAttendanceAccessOrFail($request, $locked);

            if (strtoupper((string) $locked->clock_in_status) !== 'PENDING') {
                throw ValidationException::withMessages([
                    'status' => ['Only pending time-in requests can be approved.'],
                ]);
            }

            $locked->clock_in_status = 'APPROVED';
            $locked->reviewed_at = now();
            $locked->reviewed_by_user_id = $request->user()?->id;
            $locked->review_notes = array_key_exists('notes', $data) ? ($data['notes'] ?? null) : null;
            $locked->save();

            AuditTrail::record([
                'event_type' => 'STAFF_TIME_IN_APPROVED',
                'entity_type' => 'staff_attendance',
                'entity_id' => (int) $locked->id,
                'branch_id' => $locked->branch_id ? (int) $locked->branch_id : null,
                'user_id' => $request->user()?->id,
                'summary' => 'Staff time-in approved',
                'meta' => [
                    'staff_user_id' => (int) $locked->user_id,
                    'reviewed_at' => optional($locked->reviewed_at)->toISOString(),
                    'late_minutes' => $locked->late_minutes,
                    'status' => 'APPROVED',
                ],
            ]);

            return response()->json([
                'status' => 'ok',
                'attendance' => $locked->fresh()->load([
                    'user:id,name,email',
                    'branch:id,code,name',
                    'reviewedBy:id,name,email',
                ]),
            ]);
        });
    }

    public function reject(Request $request, StaffAttendance $attendance)
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string'],
        ]);

        return $this->transactionWithRetry(function () use ($request, $attendance, $data) {
            $locked = $this->lockAttendance($attendance->id);
            $this->enforceAttendanceAccessOrFail($request, $locked);

            if (strtoupper((string) $locked->clock_in_status) !== 'PENDING') {
                throw ValidationException::withMessages([
                    'status' => ['Only pending time-in requests can be rejected.'],
                ]);
            }

            $locked->clock_in_status = 'REJECTED';
            $locked->reviewed_at = now();
            $locked->reviewed_by_user_id = $request->user()?->id;
            $locked->review_notes = array_key_exists('notes', $data)
                ? ($data['notes'] ?? null)
                : 'Time-in request rejected';
            $locked->save();

            AuditTrail::record([
                'event_type' => 'STAFF_TIME_IN_REJECTED',
                'entity_type' => 'staff_attendance',
                'entity_id' => (int) $locked->id,
                'branch_id' => $locked->branch_id ? (int) $locked->branch_id : null,
                'user_id' => $request->user()?->id,
                'summary' => 'Staff time-in rejected',
                'meta' => [
                    'staff_user_id' => (int) $locked->user_id,
                    'reviewed_at' => optional($locked->reviewed_at)->toISOString(),
                    'status' => 'REJECTED',
                    'notes' => $locked->review_notes,
                ],
            ]);

            return response()->json([
                'status' => 'ok',
                'attendance' => $locked->fresh()->load([
                    'user:id,name,email',
                    'branch:id,code,name',
                    'reviewedBy:id,name,email',
                ]),
            ]);
        });
    }

    public function close(Request $request, StaffAttendance $attendance)
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string'],
        ]);

        return $this->transactionWithRetry(function () use ($request, $attendance, $data) {
            $locked = $this->lockAttendance($attendance->id);
            $this->enforceAttendanceAccessOrFail($request, $locked);

            if ($locked->clock_out_at !== null) {
                throw ValidationException::withMessages([
                    'status' => ['This attendance request is already closed.'],
                ]);
            }

            $status = strtoupper((string) $locked->clock_in_status);
            if (!in_array($status, ['PENDING', 'APPROVED'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['Only open pending or approved time-in requests can be closed.'],
                ]);
            }

            $reviewerId = $request->user()?->id;
            $closingNote = array_key_exists('notes', $data)
                ? ($data['notes'] ?? null)
                : null;
            $defaultClosingNote = 'Closed by admin due to incorrect time-in request.';

            if ($status === 'PENDING') {
                $locked->clock_in_status = 'REJECTED';
                $locked->reviewed_at = now();
                $locked->reviewed_by_user_id = $reviewerId;
                $locked->review_notes = $closingNote ?: $defaultClosingNote;
            } else {
                if ($locked->reviewed_at === null) {
                    $locked->reviewed_at = now();
                }
                if ($locked->reviewed_by_user_id === null) {
                    $locked->reviewed_by_user_id = $reviewerId;
                }
                if (!empty($closingNote)) {
                    $locked->review_notes = $closingNote;
                }
            }

            $locked->clock_out_at = now();
            $locked->clock_out_notes = $closingNote ?: $defaultClosingNote;
            $locked->save();

            AuditTrail::record([
                'event_type' => 'STAFF_TIME_IN_CLOSED',
                'entity_type' => 'staff_attendance',
                'entity_id' => (int) $locked->id,
                'branch_id' => $locked->branch_id ? (int) $locked->branch_id : null,
                'user_id' => $reviewerId,
                'summary' => 'Staff time-in request closed by admin',
                'meta' => [
                    'staff_user_id' => (int) $locked->user_id,
                    'previous_status' => $status,
                    'new_status' => (string) $locked->clock_in_status,
                    'closed_at' => optional($locked->clock_out_at)->toISOString(),
                    'notes' => $locked->clock_out_notes,
                ],
            ]);

            return response()->json([
                'status' => 'ok',
                'attendance' => $locked->fresh()->load([
                    'user:id,name,email',
                    'branch:id,code,name',
                    'reviewedBy:id,name,email',
                ]),
            ]);
        });
    }

    private function lockAttendance(int $attendanceId): StaffAttendance
    {
        return StaffAttendance::query()
            ->lockForUpdate()
            ->findOrFail($attendanceId);
    }

    private function enforceAttendanceAccessOrFail(Request $request, StaffAttendance $attendance): void
    {
        if ($this->isPrivilegedUser($request->user())) {
            return;
        }

        if (!empty($attendance->branch_id)) {
            $this->enforceBranchAccessOrFail($request, (int) $attendance->branch_id);
        }
    }

    private function resolveScheduledStartAt(Carbon $requestedAt): Carbon
    {
        $configured = trim((string) config('app.staff_shift_start_time', env('STAFF_SHIFT_START_TIME', '09:00:00')));
        if (!preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $configured)) {
            $configured = '09:00:00';
        }
        if (strlen($configured) === 5) {
            $configured .= ':00';
        }

        $scheduled = Carbon::parse(
            $requestedAt->toDateString() . ' ' . $configured,
            config('app.timezone')
        );

        return $scheduled->setTimezone($requestedAt->getTimezone());
    }

    private function resolveMonthWindow(string $month): array
    {
        $monthStart = Carbon::createFromFormat('Y-m', $month, config('app.timezone'))->startOfMonth();
        $monthEnd = $monthStart->copy()->endOfMonth();

        return [$monthStart, $monthEnd];
    }

    private function buildMonthlySummaryRow(Collection $records, Carbon $monthStart, ?User $fallbackUser = null): array
    {
        /** @var StaffAttendance|null $first */
        $first = $records->first();
        $user = $first?->user ?? $fallbackUser?->loadMissing('role:id,code,name', 'branch:id,code,name');
        $branch = $first?->branch ?? $fallbackUser?->branch;

        $approvedRecords = $records->filter(fn (StaffAttendance $row) => strtoupper((string) $row->clock_in_status) === 'APPROVED');
        $presentDays = $approvedRecords
            ->map(fn (StaffAttendance $row) => optional($row->clock_in_requested_at)?->toDateString())
            ->filter()
            ->unique()
            ->count();
        $lateDays = $approvedRecords->filter(fn (StaffAttendance $row) => ((int) ($row->late_minutes ?? 0)) > 0)->count();
        $totalLateMinutes = (int) $approvedRecords->sum(fn (StaffAttendance $row) => max(0, (int) ($row->late_minutes ?? 0)));
        $incompleteLogs = $approvedRecords->filter(fn (StaffAttendance $row) => $row->clock_out_at === null)->count();
        $pendingRequests = $records->filter(fn (StaffAttendance $row) => strtoupper((string) $row->clock_in_status) === 'PENDING')->count();
        $rejectedRequests = $records->filter(fn (StaffAttendance $row) => strtoupper((string) $row->clock_in_status) === 'REJECTED')->count();
        $workedMinutes = (int) $approvedRecords->sum(function (StaffAttendance $row) {
            return $this->calculateWorkedMinutes($row);
        });
        $openRecords = $records->filter(fn (StaffAttendance $row) => (bool) $row->is_open)->count();
        $lastActivityAt = $records
            ->map(function (StaffAttendance $row) {
                return $row->clock_out_at
                    ?? $row->reviewed_at
                    ?? $row->clock_in_requested_at;
            })
            ->filter()
            ->sortDesc()
            ->first();

        return [
            'user_id' => (int) ($first?->user_id ?? $fallbackUser?->id ?? 0),
            'month' => $monthStart->format('Y-m'),
            'month_label' => $monthStart->format('F Y'),
            'user' => $user ? [
                'id' => (int) $user->id,
                'name' => (string) $user->name,
                'email' => (string) $user->email,
                'role' => $user->role ? [
                    'id' => (int) $user->role->id,
                    'code' => (string) $user->role->code,
                    'name' => (string) $user->role->name,
                ] : null,
            ] : null,
            'branch' => $branch ? [
                'id' => (int) $branch->id,
                'code' => (string) $branch->code,
                'name' => (string) $branch->name,
            ] : null,
            'present_days' => $presentDays,
            'approved_records' => $approvedRecords->count(),
            'late_days' => $lateDays,
            'total_late_minutes' => $totalLateMinutes,
            'incomplete_logs' => $incompleteLogs,
            'pending_requests' => $pendingRequests,
            'rejected_requests' => $rejectedRequests,
            'worked_minutes' => $workedMinutes,
            'open_records' => $openRecords,
            'last_activity_at' => $lastActivityAt?->toISOString(),
        ];
    }

    private function serializeMonthlyDetailLog(StaffAttendance $attendance): array
    {
        return [
            'id' => (int) $attendance->id,
            'attendance_date' => optional($attendance->clock_in_requested_at)?->toDateString(),
            'scheduled_start_at' => optional($attendance->scheduled_start_at)?->toISOString(),
            'clock_in_requested_at' => optional($attendance->clock_in_requested_at)?->toISOString(),
            'clock_in_status' => (string) $attendance->clock_in_status,
            'reviewed_at' => optional($attendance->reviewed_at)?->toISOString(),
            'reviewed_by_user_id' => $attendance->reviewed_by_user_id ? (int) $attendance->reviewed_by_user_id : null,
            'clock_out_at' => optional($attendance->clock_out_at)?->toISOString(),
            'request_notes' => $attendance->request_notes,
            'review_notes' => $attendance->review_notes,
            'clock_out_notes' => $attendance->clock_out_notes,
            'late_minutes' => $attendance->late_minutes,
            'worked_minutes' => $this->calculateWorkedMinutes($attendance),
            'is_open' => (bool) $attendance->is_open,
            'user' => $attendance->user ? [
                'id' => (int) $attendance->user->id,
                'name' => (string) $attendance->user->name,
                'email' => (string) $attendance->user->email,
                'role' => $attendance->user->role ? [
                    'id' => (int) $attendance->user->role->id,
                    'code' => (string) $attendance->user->role->code,
                    'name' => (string) $attendance->user->role->name,
                ] : null,
            ] : null,
            'branch' => $attendance->branch ? [
                'id' => (int) $attendance->branch->id,
                'code' => (string) $attendance->branch->code,
                'name' => (string) $attendance->branch->name,
            ] : null,
            'reviewed_by' => $attendance->reviewedBy ? [
                'id' => (int) $attendance->reviewedBy->id,
                'name' => (string) $attendance->reviewedBy->name,
                'email' => (string) $attendance->reviewedBy->email,
            ] : null,
        ];
    }

    private function calculateWorkedMinutes(StaffAttendance $attendance): int
    {
        if (
            strtoupper((string) $attendance->clock_in_status) !== 'APPROVED'
            || !($attendance->clock_in_requested_at instanceof Carbon)
            || !($attendance->clock_out_at instanceof Carbon)
        ) {
            return 0;
        }

        return max(0, (int) $attendance->clock_in_requested_at->diffInMinutes($attendance->clock_out_at, false));
    }

    private function paginateCollection(Collection $rows, int $perPage, int $page, Request $request): LengthAwarePaginator
    {
        $total = $rows->count();
        $items = $rows->forPage($page, $perPage)->values();

        return new LengthAwarePaginator(
            $items,
            $total,
            $perPage,
            $page,
            [
                'path' => $request->url(),
                'query' => $request->query(),
            ]
        );
    }
}

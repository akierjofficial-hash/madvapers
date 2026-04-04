<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

class StaffAttendance extends Model
{
    protected $fillable = [
        'user_id',
        'branch_id',
        'scheduled_start_at',
        'clock_in_requested_at',
        'clock_in_status',
        'reviewed_at',
        'reviewed_by_user_id',
        'clock_out_at',
        'request_notes',
        'review_notes',
        'clock_out_notes',
    ];

    protected $casts = [
        'scheduled_start_at' => 'datetime',
        'clock_in_requested_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'clock_out_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = [
        'late_minutes',
        'is_open',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }

    public function getLateMinutesAttribute(): ?int
    {
        $requestedAt = $this->clock_in_requested_at instanceof Carbon
            ? $this->clock_in_requested_at
            : null;
        $scheduledStartAt = $this->scheduled_start_at instanceof Carbon
            ? $this->scheduled_start_at
            : null;

        if (!$requestedAt || !$scheduledStartAt) {
            return null;
        }

        $minutes = $scheduledStartAt->diffInMinutes($requestedAt, false);

        return max(0, (int) $minutes);
    }

    public function getIsOpenAttribute(): bool
    {
        return $this->clock_out_at === null
            && in_array(strtoupper((string) $this->clock_in_status), ['PENDING', 'APPROVED'], true);
    }
}


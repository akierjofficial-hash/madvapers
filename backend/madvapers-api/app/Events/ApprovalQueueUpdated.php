<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ApprovalQueueUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $action,
        public readonly ?int $branchId = null,
        public readonly ?int $saleId = null
    ) {}

    public function broadcastOn(): array
    {
        return [
            new Channel('approvals.queue'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'approval.queue.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'action' => $this->action,
            'branch_id' => $this->branchId,
            'sale_id' => $this->saleId,
            'emitted_at' => now()->toIso8601String(),
        ];
    }
}

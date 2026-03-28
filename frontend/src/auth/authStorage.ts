const LAST_BRANCH_KEY = 'mv_last_branch_id';
const SEEN_PENDING_KEY_PREFIX = 'mv_seen_pending_v1:';
const SEEN_PENDING_AT_KEY_PREFIX = 'mv_seen_pending_at_v1:';
const BRANCH_CHANGED_EVENT = 'mv_branch_changed';
const APPROVAL_QUEUE_PING_KEY = 'mv_approval_queue_ping_at';
const APPROVAL_QUEUE_PING_EVENT = 'mv_approval_queue_ping';

type PendingSeen = {
  adjustments: number;
  transfers: number;
  purchaseOrders: number;
  voidRequests: number;
};

type PendingSeenKey = keyof PendingSeen;

type PendingSeenAt = {
  adjustments: number;
  transfers: number;
  purchaseOrders: number;
  voidRequests: number;
};

type PendingSeenAtKey = keyof PendingSeenAt;

const ZERO_SEEN: PendingSeen = {
  adjustments: 0,
  transfers: 0,
  purchaseOrders: 0,
  voidRequests: 0,
};

const ZERO_SEEN_AT: PendingSeenAt = {
  adjustments: 0,
  transfers: 0,
  purchaseOrders: 0,
  voidRequests: 0,
};

function seenPendingKey(userId: number): string {
  return `${SEEN_PENDING_KEY_PREFIX}${userId}`;
}

function seenPendingAtKey(userId: number): string {
  return `${SEEN_PENDING_AT_KEY_PREFIX}${userId}`;
}

function toTimestamp(input: string | number | null | undefined): number {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.floor(input) : 0;
  }
  if (typeof input === 'string' && input.trim()) {
    const ts = Date.parse(input);
    return Number.isFinite(ts) ? ts : 0;
  }
  return 0;
}

function emitSeenPendingUpdated(userId: number): void {
  window.dispatchEvent(
    new CustomEvent('mv_seen_pending_updated', {
      detail: { userId },
    })
  );
}

function emitBranchChanged(branchId: number | null): void {
  window.dispatchEvent(
    new CustomEvent(BRANCH_CHANGED_EVENT, {
      detail: { branchId },
    })
  );
}

function emitApprovalQueuePing(at = Date.now()): void {
  try {
    localStorage.setItem(APPROVAL_QUEUE_PING_KEY, String(at));
  } catch {
    // Ignore storage quota/privacy failures.
  }

  window.dispatchEvent(
    new CustomEvent(APPROVAL_QUEUE_PING_EVENT, {
      detail: { at },
    })
  );
}

export const authStorage = {
  getSeenPending(userId: number | null | undefined): PendingSeen {
    if (!userId) return { ...ZERO_SEEN };

    const raw = localStorage.getItem(seenPendingKey(userId));
    if (!raw) return { ...ZERO_SEEN };

    try {
      const parsed = JSON.parse(raw) as Partial<PendingSeen>;
      return {
        adjustments: Number(parsed.adjustments ?? 0) || 0,
        transfers: Number(parsed.transfers ?? 0) || 0,
        purchaseOrders: Number(parsed.purchaseOrders ?? 0) || 0,
        voidRequests: Number((parsed as any).voidRequests ?? 0) || 0,
      };
    } catch {
      return { ...ZERO_SEEN };
    }
  },
  markSeenPending(userId: number | null | undefined, key: PendingSeenKey, id: number): PendingSeen {
    if (!userId || !Number.isFinite(id) || id <= 0) {
      return this.getSeenPending(userId);
    }
    const next = this.getSeenPending(userId);
    next[key] = Math.max(next[key], Math.floor(id));
    localStorage.setItem(seenPendingKey(userId), JSON.stringify(next));
    emitSeenPendingUpdated(userId);
    return next;
  },
  getSeenPendingAt(userId: number | null | undefined): PendingSeenAt {
    if (!userId) return { ...ZERO_SEEN_AT };

    const raw = localStorage.getItem(seenPendingAtKey(userId));
    if (!raw) return { ...ZERO_SEEN_AT };

    try {
      const parsed = JSON.parse(raw) as Partial<PendingSeenAt>;
      return {
        adjustments: toTimestamp(parsed.adjustments),
        transfers: toTimestamp(parsed.transfers),
        purchaseOrders: toTimestamp(parsed.purchaseOrders),
        voidRequests: toTimestamp((parsed as any).voidRequests),
      };
    } catch {
      return { ...ZERO_SEEN_AT };
    }
  },
  markSeenPendingAt(
    userId: number | null | undefined,
    key: PendingSeenAtKey,
    at?: string | number | null
  ): PendingSeenAt {
    if (!userId) {
      return this.getSeenPendingAt(userId);
    }
    const atTs = toTimestamp(at) || Date.now();
    const next = this.getSeenPendingAt(userId);
    next[key] = Math.max(next[key], atTs);
    localStorage.setItem(seenPendingAtKey(userId), JSON.stringify(next));
    emitSeenPendingUpdated(userId);
    return next;
  },
  clearLastBranchId(): void {
    localStorage.removeItem(LAST_BRANCH_KEY);
    emitBranchChanged(null);
  },
  getLastBranchId(): number | null {
    const raw = localStorage.getItem(LAST_BRANCH_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  },
  setLastBranchId(branchId: number): void {
    localStorage.setItem(LAST_BRANCH_KEY, String(branchId));
    emitBranchChanged(branchId);
  },
  pingApprovalQueue(): void {
    emitApprovalQueuePing();
  },
};

const LAST_BRANCH_KEY = 'mv_last_branch_id';
const SEEN_PENDING_KEY_PREFIX = 'mv_seen_pending_v1:';

type PendingSeen = {
  adjustments: number;
  transfers: number;
  purchaseOrders: number;
};

type PendingSeenKey = keyof PendingSeen;

const ZERO_SEEN: PendingSeen = {
  adjustments: 0,
  transfers: 0,
  purchaseOrders: 0,
};

function seenPendingKey(userId: number): string {
  return `${SEEN_PENDING_KEY_PREFIX}${userId}`;
}

function emitSeenPendingUpdated(userId: number): void {
  window.dispatchEvent(
    new CustomEvent('mv_seen_pending_updated', {
      detail: { userId },
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
  clearLastBranchId(): void {
    localStorage.removeItem(LAST_BRANCH_KEY);
  },
  getLastBranchId(): number | null {
    const raw = localStorage.getItem(LAST_BRANCH_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  },
  setLastBranchId(branchId: number): void {
    localStorage.setItem(LAST_BRANCH_KEY, String(branchId));
  },
};

const LAST_BRANCH_KEY = 'mv_last_branch_id';

export const authStorage = {
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

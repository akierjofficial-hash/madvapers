import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  Menu,
  MenuItem,
  Pagination,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { authStorage } from '../auth/authStorage';
import { BranchSelect } from '../components/BranchSelect';
import {
  requestDialogActionsSx,
  requestDialogContentSx,
  requestDialogSx,
  requestDialogTitleSx,
  requestSectionSx,
} from '../components/requestDialogStyles';
import {
  useBranchesQuery,
  useAdjustmentsQuery,
  useCreateAdjustmentMutation,
  useSubmitAdjustmentMutation,
  useApproveAdjustmentMutation,
  usePostAdjustmentMutation,
  useVariantsQuery,
  useDashboardApprovalQueueQuery,
} from '../api/queries';
import type { StockAdjustment } from '../api/adjustments';

const STATUSES = ['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED'] as const;

function qty(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function toInt(v: string | null): number | null {
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getVariantOnHand(v: any): number | null {
  const n = Number(v?.qty_on_hand);
  return Number.isFinite(n) ? n : null;
}

export function AdjustmentsPage() {
  const theme = useTheme();
  const isCompactList = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const canBranchView = can('BRANCH_VIEW');

  // RBAC
  const canView = can('ADJUSTMENT_VIEW');
  const canCreatePerm = can('ADJUSTMENT_CREATE');
  const canSubmitPerm = can('ADJUSTMENT_SUBMIT');
  const canApprovePerm = can('ADJUSTMENT_APPROVE');
  const canPostPerm = can('ADJUSTMENT_POST');
  const canLedgerView = can('LEDGER_VIEW');

  const branchesQuery = useBranchesQuery(canBranchView);
  const [searchParams, setSearchParams] = useSearchParams();

  const [branchId, setBranchId] = useState<number | ''>(() => {
    const fromUrl = toInt(searchParams.get('branch_id'));
    if (fromUrl !== null) return fromUrl;
    const fromStorage = authStorage.getLastBranchId();
    return fromStorage ?? (user?.branch_id ?? '');
  });

  const [status, setStatus] = useState<string>(() => searchParams.get('status') ?? '');
  const [page, setPage] = useState<number>(() => toInt(searchParams.get('page')) ?? 1);
  const [seenSubmittedAdjustmentId, setSeenSubmittedAdjustmentId] = useState<number>(() =>
    authStorage.getSeenPending(user?.id).adjustments
  );
  const [pendingAdjustmentBranchAnchorEl, setPendingAdjustmentBranchAnchorEl] = useState<HTMLElement | null>(null);

  const [selected, setSelected] = useState<StockAdjustment | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [createBranchId, setCreateBranchId] = useState<number | ''>(branchId);
  const [createReasonCode, setCreateReasonCode] = useState<string>('OPENING');
  const [createRefNo, setCreateRefNo] = useState<string>('');
  const [createNotes, setCreateNotes] = useState<string>('');

  const [variantSearch, setVariantSearch] = useState('');
  const [variantSearchDebounced, setVariantSearchDebounced] = useState('');
  const [pickedVariant, setPickedVariant] = useState<any | null>(null);
  const [itemQtyDelta, setItemQtyDelta] = useState<string>('1');
  const [itemUnitCost, setItemUnitCost] = useState<string>('');
  const [itemNotes, setItemNotes] = useState<string>('');
  const [draftItems, setDraftItems] = useState<
    Array<{
      product_variant_id: number;
      sku?: string | null;
      productName?: string | null;
      onHand?: number | null;
      qty_delta: number;
      unit_cost: number | null;
      notes: string | null;
    }>
  >([]);

  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    setSeenSubmittedAdjustmentId(authStorage.getSeenPending(user?.id).adjustments);
  }, [user?.id]);

  // Hydrate state when URL changes
  useEffect(() => {
    const urlBranch = toInt(searchParams.get('branch_id'));
    const urlStatus = searchParams.get('status') ?? '';
    const urlPage = toInt(searchParams.get('page')) ?? 1;

    if (urlBranch !== null && urlBranch !== branchId) {
      setBranchId(urlBranch);
      authStorage.setLastBranchId(urlBranch);
      setSelected(null);
    }
    if (urlStatus !== status) {
      setStatus(urlStatus);
      setSelected(null);
    }
    if (urlPage !== page) {
      setPage(urlPage);
      setSelected(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Default branch once branches load
  useEffect(() => {
    if (!canBranchView) return;
    if (branchId !== '' || !branchesQuery.data?.length) return;
    const preferred = user?.branch_id ? branchesQuery.data.find((b) => b.id === user.branch_id) : null;
    const first = preferred ?? branchesQuery.data[0];
    setBranchId(first.id);
    authStorage.setLastBranchId(first.id);
  }, [canBranchView, branchId, branchesQuery.data, user?.branch_id]);

  // Sync local state back into URL
  useEffect(() => {
    if (branchId === '') return;

    const next = new URLSearchParams();
    next.set('branch_id', String(branchId));
    if (status) next.set('status', status);
    if (page !== 1) next.set('page', String(page));

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, status, page]);

  const adjustmentsQuery = useAdjustmentsQuery(
    {
      branch_id: branchId === '' ? 0 : branchId,
      status: status || undefined,
      page,
    },
    branchId !== '' && canView
  );

  const submitMut = useSubmitAdjustmentMutation();
  const approveMut = useApproveAdjustmentMutation();
  const postMut = usePostAdjustmentMutation();
  const createMut = useCreateAdjustmentMutation();
  const approvalQueueQuery = useDashboardApprovalQueueQuery({}, canView);

  useEffect(() => {
    if (!openCreate) return;
    const t = setTimeout(() => setVariantSearchDebounced(variantSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [variantSearch, openCreate]);

  const variantLookup = useVariantsQuery(
    {
      page: 1,
      search: variantSearchDebounced || undefined,
      branch_id: typeof createBranchId === 'number' ? createBranchId : undefined,
    },
    openCreate && canCreatePerm && variantSearchDebounced.length >= 2
  );
  const variantOptions: any[] = variantLookup.data?.data ?? [];

  const rows = adjustmentsQuery.data?.data ?? [];
  const totalPages = adjustmentsQuery.data?.last_page ?? 1;

  const pretty = useMemo(() => {
    return rows.map((a) => {
      const items = a.items ?? [];
      const itemsCount = items.length;
      const totalDelta = items.reduce((sum, it) => sum + Number(it.qty_delta ?? 0), 0);
      const createdByUser = a.createdBy ?? a.created_by ?? null;
      const refNo = a.reference_no?.trim() ? a.reference_no : `ADJ-${a.id}`;
      const statusText = String(a.status ?? '-');
      const adjustmentId = Number(a.id ?? 0);
      const isNew = statusText === 'SUBMITTED' && adjustmentId > seenSubmittedAdjustmentId;

      return {
        raw: a,
        id: adjustmentId,
        createdAt: a.created_at ? new Date(a.created_at).toLocaleString() : '-',
        status: statusText,
        isNew,
        reason: a.reason_code ?? '-',
        ref: refNo,
        itemsCount,
        totalDelta,
        createdBy: createdByUser?.name ?? '-',
      };
    });
  }, [rows, seenSubmittedAdjustmentId]);
  const pendingAdjustmentBranches = useMemo(() => {
    const queueRows = approvalQueueQuery.data?.approval_queue?.adjustments ?? [];
    const branchLabelById = new Map<number, string>();
    for (const branch of branchesQuery.data ?? []) {
      const id = Number(branch.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      branchLabelById.set(id, `${branch.code} - ${branch.name}`);
    }

    const grouped = new Map<
      number,
      {
        branchId: number;
        branchLabel: string;
        requestCount: number;
        latestRequestedAtTs: number;
      }
    >();

    for (const row of queueRows) {
      const statusText = String((row as any)?.status ?? '').toUpperCase();
      if (statusText && statusText !== 'SUBMITTED') continue;

      const queueBranchId = Number((row as any)?.branch_id ?? 0);
      if (!Number.isFinite(queueBranchId) || queueBranchId <= 0) continue;

      const queueBranchName = String((row as any)?.branch_name ?? '').trim();
      const queueBranchLabel = queueBranchName || branchLabelById.get(queueBranchId) || `Branch #${queueBranchId}`;
      const submittedAtRaw = Date.parse(String((row as any)?.created_at ?? ''));
      const submittedAtTs = Number.isFinite(submittedAtRaw) ? submittedAtRaw : 0;

      const existing = grouped.get(queueBranchId);
      if (existing) {
        existing.requestCount += 1;
        existing.latestRequestedAtTs = Math.max(existing.latestRequestedAtTs, submittedAtTs);
      } else {
        grouped.set(queueBranchId, {
          branchId: queueBranchId,
          branchLabel: queueBranchLabel,
          requestCount: 1,
          latestRequestedAtTs: submittedAtTs,
        });
      }
    }

    return Array.from(grouped.values()).sort(
      (a, b) =>
        b.latestRequestedAtTs - a.latestRequestedAtTs ||
        b.requestCount - a.requestCount ||
        a.branchLabel.localeCompare(b.branchLabel)
    );
  }, [approvalQueueQuery.data?.approval_queue?.adjustments, branchesQuery.data]);
  const hasPendingAdjustmentBranchAlerts = pendingAdjustmentBranches.length > 0;
  const pendingAdjustmentBranchCountMap = useMemo(
    () =>
      pendingAdjustmentBranches.reduce<Record<number, number>>((acc, item) => {
        acc[item.branchId] = item.requestCount;
        return acc;
      }, {}),
    [pendingAdjustmentBranches]
  );
  const pendingAdjustmentDotTitle = useMemo(() => {
    if (!hasPendingAdjustmentBranchAlerts) return 'No submitted adjustments';
    if (pendingAdjustmentBranches.length === 1) {
      return `Submitted adjustment from ${pendingAdjustmentBranches[0].branchLabel}`;
    }
    return `Submitted adjustments from ${pendingAdjustmentBranches.length} branches`;
  }, [hasPendingAdjustmentBranchAlerts, pendingAdjustmentBranches]);

  const jumpToPendingAdjustmentBranch = (nextBranchId: number) => {
    setBranchId(nextBranchId);
    authStorage.setLastBranchId(nextBranchId);
    setStatus('SUBMITTED');
    setPage(1);
    setSelected(null);
    setPendingAdjustmentBranchAnchorEl(null);
  };

  useEffect(() => {
    if (hasPendingAdjustmentBranchAlerts) return;
    setPendingAdjustmentBranchAnchorEl(null);
  }, [hasPendingAdjustmentBranchAlerts]);

  const openAdjustmentRow = (row: { raw: StockAdjustment; id: number; status: string }) => {
    if (row.status === 'SUBMITTED') {
      const next = authStorage.markSeenPending(user?.id, 'adjustments', row.id);
      setSeenSubmittedAdjustmentId(next.adjustments);
    }
    setSelected(row.raw);
  };

  const closeDrawer = () => setSelected(null);

  const handleTransition = async (action: 'submit' | 'approve' | 'post') => {
    if (!selected) return;

    // RBAC guard (prevents pointless API call/403 spam)
    if (action === 'submit' && !canSubmitPerm) {
      return setSnack({ open: true, message: 'Not authorized: ADJUSTMENT_SUBMIT', severity: 'error' });
    }
    if (action === 'approve' && !canApprovePerm) {
      return setSnack({ open: true, message: 'Not authorized: ADJUSTMENT_APPROVE', severity: 'error' });
    }
    if (action === 'post' && !canPostPerm) {
      return setSnack({ open: true, message: 'Not authorized: ADJUSTMENT_POST', severity: 'error' });
    }

    try {
      if (action === 'submit') await submitMut.mutateAsync(selected.id);
      if (action === 'approve') await approveMut.mutateAsync(selected.id);
      if (action === 'post') await postMut.mutateAsync(selected.id);

      setSnack({ open: true, message: `Adjustment ${action} successful.`, severity: 'success' });
      closeDrawer();
      adjustmentsQuery.refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message || `Failed to ${action} adjustment.`;
      setSnack({ open: true, message: msg, severity: 'error' });
    }
  };

  // Status + RBAC gating
  const canSubmit = canSubmitPerm && selected?.status === 'DRAFT';
  const canApprove = canApprovePerm && selected?.status === 'SUBMITTED';
  const canPost = canPostPerm && selected?.status === 'APPROVED';
  const branchLabel =
    user?.branch?.name ??
    (typeof branchId === 'number' ? `Branch #${branchId}` : 'No branch assigned');
  const createBranchLabel =
    user?.branch?.name ??
    (typeof createBranchId === 'number' ? `Branch #${createBranchId}` : branchLabel);

  const openCreateDialog = () => {
    if (!canCreatePerm) {
      setSnack({ open: true, message: 'Not authorized: ADJUSTMENT_CREATE', severity: 'error' });
      return;
    }

    setCreateBranchId(branchId === '' ? (user?.branch_id ?? '') : branchId);
    setCreateReasonCode('OPENING');
    setCreateRefNo('');
    setCreateNotes('');
    setVariantSearch('');
    setVariantSearchDebounced('');
    setPickedVariant(null);
    setItemQtyDelta('1');
    setItemUnitCost('');
    setItemNotes('');
    setDraftItems([]);
    setOpenCreate(true);
  };

  const closeCreateDialog = () => setOpenCreate(false);

  const pickVariant = (v: any) => {
    setPickedVariant(v);
    setVariantSearch(v?.sku ?? v?.barcode ?? String(v?.id ?? ''));
  };

  const addDraftItem = () => {
    if (!canCreatePerm) {
      setSnack({ open: true, message: 'Not authorized: ADJUSTMENT_CREATE', severity: 'error' });
      return;
    }

    const variantId = Number(pickedVariant?.id);
    if (!Number.isFinite(variantId) || variantId <= 0) {
      setSnack({ open: true, message: 'Pick a variant first.', severity: 'error' });
      return;
    }

    const qtyDelta = Number(itemQtyDelta);
    if (!Number.isFinite(qtyDelta) || qtyDelta === 0) {
      setSnack({ open: true, message: 'Qty delta must be non-zero.', severity: 'error' });
      return;
    }

    const unitCostRaw = itemUnitCost.trim();
    const unitCost = unitCostRaw === '' ? null : Number(unitCostRaw);
    if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) {
      setSnack({ open: true, message: 'Unit cost must be a valid number (>= 0).', severity: 'error' });
      return;
    }

    const notes = itemNotes.trim() ? itemNotes.trim() : null;
    const sku = pickedVariant?.sku ?? null;
    const productName = pickedVariant?.product?.name ?? null;
    const onHand = getVariantOnHand(pickedVariant);

    setDraftItems((prev) => {
      const idx = prev.findIndex((x) => x.product_variant_id === variantId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          qty_delta: next[idx].qty_delta + qtyDelta,
          unit_cost: unitCost,
          notes,
          sku: sku ?? next[idx].sku,
          productName: productName ?? next[idx].productName,
          onHand: onHand ?? next[idx].onHand ?? null,
        };
        return next;
      }

      return [
        ...prev,
        {
          product_variant_id: variantId,
          sku,
          productName,
          onHand,
          qty_delta: qtyDelta,
          unit_cost: unitCost,
          notes,
        },
      ];
    });

    setItemQtyDelta('1');
    setItemUnitCost('');
    setItemNotes('');
    setPickedVariant(null);
  };

  const removeDraftItem = (variantId: number) => {
    setDraftItems((prev) => prev.filter((x) => x.product_variant_id !== variantId));
  };

  const clearDraft = () => setDraftItems([]);

  const submitCreateDraft = async () => {
    if (!canCreatePerm) {
      setSnack({ open: true, message: 'Not authorized: ADJUSTMENT_CREATE', severity: 'error' });
      return;
    }

    const b = typeof createBranchId === 'number' ? createBranchId : null;
    if (!b) {
      setSnack({ open: true, message: 'Select a branch.', severity: 'error' });
      return;
    }
    if (draftItems.length < 1) {
      setSnack({ open: true, message: 'Add at least 1 item.', severity: 'error' });
      return;
    }
    if (!createReasonCode.trim()) {
      setSnack({ open: true, message: 'Reason code is required.', severity: 'error' });
      return;
    }

    try {
      const created = await createMut.mutateAsync({
        branch_id: b,
        reason_code: createReasonCode.trim().toUpperCase(),
        reference_no: createRefNo.trim() ? createRefNo.trim() : null,
        notes: createNotes.trim() ? createNotes.trim() : null,
        items: draftItems.map((it) => ({
          product_variant_id: it.product_variant_id,
          qty_delta: it.qty_delta,
          unit_cost: it.unit_cost,
          notes: it.notes,
        })),
      });

      closeCreateDialog();
      setStatus('DRAFT');
      setPage(1);
      setSelected(created);
      adjustmentsQuery.refetch();
      setSnack({ open: true, message: `Draft adjustment #${created.id} created.`, severity: 'success' });
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to create adjustment draft.';
      setSnack({ open: true, message: msg, severity: 'error' });
    }
  };

  const goToLedgerForAdjustment = () => {
    if (!selected) return;

    if (!canLedgerView) {
      return setSnack({ open: true, message: 'Not authorized: LEDGER_VIEW', severity: 'error' });
    }

    const effectiveBranchId = selected.branch_id ?? (branchId === '' ? null : branchId);
    if (!effectiveBranchId) return;

    const params = new URLSearchParams();
    params.set('branch_id', String(effectiveBranchId));
    params.set('movement_type', 'ADJUSTMENT');

    // ✅ Use real reference filters (reliable)
    params.set('ref_type', 'stock_adjustments');
    params.set('ref_id', String(selected.id));

    // Optional UI hint
    params.set('search', `Adjustment #${selected.id}`);

    navigate(`/ledger?${params.toString()}`);
  };

  const goToLedgerForAdjustmentItem = (productVariantId: number) => {
    if (!selected) return;

    if (!canLedgerView) {
      return setSnack({ open: true, message: 'Not authorized: LEDGER_VIEW', severity: 'error' });
    }

    const effectiveBranchId = selected.branch_id ?? (branchId === '' ? null : branchId);
    if (!effectiveBranchId) return;

    const params = new URLSearchParams();
    params.set('branch_id', String(effectiveBranchId));

    // keep these for correctness
    params.set('movement_type', 'ADJUSTMENT');
    params.set('ref_type', 'stock_adjustments');
    params.set('ref_id', String(selected.id));

    // focus on a specific variant
    params.set('product_variant_id', String(productVariantId));

    // optional (nice UI hint)
    params.set('search', `Adjustment #${selected.id}`);

    navigate(`/ledger?${params.toString()}`);
  };

  if (!canView) {
    return <Alert severity="error">Not authorized to view Adjustments (ADJUSTMENT_VIEW).</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h5">Stock Adjustments</Typography>
        <Button variant="contained" onClick={openCreateDialog} disabled={!canCreatePerm}>
          New Draft
        </Button>
      </Stack>

      {canBranchView && branchesQuery.isError && <Alert severity="error">Failed to load branches.</Alert>}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <Box sx={{ flex: 1, minWidth: 260 }}>
          {canBranchView ? (
            <BranchSelect
              branches={branchesQuery.data ?? []}
              value={branchId}
              onChange={(id) => {
                setBranchId(id);
                authStorage.setLastBranchId(id);
                setPage(1);
                setSelected(null);
              }}
              showAlertDot={hasPendingAdjustmentBranchAlerts}
              alertDotTitle={pendingAdjustmentDotTitle}
              onAlertDotClick={(event) => setPendingAdjustmentBranchAnchorEl(event.currentTarget)}
              showBranchAlertDots
              alertCountsByBranchId={pendingAdjustmentBranchCountMap}
            />
          ) : (
            <TextField size="small" label="Branch" value={branchLabel} disabled fullWidth />
          )}
        </Box>

        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
            setSelected(null);
          }}
          sx={{ width: { xs: '100%', md: 220 } }}
        >
          {STATUSES.map((s) => (
            <MenuItem key={s || 'ALL'} value={s}>
              {s ? s : 'All'}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Menu
        anchorEl={pendingAdjustmentBranchAnchorEl}
        open={Boolean(pendingAdjustmentBranchAnchorEl) && hasPendingAdjustmentBranchAlerts}
        onClose={() => setPendingAdjustmentBranchAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { minWidth: 260 } }}
      >
        {pendingAdjustmentBranches.map((item) => (
          <MenuItem
            key={item.branchId}
            selected={branchId === item.branchId}
            onClick={() => jumpToPendingAdjustmentBranch(item.branchId)}
          >
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
              <Typography variant="body2" sx={{ fontWeight: branchId === item.branchId ? 700 : 500 }}>
                {item.branchLabel}
              </Typography>
              <Chip size="small" color="error" label={item.requestCount === 1 ? '1 req' : `${item.requestCount} req`} />
            </Stack>
          </MenuItem>
        ))}
      </Menu>

      {branchId === '' ? (
        <Alert severity={canBranchView ? 'info' : 'error'}>
          {canBranchView ? 'Select a branch to view adjustments.' : 'No branch assigned to your account.'}
        </Alert>
      ) : adjustmentsQuery.isLoading ? (
        <Alert severity="info">Loading adjustments…</Alert>
      ) : adjustmentsQuery.isError ? (
        <Alert severity="error">Failed to load adjustments.</Alert>
      ) : pretty.length === 0 ? (
        <Alert severity="warning">No adjustments found.</Alert>
      ) : isCompactList ? (
        <Stack spacing={1}>
          {pretty.map((r) => (
            <Paper
              key={r.id}
              variant="outlined"
              role="button"
              tabIndex={0}
              onClick={() => openAdjustmentRow(r)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openAdjustmentRow(r);
                }
              }}
              sx={{
                p: 1.2,
                cursor: 'pointer',
                bgcolor: r.isNew ? 'rgba(211, 47, 47, 0.06)' : undefined,
              }}
            >
              <Stack spacing={0.75}>
                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                  <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                    ADJ #{r.id}
                  </Typography>
                  <Stack direction="row" spacing={0.6} alignItems="center">
                    <Chip size="small" label={r.status} />
                    {r.isNew && <Chip size="small" color="error" label="NEW" sx={{ height: 20, fontSize: 10 }} />}
                  </Stack>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {r.createdAt}
                </Typography>
                <Typography variant="body2">
                  Reason: {r.reason} | Ref: {r.ref}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Items: {r.itemsCount} | Qty Delta: {qty(r.totalDelta)} | By: {r.createdBy}
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Paper variant="outlined">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Ref</TableCell>
                <TableCell align="right">Items</TableCell>
                <TableCell align="right">Qty Δ</TableCell>
                <TableCell>By</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pretty.map((r) => (
                <TableRow
                  key={r.id}
                  hover
                  sx={{
                    cursor: 'pointer',
                    bgcolor: r.isNew ? 'rgba(211, 47, 47, 0.06)' : undefined,
                  }}
                  onClick={() => openAdjustmentRow(r)}
                >
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{r.createdAt}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Typography variant="body2">{r.status}</Typography>
                      {r.isNew && (
                        <>
                          <Box
                            component="span"
                            sx={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              bgcolor: 'error.main',
                              display: 'inline-block',
                            }}
                          />
                          <Chip size="small" color="error" label="NEW" sx={{ height: 20, fontSize: 10 }} />
                        </>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>{r.reason}</TableCell>
                  <TableCell>{r.ref}</TableCell>
                  <TableCell align="right">{r.itemsCount}</TableCell>
                  <TableCell align="right">{qty(r.totalDelta)}</TableCell>
                  <TableCell>{r.createdBy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {branchId !== '' && totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} showFirstButton showLastButton />
        </Box>
      )}

      <Dialog open={openCreate} onClose={closeCreateDialog} maxWidth="md" fullWidth sx={requestDialogSx}>
        <DialogTitle sx={requestDialogTitleSx}>
          <Stack spacing={0.35}>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
              New Adjustment Draft
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Stage stock corrections first, then submit and post when validated.
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={requestDialogContentSx}>
          <Stack spacing={1.5}>
            {canBranchView ? (
              <Paper variant="outlined" sx={requestSectionSx}>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  Branch
                </Typography>
                <BranchSelect
                  branches={branchesQuery.data ?? []}
                  value={createBranchId}
                  onChange={(id) => setCreateBranchId(id)}
                  disabled={!canCreatePerm}
                />
              </Paper>
            ) : (
              <TextField size="small" label="Branch" value={createBranchLabel} disabled fullWidth />
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                select
                size="small"
                label="Reason code"
                value={createReasonCode}
                onChange={(e) => setCreateReasonCode(e.target.value)}
                sx={{ minWidth: 220 }}
                disabled={!canCreatePerm}
              >
                {['OPENING', 'CORRECTION', 'DAMAGE', 'EXPIRED', 'SHRINKAGE', 'TRANSFER_FIX'].map((code) => (
                  <MenuItem key={code} value={code}>
                    {code}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Reference no (optional)"
                value={createRefNo}
                onChange={(e) => setCreateRefNo(e.target.value)}
                fullWidth
                disabled={!canCreatePerm}
              />
            </Stack>

            <TextField
              size="small"
              label="Scan/search SKU or barcode"
              value={variantSearch}
              onChange={(e) => setVariantSearch(e.target.value)}
              helperText="Type at least 2 characters to search variants. On hand is based on the selected branch."
              disabled={!canCreatePerm}
            />

            {variantSearchDebounced.length >= 2 && variantLookup.isLoading && (
              <Alert severity="info">Searching variants...</Alert>
            )}

            {variantSearchDebounced.length >= 2 && !variantLookup.isLoading && variantOptions.length > 0 && (
              <Paper variant="outlined" sx={[requestSectionSx, { maxHeight: 220, overflow: 'auto', p: 0 }]}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell width={110}>ID</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell align="right" width={120}>On hand</TableCell>
                      <TableCell width={100} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {variantOptions.slice(0, 10).map((v: any) => {
                      const id = Number(v?.id);
                      const onHand = getVariantOnHand(v);
                      return (
                        <TableRow key={id} hover>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{id}</TableCell>
                          <TableCell>{v?.sku ?? '-'}</TableCell>
                          <TableCell>{v?.product?.name ?? '-'}</TableCell>
                          <TableCell align="right">{onHand === null ? '-' : qty(onHand)}</TableCell>
                          <TableCell>
                            <Button size="small" onClick={() => pickVariant(v)} disabled={!canCreatePerm}>
                              Pick
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Paper>
            )}

            <Paper variant="outlined" sx={requestSectionSx}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <TextField
                  size="small"
                  label="Picked variant"
                  value={pickedVariant ? `${pickedVariant?.id} - ${pickedVariant?.sku ?? '-'}` : ''}
                  placeholder="Pick a variant above"
                  disabled
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  label="On hand"
                  value={pickedVariant ? (getVariantOnHand(pickedVariant) === null ? '-' : qty(getVariantOnHand(pickedVariant) as number)) : ''}
                  disabled
                  sx={{ width: 130 }}
                />
                <TextField
                  size="small"
                  label="Qty delta (+/-)"
                  value={itemQtyDelta}
                  onChange={(e) => setItemQtyDelta(e.target.value)}
                  sx={{ width: 140 }}
                  disabled={!canCreatePerm}
                />
                <TextField
                  size="small"
                  label="Unit cost (optional)"
                  value={itemUnitCost}
                  onChange={(e) => setItemUnitCost(e.target.value)}
                  sx={{ width: 180 }}
                  disabled={!canCreatePerm}
                />
                <Button variant="contained" onClick={addDraftItem} disabled={!canCreatePerm}>
                  Add item
                </Button>
              </Stack>

              <TextField
                size="small"
                label="Item notes (optional)"
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                sx={{ mt: 1 }}
                fullWidth
                disabled={!canCreatePerm}
              />
            </Paper>

            <Paper variant="outlined" sx={requestSectionSx}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">
                  Draft items: <b>{draftItems.length}</b>, total qty delta{' '}
                  <b>{qty(draftItems.reduce((sum, it) => sum + Number(it.qty_delta ?? 0), 0))}</b>
                </Typography>
                <Button size="small" onClick={clearDraft} disabled={!canCreatePerm || draftItems.length === 0}>
                  Clear draft
                </Button>
              </Stack>

              <Divider sx={{ my: 1 }} />

              {draftItems.length === 0 ? (
                <Alert severity="warning">No items yet. Add at least 1 item.</Alert>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width={130}>Variant ID</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell align="right" width={120}>On hand</TableCell>
                      <TableCell align="right" width={120}>Qty delta</TableCell>
                      <TableCell align="right" width={120}>Unit cost</TableCell>
                      <TableCell align="right" width={100}>Remove</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {draftItems.map((it) => (
                      <TableRow key={it.product_variant_id}>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{it.product_variant_id}</TableCell>
                        <TableCell>{it.sku ?? '-'}</TableCell>
                        <TableCell>{it.productName ?? '-'}</TableCell>
                        <TableCell align="right">{it.onHand === null || it.onHand === undefined ? '-' : qty(it.onHand)}</TableCell>
                        <TableCell align="right">{qty(it.qty_delta)}</TableCell>
                        <TableCell align="right">
                          {it.unit_cost === null ? '-' : Number(it.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" color="error" onClick={() => removeDraftItem(it.product_variant_id)} disabled={!canCreatePerm}>
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Paper>

            <TextField
              size="small"
              label="Draft notes (optional)"
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              multiline
              minRows={2}
              disabled={!canCreatePerm}
            />

            {createMut.isPending && <Alert severity="info">Creating draft...</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={requestDialogActionsSx}>
          <Button onClick={closeCreateDialog} disabled={createMut.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={submitCreateDraft}
            disabled={!canCreatePerm || createMut.isPending || draftItems.length === 0}
          >
            Save Draft
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer anchor="right" open={!!selected} onClose={closeDrawer}>
        <Box sx={{ width: { xs: '100vw', sm: 460 }, maxWidth: '100vw', p: { xs: 2, sm: 2.5 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Adjustment</Typography>
            <Button onClick={closeDrawer}>Close</Button>
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          {selected && (
            <Stack spacing={1.25}>
              <Typography variant="body2">
                <b>ID:</b> {selected.id}
              </Typography>
              <Typography variant="body2">
                <b>Status:</b> {selected.status}
              </Typography>
              <Typography variant="body2">
                <b>Branch:</b> {selected.branch?.name ?? selected.branch_id}
              </Typography>
              <Typography variant="body2">
                <b>Reason:</b> {selected.reason_code}
              </Typography>
              <Typography variant="body2">
                <b>Reference:</b>{' '}
                {selected.reference_no?.trim() ? selected.reference_no : `ADJ-${selected.id}`}
              </Typography>
              <Typography variant="body2">
                <b>Created by:</b> {selected.createdBy?.name ?? selected.created_by?.name ?? '-'}
              </Typography>
              <Typography variant="body2">
                <b>Notes:</b> {selected.notes?.trim() ? selected.notes : '-'}
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ pt: 0.5 }}>
                <Button variant="outlined" onClick={goToLedgerForAdjustment} disabled={!canLedgerView}>
                  View Ledger
                </Button>
              </Stack>

              <Divider sx={{ my: 1 }} />

              <Typography variant="subtitle2">Items</Typography>

              {(selected.items ?? []).length === 0 ? (
                <Alert severity="warning">No items loaded.</Alert>
              ) : (
                <Paper variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>SKU</TableCell>
                        <TableCell>Product</TableCell>
                        <TableCell align="right">Qty Δ</TableCell>
                        <TableCell align="right">Ledger</TableCell>
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {(selected.items ?? []).map((it) => (
                        <TableRow key={it.id}>
                          <TableCell>{it.variant?.sku ?? it.product_variant_id}</TableCell>
                          <TableCell>{it.variant?.product?.name ?? '-'}</TableCell>
                          <TableCell align="right">{qty(Number(it.qty_delta ?? 0))}</TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="text"
                              sx={{ textTransform: 'none' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (it.product_variant_id) goToLedgerForAdjustmentItem(it.product_variant_id);
                              }}
                              disabled={!it.product_variant_id || !canLedgerView}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}

              <Divider sx={{ my: 1 }} />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button variant="contained" disabled={!canSubmit || submitMut.isPending} onClick={() => handleTransition('submit')}>
                  Submit
                </Button>
                <Button variant="contained" disabled={!canApprove || approveMut.isPending} onClick={() => handleTransition('approve')}>
                  Approve
                </Button>
                <Button variant="contained" disabled={!canPost || postMut.isPending} onClick={() => handleTransition('post')}>
                  Post
                </Button>
              </Stack>

              {(submitMut.isPending || approveMut.isPending || postMut.isPending) && <Alert severity="info">Working…</Alert>}
            </Stack>
          )}
        </Box>
      </Drawer>

      <Snackbar
        open={snack.open}
        autoHideDuration={1800}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}



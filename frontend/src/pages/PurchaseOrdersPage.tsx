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
import { BranchSelect } from '../components/BranchSelect';
import {
  requestDialogActionsSx,
  requestDialogContentSx,
  requestDialogSx,
  requestDialogTitleSx,
  requestSectionSx,
} from '../components/requestDialogStyles';
import { authStorage } from '../auth/authStorage';
import { useAuth } from '../auth/AuthProvider';
import {
  useBranchesQuery,
  useSuppliersQuery,
  useVariantsQuery,
  usePurchaseOrdersQuery,
  usePurchaseOrderQuery,
  useCreatePurchaseOrderMutation,
  useSubmitPurchaseOrderMutation,
  useApprovePurchaseOrderMutation,
  useReceivePurchaseOrderMutation,
  useDashboardApprovalQueueQuery,
} from '../api/queries';

const STATUSES = ['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'] as const;

function toInt(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function qtyFmt(v: string | number | null | undefined) {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatStatus(value: string | null | undefined) {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  return raw
    .toLowerCase()
    .split('_')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
    .join(' ');
}

function statusChipColor(status: string): 'default' | 'info' | 'warning' | 'success' | 'error' {
  switch (status) {
    case 'DRAFT':
      return 'default';
    case 'SUBMITTED':
      return 'info';
    case 'APPROVED':
      return 'warning';
    case 'PARTIALLY_RECEIVED':
      return 'warning';
    case 'RECEIVED':
      return 'success';
    case 'CANCELLED':
      return 'error';
    default:
      return 'default';
  }
}

function getVariantLabel(v: any): string {
  const byName = String(v?.variant_name ?? '').trim();
  if (byName) return byName;

  const composed = [
    v?.flavor,
    v?.nicotine_strength,
    v?.capacity,
    v?.resistance,
    v?.color,
  ]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' / ');

  return composed || 'Standard';
}

function getVariantOnHand(v: any): number | null {
  const n = Number(v?.qty_on_hand);
  return Number.isFinite(n) ? n : null;
}

type DraftItem = {
  product_variant_id: number;
  sku?: string | null;
  productName?: string | null;
  variantName?: string | null;
  onHand?: number | null;
  qty_ordered: number;
  unit_cost: number; // required by backend (0 ok)
};

type PrettyRow = {
  id: number;
  status: string;
  isNew: boolean;
  branch: string;
  supplier: string;
  itemsCount: number;
  totalQty: number;
  notes: string;
};

export function PurchaseOrdersPage() {
  const theme = useTheme();
  const isCompactList = useMediaQuery(theme.breakpoints.down('md'));
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const canBranchView = can('BRANCH_VIEW');
  const branchesQuery = useBranchesQuery(canBranchView);

  const canPOView = can('PO_VIEW');
  const canPOCreate = can('PO_CREATE');
  const canPOApprove = can('PO_APPROVE');
  const canPOReceive = can('PO_RECEIVE');
  const canLedgerView = can('LEDGER_VIEW');

  const [searchParams, setSearchParams] = useSearchParams();

  // List filters
  const [branchId, setBranchId] = useState<number | ''>(() => {
    const url = toInt(searchParams.get('branch_id'));
    if (url) return url;
    const stored = authStorage.getLastBranchId();
    return stored ?? (user?.branch_id ?? '');
  });

  const [status, setStatus] = useState<string>(() => searchParams.get('status') ?? '');
  const [page, setPage] = useState<number>(() => toInt(searchParams.get('page')) ?? 1);
  const [seenSubmittedPoId, setSeenSubmittedPoId] = useState<number>(() =>
    authStorage.getSeenPending(user?.id).purchaseOrders
  );
  const [pendingPoBranchAnchorEl, setPendingPoBranchAnchorEl] = useState<HTMLElement | null>(null);

  // Drawer
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const poQuery = usePurchaseOrderQuery(selectedId ?? 0, !!selectedId);
  const selected = poQuery.data ?? null;
  const selectedAny = selected as any; // safe for items/relations until types are fully strict

  // Mutations
  const createMut = useCreatePurchaseOrderMutation();
  const submitMut = useSubmitPurchaseOrderMutation();
  const approveMut = useApprovePurchaseOrderMutation();
  const receiveMut = useReceivePurchaseOrderMutation();
  const approvalQueueQuery = useDashboardApprovalQueueQuery({}, canPOView);

  // Create dialog state
  const [openCreate, setOpenCreate] = useState(false);
  const [createBranch, setCreateBranch] = useState<number | ''>(branchId);
  const [createSupplierId, setCreateSupplierId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Suppliers only needed for create dialog
  const suppliersQuery = useSuppliersQuery(openCreate && canPOCreate);

  // Variant search/pick
  const [variantSearch, setVariantSearch] = useState('');
  const [variantSearchDebounced, setVariantSearchDebounced] = useState('');

  const variantLookup = useVariantsQuery(
    {
      page: 1,
      per_page: 500,
      search: variantSearchDebounced || undefined,
      branch_id: typeof createBranch === 'number' ? createBranch : undefined,
    },
    openCreate && canPOCreate && variantSearchDebounced.length >= 2
  );
  const variantOptions: any[] = variantLookup.data?.data ?? [];

  const [pickedVariant, setPickedVariant] = useState<any | null>(null);
  const [itemQty, setItemQty] = useState('1');
  const [itemUnitCost, setItemUnitCost] = useState('0');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [snack, setSnack] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showSnack = (message: string, severity: 'success' | 'error' | 'info' = 'error') => {
    setSnack({ open: true, message, severity });
  };

  useEffect(() => {
    setSeenSubmittedPoId(authStorage.getSeenPending(user?.id).purchaseOrders);
  }, [user?.id]);

  useEffect(() => {
    if (!openCreate) return;
    const t = setTimeout(() => setVariantSearchDebounced(variantSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [variantSearch, openCreate]);

  // Default branch after load
  useEffect(() => {
    if (!canBranchView) return;
    if (branchId !== '' || !branchesQuery.data?.length) return;
    const preferred = user?.branch_id ? branchesQuery.data.find((b) => b.id === user.branch_id) : null;
    const first = preferred ?? branchesQuery.data[0];
    setBranchId(first.id);
    authStorage.setLastBranchId(first.id);
  }, [canBranchView, branchId, branchesQuery.data, user?.branch_id]);

  // Sync URL
  useEffect(() => {
    const next = new URLSearchParams();
    if (branchId) next.set('branch_id', String(branchId));
    if (status) next.set('status', status);
    if (page !== 1) next.set('page', String(page));
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, status, page]);

  const listQuery = usePurchaseOrdersQuery(
    {
      page,
      branch_id: branchId === '' ? undefined : branchId,
      status: status || undefined,
    },
    branchId !== '' && canPOView
  );

  const rows = listQuery.data?.data ?? [];
  const totalPages = listQuery.data?.last_page ?? 1;

  const pretty: PrettyRow[] = useMemo(() => {
    return rows.map((po: any) => {
      const itemsCount = Number(po.items_count ?? po.items?.length ?? 0);
      const totalQty = Number(po.total_qty_ordered ?? po.total_qty ?? 0);
      const id = Number(po.id);
      const statusText = String(po.status ?? '-');
      const isNew = statusText === 'SUBMITTED' && id > seenSubmittedPoId;

      return {
        id,
        status: statusText,
        isNew,
        branch: String(po.branch?.name ?? po.branch_name ?? po.branch_id ?? '-'),
        supplier: String(po.supplier?.name ?? po.supplier_name ?? po.supplier_id ?? '-'),
        itemsCount: Number.isFinite(itemsCount) ? itemsCount : 0,
        totalQty: Number.isFinite(totalQty) ? totalQty : 0,
        notes: String(po.notes ?? ''),
      };
    });
  }, [rows, seenSubmittedPoId]);
  const pendingPoBranches = useMemo(() => {
    const queueRows = approvalQueueQuery.data?.approval_queue?.purchase_orders ?? [];
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
  }, [approvalQueueQuery.data?.approval_queue?.purchase_orders, branchesQuery.data]);
  const hasPendingPoBranchAlerts = pendingPoBranches.length > 0;
  const pendingPoBranchCountMap = useMemo(
    () =>
      pendingPoBranches.reduce<Record<number, number>>((acc, item) => {
        acc[item.branchId] = item.requestCount;
        return acc;
      }, {}),
    [pendingPoBranches]
  );
  const pendingPoDotTitle = useMemo(() => {
    if (!hasPendingPoBranchAlerts) return 'No submitted purchase orders';
    if (pendingPoBranches.length === 1) {
      return `Submitted purchase order from ${pendingPoBranches[0].branchLabel}`;
    }
    return `Submitted purchase orders from ${pendingPoBranches.length} branches`;
  }, [hasPendingPoBranchAlerts, pendingPoBranches]);

  const jumpToPendingPoBranch = (nextBranchId: number) => {
    setBranchId(nextBranchId);
    authStorage.setLastBranchId(nextBranchId);
    setStatus('SUBMITTED');
    setPage(1);
    setPendingPoBranchAnchorEl(null);
  };

  useEffect(() => {
    if (hasPendingPoBranchAlerts) return;
    setPendingPoBranchAnchorEl(null);
  }, [hasPendingPoBranchAlerts]);

  const openPurchaseOrderRow = (row: PrettyRow) => {
    if (row.status === 'SUBMITTED') {
      const next = authStorage.markSeenPending(user?.id, 'purchaseOrders', row.id);
      setSeenSubmittedPoId(next.purchaseOrders);
    }
    setSelectedId(row.id);
  };

  const openNew = () => {
    if (!canPOCreate) {
      showSnack('Not authorized: PO_CREATE');
      return;
    }

    setCreateBranch(branchId === '' ? '' : branchId);
    setCreateSupplierId('');
    setNotes('');

    setVariantSearch('');
    setVariantSearchDebounced('');
    setPickedVariant(null);
    setItemQty('1');
    setItemUnitCost('0');
    setDraftItems([]);

    setOpenCreate(true);
  };

  const pickVariant = (v: any) => {
    setPickedVariant(v);
    setVariantSearch(v?.sku ?? v?.barcode ?? String(v?.id ?? ''));
  };

  const addItem = () => {
    const id = Number(pickedVariant?.id);
    if (!Number.isFinite(id) || id <= 0) {
      showSnack('Pick a variant first.');
      return;
    }

    const q = Number(itemQty);
    if (!Number.isFinite(q) || q <= 0) {
      showSnack('Qty must be > 0.');
      return;
    }

    const rawCost = itemUnitCost.trim();
    const cost = rawCost === '' ? 0 : Number(rawCost);
    if (!Number.isFinite(cost) || cost < 0) {
      showSnack('Unit cost must be a valid number (>= 0).');
      return;
    }

    const sku = pickedVariant?.sku ?? null;
    const productName = pickedVariant?.product?.name ?? null;
    const variantName = getVariantLabel(pickedVariant);
    const onHand = getVariantOnHand(pickedVariant);

    setDraftItems((prev) => {
      const idx = prev.findIndex((x) => x.product_variant_id === id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          sku,
          productName,
          variantName,
          onHand,
          qty_ordered: next[idx].qty_ordered + q,
          unit_cost: cost,
        };
        return next;
      }
      return [
        ...prev,
        {
          product_variant_id: id,
          sku,
          productName,
          variantName,
          onHand,
          qty_ordered: q,
          unit_cost: cost,
        },
      ];
    });

    setItemQty('1');
    setPickedVariant(null);
  };

  const removeDraftItem = (variantId: number) => {
    setDraftItems((prev) => prev.filter((x) => x.product_variant_id !== variantId));
  };

  const clearDraft = () => setDraftItems([]);

  const submitCreate = async () => {
    try {
      if (!canPOCreate) {
        showSnack('Not authorized: PO_CREATE');
        return;
      }

      const b = typeof createBranch === 'number' ? createBranch : null;
      if (!b) {
        showSnack('Select a branch.');
        return;
      }

      const s = typeof createSupplierId === 'number' ? createSupplierId : null;
      if (!s) {
        showSnack('Select a supplier.');
        return;
      }

      if (draftItems.length === 0) {
        showSnack('Add at least 1 item.');
        return;
      }

      const payload = {
        branch_id: b,
        supplier_id: s,
        notes: notes.trim() ? notes.trim() : null,
        items: draftItems.map((it) => ({
          product_variant_id: it.product_variant_id,
          qty_ordered: it.qty_ordered,
          unit_cost: it.unit_cost,
          notes: null,
        })),
      };

      const created = await createMut.mutateAsync(payload as any);
      setOpenCreate(false);
      setSelectedId((created as any).id);
      listQuery.refetch();
      showSnack(`PO #${(created as any).id} created.`, 'success');
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        (e?.response?.data?.errors ? JSON.stringify(e.response.data.errors, null, 2) : null) ??
        'Failed to create PO.';
      showSnack(msg);
    }
  };

  const closeDrawer = () => setSelectedId(null);

  const canSubmit = canPOCreate && selected?.status === 'DRAFT';
  const canApprove = canPOApprove && selected?.status === 'SUBMITTED';
  const canReceive = canPOReceive && (selected?.status === 'APPROVED' || selected?.status === 'PARTIALLY_RECEIVED');

  const buildReceiveLines = () => {
    const items = selectedAny?.items ?? [];
    return items
      .map((it: any) => {
        const ordered = toNum(it.qty_ordered ?? it.qty ?? 0);
        const received = toNum(it.qty_received ?? 0);
        const remaining = ordered - received;

        return {
          // backend in this project accepts product_variant_id for receive lines
          product_variant_id: Number(it.product_variant_id ?? it.variant_id ?? it.variant?.id),
          qty_received: remaining,
        };
      })
      .filter((l: any) => Number.isFinite(l.product_variant_id) && l.product_variant_id > 0 && l.qty_received > 0);
  };

  const runAction = async (action: 'submit' | 'approve' | 'receive') => {
    if (!selected) return;

    try {
      if (action === 'submit') {
        if (!canPOCreate) {
          showSnack('Not authorized: PO_CREATE');
          return;
        }
        await submitMut.mutateAsync(selected.id);
      }

      if (action === 'approve') {
        if (!canPOApprove) {
          showSnack('Not authorized: PO_APPROVE');
          return;
        }
        await approveMut.mutateAsync(selected.id);
      }

      if (action === 'receive') {
        if (!canPOReceive) {
          showSnack('Not authorized: PO_RECEIVE');
          return;
        }

        const lines = buildReceiveLines();
        if (lines.length === 0) {
          showSnack('Nothing to receive (all items already received).');
          return;
        }

        await receiveMut.mutateAsync({
          id: selected.id,
          payload: { lines, notes: null } as any,
        });
      }

      poQuery.refetch();
      listQuery.refetch();
      showSnack(`PO ${action} successful.`, 'success');
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        (e?.response?.data?.errors ? JSON.stringify(e.response.data.errors, null, 2) : null) ??
        `Failed to ${action} PO.`;
      showSnack(msg);
    }
  };

  const goToLedgerForPO = () => {
    if (!selected) return;
    if (!canLedgerView) {
      showSnack('Not authorized: LEDGER_VIEW');
      return;
    }

    const params = new URLSearchParams();
    params.set('branch_id', String(selectedAny?.branch_id ?? branchId ?? ''));
    params.set('ref_type', 'purchase_orders');
    params.set('ref_id', String(selected.id));
    params.set('search', `PO #${selected.id}`);
    navigate(`/ledger?${params.toString()}`);
  };

  const draftTotalQty = draftItems.reduce((sum, it) => sum + it.qty_ordered, 0);

  const canCreate =
    canPOCreate &&
    typeof createBranch === 'number' &&
    typeof createSupplierId === 'number' &&
    draftItems.length > 0 &&
    !createMut.isPending;
  const branchLabel =
    user?.branch?.name ??
    (typeof branchId === 'number' ? `Branch #${branchId}` : 'No branch assigned');
  const createBranchLabel =
    user?.branch?.name ??
    (typeof createBranch === 'number' ? `Branch #${createBranch}` : branchLabel);
  const selectedItems: any[] = selectedAny?.items ?? [];
  const selectedQtyOrdered = selectedItems.reduce((sum, it) => sum + toNum(it.qty_ordered ?? it.qty), 0);
  const selectedQtyReceived = selectedItems.reduce((sum, it) => sum + toNum(it.qty_received ?? 0), 0);

  if (!canPOView) {
    return <Alert severity="error">Not authorized to view Purchase Orders (PO_VIEW).</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        spacing={{ xs: 1, sm: 0 }}
      >
        <Typography variant="h5">Purchase Orders</Typography>
        <Button
          variant="contained"
          onClick={openNew}
          sx={{ textTransform: 'none', alignSelf: { xs: 'flex-end', sm: 'auto' } }}
          disabled={!canPOCreate}
        >
          New PO
        </Button>
      </Stack>

      {!canPOCreate && !canPOApprove && !canPOReceive && (
        <Alert severity="info">You have view-only access to purchase orders.</Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <Box sx={{ minWidth: 260, flex: 1 }}>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Branch
          </Typography>
          {canBranchView ? (
            <BranchSelect
              branches={branchesQuery.data ?? []}
              value={branchId}
              onChange={(id) => {
                setBranchId(id);
                authStorage.setLastBranchId(id);
                setPage(1);
              }}
              showAlertDot={hasPendingPoBranchAlerts}
              alertDotTitle={pendingPoDotTitle}
              onAlertDotClick={(event) => setPendingPoBranchAnchorEl(event.currentTarget)}
              showBranchAlertDots
              alertCountsByBranchId={pendingPoBranchCountMap}
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
          }}
          sx={{ width: { xs: '100%', md: 240 } }}
        >
          {STATUSES.map((s) => (
            <MenuItem key={s || 'ALL'} value={s}>
              {s ? s : 'All'}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Menu
        anchorEl={pendingPoBranchAnchorEl}
        open={Boolean(pendingPoBranchAnchorEl) && hasPendingPoBranchAlerts}
        onClose={() => setPendingPoBranchAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { minWidth: 260 } }}
      >
        {pendingPoBranches.map((item) => (
          <MenuItem
            key={item.branchId}
            selected={branchId === item.branchId}
            onClick={() => jumpToPendingPoBranch(item.branchId)}
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
          {canBranchView ? 'Select a branch.' : 'No branch assigned to your account.'}
        </Alert>
      ) : listQuery.isLoading ? (
        <Alert severity="info">Loading purchase orders…</Alert>
      ) : listQuery.isError ? (
        <Alert severity="error">Failed to load purchase orders.</Alert>
      ) : pretty.length === 0 ? (
        <Alert severity="warning">No purchase orders found.</Alert>
      ) : isCompactList ? (
        <Stack spacing={1}>
          {pretty.map((r) => (
            <Paper
              key={r.id}
              variant="outlined"
              role="button"
              tabIndex={0}
              onClick={() => openPurchaseOrderRow(r)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openPurchaseOrderRow(r);
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
                    PO #{r.id}
                  </Typography>
                  <Stack direction="row" spacing={0.6} alignItems="center">
                    <Chip size="small" color={statusChipColor(r.status)} label={formatStatus(r.status)} />
                    {r.isNew && <Chip size="small" color="error" label="NEW" sx={{ height: 20, fontSize: 10 }} />}
                  </Stack>
                </Stack>
                <Typography variant="body2">Supplier: {r.supplier}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Branch: {r.branch}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Lines: {r.itemsCount} | Qty Ordered: {qtyFmt(r.totalQty)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Notes: {r.notes.trim() ? r.notes : '-'}
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
                <TableCell>Status</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell>Branch</TableCell>
                <TableCell align="right">Lines</TableCell>
                <TableCell align="right">Qty Ordered</TableCell>
                <TableCell>Notes</TableCell>
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
                  onClick={() => openPurchaseOrderRow(r)}
                >
                  <TableCell sx={{ fontFamily: 'monospace' }}>#{r.id}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Chip size="small" color={statusChipColor(r.status)} label={formatStatus(r.status)} />
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
                  <TableCell>{r.supplier}</TableCell>
                  <TableCell>{r.branch}</TableCell>
                  <TableCell align="right">{r.itemsCount}</TableCell>
                  <TableCell align="right">{qtyFmt(r.totalQty)}</TableCell>
                  <TableCell sx={{ maxWidth: 260 }}>
                    <Typography variant="body2" noWrap sx={{ opacity: r.notes.trim() ? 0.9 : 0.65 }}>
                      {r.notes.trim() ? r.notes : '-'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => setPage(p)}
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* CREATE PO */}
      <Dialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        maxWidth="md"
        fullWidth
        disableScrollLock
        sx={requestDialogSx}
      >
        <DialogTitle sx={requestDialogTitleSx}>
          <Stack spacing={0.35}>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
              New Purchase Order
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Prepare supplier replenishment with clean variant-level quantities and costs.
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={requestDialogContentSx}>
          <Stack spacing={1.5}>
            <Paper variant="outlined" sx={requestSectionSx}>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Branch
              </Typography>
              {canBranchView ? (
                <BranchSelect
                  branches={branchesQuery.data ?? []}
                  value={createBranch}
                  onChange={(id) => setCreateBranch(id)}
                />
              ) : (
                <TextField size="small" label="Branch" value={createBranchLabel} disabled fullWidth />
              )}
            </Paper>

            <Paper variant="outlined" sx={requestSectionSx}>
              <TextField
                select
                size="small"
                label="Supplier"
                value={createSupplierId}
                onChange={(e) => setCreateSupplierId(e.target.value === '' ? '' : Number(e.target.value))}
                helperText={suppliersQuery.isError ? 'Failed to load suppliers.' : 'Required'}
                disabled={!canPOCreate}
                fullWidth
              >
                <MenuItem value="">Select supplier</MenuItem>
                {(suppliersQuery.data ?? []).map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </TextField>
            </Paper>

            <TextField
              size="small"
              label="Scan/search SKU, barcode, or variant"
              value={variantSearch}
              onChange={(e) => setVariantSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const first = variantOptions[0];
                  if (first) pickVariant(first);
                }
              }}
              helperText="Tip: press Enter to auto-pick the first match. Product is the item family; Variant is the exact sellable option. On hand uses the selected branch."
              disabled={!canPOCreate}
            />

            {variantSearchDebounced.length >= 2 && variantLookup.isLoading && (
              <Alert severity="info">Searching variants…</Alert>
            )}

            {variantSearchDebounced.length >= 2 && !variantLookup.isLoading && variantOptions.length > 0 && (
              <Paper variant="outlined" sx={[requestSectionSx, { maxHeight: 220, overflow: 'auto', p: 0 }]}>
                <Box sx={{ px: 1.5, pt: 1 }}>
                  <Typography variant="caption" sx={{ opacity: 0.75 }}>
                    Search Results - pick the exact variant
                  </Typography>
                </Box>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell width={110}>ID</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell>Variant</TableCell>
                      <TableCell align="right" width={120}>On hand</TableCell>
                      <TableCell width={90} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {variantOptions.map((v: any) => {
                      const id = Number(v?.id);
                      const onHand = getVariantOnHand(v);
                      return (
                        <TableRow key={id} hover>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{id}</TableCell>
                          <TableCell>{v?.sku ?? '-'}</TableCell>
                          <TableCell>{v?.product?.name ?? '-'}</TableCell>
                          <TableCell>{getVariantLabel(v)}</TableCell>
                          <TableCell align="right">{onHand === null ? '-' : qtyFmt(onHand)}</TableCell>
                          <TableCell>
                            <Button size="small" onClick={() => pickVariant(v)} sx={{ textTransform: 'none' }}>
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

            {variantSearchDebounced.length >= 2 && !variantLookup.isLoading && variantOptions.length === 0 && (
              <Alert severity="warning">
                No variants matched this search. Try SKU, barcode, or part of the variant name.
              </Alert>
            )}

            <Paper variant="outlined" sx={requestSectionSx}>
              <Stack spacing={1}>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Selected Item (for this PO line)
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    size="small"
                    label="Product"
                    value={pickedVariant?.product?.name ?? ''}
                    placeholder="Pick from search results"
                    disabled
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    size="small"
                    label="Variant"
                    value={pickedVariant ? getVariantLabel(pickedVariant) : ''}
                    placeholder="Exact option (flavor/color/spec)"
                    disabled
                    sx={{ flex: 1 }}
                  />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                  <TextField
                    size="small"
                    label="SKU"
                    value={pickedVariant?.sku ?? ''}
                    placeholder="SKU"
                    disabled
                    sx={{ width: { xs: '100%', sm: 220 } }}
                  />
                  <TextField
                    size="small"
                    label="On hand"
                    value={pickedVariant ? (getVariantOnHand(pickedVariant) === null ? '-' : qtyFmt(getVariantOnHand(pickedVariant) as number)) : ''}
                    disabled
                    sx={{ width: { xs: '100%', sm: 130 } }}
                  />
                  <TextField
                    size="small"
                    label="Qty to order"
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                    sx={{ width: { xs: '100%', sm: 140 } }}
                    disabled={!canPOCreate}
                  />
                  <TextField
                    size="small"
                    label="Unit cost (required, 0 ok)"
                    value={itemUnitCost}
                    onChange={(e) => setItemUnitCost(e.target.value)}
                    sx={{ width: { xs: '100%', sm: 220 } }}
                    disabled={!canPOCreate}
                  />
                  <Button
                    variant="contained"
                    onClick={addItem}
                    sx={{ textTransform: 'none', alignSelf: { xs: 'stretch', sm: 'auto' } }}
                    disabled={!canPOCreate || !pickedVariant}
                  >
                    Add item
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={requestSectionSx}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">
                  Draft: <b>{draftItems.length}</b> item(s), total qty <b>{qtyFmt(draftTotalQty)}</b>
                </Typography>
                <Button size="small" onClick={clearDraft} sx={{ textTransform: 'none' }} disabled={!canPOCreate}>
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
                      <TableCell width={140}>Variant ID</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell>Variant</TableCell>
                      <TableCell align="right" width={120}>On hand</TableCell>
                      <TableCell align="right" width={120}>
                        Qty
                      </TableCell>
                      <TableCell align="right" width={140}>
                        Unit cost
                      </TableCell>
                      <TableCell align="right" width={90}>
                        Remove
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {draftItems.map((it) => (
                      <TableRow key={it.product_variant_id}>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{it.product_variant_id}</TableCell>
                        <TableCell>{it.sku ?? '-'}</TableCell>
                        <TableCell>{it.productName ?? '-'}</TableCell>
                        <TableCell>{it.variantName ?? '-'}</TableCell>
                        <TableCell align="right">{it.onHand === null || it.onHand === undefined ? '-' : qtyFmt(it.onHand)}</TableCell>
                        <TableCell align="right">{qtyFmt(it.qty_ordered)}</TableCell>
                        <TableCell align="right">{qtyFmt(it.unit_cost)}</TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            color="error"
                            onClick={() => removeDraftItem(it.product_variant_id)}
                            sx={{ textTransform: 'none' }}
                            disabled={!canPOCreate}
                          >
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
              label="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              minRows={2}
              disabled={!canPOCreate}
            />

            {createMut.isError && <Alert severity="error">Failed to create PO.</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={requestDialogActionsSx}>
          <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitCreate} disabled={!canCreate}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* DRAWER */}
      <Drawer anchor="right" open={!!selectedId} onClose={closeDrawer} ModalProps={{ disableScrollLock: true }}>
        <Box sx={{ width: { xs: '100vw', sm: 520 }, maxWidth: '100vw', p: { xs: 2, sm: 2.5 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Purchase Order</Typography>
            <Button onClick={closeDrawer}>Close</Button>
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          {poQuery.isLoading ? (
            <Alert severity="info">Loading PO…</Alert>
          ) : poQuery.isError ? (
            <Alert severity="error">Failed to load PO.</Alert>
          ) : !selected ? (
            <Alert severity="warning">No PO selected.</Alert>
          ) : (
            <Stack spacing={1.25}>
              <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Stack spacing={0.8}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ gap: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                      PO #{selected.id}
                    </Typography>
                    <Chip size="small" color={statusChipColor(selected.status)} label={formatStatus(selected.status)} />
                  </Stack>
                  <Typography variant="body2">
                    <b>Supplier:</b> {selectedAny?.supplier?.name ?? selectedAny?.supplier_id ?? '-'}
                  </Typography>
                  <Typography variant="body2">
                    <b>Branch:</b> {selectedAny?.branch?.name ?? selectedAny?.branch_id ?? '-'}
                  </Typography>
                  <Typography variant="body2">
                    <b>Lines:</b> {selectedItems.length} | <b>Ordered:</b> {qtyFmt(selectedQtyOrdered)} |{' '}
                    <b>Received:</b> {qtyFmt(selectedQtyReceived)}
                  </Typography>
                  <Typography variant="body2">
                    <b>Notes:</b> {String(selectedAny?.notes ?? '').trim() ? selectedAny?.notes : '-'}
                  </Typography>
                </Stack>
              </Paper>

              <Stack direction="row" spacing={1} sx={{ pt: 0.5, flexWrap: 'wrap' }}>
                {canLedgerView && (
                  <Button variant="outlined" onClick={goToLedgerForPO} sx={{ textTransform: 'none' }}>
                    View Ledger
                  </Button>
                )}
              </Stack>

              <Divider sx={{ my: 1 }} />

              <Typography variant="subtitle2">Workflow</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {canPOCreate && (
                  <Button
                    variant="contained"
                    disabled={!canSubmit || submitMut.isPending}
                    onClick={() => runAction('submit')}
                  >
                    Submit
                  </Button>
                )}
                {canPOApprove && (
                  <Button
                    variant="contained"
                    disabled={!canApprove || approveMut.isPending}
                    onClick={() => runAction('approve')}
                  >
                    Approve
                  </Button>
                )}
                {canPOReceive && (
                  <Button
                    variant="contained"
                    disabled={!canReceive || receiveMut.isPending}
                    onClick={() => runAction('receive')}
                  >
                    Receive
                  </Button>
                )}
              </Stack>

              {(submitMut.isPending || approveMut.isPending || receiveMut.isPending) && (
                <Alert severity="info">Working…</Alert>
              )}

              <Divider sx={{ my: 1 }} />

              <Typography variant="subtitle2">Items (Product + Variant)</Typography>
              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                Product is the item family. Variant is the exact option being ordered.
              </Typography>
              {selectedItems.length === 0 ? (
                <Alert severity="warning">No items loaded.</Alert>
              ) : (
                <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 760 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell width={140}>Variant ID</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell>Product</TableCell>
                        <TableCell>Variant</TableCell>
                        <TableCell align="right" width={120}>
                          Ordered
                        </TableCell>
                        <TableCell align="right" width={120}>
                          Received
                        </TableCell>
                        <TableCell align="right" width={120}>
                          Remaining
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedItems.map((it: any) => {
                        const variantRef = it.variant ?? it;
                        const ordered = toNum(it.qty_ordered ?? it.qty);
                        const received = toNum(it.qty_received ?? 0);
                        const remaining = Math.max(ordered - received, 0);

                        return (
                          <TableRow key={it.id ?? it.product_variant_id}>
                            <TableCell sx={{ fontFamily: 'monospace' }}>
                              {it.product_variant_id ?? it.variant_id ?? '-'}
                            </TableCell>
                            <TableCell>{variantRef?.sku ?? it.sku ?? '-'}</TableCell>
                            <TableCell>{variantRef?.product?.name ?? '-'}</TableCell>
                            <TableCell>{getVariantLabel(variantRef)}</TableCell>
                            <TableCell align="right">{qtyFmt(ordered)}</TableCell>
                            <TableCell align="right">{qtyFmt(received)}</TableCell>
                            <TableCell align="right">{qtyFmt(remaining)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Paper>
              )}
            </Stack>
          )}
        </Box>
      </Drawer>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return;
          setSnack((prev) => ({ ...prev, open: false }));
        }}
      >
        <Alert
          onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
          severity={snack.severity}
          sx={{ width: '100%' }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}



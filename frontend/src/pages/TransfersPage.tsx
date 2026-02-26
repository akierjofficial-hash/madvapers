import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
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
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { authStorage } from '../auth/authStorage';
import { BranchSelect } from '../components/BranchSelect';
import {
  useApproveTransferMutation,
  useBranchesQuery,
  useCancelTransferMutation,
  useCreateTransferMutation,
  useDispatchTransferMutation,
  useReceiveTransferMutation,
  useRequestTransferMutation,
  useTransferQuery,
  useTransfersQuery,
  useVariantsQuery,
} from '../api/queries';
import type { Transfer } from '../api/transfers';

const STATUSES = ['', 'DRAFT', 'REQUESTED', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'] as const;

function toInt(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function qtyFmt(v: string | number | null | undefined) {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

type DraftItem = {
  product_variant_id: number;
  qty: number;
  sku?: string | null;
  productName?: string | null;
};

export function TransfersPage() {
  const { user, can } = useAuth();
  const canBranchView = can('BRANCH_VIEW');
  const canTransferView = can('TRANSFER_VIEW');
  const canTransferCreate = can('TRANSFER_CREATE');
  const canTransferApprove = can('TRANSFER_APPROVE');
  const canTransferDispatch = can('TRANSFER_DISPATCH');
  const canTransferReceive = can('TRANSFER_RECEIVE');
  const canLedgerView = can('LEDGER_VIEW');
  const canMutateTransfers =
    canTransferCreate || canTransferApprove || canTransferDispatch || canTransferReceive;

  const navigate = useNavigate();
  const branchesQuery = useBranchesQuery(canBranchView);
  const [searchParams, setSearchParams] = useSearchParams();

  const createMut = useCreateTransferMutation();
  const requestMut = useRequestTransferMutation();
  const approveMut = useApproveTransferMutation();
  const dispatchMut = useDispatchTransferMutation();
  const receiveMut = useReceiveTransferMutation();
  const cancelMut = useCancelTransferMutation();

  // Filters (list)
  const [fromBranchId, setFromBranchId] = useState<number | ''>(() => {
    const fromUrl = toInt(searchParams.get('from_branch_id'));
    if (fromUrl) return fromUrl;
    const fromStorage = authStorage.getLastBranchId();
    return fromStorage ?? (user?.branch_id ?? '');
  });

  const [toBranchId, setToBranchId] = useState<number | ''>(() => {
    const toUrl = toInt(searchParams.get('to_branch_id'));
    return toUrl ?? '';
  });

  const [status, setStatus] = useState<string>(() => searchParams.get('status') ?? '');
  const [page, setPage] = useState<number>(() => toInt(searchParams.get('page')) ?? 1);

  // Drawer state
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const transferQuery = useTransferQuery(selectedId ?? 0, !!selectedId && canTransferView);
  const selected = transferQuery.data ?? null;

  // Create dialog state
  const [openCreate, setOpenCreate] = useState(false);
  const [createFrom, setCreateFrom] = useState<number | ''>(fromBranchId);
  const [createTo, setCreateTo] = useState<number | ''>('');
  const [createNotes, setCreateNotes] = useState<string>('');

  // Variant picker state
  const [variantSearch, setVariantSearch] = useState('');
  const [variantSearchDebounced, setVariantSearchDebounced] = useState('');
  const [createVariantId, setCreateVariantId] = useState<string>(''); // fallback/manual
  const [createQty, setCreateQty] = useState<string>('1');

  const [pickedVariant, setPickedVariant] = useState<{
    id: number;
    sku?: string | null;
    productName?: string | null;
  } | null>(null);

  // Draft items (multi-item support)
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
    if (!openCreate) return;
    const t = setTimeout(() => setVariantSearchDebounced(variantSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [variantSearch, openCreate]);

  const variantLookupQuery = useVariantsQuery(
    { page: 1, search: variantSearchDebounced || undefined },
    openCreate && canTransferCreate && variantSearchDebounced.length >= 2
  );
  const variantOptions: any[] = variantLookupQuery.data?.data ?? [];

  const pickVariant = (v: any) => {
    const id = Number(v?.id);
    if (!Number.isFinite(id) || id <= 0) return;

    const sku = v?.sku ?? null;
    const productName = v?.product?.name ?? null;

    setPickedVariant({ id, sku, productName });
    setCreateVariantId(String(id));
    setVariantSearch(sku ?? String(id));
  };

  const clearPickedVariant = () => {
    setPickedVariant(null);
    setCreateVariantId('');
  };

  const addDraftItem = () => {
    if (!canTransferCreate) {
      showSnack('Not authorized: TRANSFER_CREATE');
      return;
    }

    const variantId = Number(createVariantId);
    const qty = Number(createQty);

    if (!Number.isFinite(variantId) || variantId <= 0) {
      showSnack('Select a variant (or enter a valid Variant ID).');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      showSnack('Enter a valid Qty (> 0).');
      return;
    }

    const fromPicked =
      pickedVariant?.id === variantId
        ? { sku: pickedVariant.sku ?? null, productName: pickedVariant.productName ?? null }
        : null;

    const fromLookup = (() => {
      const found = variantOptions.find((x) => Number(x?.id) === variantId);
      if (!found) return null;
      return { sku: found?.sku ?? null, productName: found?.product?.name ?? null };
    })();

    const meta = fromPicked ?? fromLookup ?? { sku: null, productName: null };

    setDraftItems((prev) => {
      const idx = prev.findIndex((x) => x.product_variant_id === variantId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, { product_variant_id: variantId, qty, sku: meta.sku, productName: meta.productName }];
    });

    setCreateQty('1');
  };

  const removeDraftItem = (variantId: number) => {
    setDraftItems((prev) => prev.filter((x) => x.product_variant_id !== variantId));
  };

  const clearDraft = () => setDraftItems([]);

  const draftTotals = useMemo(() => {
    const itemsCount = draftItems.length;
    const totalQty = draftItems.reduce((sum, it) => sum + Number(it.qty ?? 0), 0);
    return { itemsCount, totalQty };
  }, [draftItems]);

  /**
   * ✅ FIX #1: Hydrate safely.
   * - If URL does NOT include from_branch_id, DO NOT overwrite fromBranchId.
   * - This prevents the blank->filled flicker when navigating to /transfers (no query).
   */
  useEffect(() => {
    const spFrom = searchParams.get('from_branch_id');
    if (spFrom !== null) {
      const urlFrom = toInt(spFrom);
      const nextFrom = (urlFrom ?? '') as any;
      if (nextFrom !== fromBranchId) setFromBranchId(nextFrom);
    }

    const spTo = searchParams.get('to_branch_id');
    if (spTo !== null) {
      const urlTo = toInt(spTo);
      const nextTo = (urlTo ?? '') as any;
      if (nextTo !== toBranchId) setToBranchId(nextTo);
    } else if (toBranchId !== '') {
      setToBranchId('');
    }

    const spStatus = searchParams.get('status');
    const nextStatus = spStatus ?? '';
    if (nextStatus !== status) setStatus(nextStatus);

    const spPage = searchParams.get('page');
    const nextPage = spPage ? toInt(spPage) ?? 1 : 1;
    if (nextPage !== page) setPage(nextPage);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Default branch once branches load
  useEffect(() => {
    if (!canBranchView) return;
    if (fromBranchId !== '' || !branchesQuery.data?.length) return;
    const preferred = user?.branch_id ? branchesQuery.data.find((b) => b.id === user.branch_id) : null;
    const first = preferred ?? branchesQuery.data[0];
    setFromBranchId(first.id);
    authStorage.setLastBranchId(first.id);
  }, [canBranchView, fromBranchId, branchesQuery.data, user?.branch_id]);

  // Sync to URL
  useEffect(() => {
    const next = new URLSearchParams();
    if (fromBranchId) next.set('from_branch_id', String(fromBranchId));
    if (toBranchId) next.set('to_branch_id', String(toBranchId));
    if (status) next.set('status', status);
    if (page !== 1) next.set('page', String(page));

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromBranchId, toBranchId, status, page]);

  /**
   * ✅ FIX #2: Don’t load /transfers until fromBranchId is known.
   * Prevents the “unfiltered first request then filtered request” redraw.
   */
  const transfersQuery = useTransfersQuery(
    {
      page,
      from_branch_id: fromBranchId === '' ? undefined : fromBranchId,
      to_branch_id: toBranchId === '' ? undefined : toBranchId,
      status: status || undefined,
    },
    fromBranchId !== '' && canTransferView
  );

  const rows = transfersQuery.data?.data ?? [];
  const totalPages = transfersQuery.data?.last_page ?? 1;

  const pretty = useMemo(() => {
    return rows.map((t: Transfer) => {
      const items = (t as any).items ?? [];
      const itemsCount = items.length;
      const totalQty = items.reduce((sum: number, it: any) => sum + Number(it.qty ?? 0), 0);

      return {
        id: t.id,
        status: (t as any).status ?? '-',
        from: (t as any).fromBranch?.name ?? (t as any).from_branch_id,
        to: (t as any).toBranch?.name ?? (t as any).to_branch_id,
        itemsCount,
        totalQty,
        notes: (t as any).notes ?? '',
      };
    });
  }, [rows]);

  const openNewTransfer = () => {
    if (!canTransferCreate) {
      showSnack('Not authorized: TRANSFER_CREATE');
      return;
    }

    setCreateFrom(fromBranchId === '' ? '' : fromBranchId);
    setCreateTo('');
    setCreateNotes('');

    setVariantSearch('');
    setVariantSearchDebounced('');
    setCreateVariantId('');
    setCreateQty('1');
    setPickedVariant(null);
    setDraftItems([]);

    setOpenCreate(true);
  };

  const submitCreate = async () => {
    if (!canTransferCreate) {
      showSnack('Not authorized: TRANSFER_CREATE');
      return;
    }

    const fromId = typeof createFrom === 'number' ? createFrom : null;
    const toId = typeof createTo === 'number' ? createTo : null;

    if (!canBranchView && !toId) {
      showSnack('Destination branch selection requires BRANCH_VIEW.');
      return;
    }
    if (!fromId || !toId) {
      showSnack('Select From/To branches.');
      return;
    }
    if (fromId === toId) {
      showSnack('From and To branch must be different.');
      return;
    }
    if (draftItems.length < 1) {
      showSnack('Add at least 1 item to the draft.');
      return;
    }

    try {
      const created = await createMut.mutateAsync({
        from_branch_id: fromId,
        to_branch_id: toId,
        notes: createNotes?.trim() ? createNotes.trim() : null,
        items: draftItems.map((it) => ({ product_variant_id: it.product_variant_id, qty: it.qty })),
      });

      setOpenCreate(false);
      setSelectedId(created.id);
      showSnack(`Transfer #${created.id} created.`, 'success');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to create transfer.';
      showSnack(msg);
    }
  };

  const closeDrawer = () => setSelectedId(null);

  const canRequest = canTransferCreate && selected?.status === 'DRAFT';
  const canApprove = canTransferApprove && selected?.status === 'REQUESTED';
  const canDispatch = canTransferDispatch && selected?.status === 'APPROVED';
  const canReceive = canTransferReceive && selected?.status === 'IN_TRANSIT';
  const canCancel =
    canTransferCreate && !!selected?.status && !['RECEIVED', 'CANCELLED'].includes(selected.status);

  const runAction = async (action: 'request' | 'approve' | 'dispatch' | 'receive' | 'cancel') => {
    if (!selected) return;

    if ((action === 'request' || action === 'cancel') && !canTransferCreate) {
      showSnack('Not authorized: TRANSFER_CREATE');
      return;
    }
    if (action === 'approve' && !canTransferApprove) {
      showSnack('Not authorized: TRANSFER_APPROVE');
      return;
    }
    if (action === 'dispatch' && !canTransferDispatch) {
      showSnack('Not authorized: TRANSFER_DISPATCH');
      return;
    }
    if (action === 'receive' && !canTransferReceive) {
      showSnack('Not authorized: TRANSFER_RECEIVE');
      return;
    }

    try {
      if (action === 'request') await requestMut.mutateAsync(selected.id);
      if (action === 'approve') await approveMut.mutateAsync(selected.id);
      if (action === 'dispatch') await dispatchMut.mutateAsync(selected.id);
      if (action === 'receive') await receiveMut.mutateAsync(selected.id);
      if (action === 'cancel') await cancelMut.mutateAsync(selected.id);
      transferQuery.refetch();
      transfersQuery.refetch();
      showSnack(`Transfer ${action} successful.`, 'success');
    } catch (e: any) {
      const msg = e?.response?.data?.message || `Failed to ${action} transfer.`;
      showSnack(msg);
    }
  };

  const goToLedgerForTransferFrom = () => {
    if (!selected) return;
    if (!canLedgerView) {
      showSnack('Not authorized: LEDGER_VIEW');
      return;
    }

    const branch = selected.from_branch_id ?? (typeof fromBranchId === 'number' ? fromBranchId : null);
    if (!branch) return;

    const params = new URLSearchParams();
    params.set('branch_id', String(branch));
    params.set('movement_type', 'TRANSFER_OUT');
    params.set('ref_type', 'transfers');
    params.set('ref_id', String(selected.id));
    params.set('search', `Transfer #${selected.id}`);

    navigate(`/ledger?${params.toString()}`);
  };

  const goToLedgerForTransferTo = () => {
    if (!selected) return;
    if (!canLedgerView) {
      showSnack('Not authorized: LEDGER_VIEW');
      return;
    }

    const branch = selected.to_branch_id ?? (typeof toBranchId === 'number' ? toBranchId : null);
    if (!branch) return;

    const params = new URLSearchParams();
    params.set('branch_id', String(branch));
    params.set('movement_type', 'TRANSFER_IN');
    params.set('ref_type', 'transfers');
    params.set('ref_id', String(selected.id));
    params.set('search', `Transfer #${selected.id}`);

    navigate(`/ledger?${params.toString()}`);
  };

  const copyVariantId = async (id: number) => {
    try {
      await navigator.clipboard.writeText(String(id));
    } catch {
      window.prompt('Copy Variant ID:', String(id));
    }
  };
  const fromBranchLabel =
    user?.branch?.name ??
    (typeof fromBranchId === 'number' ? `Branch #${fromBranchId}` : 'No branch assigned');
  const createFromBranchLabel =
    user?.branch?.name ??
    (typeof createFrom === 'number' ? `Branch #${createFrom}` : fromBranchLabel);
  const toBranchLabel = typeof toBranchId === 'number' ? `Branch #${toBranchId}` : 'Any';
  const createToBranchLabel =
    typeof createTo === 'number' ? `Branch #${createTo}` : 'Select a destination branch';

  if (!canTransferView) {
    return <Alert severity="error">Not authorized to view Transfers (TRANSFER_VIEW).</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h5">Transfers</Typography>

        <Button
          variant="contained"
          onClick={openNewTransfer}
          sx={{ textTransform: 'none' }}
          disabled={!canTransferCreate}
        >
          New Transfer
        </Button>
      </Stack>

      {!canMutateTransfers && <Alert severity="info">You have view-only access to transfers.</Alert>}

      {canBranchView && branchesQuery.isError && <Alert severity="error">Failed to load branches.</Alert>}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <Box sx={{ minWidth: 260, flex: 1 }}>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            From branch
          </Typography>
          {canBranchView ? (
            <BranchSelect
              branches={branchesQuery.data ?? []}
              value={fromBranchId}
              onChange={(id) => {
                setFromBranchId(id);
                authStorage.setLastBranchId(id);
                setPage(1);
              }}
            />
          ) : (
            <TextField size="small" label="From branch" value={fromBranchLabel} disabled fullWidth />
          )}
        </Box>

        <Box sx={{ minWidth: 260, flex: 1 }}>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            To branch
          </Typography>
          {canBranchView ? (
            <BranchSelect
              branches={branchesQuery.data ?? []}
              value={toBranchId}
              onChange={(id) => {
                setToBranchId(id);
                setPage(1);
              }}
            />
          ) : (
            <TextField size="small" label="To branch" value={toBranchLabel} disabled fullWidth />
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
          sx={{ width: 220 }}
        >
          {STATUSES.map((s) => (
            <MenuItem key={s || 'ALL'} value={s}>
              {s ? s : 'All'}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {fromBranchId === '' ? (
        <Alert severity={canBranchView ? 'info' : 'error'}>
          {canBranchView ? 'Select a From branch.' : 'No branch assigned to your account.'}
        </Alert>
      ) : transfersQuery.isLoading ? (
        <Alert severity="info">Loading transfers…</Alert>
      ) : transfersQuery.isError ? (
        <Alert severity="error">Failed to load transfers.</Alert>
      ) : pretty.length === 0 ? (
        <Alert severity="warning">No transfers found.</Alert>
      ) : (
        <Paper variant="outlined">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell width={90}>ID</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>From</TableCell>
                <TableCell>To</TableCell>
                <TableCell align="right">Items</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pretty.map((r) => (
                <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelectedId(r.id)}>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell>{r.from}</TableCell>
                  <TableCell>{r.to}</TableCell>
                  <TableCell align="right">{r.itemsCount}</TableCell>
                  <TableCell align="right">{qtyFmt(r.totalQty)}</TableCell>
                  <TableCell>{r.notes?.trim() ? r.notes : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} showFirstButton showLastButton />
        </Box>
      )}

      {/* Create dialog */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Transfer</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {!canTransferCreate && <Alert severity="error">Not authorized: TRANSFER_CREATE.</Alert>}
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                From branch
              </Typography>
              {canBranchView ? (
                <BranchSelect
                  branches={branchesQuery.data ?? []}
                  value={createFrom}
                  onChange={(id) => setCreateFrom(id)}
                  disabled={!canTransferCreate}
                />
              ) : (
                <TextField size="small" label="From branch" value={createFromBranchLabel} disabled fullWidth />
              )}
            </Box>

            <Box>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                To branch
              </Typography>
              {canBranchView ? (
                <BranchSelect
                  branches={branchesQuery.data ?? []}
                  value={createTo}
                  onChange={(id) => setCreateTo(id)}
                  disabled={!canTransferCreate}
                />
              ) : (
                <TextField size="small" label="To branch" value={createToBranchLabel} disabled fullWidth />
              )}
            </Box>

            <TextField
              size="small"
              label="Scan/search SKU or barcode"
              value={variantSearch}
              onChange={(e) => setVariantSearch(e.target.value)}
              disabled={!canTransferCreate}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const first = variantOptions[0];
                  if (first) pickVariant(first);
                }
              }}
              placeholder="Scan barcode or type SKU…"
              helperText="Tip: press Enter to auto-select the first match."
            />

            {variantSearchDebounced.length >= 2 && variantLookupQuery.isLoading && (
              <Alert severity="info">Searching variants…</Alert>
            )}

            {pickedVariant && (
              <Paper variant="outlined" sx={{ p: 1 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                  <Box>
                    <Typography variant="body2">
                      <b>Last picked Variant ID:</b> {pickedVariant.id}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      {pickedVariant.sku ? `SKU: ${pickedVariant.sku}` : ''}
                      {pickedVariant.productName ? ` • ${pickedVariant.productName}` : ''}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    onClick={clearPickedVariant}
                    sx={{ textTransform: 'none' }}
                    disabled={!canTransferCreate}
                  >
                    Clear
                  </Button>
                </Stack>
              </Paper>
            )}

            {variantSearchDebounced.length >= 2 && !variantLookupQuery.isLoading && variantOptions.length > 0 && (
              <Paper variant="outlined" sx={{ maxHeight: 220, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell width={110}>ID</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell>Product</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {variantOptions.slice(0, 10).map((v: any) => {
                      const id = Number(v?.id);
                      const sku = v?.sku ?? '-';
                      const prod = v?.product?.name ?? '-';
                      const isPicked = pickedVariant?.id === id;

                      return (
                        <TableRow
                          key={id}
                          hover
                          sx={{ cursor: 'pointer', backgroundColor: isPicked ? 'rgba(0,0,0,0.04)' : undefined }}
                          onClick={() => pickVariant(v)}
                        >
                          <TableCell sx={{ fontFamily: 'monospace' }}>{id}</TableCell>
                          <TableCell>{sku}</TableCell>
                          <TableCell>{prod}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Paper>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <TextField
                fullWidth
                size="small"
                label="Variant ID (fallback/manual)"
                value={createVariantId}
                onChange={(e) => setCreateVariantId(e.target.value)}
                placeholder="e.g. 5"
                helperText="If you picked above, this is already filled."
                disabled={!canTransferCreate}
              />
              <TextField
                size="small"
                label="Qty"
                value={createQty}
                onChange={(e) => setCreateQty(e.target.value)}
                sx={{ width: 140 }}
                disabled={!canTransferCreate}
              />
              <Button
                variant="outlined"
                onClick={addDraftItem}
                sx={{ whiteSpace: 'nowrap', textTransform: 'none' }}
                disabled={!canTransferCreate}
              >
                Add item
              </Button>
            </Stack>

            <Paper variant="outlined" sx={{ p: 1 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="body2">
                  <b>Draft:</b> {draftTotals.itemsCount} item(s), total qty {qtyFmt(draftTotals.totalQty)}
                </Typography>
                <Button
                  size="small"
                  onClick={clearDraft}
                  sx={{ textTransform: 'none' }}
                  disabled={!canTransferCreate || draftItems.length === 0}
                >
                  Clear draft
                </Button>
              </Stack>
            </Paper>

            {draftItems.length > 0 && (
              <Paper variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width={130}>Variant ID</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell align="right" width={120}>Qty</TableCell>
                      <TableCell align="right" width={90}>Remove</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {draftItems.map((it) => (
                      <TableRow key={it.product_variant_id}>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{it.product_variant_id}</TableCell>
                        <TableCell>{it.sku ?? '-'}</TableCell>
                        <TableCell>{it.productName ?? '-'}</TableCell>
                        <TableCell align="right">{qtyFmt(it.qty)}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => removeDraftItem(it.product_variant_id)} disabled={!canTransferCreate}>
                            <span style={{ fontSize: 14, lineHeight: 1 }}>🗑️</span>
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}

            <TextField
              size="small"
              label="Notes (optional)"
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              multiline
              minRows={2}
              disabled={!canTransferCreate}
            />

            {createMut.isError && <Alert severity="error">Failed to create transfer.</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={submitCreate}
            disabled={createMut.isPending || draftItems.length < 1 || !canTransferCreate}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Drawer */}
      <Drawer anchor="right" open={!!selectedId} onClose={closeDrawer}>
        <Box sx={{ width: { xs: '100vw', sm: 520 }, maxWidth: '100vw', p: { xs: 2, sm: 2.5 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Transfer</Typography>
            <Button onClick={closeDrawer}>Close</Button>
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          {transferQuery.isLoading ? (
            <Alert severity="info">Loading transfer…</Alert>
          ) : transferQuery.isError ? (
            <Alert severity="error">Failed to load transfer.</Alert>
          ) : !selected ? (
            <Alert severity="warning">No transfer selected.</Alert>
          ) : (
            <Stack spacing={1.25}>
              <Typography variant="body2"><b>ID:</b> {selected.id}</Typography>
              <Typography variant="body2"><b>Status:</b> {selected.status}</Typography>
              <Typography variant="body2"><b>From:</b> {(selected as any).fromBranch?.name ?? selected.from_branch_id}</Typography>
              <Typography variant="body2"><b>To:</b> {(selected as any).toBranch?.name ?? selected.to_branch_id}</Typography>
              <Typography variant="body2"><b>Notes:</b> {selected.notes?.trim() ? selected.notes : '-'}</Typography>

              <Stack direction="row" spacing={1} sx={{ pt: 0.5, flexWrap: 'wrap' }}>
                {canLedgerView && (
                  <Button variant="outlined" onClick={goToLedgerForTransferFrom} sx={{ textTransform: 'none' }}>
                    View Ledger (From)
                  </Button>
                )}
                {canLedgerView && (
                  <Button variant="outlined" onClick={goToLedgerForTransferTo} sx={{ textTransform: 'none' }}>
                    View Ledger (To)
                  </Button>
                )}
              </Stack>

              <Divider sx={{ my: 1 }} />

              <Typography variant="subtitle2">Workflow</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {canTransferCreate && (
                  <Button
                    variant="contained"
                    disabled={!canRequest || requestMut.isPending}
                    onClick={() => runAction('request')}
                  >
                    Request
                  </Button>
                )}
                {canTransferApprove && (
                  <Button
                    variant="contained"
                    disabled={!canApprove || approveMut.isPending}
                    onClick={() => runAction('approve')}
                  >
                    Approve
                  </Button>
                )}
                {canTransferDispatch && (
                  <Button
                    variant="contained"
                    disabled={!canDispatch || dispatchMut.isPending}
                    onClick={() => runAction('dispatch')}
                  >
                    Dispatch
                  </Button>
                )}
                {canTransferReceive && (
                  <Button
                    variant="contained"
                    disabled={!canReceive || receiveMut.isPending}
                    onClick={() => runAction('receive')}
                  >
                    Receive
                  </Button>
                )}
                {canTransferCreate && (
                  <Button
                    variant="outlined"
                    color="error"
                    disabled={!canCancel || cancelMut.isPending}
                    onClick={() => runAction('cancel')}
                  >
                    Cancel
                  </Button>
                )}
              </Stack>
              {!canTransferCreate && !canTransferApprove && !canTransferDispatch && !canTransferReceive && (
                <Alert severity="info">You have view-only access to transfer workflow actions.</Alert>
              )}

              {(requestMut.isPending ||
                approveMut.isPending ||
                dispatchMut.isPending ||
                receiveMut.isPending ||
                cancelMut.isPending) && <Alert severity="info">Working…</Alert>}

              <Divider sx={{ my: 1 }} />

              <Typography variant="subtitle2">Items</Typography>
              {(selected.items ?? []).length === 0 ? (
                <Alert severity="warning">No items loaded.</Alert>
              ) : (
                <Paper variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell width={150}>Variant ID</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell>Product</TableCell>
                        <TableCell align="right" width={120}>Qty</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(selected.items ?? []).map((it: any) => {
                        const vid = Number(it.product_variant_id ?? it.variant?.id ?? 0) || 0;
                        const sku = it.variant?.sku ?? '-';
                        const prod = it.variant?.product?.name ?? '-';

                        return (
                          <TableRow key={it.id ?? `${vid}-${sku}`}>
                            <TableCell>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <Tooltip title="Copy Variant ID">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (vid) copyVariantId(vid);
                                    }}
                                    disabled={!vid}
                                  >
                                    <span style={{ fontSize: 14, lineHeight: 1 }}>📋</span>
                                  </IconButton>
                                </Tooltip>
                                <Box component="span" sx={{ fontFamily: 'monospace' }}>
                                  {vid ? vid : '-'}
                                </Box>
                              </Stack>
                            </TableCell>
                            <TableCell>{sku}</TableCell>
                            <TableCell>{prod}</TableCell>
                            <TableCell align="right">{qtyFmt(it.qty)}</TableCell>
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



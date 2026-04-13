import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
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
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
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
  useApproveTransferMutation,
  useCancelTransferMutation,
  useCreateTransferMutation,
  useTransferBranchOptionsQuery,
  useRequestTransferMutation,
  useTransferQuery,
  useTransfersQuery,
  useVariantsQuery,
  useDashboardApprovalQueueQuery,
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

function dateTimeFmt(v: string | null | undefined) {
  if (!v) return '-';
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  });
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

function getTransferItemDisplay(it: any): string {
  const variant = it?.variant ?? null;
  const productName = String(variant?.product?.name ?? '').trim() || `Variant #${Number(it?.product_variant_id ?? 0) || '-'}`;
  const variantLabelRaw = String(getVariantLabel(variant) ?? '').trim();
  const variantLabel = variantLabelRaw && variantLabelRaw !== 'Standard' ? variantLabelRaw : '-';
  const flavor = String(variant?.flavor ?? '').trim() || '-';
  const qty = qtyFmt(it?.qty);

  return `${productName} / ${variantLabel} / ${flavor} (Qty: ${qty})`;
}

type DraftItem = {
  product_variant_id: number;
  qty: number | null;
  qtyInput: string;
  sku?: string | null;
  productName?: string | null;
  variantName?: string | null;
  flavor?: string | null;
  onHand?: number | null;
};

export function TransfersPage() {
  const theme = useTheme();
  const isCompactList = useMediaQuery(theme.breakpoints.down('md'));
  const { user, can } = useAuth();
  const canTransferView = can('TRANSFER_VIEW');
  const canTransferCreate = can('TRANSFER_CREATE');
  const canTransferApprove = can('TRANSFER_APPROVE');
  const canLedgerView = can('LEDGER_VIEW');
  const canDashboardView = can('USER_VIEW');
  const canMutateTransfers = canTransferCreate || canTransferApprove;

  const navigate = useNavigate();
  const transferBranchOptionsQuery = useTransferBranchOptionsQuery(canTransferView);
  const fromBranchOptions = transferBranchOptionsQuery.data?.from_branches ?? [];
  const toBranchOptions = transferBranchOptionsQuery.data?.to_branches ?? [];
  const [searchParams, setSearchParams] = useSearchParams();

  const createMut = useCreateTransferMutation();
  const requestMut = useRequestTransferMutation();
  const approveMut = useApproveTransferMutation();
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
  const [seenRequestedTransferId, setSeenRequestedTransferId] = useState<number>(() =>
    authStorage.getSeenPending(user?.id).transfers
  );
  const [pendingTransferBranchAnchorEl, setPendingTransferBranchAnchorEl] = useState<HTMLElement | null>(null);

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
  const [variantLookupPage, setVariantLookupPage] = useState(1);

  // Draft items (multi-item support)
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [createErrorMessage, setCreateErrorMessage] = useState<string>('');
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
    setSeenRequestedTransferId(authStorage.getSeenPending(user?.id).transfers);
  }, [user?.id]);

  useEffect(() => {
    if (!openCreate) return;
    const t = setTimeout(() => setVariantSearchDebounced(variantSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [variantSearch, openCreate]);

  useEffect(() => {
    if (!openCreate) return;
    setVariantLookupPage(1);
  }, [variantSearchDebounced, createFrom, openCreate]);

  const variantLookupQuery = useVariantsQuery(
    {
      page: variantLookupPage,
      per_page: 25,
      search: variantSearchDebounced || undefined,
      branch_id: typeof createFrom === 'number' ? createFrom : undefined,
    },
    openCreate && canTransferCreate && typeof createFrom === 'number'
  );
  const variantOptions: any[] = variantLookupQuery.data?.data ?? [];
  const variantLookupTotalPages = variantLookupQuery.data?.last_page ?? 1;
  const approvalQueueQuery = useDashboardApprovalQueueQuery({}, canDashboardView);

  const removeDraftItem = (variantId: number) => {
    setDraftItems((prev) => prev.filter((x) => x.product_variant_id !== variantId));
  };

  const clearDraft = () => setDraftItems([]);

  const isVariantMarked = (variantId: number) =>
    draftItems.some((item) => item.product_variant_id === variantId);

  const markVariantForTransfer = (variant: any, nextChecked: boolean) => {
    const variantId = Number(variant?.id);
    if (!Number.isFinite(variantId) || variantId <= 0) return;

    if (!nextChecked) {
      removeDraftItem(variantId);
      return;
    }

    const onHand = getVariantOnHand(variant);
    const defaultQty = onHand !== null && onHand > 0 ? 1 : 0;
    if (defaultQty <= 0) {
      showSnack('This variant has no available stock to transfer.');
      return;
    }

    setDraftItems((prev) => {
      const existing = prev.find((item) => item.product_variant_id === variantId);
      if (existing) {
        return prev;
      }

      return [
        ...prev,
        {
          product_variant_id: variantId,
          qty: defaultQty,
          qtyInput: String(defaultQty),
          sku: variant?.sku ?? null,
          productName: variant?.product?.name ?? null,
          variantName: getVariantLabel(variant),
          flavor: String(variant?.flavor ?? '').trim() || null,
          onHand,
        },
      ];
    });
  };

  const updateDraftItemQty = (variantId: number, rawValue: string) => {
    setDraftItems((prev) =>
      prev.map((item) =>
        item.product_variant_id === variantId
          ? {
              ...item,
              qtyInput: rawValue,
              qty:
                rawValue.trim() !== '' && Number.isFinite(Number(rawValue)) && Number(rawValue) > 0
                  ? Number(rawValue)
                  : null,
            }
          : item
      )
    );
  };

  const getDraftItemQtyError = (item: DraftItem): string | null => {
    const rawValue = String(item.qtyInput ?? '').trim();
    if (rawValue === '') return 'Quantity is required.';

    const qty = Number(rawValue);
    if (!Number.isFinite(qty) || qty <= 0) {
      return 'Enter a quantity greater than 0.';
    }

    const onHand = typeof item.onHand === 'number' && Number.isFinite(item.onHand) ? item.onHand : null;
    if (onHand !== null && qty > onHand) {
      return `Max ${qtyFmt(onHand)} available.`;
    }

    return null;
  };

  const draftTotals = useMemo(() => {
    const itemsCount = draftItems.length;
    const totalQty = draftItems.reduce((sum, it) => sum + (it.qty ?? 0), 0);
    return { itemsCount, totalQty };
  }, [draftItems]);
  const hasInvalidDraftQty = useMemo(
    () => draftItems.some((item) => getDraftItemQtyError(item) !== null),
    [draftItems]
  );

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
    if (fromBranchOptions.length < 1) return;
    if (typeof fromBranchId === 'number' && fromBranchOptions.some((b) => b.id === fromBranchId)) return;
    const preferred = user?.branch_id ? fromBranchOptions.find((b) => b.id === user.branch_id) : null;
    const first = preferred ?? fromBranchOptions[0];
    setFromBranchId(first.id);
    authStorage.setLastBranchId(first.id);
  }, [fromBranchId, fromBranchOptions, user?.branch_id]);

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
  const branchLabelById = useMemo(() => {
    const map = new Map<number, string>();
    for (const branch of [...fromBranchOptions, ...toBranchOptions]) {
      const id = Number(branch.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      const code = String(branch.code ?? '').trim();
      const name = String(branch.name ?? '').trim();
      if (!name) continue;
      map.set(id, code ? `${code} - ${name}` : name);
    }
    return map;
  }, [fromBranchOptions, toBranchOptions]);

  const resolveBranchLabel = (branchId: number | null | undefined, explicitName?: unknown): string => {
    const name = String(explicitName ?? '').trim();
    if (name) return name;
    const n = Number(branchId);
    if (Number.isFinite(n) && n > 0) {
      return branchLabelById.get(n) ?? 'Unknown branch';
    }
    return 'Unknown branch';
  };

  const pretty = useMemo(() => {
    return rows.map((t: Transfer) => {
      const items = (t as any).items ?? [];
      const itemsCount = items.length;
      const totalQty = items.reduce((sum: number, it: any) => sum + Number(it.qty ?? 0), 0);
      const itemDisplays = items.map((it: any) => getTransferItemDisplay(it));
      const statusText = String((t as any).status ?? '-');
      const createdAt = dateTimeFmt((t as any).created_at ?? null);
      const postedAt = dateTimeFmt((t as any).dispatched_at ?? null);
      const receivedAt = dateTimeFmt((t as any).received_at ?? null);
      const transferId = Number(t.id ?? 0);
      const isNew = statusText === 'REQUESTED' && transferId > seenRequestedTransferId;
      const fromBranchIdValue = Number((t as any).from_branch_id ?? 0);
      const toBranchIdValue = Number((t as any).to_branch_id ?? 0);

      return {
        id: transferId,
        status: statusText,
        isNew,
        from: resolveBranchLabel(fromBranchIdValue, (t as any).fromBranch?.name),
        to: resolveBranchLabel(toBranchIdValue, (t as any).toBranch?.name),
        itemsCount,
        totalQty,
        itemDisplays,
        createdAt,
        postedAt,
        receivedAt,
        notes: (t as any).notes ?? '',
      };
    });
  }, [rows, seenRequestedTransferId, branchLabelById]);
  const pendingTransferBranches = useMemo(() => {
    const queueRows = approvalQueueQuery.data?.approval_queue?.transfers ?? [];
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
      if (statusText && statusText !== 'REQUESTED') continue;

      const sourceBranchId = Number((row as any)?.from_branch_id ?? 0);
      if (!Number.isFinite(sourceBranchId) || sourceBranchId <= 0) continue;

      const sourceBranchName = String((row as any)?.from_branch_name ?? '').trim();
      const sourceBranchLabel =
        sourceBranchName || branchLabelById.get(sourceBranchId) || `Branch #${sourceBranchId}`;
      const requestedAtRaw = Date.parse(String((row as any)?.created_at ?? ''));
      const requestedAtTs = Number.isFinite(requestedAtRaw) ? requestedAtRaw : 0;

      const existing = grouped.get(sourceBranchId);
      if (existing) {
        existing.requestCount += 1;
        existing.latestRequestedAtTs = Math.max(existing.latestRequestedAtTs, requestedAtTs);
      } else {
        grouped.set(sourceBranchId, {
          branchId: sourceBranchId,
          branchLabel: sourceBranchLabel,
          requestCount: 1,
          latestRequestedAtTs: requestedAtTs,
        });
      }
    }

    return Array.from(grouped.values()).sort(
      (a, b) =>
        b.latestRequestedAtTs - a.latestRequestedAtTs ||
        b.requestCount - a.requestCount ||
        a.branchLabel.localeCompare(b.branchLabel)
    );
  }, [approvalQueueQuery.data?.approval_queue?.transfers, branchLabelById]);
  const hasPendingTransferBranchAlerts = pendingTransferBranches.length > 0;
  const pendingTransferBranchCountMap = useMemo(
    () =>
      pendingTransferBranches.reduce<Record<number, number>>((acc, item) => {
        acc[item.branchId] = item.requestCount;
        return acc;
      }, {}),
    [pendingTransferBranches]
  );
  const pendingTransferDotTitle = useMemo(() => {
    if (!hasPendingTransferBranchAlerts) return 'No pending transfer requests';
    if (pendingTransferBranches.length === 1) {
      return `Pending transfer request from ${pendingTransferBranches[0].branchLabel}`;
    }
    return `Pending transfer requests from ${pendingTransferBranches.length} branches`;
  }, [hasPendingTransferBranchAlerts, pendingTransferBranches]);

  const jumpToPendingTransferBranch = (nextBranchId: number) => {
    setFromBranchId(nextBranchId);
    authStorage.setLastBranchId(nextBranchId);
    setToBranchId('');
    setStatus('REQUESTED');
    setPage(1);
    setPendingTransferBranchAnchorEl(null);
  };

  useEffect(() => {
    if (hasPendingTransferBranchAlerts) return;
    setPendingTransferBranchAnchorEl(null);
  }, [hasPendingTransferBranchAlerts]);

  const openTransferRow = (row: { id: number; status: string }) => {
    if (row.status === 'REQUESTED') {
      const next = authStorage.markSeenPending(user?.id, 'transfers', row.id);
      setSeenRequestedTransferId(next.transfers);
    }
    setSelectedId(row.id);
  };

  const createFromBranchOptions = useMemo(() => {
    const all = fromBranchOptions;
    if (typeof createTo !== 'number') return all;
    return all.filter((b) => b.id !== createTo);
  }, [fromBranchOptions, createTo]);

  const createToBranchOptions = useMemo(() => {
    const all = toBranchOptions;
    if (typeof createFrom !== 'number') return all;
    return all.filter((b) => b.id !== createFrom);
  }, [toBranchOptions, createFrom]);

  useEffect(() => {
    if (typeof toBranchId !== 'number') return;
    if (toBranchOptions.some((b) => b.id === toBranchId)) return;
    setToBranchId('');
  }, [toBranchId, toBranchOptions]);

  useEffect(() => {
    if (typeof createTo !== 'number') return;
    if (createToBranchOptions.some((b) => b.id === createTo)) return;
    setCreateTo('');
  }, [createTo, createToBranchOptions]);

  useEffect(() => {
    if (typeof createFrom === 'number' && createTo === createFrom) {
      setCreateTo('');
    }
  }, [createFrom, createTo]);

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
    setVariantLookupPage(1);
    setDraftItems([]);
    setCreateErrorMessage('');

    setOpenCreate(true);
  };

  const submitCreate = async () => {
    if (!canTransferCreate) {
      showSnack('Not authorized: TRANSFER_CREATE');
      return;
    }

    const fromId = typeof createFrom === 'number' ? createFrom : null;
    const toId = typeof createTo === 'number' ? createTo : null;

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
    if (draftItems.some((it) => it.qty === null || it.qty <= 0)) {
      showSnack('Enter a valid quantity for every marked transfer item.');
      return;
    }

    try {
      setCreateErrorMessage('');
      const created = await createMut.mutateAsync({
        from_branch_id: fromId,
        to_branch_id: toId,
        notes: createNotes?.trim() ? createNotes.trim() : null,
        items: draftItems.map((it) => ({ product_variant_id: it.product_variant_id, qty: it.qty as number })),
      });

      setOpenCreate(false);
      setSelectedId(created.id);
      showSnack(`Transfer #${created.id} created.`, 'success');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to create transfer.';
      setCreateErrorMessage(msg);
      showSnack(msg);
    }
  };

  const closeDrawer = () => setSelectedId(null);

  const canRequest = canTransferCreate && selected?.status === 'DRAFT';
  const canApprove = canTransferApprove && selected?.status === 'REQUESTED';
  const canCancel =
    canTransferCreate && !!selected?.status && !['RECEIVED', 'CANCELLED'].includes(selected.status);

  const runAction = async (action: 'request' | 'approve' | 'cancel') => {
    if (!selected) return;

    if ((action === 'request' || action === 'cancel') && !canTransferCreate) {
      showSnack('Not authorized: TRANSFER_CREATE');
      return;
    }
    if (action === 'approve' && !canTransferApprove) {
      showSnack('Not authorized: TRANSFER_APPROVE');
      return;
    }

    try {
      if (action === 'request') await requestMut.mutateAsync(selected.id);
      if (action === 'approve') await approveMut.mutateAsync(selected.id);
      if (action === 'cancel') await cancelMut.mutateAsync(selected.id);
      transferQuery.refetch();
      transfersQuery.refetch();
      const successMessage =
        action === 'approve'
          ? 'Transfer approved and posted to both branches successfully.'
          : `Transfer ${action} successful.`;
      showSnack(successMessage, 'success');
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
    typeof fromBranchId === 'number'
      ? resolveBranchLabel(fromBranchId, user?.branch?.name)
      : user?.branch?.name ?? 'No branch assigned';
  const createFromBranchLabel =
    typeof createFrom === 'number'
      ? resolveBranchLabel(createFrom, user?.branch?.name)
      : fromBranchLabel;
  const toBranchLabel = typeof toBranchId === 'number' ? resolveBranchLabel(toBranchId) : 'Any';
  const createToBranchLabel =
    typeof createTo === 'number' ? resolveBranchLabel(createTo) : 'Select a destination branch';

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

      {transferBranchOptionsQuery.isError && <Alert severity="error">Failed to load transfer branch options.</Alert>}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <Box sx={{ minWidth: 260, flex: 1 }}>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            From branch
          </Typography>
          {fromBranchOptions.length > 0 ? (
            <BranchSelect
              branches={fromBranchOptions}
              value={fromBranchId}
              onChange={(id) => {
                setFromBranchId(id);
                authStorage.setLastBranchId(id);
                setPage(1);
              }}
              showAlertDot={hasPendingTransferBranchAlerts}
              alertDotTitle={pendingTransferDotTitle}
              onAlertDotClick={(event) => setPendingTransferBranchAnchorEl(event.currentTarget)}
              showBranchAlertDots
              alertCountsByBranchId={pendingTransferBranchCountMap}
            />
          ) : (
            <TextField size="small" label="From branch" value={fromBranchLabel} disabled fullWidth />
          )}
        </Box>

        <Box sx={{ minWidth: 260, flex: 1 }}>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            To branch
          </Typography>
          {toBranchOptions.length > 0 ? (
            <BranchSelect
              branches={toBranchOptions}
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
        anchorEl={pendingTransferBranchAnchorEl}
        open={Boolean(pendingTransferBranchAnchorEl) && hasPendingTransferBranchAlerts}
        onClose={() => setPendingTransferBranchAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { minWidth: 260 } }}
      >
        {pendingTransferBranches.map((item) => (
          <MenuItem
            key={item.branchId}
            selected={fromBranchId === item.branchId}
            onClick={() => jumpToPendingTransferBranch(item.branchId)}
          >
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
              <Typography variant="body2" sx={{ fontWeight: fromBranchId === item.branchId ? 700 : 500 }}>
                {item.branchLabel}
              </Typography>
              <Chip size="small" color="error" label={item.requestCount === 1 ? '1 req' : `${item.requestCount} req`} />
            </Stack>
          </MenuItem>
        ))}
      </Menu>

      {fromBranchId === '' ? (
        <Alert severity={fromBranchOptions.length > 0 ? 'info' : 'error'}>
          {fromBranchOptions.length > 0 ? 'Select a From branch.' : 'No branch assigned to your account.'}
        </Alert>
      ) : transfersQuery.isLoading ? (
        <Alert severity="info">Loading transfers…</Alert>
      ) : transfersQuery.isError ? (
        <Alert severity="error">Failed to load transfers.</Alert>
      ) : pretty.length === 0 ? (
        <Alert severity="warning">No transfers found.</Alert>
      ) : isCompactList ? (
        <Stack spacing={1}>
          {pretty.map((r) => (
            <Paper
              key={r.id}
              variant="outlined"
              role="button"
              tabIndex={0}
              onClick={() => openTransferRow(r)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openTransferRow(r);
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
                    TR #{r.id}
                  </Typography>
                  <Stack direction="row" spacing={0.6} alignItems="center">
                    <Chip size="small" label={r.status} />
                    {r.isNew && <Chip size="small" color="error" label="NEW" sx={{ height: 20, fontSize: 10 }} />}
                  </Stack>
                </Stack>
                <Typography variant="body2">{`${r.from} -> ${r.to}`}</Typography>
                {r.itemDisplays.length > 0 ? (
                  <Stack spacing={0.2}>
                    {r.itemDisplays.slice(0, 2).map((line: string, idx: number) => (
                      <Typography key={`${r.id}-line-${idx}`} variant="caption" color="text.secondary">
                        {line}
                      </Typography>
                    ))}
                    {r.itemDisplays.length > 2 && (
                      <Typography variant="caption" color="text.secondary">
                        +{r.itemDisplays.length - 2} more item(s)
                      </Typography>
                    )}
                  </Stack>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    No item details available.
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  Items: {r.itemsCount} | Qty: {qtyFmt(r.totalQty)}
                </Typography>
                <Stack spacing={0.15}>
                  <Typography variant="caption" color="text.secondary">
                    Created: {r.createdAt}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Posted: {r.postedAt}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Received: {r.receivedAt}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Notes: {r.notes?.trim() ? r.notes : '-'}
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
                <TableCell width={90}>ID</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>From</TableCell>
                <TableCell>To</TableCell>
                <TableCell>Transferred Items (Product / Variant / Flavor)</TableCell>
                <TableCell align="right">Items</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell>Timeline</TableCell>
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
                  onClick={() => openTransferRow(r)}
                >
                  <TableCell>{r.id}</TableCell>
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
                  <TableCell>{r.from}</TableCell>
                  <TableCell>{r.to}</TableCell>
                  <TableCell sx={{ minWidth: 280 }}>
                    {r.itemDisplays.length > 0 ? (
                      <Stack spacing={0.2}>
                        {r.itemDisplays.slice(0, 2).map((line: string, idx: number) => (
                          <Typography key={`${r.id}-item-${idx}`} variant="caption">
                            {line}
                          </Typography>
                        ))}
                        {r.itemDisplays.length > 2 && (
                          <Typography variant="caption" color="text.secondary">
                            +{r.itemDisplays.length - 2} more item(s)
                          </Typography>
                        )}
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        No item details
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">{r.itemsCount}</TableCell>
                  <TableCell align="right">{qtyFmt(r.totalQty)}</TableCell>
                  <TableCell sx={{ minWidth: 190 }}>
                    <Stack spacing={0.15}>
                      <Typography variant="caption">Created: {r.createdAt}</Typography>
                      <Typography variant="caption">Posted: {r.postedAt}</Typography>
                      <Typography variant="caption">Received: {r.receivedAt}</Typography>
                    </Stack>
                  </TableCell>
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
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="sm" fullWidth sx={requestDialogSx}>
        <DialogTitle sx={requestDialogTitleSx}>
          <Stack spacing={0.35}>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
              New Transfer
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Build a branch-to-branch request with exact variants and quantities.
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={requestDialogContentSx}>
          <Stack spacing={1.5}>
            {!canTransferCreate && <Alert severity="error">Not authorized: TRANSFER_CREATE.</Alert>}
            <Paper variant="outlined" sx={requestSectionSx}>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                From branch
              </Typography>
              {createFromBranchOptions.length > 0 ? (
                <BranchSelect
                  branches={createFromBranchOptions}
                  value={createFrom}
                  onChange={(id) => setCreateFrom(id)}
                  disabled={!canTransferCreate}
                />
              ) : (
                <TextField size="small" label="From branch" value={createFromBranchLabel} disabled fullWidth />
              )}
            </Paper>

            <Paper variant="outlined" sx={requestSectionSx}>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                To branch
              </Typography>
              {createToBranchOptions.length > 0 ? (
                <BranchSelect
                  branches={createToBranchOptions}
                  value={createTo}
                  onChange={(id) => setCreateTo(id)}
                  disabled={!canTransferCreate}
                />
              ) : (
                <TextField size="small" label="To branch" value={createToBranchLabel} disabled fullWidth />
              )}
            </Paper>

            <TextField
              size="small"
              label="Search SKU / product / variant / flavor"
              value={variantSearch}
              onChange={(e) => setVariantSearch(e.target.value)}
              disabled={!canTransferCreate}
              placeholder="Type to filter available stock..."
              helperText="Mark the stock items you want to transfer, then enter each quantity."
            />

            <Alert severity="info">
              One transfer request can include multiple variants and quantities. Choose everything here, then create once.
            </Alert>

            {variantLookupQuery.isLoading && (
              <Alert severity="info">
                {variantSearchDebounced ? 'Searching variants...' : 'Loading available variants...'}
              </Alert>
            )}

            {variantLookupQuery.isError && (
              <Alert severity="error">Failed to load available variants for this branch.</Alert>
            )}

            {!variantLookupQuery.isLoading && variantOptions.length > 0 && (
              <Paper variant="outlined" sx={[requestSectionSx, { p: 0 }]}> 
                <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" width={56}>Pick</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell>Product</TableCell>
                        <TableCell>Variant</TableCell>
                        <TableCell>Flavor</TableCell>
                        <TableCell align="right" width={120}>On hand</TableCell>
                        <TableCell align="right" width={132}>Qty to transfer</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {variantOptions.map((v: any) => {
                        const id = Number(v?.id);
                        if (!Number.isFinite(id) || id <= 0) return null;

                        const sku = v?.sku ?? '-';
                        const prod = v?.product?.name ?? '-';
                        const variant = getVariantLabel(v);
                        const flavor = String(v?.flavor ?? '').trim() || '-';
                        const onHand = getVariantOnHand(v);
                        const isMarked = isVariantMarked(id);
                        const selectedDraft = draftItems.find((item) => item.product_variant_id === id);
                        const qtyError = selectedDraft ? getDraftItemQtyError(selectedDraft) : null;
                        const disablePick = onHand !== null && onHand <= 0;

                        return (
                          <TableRow
                            key={id}
                            hover
                            sx={{
                              cursor: disablePick ? 'not-allowed' : 'pointer',
                              backgroundColor: isMarked ? 'rgba(0,0,0,0.04)' : undefined,
                              opacity: disablePick && !isMarked ? 0.6 : 1,
                            }}
                            onClick={() => markVariantForTransfer(v, !isMarked)}
                          >
                            <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isMarked}
                                disabled={!canTransferCreate || disablePick}
                                onChange={(_, checked) => markVariantForTransfer(v, checked)}
                              />
                            </TableCell>
                            <TableCell>{sku}</TableCell>
                            <TableCell>{prod}</TableCell>
                            <TableCell>{variant}</TableCell>
                            <TableCell>{flavor}</TableCell>
                            <TableCell align="right">{onHand === null ? '-' : qtyFmt(onHand)}</TableCell>
                            <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                              <TextField
                                size="small"
                                type="number"
                                value={selectedDraft?.qtyInput ?? ''}
                                disabled={!canTransferCreate || !isMarked}
                                onChange={(e) => updateDraftItemQty(id, e.target.value)}
                                error={isMarked && qtyError !== null}
                                helperText={isMarked ? qtyError ?? ' ' : ' '}
                                inputProps={{
                                  min: 1,
                                  step: 1,
                                  inputMode: 'numeric',
                                  max: onHand ?? undefined,
                                }}
                                sx={{ width: 110 }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              </Paper>
            )}

            {!variantLookupQuery.isLoading && !variantLookupQuery.isError && variantOptions.length === 0 && (
              <Alert severity="warning">
                {variantSearchDebounced
                  ? 'No variants matched your search in this branch.'
                  : 'No available variants were found for this branch.'}
              </Alert>
            )}

            {variantLookupTotalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Pagination
                  count={variantLookupTotalPages}
                  page={variantLookupPage}
                  onChange={(_, nextPage) => setVariantLookupPage(nextPage)}
                  showFirstButton
                  showLastButton
                />
              </Box>
            )}

            <Paper variant="outlined" sx={requestSectionSx}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="body2">
                  <b>Marked for transfer:</b> {draftTotals.itemsCount} item(s), total qty {qtyFmt(draftTotals.totalQty)}
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
              <Paper variant="outlined" sx={[requestSectionSx, { p: 0 }]}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width={130}>Variant ID</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell>Variant</TableCell>
                      <TableCell>Flavor</TableCell>
                      <TableCell align="right" width={120}>On hand</TableCell>
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
                        <TableCell>{it.variantName ?? '-'}</TableCell>
                        <TableCell>{it.flavor ?? '-'}</TableCell>
                        <TableCell align="right">{it.onHand === null || it.onHand === undefined ? '-' : qtyFmt(it.onHand)}</TableCell>
                        <TableCell align="right">{it.qtyInput.trim() || '-'}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => removeDraftItem(it.product_variant_id)} disabled={!canTransferCreate}>
                            <CloseRoundedIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}

            {hasInvalidDraftQty && (
              <Alert severity="warning">
                Some selected items exceed available stock or have invalid quantity. Reduce each qty to the on-hand amount before creating the transfer.
              </Alert>
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

            {createMut.isError && (
              <Alert severity="error">
                {createErrorMessage || 'Failed to create transfer.'}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={requestDialogActionsSx}>
          <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={submitCreate}
            disabled={createMut.isPending || draftItems.length < 1 || !canTransferCreate || hasInvalidDraftQty}
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
              <Typography variant="body2">
                <b>From:</b> {resolveBranchLabel(selected.from_branch_id, (selected as any).fromBranch?.name)}
              </Typography>
              <Typography variant="body2">
                <b>To:</b> {resolveBranchLabel(selected.to_branch_id, (selected as any).toBranch?.name)}
              </Typography>
              {selected.status === 'APPROVED' || selected.status === 'IN_TRANSIT' ? (
                <Alert severity="warning">
                  This is a legacy transfer still using the old dispatch/receive workflow. New approvals now complete the transfer automatically.
                </Alert>
              ) : null}
              <Typography variant="body2">
                <b>Created at:</b> {dateTimeFmt((selected as any).created_at ?? null)}
              </Typography>
              <Typography variant="body2">
                <b>Posted at:</b> {dateTimeFmt((selected as any).dispatched_at ?? null)}
              </Typography>
              <Typography variant="body2">
                <b>Received at:</b> {dateTimeFmt((selected as any).received_at ?? null)}
              </Typography>
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
                    Approve &amp; Transfer
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
              {!canTransferCreate && !canTransferApprove && (
                <Alert severity="info">You have view-only access to transfer workflow actions.</Alert>
              )}

              {(requestMut.isPending ||
                approveMut.isPending ||
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



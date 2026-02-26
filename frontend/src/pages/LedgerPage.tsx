import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { useBranchesQuery, useLedgerQuery } from '../api/queries';
import { authStorage } from '../auth/authStorage';
import { BranchSelect } from '../components/BranchSelect';
import { useAuth } from '../auth/AuthProvider';
import type { StockLedger } from '../types/models';
import { getTransfer, type Transfer } from '../api/transfers';

const MOVEMENT_TYPES = ['', 'ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN', 'PO_RECEIVE'] as const;

function toInt(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function money(v?: string | null) {
  if (!v) return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function qty(v?: string | null) {
  if (!v) return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function LedgerPage() {
  const { user, can } = useAuth();
  const canBranchView = can('BRANCH_VIEW');
  const branchesQuery = useBranchesQuery(canBranchView);
  const [searchParams, setSearchParams] = useSearchParams();

  const [branchId, setBranchId] = useState<number | ''>(() => {
    const fromUrl = toInt(searchParams.get('branch_id'));
    if (fromUrl) return fromUrl;
    const fromStorage = authStorage.getLastBranchId();
    return fromStorage ?? (user?.branch_id ?? '');
  });

  const [page, setPage] = useState<number>(() => toInt(searchParams.get('page')) ?? 1);
  const [movementType, setMovementType] = useState<string>(() => searchParams.get('movement_type') ?? '');
  const [productVariantId, setProductVariantId] = useState<number | null>(() =>
    toInt(searchParams.get('product_variant_id'))
  );

  // ref filters (server-side)
  const [refType, setRefType] = useState<string>(() => searchParams.get('ref_type') ?? '');
  const [refId, setRefId] = useState<number | null>(() => toInt(searchParams.get('ref_id')));

  // server-side search (debounced)
  const [search, setSearch] = useState<string>(() => searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') ?? '');

  // row drawer
  const [selected, setSelected] = useState<StockLedger | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // hydrate state from URL
  useEffect(() => {
    const urlBranch = toInt(searchParams.get('branch_id'));
    const urlPage = toInt(searchParams.get('page')) ?? 1;
    const urlMove = searchParams.get('movement_type') ?? '';
    const urlVariant = toInt(searchParams.get('product_variant_id'));
    const urlRefType = searchParams.get('ref_type') ?? '';
    const urlRefId = toInt(searchParams.get('ref_id'));
    const urlSearch = searchParams.get('search') ?? '';

    if (urlBranch && urlBranch !== branchId) {
      setBranchId(urlBranch);
      authStorage.setLastBranchId(urlBranch);
    }
    if (urlPage !== page) setPage(urlPage);
    if (urlMove !== movementType) setMovementType(urlMove);
    if ((urlVariant ?? null) !== (productVariantId ?? null)) setProductVariantId(urlVariant);

    if (urlRefType !== refType) setRefType(urlRefType);
    if ((urlRefId ?? null) !== (refId ?? null)) setRefId(urlRefId);

    if (urlSearch !== search) {
      setSearch(urlSearch);
      setDebouncedSearch(urlSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // default branch once loaded
  useEffect(() => {
    if (!canBranchView) return;
    if (branchId !== '' || !branchesQuery.data?.length) return;
    const preferred = user?.branch_id ? branchesQuery.data.find((b) => b.id === user.branch_id) : null;
    const first = preferred ?? branchesQuery.data[0];
    setBranchId(first.id);
    authStorage.setLastBranchId(first.id);
  }, [canBranchView, branchId, branchesQuery.data, user?.branch_id]);

  // sync state -> URL
  useEffect(() => {
    if (branchId === '') return;

    const next = new URLSearchParams();
    next.set('branch_id', String(branchId));
    if (page !== 1) next.set('page', String(page));
    if (movementType) next.set('movement_type', movementType);
    if (productVariantId) next.set('product_variant_id', String(productVariantId));
    if (refType) next.set('ref_type', refType);
    if (refId) next.set('ref_id', String(refId));
    if (debouncedSearch) next.set('search', debouncedSearch);

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, page, movementType, productVariantId, refType, refId, debouncedSearch]);

  const ledgerQuery = useLedgerQuery(
    {
      branch_id: branchId === '' ? 0 : branchId,
      page,
      movement_type: movementType || undefined,
      product_variant_id: productVariantId || undefined,
      ref_type: refType || undefined,
      ref_id: refId || undefined,
      search: debouncedSearch || undefined,
    },
    branchId !== ''
  );

  const rows = ledgerQuery.data?.data ?? [];
  const totalPages = ledgerQuery.data?.last_page ?? 1;

  // branch map for quick label lookup
  const branchMap = useMemo(() => {
    const m = new Map<number, { id: number; code?: string | null; name: string }>();
    for (const b of branchesQuery.data ?? []) m.set(b.id, b);
    if (user?.branch_id && user?.branch?.name) {
      m.set(user.branch_id, user.branch);
    }
    return m;
  }, [branchesQuery.data, user?.branch_id, user?.branch]);

  const branchLabel = (id?: number | null) => {
    if (!id) return '-';
    const b = branchMap.get(id);
    if (!b) return String(id);
    return b.code ? `${b.code} — ${b.name}` : b.name;
  };

  // collect unique transfer ref ids from visible rows
  const transferIds = useMemo(() => {
    const set = new Set<number>();
    for (const r of rows) {
      if (r.ref_type === 'transfers' && r.ref_id) set.add(Number(r.ref_id));
    }
    return Array.from(set);
  }, [rows]);

  // fetch transfer details for those refs (to show counterparty)
  const transferQueries = useQueries({
    queries: transferIds.map((id) => ({
      queryKey: ['transfer', id],
      queryFn: () => getTransfer(id),
      enabled: branchId !== '' && !!id,
      staleTime: 60_000,
    })),
  });

  const transferById = useMemo(() => {
    const m = new Map<number, Transfer>();
    for (const q of transferQueries) {
      const t = q.data as Transfer | undefined;
      if (t?.id) m.set(t.id, t);
    }
    return m;
  }, [transferQueries]);

  const transferCounterparty = (r: StockLedger) => {
    if (r.ref_type !== 'transfers' || !r.ref_id) return '-';
    const t = transferById.get(Number(r.ref_id));
    if (!t) return '…'; // loading

    if (r.movement_type === 'TRANSFER_OUT') return `To: ${branchLabel((t as any).to_branch_id ?? (t as any).toBranch?.id)}`;
    if (r.movement_type === 'TRANSFER_IN') return `From: ${branchLabel((t as any).from_branch_id ?? (t as any).fromBranch?.id)}`;

    const fromId = (t as any).from_branch_id ?? (t as any).fromBranch?.id;
    const toId = (t as any).to_branch_id ?? (t as any).toBranch?.id;
    return `${branchLabel(fromId)} → ${branchLabel(toId)}`;
  };

  const filteredRows = rows;

  const closeDrawer = () => setSelected(null);

  const clearExtraFilters = () => {
    setMovementType('');
    setProductVariantId(null);
    setRefType('');
    setRefId(null);
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
    setSelected(null);

    if (branchId !== '') {
      const next = new URLSearchParams();
      next.set('branch_id', String(branchId));
      setSearchParams(next, { replace: true });
    }
  };

  const hasExtraFilters = !!movementType || !!productVariantId || !!refType || !!refId || !!debouncedSearch;

  const selectedTransfer =
    selected?.ref_type === 'transfers' && selected?.ref_id ? transferById.get(Number(selected.ref_id)) : null;

  const selectedTransferFrom =
    (selectedTransfer as any)?.fromBranch?.id ?? (selectedTransfer as any)?.from_branch_id ?? null;
  const selectedTransferTo =
    (selectedTransfer as any)?.toBranch?.id ?? (selectedTransfer as any)?.to_branch_id ?? null;
  const selectedBranchLabel =
    user?.branch?.name ??
    (typeof branchId === 'number' ? `Branch #${branchId}` : 'No branch assigned');

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Ledger</Typography>

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
                setProductVariantId(null);
                setRefType('');
                setRefId(null);
                setSelected(null);
              }}
            />
          ) : (
            <TextField size="small" label="Branch" value={selectedBranchLabel} disabled fullWidth />
          )}
        </Box>

        <TextField
          select
          size="small"
          label="Movement type"
          value={movementType}
          onChange={(e) => {
            setMovementType(e.target.value);
            setPage(1);
          }}
          sx={{ width: 220 }}
        >
          {MOVEMENT_TYPES.map((t) => (
            <MenuItem key={t || 'ALL'} value={t}>
              {t ? t : 'All'}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          size="small"
          label="Search (SKU / product / ref / notes)"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          sx={{ flex: 2, minWidth: 260 }}
        />
      </Stack>

      {hasExtraFilters && (
        <Paper variant="outlined" sx={{ p: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
            {movementType && (
              <Chip
                size="small"
                label={`Type: ${movementType}`}
                onDelete={() => {
                  setMovementType('');
                  setPage(1);
                }}
              />
            )}
            {productVariantId && (
              <Chip
                size="small"
                label={`Variant ID: ${productVariantId}`}
                onDelete={() => {
                  setProductVariantId(null);
                  setPage(1);
                }}
              />
            )}
            {refType && (
              <Chip
                size="small"
                label={`Ref: ${refType}${refId ? ` #${refId}` : ''}`}
                onDelete={() => {
                  setRefType('');
                  setRefId(null);
                  setPage(1);
                }}
              />
            )}
            {debouncedSearch && (
              <Chip
                size="small"
                label={`Search: ${debouncedSearch}`}
                onDelete={() => {
                  setSearch('');
                  setDebouncedSearch('');
                  setPage(1);
                }}
              />
            )}

            <Box sx={{ flexGrow: 1 }} />

            <Button size="small" onClick={clearExtraFilters} sx={{ textTransform: 'none' }}>
              Clear filters
            </Button>
          </Stack>
        </Paper>
      )}

      {branchId === '' ? (
        <Alert severity={canBranchView ? 'info' : 'error'}>
          {canBranchView ? 'Select a branch to view ledger.' : 'No branch assigned to your account.'}
        </Alert>
      ) : ledgerQuery.isLoading ? (
        <Alert severity="info">Loading ledger…</Alert>
      ) : ledgerQuery.isError ? (
        <Alert severity="error">Failed to load ledger.</Alert>
      ) : filteredRows.length === 0 ? (
        <Alert severity="warning">No ledger entries found.</Alert>
      ) : (
        <Paper variant="outlined">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>SKU</TableCell>
                <TableCell>Product</TableCell>
                <TableCell align="right">Qty Δ</TableCell>
                <TableCell>Ref</TableCell>
                <TableCell>Counterparty</TableCell>
                <TableCell>By</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.map((r) => {
                const v = r.variant;
                const p = v?.product;
                const performer = r.performed_by ?? (r as any).performedBy;
                const ref = r.ref_type ? `${r.ref_type}${r.ref_id ? ` #${r.ref_id}` : ''}` : '-';

                return (
                  <TableRow key={r.id} hover onClick={() => setSelected(r)} sx={{ cursor: 'pointer' }}>
                    <TableCell>{r.posted_at ? new Date(r.posted_at).toLocaleString() : '-'}</TableCell>
                    <TableCell>{r.movement_type ?? '-'}</TableCell>
                    <TableCell>{v?.sku ?? '-'}</TableCell>
                    <TableCell>{p?.name ?? '-'}</TableCell>
                    <TableCell align="right">{qty(r.qty_delta)}</TableCell>
                    <TableCell>{ref}</TableCell>
                    <TableCell>{transferCounterparty(r)}</TableCell>
                    <TableCell>{performer?.name ?? '-'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      )}

      {branchId !== '' && totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} showFirstButton showLastButton />
        </Box>
      )}

      <Drawer anchor="right" open={!!selected} onClose={closeDrawer}>
        <Box sx={{ width: { xs: '100vw', sm: 420 }, maxWidth: '100vw', p: { xs: 2, sm: 2.5 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Ledger Entry</Typography>
            <Button onClick={closeDrawer}>Close</Button>
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          {selected && (
            <Stack spacing={1.25}>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                ID: {selected.id}
              </Typography>

              <Typography variant="body2">
                <b>Posted:</b> {selected.posted_at ? new Date(selected.posted_at).toLocaleString() : '-'}
              </Typography>

              <Typography variant="body2">
                <b>Movement:</b> {selected.movement_type ?? '-'}
              </Typography>

              <Typography variant="body2">
                <b>Branch:</b> {(selected as any).branch?.name ?? (selected as any).branch_id}
              </Typography>

              {selectedTransfer && (
                <Typography variant="body2">
                  <b>Transfer route:</b> {branchLabel(selectedTransferFrom)} → {branchLabel(selectedTransferTo)}
                </Typography>
              )}

              <Divider sx={{ my: 1 }} />

              <Typography variant="body2">
                <b>SKU:</b> {selected.variant?.sku ?? '-'}
              </Typography>
              <Typography variant="body2">
                <b>Barcode:</b> {selected.variant?.barcode ?? '-'}
              </Typography>
              <Typography variant="body2">
                <b>Product:</b> {selected.variant?.product?.name ?? '-'}
              </Typography>
              <Typography variant="body2">
                <b>Variant:</b> {(selected.variant as any)?.variant_name ?? '-'}
              </Typography>

              <Divider sx={{ my: 1 }} />

              <Typography variant="body2">
                <b>Qty Δ:</b> {qty((selected as any).qty_delta)}
              </Typography>
              <Typography variant="body2">
                <b>Unit cost:</b> {money((selected as any).unit_cost)}
              </Typography>
              <Typography variant="body2">
                <b>Unit price:</b> {money((selected as any).unit_price)}
              </Typography>

              <Typography variant="body2">
                <b>Reason:</b> {(selected as any).reason_code ?? '-'}
              </Typography>

              <Typography variant="body2">
                <b>Reference:</b>{' '}
                {(selected as any).ref_type
                  ? `${(selected as any).ref_type}${(selected as any).ref_id ? ` #${(selected as any).ref_id}` : ''}`
                  : '-'}
              </Typography>

              <Typography variant="body2">
                <b>Performed by:</b> {((selected as any).performed_by ?? (selected as any).performedBy)?.name ?? '-'}
              </Typography>

              <Typography variant="body2">
                <b>Notes:</b> {(selected as any).notes?.trim() ? (selected as any).notes : '-'}
              </Typography>
            </Stack>
          )}
        </Box>
      </Drawer>
    </Stack>
  );
}



import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useBranchesQuery,
  useInventoryQuery,
  useQuickPostAdjustmentMutation,
  useCreateAdjustmentMutation, // NEW
} from '../api/queries';
import { authStorage } from '../auth/authStorage';
import { BranchSelect } from '../components/BranchSelect';
import { useAuth } from '../auth/AuthProvider';

type SelectedItem = {
  inventory_id: number;
  branch_id: number;
  product_id: number;
  product_key: string;
  product_variant_id: number;
  sku: string;
  barcode: string;
  product: string;
  variant: string;
  flavor: string;
  brand: string;
  default_cost: number;
  default_price: number;
  stock_value: number;
  qty: number;
};

type ProductGroup = {
  product_id: number;
  product_key: string;
  product: string;
  brand: string;
  total_qty: number;
  variants: SelectedItem[];
};

function playBeep(kind: 'ok' | 'error') {
  try {
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = kind === 'ok' ? 880 : 220;
    gain.gain.value = 0.06;

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();

    const durationMs = kind === 'ok' ? 70 : 140;
    setTimeout(() => {
      osc.stop();
      ctx.close().catch(() => {});
    }, durationMs);
  } catch {
    // ignore audio failures
  }
}

function formatQty(value: number): string {
  return Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatMoney(value: number): string {
  return `₱${Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function InventoryPage() {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const canBranchView = can('BRANCH_VIEW');
  const branchesQuery = useBranchesQuery(canBranchView);
  const quickPostAdj = useQuickPostAdjustmentMutation();
  const createAdj = useCreateAdjustmentMutation();
  const canCreateAdjustment = can('ADJUSTMENT_CREATE');
  const canApproveAdjustment = can('ADJUSTMENT_APPROVE');
  const canPostAdjustment = can('ADJUSTMENT_POST');
  const canQuickPostStock = canCreateAdjustment && canApproveAdjustment && canPostAdjustment;
  const canSaveDraftStock = canCreateAdjustment;
  const canAdjustStock = canSaveDraftStock || canQuickPostStock;
  const canViewLedger = can('LEDGER_VIEW');

  const [branchId, setBranchId] = useState<number | ''>(() => {
    const fromStorage = authStorage.getLastBranchId();
    return fromStorage ?? (user?.branch_id ?? '');
  });

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const searchRef = useRef<HTMLInputElement | null>(null);

  // Drawer + stock dialog
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [stockOpen, setStockOpen] = useState(false);
  const [stockQty, setStockQty] = useState<string>('1');
  const [stockUnitCost, setStockUnitCost] = useState<string>('');
  const [stockNotes, setStockNotes] = useState<string>('');

  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(() => ({
    open: false,
    message: '',
    severity: 'success',
  }));

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Pick a default branch once branches load
  useEffect(() => {
    if (!canBranchView) return;
    if (branchId !== '' || !branchesQuery.data?.length) return;
    const preferred = user?.branch_id ? branchesQuery.data.find((b) => b.id === user.branch_id) : null;
    const first = preferred ?? branchesQuery.data[0];
    setBranchId(first.id);
    authStorage.setLastBranchId(first.id);
  }, [canBranchView, branchId, branchesQuery.data, user?.branch_id]);

  // For roles without BRANCH_VIEW, force their assigned branch and ignore stale saved branch ids.
  useEffect(() => {
    if (canBranchView) return;
    const assigned = user?.branch_id ?? '';
    if (branchId !== assigned) {
      setBranchId(assigned);
    }
  }, [canBranchView, user?.branch_id, branchId]);

  const invQuery = useInventoryQuery(
    {
      branch_id: branchId === '' ? 0 : branchId,
      page,
      search: debouncedSearch || undefined,
    },
    branchId !== ''
  );

  const rows = invQuery.data?.data ?? [];
  const totalPages = invQuery.data?.last_page ?? 1;

  const prettyRows = useMemo(() => {
    return rows.map((r) => {
      const variant = r.variant;
      const product = variant?.product;
      const brand = product?.brand?.name ?? '-';
      const productId = Number(product?.id ?? 0);
      const productName = product?.name ?? '-';
      const productKey =
        productId > 0
          ? `product:${productId}`
          : `name:${String(productName).trim().toLowerCase()}|${String(brand).trim().toLowerCase()}`;
      return {
        inventory_id: r.id,
        branch_id: (branchId === '' ? 0 : branchId) as number,
        product_id: productId,
        product_key: productKey,
        product_variant_id: variant?.id ?? 0,
        sku: variant?.sku ?? '-',
        barcode: variant?.barcode ?? '-',
        product: productName,
        variant: variant?.variant_name ?? '-',
        flavor: variant?.flavor ?? '-',
        brand,
        default_cost: Number(variant?.default_cost ?? 0),
        default_price: Number(variant?.default_price ?? 0),
        stock_value: Number(r.qty_on_hand ?? 0) * Number(variant?.default_cost ?? 0),
        qty: Number(r.qty_on_hand ?? 0),
      } as SelectedItem;
    });
  }, [rows, branchId]);

  const groupedProducts = useMemo<ProductGroup[]>(() => {
    const groups = new Map<string, ProductGroup>();

    for (const row of prettyRows) {
      const existing = groups.get(row.product_key);
      if (!existing) {
        groups.set(row.product_key, {
          product_id: row.product_id,
          product_key: row.product_key,
          product: row.product,
          brand: row.brand,
          total_qty: Number(row.qty ?? 0),
          variants: [row],
        });
        continue;
      }

      existing.total_qty += Number(row.qty ?? 0);
      existing.variants.push(row);
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        variants: [...group.variants].sort((a, b) => {
          const byVariant = String(a.variant ?? '').localeCompare(String(b.variant ?? ''));
          if (byVariant !== 0) return byVariant;
          return String(a.sku ?? '').localeCompare(String(b.sku ?? ''));
        }),
      }))
      .sort((a, b) => String(a.product ?? '').localeCompare(String(b.product ?? '')));
  }, [prettyRows]);

  // Keep search focused for scanner workflow
  useEffect(() => {
    if (!searchRef.current) return;
    const t = setTimeout(() => searchRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [branchId]);

  const openDetails = (item: SelectedItem, source: 'scan' | 'click' = 'click') => {
    setSelected(item);
    if (source === 'scan') playBeep('ok');
  };

  const closeDetails = () => setSelected(null);

  const openStock = () => {
    if (!canAdjustStock) {
      setSnack({ open: true, message: 'Not authorized to adjust stock.', severity: 'error' });
      return;
    }

    setStockQty('1');
    setStockUnitCost('');
    setStockNotes('');
    setStockOpen(true);
  };

  const closeStock = () => setStockOpen(false);

  const validateStockInputs = () => {
    const qty = Number(stockQty);
    if (!Number.isFinite(qty) || qty === 0) {
      setSnack({ open: true, message: 'Enter a valid quantity (non-zero).', severity: 'error' });
      playBeep('error');
      return { ok: false as const };
    }

    const unitCost = stockUnitCost.trim() ? Number(stockUnitCost) : null;
    if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) {
      setSnack({ open: true, message: 'Unit cost must be a valid number (>= 0).', severity: 'error' });
      playBeep('error');
      return { ok: false as const };
    }

    return { ok: true as const, qty, unitCost };
  };

  const afterStockAction = () => {
    // keep scanner flow clean
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const handleQuickPostStock = async () => {
    if (!canQuickPostStock) {
      setSnack({ open: true, message: 'Not authorized to quick post stock.', severity: 'error' });
      return;
    }
    if (!selected || branchId === '') return;

    const v = validateStockInputs();
    if (!v.ok) return;

    try {
      await quickPostAdj.mutateAsync({
        branch_id: branchId,
        reason_code: 'OPENING',
        notes: stockNotes.trim() ? stockNotes.trim() : null,
        items: [
          {
            product_variant_id: selected.product_variant_id,
            qty_delta: v.qty,
            unit_cost: v.unitCost,
            notes: null,
          },
        ],
      });

      setSnack({ open: true, message: 'Stock posted. Inventory + ledger updated.', severity: 'success' });
      playBeep('ok');
      closeStock();
      afterStockAction();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to post stock.';
      setSnack({ open: true, message: msg, severity: 'error' });
      playBeep('error');
    }
  };

  // NEW: Save Draft (does not affect inventory yet)
  const handleSaveDraftStock = async () => {
    if (!canSaveDraftStock) {
      setSnack({ open: true, message: 'Not authorized to create adjustments.', severity: 'error' });
      return;
    }
    if (!selected || branchId === '') return;

    const v = validateStockInputs();
    if (!v.ok) return;

    try {
      const draft = await createAdj.mutateAsync({
        branch_id: branchId,
        reason_code: 'OPENING',
        notes: stockNotes.trim() ? stockNotes.trim() : null,
        reference_no: null,
        items: [
          {
            product_variant_id: selected.product_variant_id,
            qty_delta: v.qty,
            unit_cost: v.unitCost,
            notes: null,
          },
        ],
      });

      setSnack({
        open: true,
        message: `Draft adjustment #${draft.id} created. Submit/approve/post from Adjustments.`,
        severity: 'success',
      });

      closeStock();
      // jump to adjustments filtered to drafts
      const params = new URLSearchParams();
      params.set('branch_id', String(branchId));
      params.set('status', 'DRAFT');
      navigate(`/adjustments?${params.toString()}`);
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to create draft.';
      setSnack({ open: true, message: msg, severity: 'error' });
      playBeep('error');
    }
  };

  const goToLedgerForSelected = () => {
    if (!canViewLedger) {
      setSnack({ open: true, message: 'Not authorized: LEDGER_VIEW', severity: 'error' });
      return;
    }
    if (!selected || branchId === '') return;

    const params = new URLSearchParams();
    params.set('branch_id', String(branchId));
    params.set('product_variant_id', String(selected.product_variant_id)); // real filter
    params.set('search', selected.sku); // UI hint
    navigate(`/ledger?${params.toString()}`);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;

    const typed = search.trim();
    if (!typed) return;

    if (prettyRows.length === 0) {
      setSnack({ open: true, message: 'No match found.', severity: 'error' });
      playBeep('error');
      return;
    }

    openDetails(prettyRows[0], 'scan');

    setSearch('');
    setDebouncedSearch('');
    setPage(1);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const busy = quickPostAdj.isPending || createAdj.isPending;
  const branchLabel =
    user?.branch?.name ??
    (typeof branchId === 'number' ? `Branch #${branchId}` : 'No branch assigned');

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Inventory</Typography>

      {!canAdjustStock && (
        <Alert severity="info">You have view-only access to inventory on this account.</Alert>
      )}

      {canBranchView && branchesQuery.isError && <Alert severity="error">Failed to load branches.</Alert>}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <Box sx={{ flex: 1, minWidth: { md: 260 } }}>
          {canBranchView ? (
            <BranchSelect
              branches={branchesQuery.data ?? []}
              value={branchId}
              onChange={(id) => {
                setBranchId(id);
                authStorage.setLastBranchId(id);
                setPage(1);
                setSelected(null);
                setTimeout(() => searchRef.current?.focus(), 50);
              }}
            />
          ) : (
            <TextField size="small" label="Branch" value={branchLabel} disabled fullWidth />
          )}
        </Box>

        <TextField
          inputRef={searchRef}
          size="small"
          label="Scan / Search SKU / barcode / variant"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          onKeyDown={handleSearchKeyDown}
          sx={{ flex: 2, minWidth: { md: 260 } }}
        />
      </Stack>
      {branchId === '' ? (
        <Alert severity={canBranchView ? 'info' : 'error'}>
          {canBranchView ? 'Select a branch to view inventory.' : 'No branch assigned to your account.'}
        </Alert>
      ) : invQuery.isLoading ? (
        <Alert severity="info">Loading inventory...</Alert>
      ) : invQuery.isError ? (
        <Alert severity="error">Failed to load inventory.</Alert>
      ) : rows.length === 0 ? (
        <Alert severity="warning">No inventory found for this branch.</Alert>
      ) : isCompact ? (
        <Stack spacing={1.1}>
          {groupedProducts.map((group) => {
            const selectedItem = !!selected && group.variants.some((variant) => variant.inventory_id === selected.inventory_id);
            return (
              <Paper
                key={group.product_key}
                variant="outlined"
                sx={{
                  p: 1.25,
                  borderRadius: 2.5,
                  borderColor: selectedItem ? 'primary.main' : 'divider',
                  bgcolor: selectedItem ? 'action.hover' : 'background.paper',
                  transition: 'all 0.18s ease',
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontWeight: 700 }} noWrap>
                        {group.product}
                      </Typography>
                      <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap" sx={{ mt: 0.4 }}>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={group.brand}
                          sx={{ height: 22 }}
                        />
                        <Chip
                          size="small"
                          color="primary"
                          variant="outlined"
                          label={`${group.variants.length} variants`}
                          sx={{ height: 22 }}
                        />
                      </Stack>
                    </Box>
                    <Chip
                      size="small"
                      color={group.total_qty <= 0 ? 'error' : 'default'}
                      label={`Total ${formatQty(group.total_qty)}`}
                      sx={{ fontWeight: 700 }}
                    />
                  </Stack>

                  <Stack spacing={0.75}>
                    {group.variants.map((variant) => {
                      const variantSelected = selected?.inventory_id === variant.inventory_id;
                      return (
                        <Paper
                          key={variant.inventory_id}
                          variant="outlined"
                          onClick={() => openDetails(variant, 'click')}
                          sx={{
                            p: 0.9,
                            cursor: 'pointer',
                            borderStyle: 'dashed',
                            borderColor: variantSelected ? 'primary.main' : 'divider',
                            bgcolor: variantSelected ? 'action.hover' : 'background.default',
                            transition: 'all 0.18s ease',
                            '&:hover': {
                              borderColor: 'primary.light',
                            },
                          }}
                        >
                          <Stack spacing={0.4}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                              <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 0 }} noWrap>
                                {variant.variant}
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 700, color: variant.qty <= 0 ? 'error.main' : 'text.primary' }}
                              >
                                {formatQty(variant.qty)}
                              </Typography>
                            </Stack>
                            <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                              SKU: {variant.sku}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                              Flavor: {variant.flavor}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                              Barcode: {variant.barcode}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                              Supply Cost: {formatMoney(variant.default_cost)} | Sale Price: {formatMoney(variant.default_price)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                              Stock value: {formatMoney(variant.stock_value)}
                            </Typography>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      ) : (
        <Paper variant="outlined">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell>Brand</TableCell>
                <TableCell>Variant</TableCell>
                <TableCell>Flavor</TableCell>
                <TableCell>SKU</TableCell>
                <TableCell align="right">Supply Cost</TableCell>
                <TableCell align="right">Sale Price</TableCell>
                <TableCell align="right">Selected Qty</TableCell>
                <TableCell align="right">Stock Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groupedProducts.flatMap((group) =>
                group.variants.map((variant, idx) => {
                  const showGroupMeta = idx === 0;
                  const variantSelected = selected?.inventory_id === variant.inventory_id;
                  return (
                    <TableRow
                      key={`${group.product_key}:${variant.inventory_id}`}
                      hover
                      onClick={() => openDetails(variant, 'click')}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: variantSelected ? 'action.hover' : undefined,
                      }}
                    >
                      <TableCell>
                        {showGroupMeta ? (
                          <Stack spacing={0.35}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {group.product}
                            </Typography>
                            {group.variants.length > 1 && (
                              <Typography variant="caption" color="primary.main">
                                {group.variants.length} variants
                              </Typography>
                            )}
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            {group.product}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{group.brand}</TableCell>
                      <TableCell>{variant.variant}</TableCell>
                      <TableCell>{variant.flavor}</TableCell>
                      <TableCell>{variant.sku}</TableCell>
                      <TableCell align="right">{formatMoney(variant.default_cost)}</TableCell>
                      <TableCell align="right">{formatMoney(variant.default_price)}</TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: variant.qty <= 0 ? 'error.main' : 'text.primary', fontWeight: 700 }}
                      >
                        {formatQty(variant.qty)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'text.primary', fontWeight: showGroupMeta ? 700 : 400 }}>
                        {formatMoney(variant.stock_value)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {branchId !== '' && totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} showFirstButton showLastButton />
        </Box>
      )}

      {/* Details Drawer */}
      <Drawer anchor="right" open={!!selected} onClose={closeDetails}>
        <Box sx={{ width: { xs: '100vw', sm: 380 }, maxWidth: '100vw', p: { xs: 2, sm: 2.5 } }}>
          <Typography variant="h6" gutterBottom>
            Item Details
          </Typography>

          {selected && (
            <Stack spacing={1.2}>
              <Typography variant="subtitle2">{selected.product}</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Variant: {selected.variant}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Flavor: {selected.flavor}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                SKU: {selected.sku}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Barcode: {selected.barcode}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Brand: {selected.brand}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Supply Cost: {formatMoney(selected.default_cost)}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Sale Price: {formatMoney(selected.default_price)}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Stock value: {formatMoney(selected.stock_value)}
              </Typography>

              <Box sx={{ py: 1 }}>
                <Typography variant="h5">{selected.qty.toLocaleString(undefined, { maximumFractionDigits: 3 })}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Qty on hand
                </Typography>
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                {canAdjustStock && (
                  <Button variant="contained" onClick={openStock} disabled={busy}>
                    Add Stock
                  </Button>
                )}
                {canViewLedger && (
                  <Button variant="outlined" onClick={goToLedgerForSelected}>
                    View Ledger
                  </Button>
                )}
              </Stack>

              <Button color="inherit" onClick={closeDetails}>
                Close
              </Button>
            </Stack>
          )}
        </Box>
      </Drawer>

      {/* Add Stock Dialog */}
      <Dialog open={stockOpen} onClose={closeStock} fullWidth maxWidth="sm">
        <DialogTitle>Add Stock</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Alert severity="info">
              {canQuickPostStock && (
                <>
                  <b>Post</b> updates inventory + ledger immediately. <br />
                </>
              )}
              {canSaveDraftStock && (
                <>
                  <b>Save Draft</b> creates an adjustment you can review/approve/post later.
                </>
              )}
              {!canAdjustStock && <>You do not have stock adjustment permissions.</>}
            </Alert>

            <TextField
              label="Qty delta (+/-)"
              type="number"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
            />
            <TextField
              label="Unit cost (optional)"
              type="number"
              value={stockUnitCost}
              onChange={(e) => setStockUnitCost(e.target.value)}
              inputProps={{ step: '0.01', min: '0' }}
            />
            <TextField label="Notes (optional)" value={stockNotes} onChange={(e) => setStockNotes(e.target.value)} />

            {busy && <Alert severity="info">Working...</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeStock} disabled={busy}>
            Cancel
          </Button>

          {canSaveDraftStock && (
            <Button variant="outlined" onClick={handleSaveDraftStock} disabled={busy}>
              Save Draft
            </Button>
          )}

          {canQuickPostStock && (
            <Button variant="contained" onClick={handleQuickPostStock} disabled={busy}>
              Post Now
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={2200}
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




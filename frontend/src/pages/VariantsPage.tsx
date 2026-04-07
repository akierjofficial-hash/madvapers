import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
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
import { useEffect, useMemo, useRef, useState } from 'react';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useNavigate } from 'react-router-dom';
import {
  useBranchesQuery,
  useCreateVariantMutation,
  useDisableVariantMutation,
  useEnableVariantMutation,
  useProductsQuery,
  usePurgeVariantMutation,
  useQuickPostAdjustmentMutation,
  useUpdateVariantMutation,
  useVariantsQuery,
} from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { authStorage } from '../auth/authStorage';
import {
  requestDialogActionsSx,
  requestDialogContentSx,
  requestDialogSx,
  requestDialogTitleSx,
  requestSectionSx,
} from '../components/requestDialogStyles';

function slugSkuPart(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function shortSuffix() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(2);
}

function suggestedUnitCost(defaultCost: string | number | null | undefined, defaultPrice: string | number | null | undefined) {
  const cost = Number(defaultCost);
  if (Number.isFinite(cost) && cost > 0) return cost.toFixed(2);

  const price = Number(defaultPrice);
  if (Number.isFinite(price) && price > 0) return price.toFixed(2);

  return '';
}

type SnackState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info';
};

const DELETE_UNDO_MS = 5000;

export function VariantsPage() {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const canCreate = can('PRODUCT_CREATE');
  const canUpdate = can('PRODUCT_UPDATE');
  const canDisable = can('PRODUCT_DISABLE');
  const canDelete = can('PRODUCT_DELETE');
  const canBranchView = can('BRANCH_VIEW');
  const canQuickAdjustStock = can('ADJUSTMENT_CREATE') && can('ADJUSTMENT_APPROVE') && can('ADJUSTMENT_POST');

  const branchesQuery = useBranchesQuery(canBranchView);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState<number | null>(null);

  const [productId, setProductId] = useState<number | ''>('');
  const [sku, setSku] = useState('');
  const [variantName, setVariantName] = useState('');
  const [variantFlavor, setVariantFlavor] = useState('');
  const [defaultPrice, setDefaultPrice] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editVariantName, setEditVariantName] = useState('');
  const [editVariantFlavor, setEditVariantFlavor] = useState('');
  const [editDefaultPrice, setEditDefaultPrice] = useState('');

  const [stockOpen, setStockOpen] = useState(false);
  const [stockVariant, setStockVariant] = useState<{ id: number; sku: string } | null>(null);
  const [stockBranchId, setStockBranchId] = useState<number | ''>(
    () => authStorage.getLastBranchId() ?? (user?.branch_id ?? '')
  );
  const [stockQty, setStockQty] = useState('1');
  const [stockUnitCost, setStockUnitCost] = useState('');
  const [stockNotes, setStockNotes] = useState('');
  const [disableConfirmTarget, setDisableConfirmTarget] = useState<{ id: number; sku: string } | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: number; sku: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; sku: string } | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [snack, setSnack] = useState<SnackState>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (stockBranchId !== '') return;
    if (user?.branch_id) {
      setStockBranchId(user.branch_id);
      authStorage.setLastBranchId(user.branch_id);
      return;
    }
    if (!canBranchView || !(branchesQuery.data?.length)) return;
    const first = branchesQuery.data[0];
    setStockBranchId(first.id);
    authStorage.setLastBranchId(first.id);
  }, [stockBranchId, canBranchView, branchesQuery.data, user?.branch_id]);

  const variantsQuery = useVariantsQuery(
    {
      page,
      search: debouncedSearch || undefined,
      include_inactive: includeInactive ? true : undefined,
    },
    true
  );
  const productsQuery = useProductsQuery({ page: 1, include_inactive: false }, openCreate && canCreate);
  const createVariant = useCreateVariantMutation();
  const updateVariant = useUpdateVariantMutation();
  const disableVariant = useDisableVariantMutation();
  const enableVariant = useEnableVariantMutation();
  const purgeVariant = usePurgeVariantMutation();
  const quickPostAdj = useQuickPostAdjustmentMutation();

  const rows = variantsQuery.data?.data ?? [];
  const totalPages = variantsQuery.data?.last_page ?? 1;
  const products = productsQuery.data?.data ?? [];

  const tableRows = useMemo(() => {
    return rows.map((v) => ({
      id: v.id,
      sku: v.sku ?? '-',
      product: v.product?.name ?? '-',
      productType: (v.product?.product_type ?? '-').replace(/_/g, ' '),
      variant: v.variant_name ?? '-',
      flavor: v.flavor ?? '-',
      defaultCost: v.default_cost,
      price: v.default_price,
      brand: v.product?.brand?.name ?? '-',
      active: v.is_active ?? true,
    }));
  }, [rows]);

  const resetCreate = () => {
    setProductId('');
    setSku('');
    setVariantName('');
    setVariantFlavor('');
    setDefaultPrice('');
  };

  const selectedProduct = useMemo(() => {
    if (typeof productId !== 'number') return '';
    return products.find((p) => p.id === productId) ?? '';
  }, [productId, products]);

  const selectedProductName = typeof selectedProduct === 'string' ? '' : selectedProduct.name ?? '';

  const generateSku = () => {
    if (!canCreate) return;
    const productName = selectedProductName.trim();
    if (!productName) {
      setSnack({ open: true, message: 'Select a product first.', severity: 'error' });
      return;
    }

    const productCode = slugSkuPart(productName);
    const variantCode = variantName.trim() ? slugSkuPart(variantName) : '';
    const base = variantCode ? `MV-${productCode}-${variantCode}` : `MV-${productCode}`;
    setSku(`${base}-${shortSuffix()}`);
  };

  const submitCreate = async () => {
    if (!canCreate) {
      setSnack({ open: true, message: 'Not authorized: PRODUCT_CREATE', severity: 'error' });
      return;
    }
    if (typeof productId !== 'number') {
      setSnack({ open: true, message: 'Product is required.', severity: 'error' });
      return;
    }
    if (!sku.trim()) {
      setSnack({ open: true, message: 'SKU is required.', severity: 'error' });
      return;
    }
    if (!variantName.trim()) {
      setSnack({ open: true, message: 'Variant name is required.', severity: 'error' });
      return;
    }
    if (!defaultPrice.trim()) {
      setSnack({ open: true, message: 'Price is required.', severity: 'error' });
      return;
    }
    const parsedDefaultPrice = Number(defaultPrice);
    if (!Number.isFinite(parsedDefaultPrice) || parsedDefaultPrice <= 0) {
      setSnack({ open: true, message: 'Price must be a valid number > 0.', severity: 'error' });
      return;
    }

    try {
      await createVariant.mutateAsync({
        product_id: productId,
        sku: sku.trim(),
        variant_name: variantName.trim(),
        flavor: variantFlavor.trim() || null,
        default_price: parsedDefaultPrice,
      });
      setSnack({ open: true, message: 'Variant created.', severity: 'success' });
      setOpenCreate(false);
      resetCreate();
    } catch (error: any) {
      setSnack({
        open: true,
        message: error?.response?.data?.message || 'Failed to create variant.',
        severity: 'error',
      });
    }
  };

  const openEditDialog = (id: number) => {
    if (!canUpdate) {
      setSnack({ open: true, message: 'Not authorized: PRODUCT_UPDATE', severity: 'error' });
      return;
    }

    const target = rows.find((v) => v.id === id);
    if (!target) {
      setSnack({ open: true, message: 'Variant not found.', severity: 'error' });
      return;
    }

    setEditingVariantId(target.id);
    setEditSku(target.sku ?? '');
    setEditVariantName(target.variant_name ?? '');
    setEditVariantFlavor(target.flavor ?? '');
    setEditDefaultPrice(target.default_price == null ? '' : String(target.default_price));
    setOpenEdit(true);
  };

  const closeEditDialog = () => {
    setOpenEdit(false);
    setEditingVariantId(null);
    setEditSku('');
    setEditVariantName('');
    setEditVariantFlavor('');
    setEditDefaultPrice('');
  };

  const submitEdit = async () => {
    if (!canUpdate) {
      setSnack({ open: true, message: 'Not authorized: PRODUCT_UPDATE', severity: 'error' });
      return;
    }
    if (!editingVariantId) {
      setSnack({ open: true, message: 'No variant selected.', severity: 'error' });
      return;
    }
    if (!editSku.trim()) {
      setSnack({ open: true, message: 'SKU is required.', severity: 'error' });
      return;
    }
    if (!editVariantName.trim()) {
      setSnack({ open: true, message: 'Variant name is required.', severity: 'error' });
      return;
    }
    if (!editDefaultPrice.trim()) {
      setSnack({ open: true, message: 'Price is required.', severity: 'error' });
      return;
    }
    const parsedEditDefaultPrice = Number(editDefaultPrice);
    if (!Number.isFinite(parsedEditDefaultPrice) || parsedEditDefaultPrice <= 0) {
      setSnack({ open: true, message: 'Price must be a valid number > 0.', severity: 'error' });
      return;
    }

    try {
      await updateVariant.mutateAsync({
        id: editingVariantId,
        input: {
          sku: editSku.trim(),
          variant_name: editVariantName.trim(),
          flavor: editVariantFlavor.trim() || null,
          default_price: parsedEditDefaultPrice,
        },
      });
      setSnack({ open: true, message: 'Variant updated.', severity: 'success' });
      closeEditDialog();
    } catch (error: any) {
      setSnack({
        open: true,
        message: error?.response?.data?.message || 'Failed to update variant.',
        severity: 'error',
      });
    }
  };

  const disable = async (id: number, skuLabel: string) => {
    if (!canDisable) {
      setSnack({ open: true, message: 'Not authorized: PRODUCT_DISABLE', severity: 'error' });
      return;
    }
    try {
      await disableVariant.mutateAsync(id);
      setSnack({ open: true, message: `${skuLabel} moved to inactive.`, severity: 'success' });
    } catch {
      setSnack({ open: true, message: 'Failed to disable variant.', severity: 'error' });
    }
  };

  const requestDisable = (id: number, skuLabel: string) => {
    if (!canDisable) {
      setSnack({ open: true, message: 'Not authorized: PRODUCT_DISABLE', severity: 'error' });
      return;
    }
    setDisableConfirmTarget({ id, sku: skuLabel });
  };

  const confirmDisable = async () => {
    if (!disableConfirmTarget) return;
    const target = disableConfirmTarget;
    setDisableConfirmTarget(null);
    await disable(target.id, target.sku);
  };

  const enable = async (id: number) => {
    if (!canDisable) {
      setSnack({ open: true, message: 'Not authorized: PRODUCT_DISABLE', severity: 'error' });
      return;
    }
    try {
      await enableVariant.mutateAsync(id);
    } catch {
      setSnack({ open: true, message: 'Failed to enable variant.', severity: 'error' });
    }
  };

  const commitPurge = async (id: number, skuLabel: string) => {
    try {
      await purgeVariant.mutateAsync(id);
      setSnack({
        open: true,
        message: `${skuLabel} deleted permanently.`,
        severity: 'success',
      });
    } catch (error: any) {
      setSnack({
        open: true,
        message: error?.response?.data?.message || 'Failed to delete variant.',
        severity: 'error',
      });
    } finally {
      deleteTimerRef.current = null;
      setPendingDelete((current) => (current?.id === id ? null : current));
    }
  };

  const purge = async (id: number, skuLabel: string) => {
    if (!canDelete) {
      setSnack({ open: true, message: 'Not authorized: PRODUCT_DELETE', severity: 'error' });
      return;
    }
    if (pendingDelete) {
      setSnack({
        open: true,
        message: 'A delete is already pending. Undo it first or wait a few seconds.',
        severity: 'error',
      });
      return;
    }

    setPendingDelete({ id, sku: skuLabel });
    deleteTimerRef.current = setTimeout(() => {
      void commitPurge(id, skuLabel);
    }, DELETE_UNDO_MS);

    setSnack({
      open: true,
      message: `${skuLabel} will be deleted permanently in ${DELETE_UNDO_MS / 1000} seconds.`,
      severity: 'info',
    });
  };

  const requestDelete = (id: number, skuLabel: string) => {
    if (!canDelete) {
      setSnack({ open: true, message: 'Not authorized: PRODUCT_DELETE', severity: 'error' });
      return;
    }
    setDeleteConfirmTarget({ id, sku: skuLabel });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    const target = deleteConfirmTarget;
    setDeleteConfirmTarget(null);
    await purge(target.id, target.sku);
  };

  const undoDelete = () => {
    if (!pendingDelete) return;
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    const skuLabel = pendingDelete.sku;
    setPendingDelete(null);
    setSnack({
      open: true,
      message: `Delete canceled for ${skuLabel}.`,
      severity: 'success',
    });
  };

  const openStock = (
    id: number,
    skuLabel: string,
    defaultCostValue: string | number | null | undefined,
    defaultPriceValue: string | number | null | undefined
  ) => {
    if (!canQuickAdjustStock) return;
    setStockVariant({ id, sku: skuLabel });
    setStockQty('1');
    setStockUnitCost(suggestedUnitCost(defaultCostValue, defaultPriceValue));
    setStockNotes('');
    setStockOpen(true);
  };

  const submitStock = async () => {
    if (!canQuickAdjustStock || !stockVariant) return;
    const branchIdNum = typeof stockBranchId === 'number' ? stockBranchId : 0;
    if (!branchIdNum) {
      setSnack({ open: true, message: 'Select a branch.', severity: 'error' });
      return;
    }

    const qty = Number(stockQty);
    if (!Number.isFinite(qty) || qty === 0) {
      setSnack({ open: true, message: 'Quantity must be non-zero.', severity: 'error' });
      return;
    }

    const unitCost = stockUnitCost.trim() ? Number(stockUnitCost) : null;
    if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) {
      setSnack({ open: true, message: 'Unit cost must be >= 0.', severity: 'error' });
      return;
    }

    try {
      authStorage.setLastBranchId(branchIdNum);
      await quickPostAdj.mutateAsync({
        branch_id: branchIdNum,
        reason_code: 'OPENING',
        notes: stockNotes.trim() || null,
        items: [
          {
            product_variant_id: stockVariant.id,
            qty_delta: qty,
            unit_cost: unitCost,
            notes: null,
          },
        ],
      });
      setStockOpen(false);
    } catch (error: any) {
      setSnack({
        open: true,
        message: error?.response?.data?.message || 'Failed to post stock movement.',
        severity: 'error',
      });
    }
  };

  const busy =
    updateVariant.isPending ||
    disableVariant.isPending ||
    enableVariant.isPending ||
    purgeVariant.isPending ||
    quickPostAdj.isPending ||
    !!pendingDelete;

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
      >
        <Stack>
          <Typography variant="h5">Variants</Typography>
          <Typography variant="body2" sx={{ opacity: 0.75 }}>
            SKU-level records only. Manage product definitions in Products.
          </Typography>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="outlined" onClick={() => navigate('/products')}>
            Products
          </Button>
          <Button
            variant="contained"
            disabled={!canCreate}
            onClick={() => {
              resetCreate();
              setOpenCreate(true);
            }}
          >
            New Variant
          </Button>
        </Stack>
      </Stack>

      {!canCreate && !canUpdate && !canDisable && !canDelete && !canQuickAdjustStock && (
        <Alert severity="info">You have view-only access to variants.</Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
        <TextField
          size="small"
          label="Search SKU / variant / flavor"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          sx={{ maxWidth: { md: 520 }, minWidth: { md: 280 }, flex: 1 }}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={includeInactive}
              onChange={(e) => {
                setIncludeInactive(e.target.checked);
                setPage(1);
              }}
            />
          }
          label="Include inactive"
        />
      </Stack>

      {variantsQuery.isLoading ? (
        <Alert severity="info">Loading variants...</Alert>
      ) : variantsQuery.isError ? (
        <Alert severity="error">Failed to load variants.</Alert>
      ) : tableRows.length === 0 ? (
        <Alert severity="warning">No variants found.</Alert>
      ) : isCompact ? (
        <Stack spacing={1.1}>
          {tableRows.map((row) => (
            <Paper key={row.id} variant="outlined" sx={{ p: 1.2, borderRadius: 2, opacity: row.active ? 1 : 0.72 }}>
              <Stack spacing={0.65}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                  <Typography sx={{ fontWeight: 700, minWidth: 0 }}>{row.sku}</Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      px: 1,
                      py: 0.2,
                      borderRadius: 999,
                      border: '1px solid',
                      borderColor: row.active ? 'success.light' : 'warning.light',
                      color: row.active ? 'success.dark' : 'warning.dark',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.active ? 'Active' : 'Inactive'}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {row.product} • {row.variant}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Flavor: {row.flavor}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {row.productType} • {row.brand}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Price: {formatMoney(row.price)}
                </Typography>
                {(canUpdate || canDisable || canDelete || canQuickAdjustStock) && (
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ pt: 0.3 }}>
                    {canUpdate && (
                      <Button size="small" variant="outlined" disabled={busy} onClick={() => openEditDialog(row.id)}>
                        Edit
                      </Button>
                    )}
                    {row.active && canQuickAdjustStock && (
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={busy}
                        onClick={() => openStock(row.id, row.sku, row.defaultCost, row.price)}
                      >
                        Add Stock
                      </Button>
                    )}
                    {row.active ? (
                      <>
                        {canDisable && (
                          <Button
                            size="small"
                            color="warning"
                            variant="outlined"
                            disabled={busy}
                            onClick={() => requestDisable(row.id, row.sku)}
                          >
                            Disable
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            disabled={busy}
                            onClick={() => requestDelete(row.id, row.sku)}
                          >
                            Delete
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        {canDisable && (
                          <Button
                            size="small"
                            color="success"
                            variant="outlined"
                            disabled={busy}
                            onClick={() => enable(row.id)}
                          >
                            Enable
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            disabled={busy}
                            onClick={() => requestDelete(row.id, row.sku)}
                          >
                            Delete
                          </Button>
                        )}
                      </>
                    )}
                  </Stack>
                )}
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
                <TableCell>SKU</TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Variant</TableCell>
                <TableCell>Flavor</TableCell>
                <TableCell align="right" width={120}>Price</TableCell>
                <TableCell>Brand</TableCell>
                {(canUpdate || canDisable || canDelete || canQuickAdjustStock) && (
                  <TableCell align="right">Actions</TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {tableRows.map((row) => (
                <TableRow key={row.id} hover sx={{ opacity: row.active ? 1 : 0.55 }}>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{row.id}</TableCell>
                  <TableCell>{row.sku}</TableCell>
                  <TableCell>{row.product}</TableCell>
                  <TableCell>{row.productType}</TableCell>
                  <TableCell>{row.variant}</TableCell>
                  <TableCell>{row.flavor}</TableCell>
                  <TableCell align="right">{formatMoney(row.price)}</TableCell>
                  <TableCell>{row.brand}</TableCell>
                  {(canUpdate || canDisable || canDelete || canQuickAdjustStock) && (
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        {canUpdate && (
                          <Button
                            size="small"
                            disabled={busy}
                            onClick={() => openEditDialog(row.id)}
                          >
                            Edit
                          </Button>
                        )}
                        {row.active && canQuickAdjustStock && (
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={busy}
                            onClick={() => openStock(row.id, row.sku, row.defaultCost, row.price)}
                          >
                            Add Stock
                          </Button>
                        )}
                        {row.active ? (
                          <>
                            {canDisable && (
                              <Button
                                size="small"
                                color="warning"
                                disabled={busy}
                                onClick={() => requestDisable(row.id, row.sku)}
                              >
                                Disable
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                size="small"
                                color="error"
                                disabled={busy}
                                onClick={() => requestDelete(row.id, row.sku)}
                              >
                                Delete
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            {canDisable && (
                              <Button size="small" color="success" disabled={busy} onClick={() => enable(row.id)}>
                                Enable
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                size="small"
                                color="error"
                                disabled={busy}
                                onClick={() => requestDelete(row.id, row.sku)}
                              >
                                Delete
                              </Button>
                            )}
                          </>
                        )}
                      </Stack>
                    </TableCell>
                  )}
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

      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="sm" sx={requestDialogSx}>
        <DialogTitle sx={requestDialogTitleSx}>
          <Stack spacing={0.35}>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
              New Variant
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create the exact sellable option linked to a product family.
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={requestDialogContentSx}>
          <Stack spacing={1.5}>
            <Paper variant="outlined" sx={requestSectionSx}>
              <Stack spacing={1.5}>
                <TextField
                  select
                  label="Product *"
                  value={productId}
                  onChange={(e) => {
                    const nextProductId = e.target.value === '' ? '' : Number(e.target.value);
                    setProductId(nextProductId);
                    if (typeof nextProductId !== 'number') {
                      setDefaultPrice('');
                      return;
                    }
                    const selected = products.find((p) => p.id === nextProductId);
                    setDefaultPrice(selected?.base_price == null ? '' : String(selected.base_price));
                  }}
                  disabled={productsQuery.isLoading || !canCreate}
                >
                  <MenuItem value="">Select product</MenuItem>
                  {products.map((product) => (
                    <MenuItem key={product.id} value={product.id}>
                      {product.name} {product.product_type ? `(${String(product.product_type).replace(/_/g, ' ')})` : ''}
                    </MenuItem>
                  ))}
                </TextField>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                  <TextField
                    fullWidth
                    label="SKU *"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    helperText="You can type this, or generate one."
                    disabled={!canCreate}
                  />
                  <Button variant="outlined" onClick={generateSku} sx={{ whiteSpace: 'nowrap' }} disabled={!canCreate}>
                    Generate SKU
                  </Button>
                </Stack>

                <TextField
                  label="Variant Name *"
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  disabled={!canCreate}
                />

                <TextField
                  label="Flavor"
                  value={variantFlavor}
                  onChange={(e) => setVariantFlavor(e.target.value)}
                  helperText="Optional but recommended for stock tracking by flavor."
                  disabled={!canCreate}
                />

                <TextField
                  label="Price *"
                  type="number"
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(e.target.value)}
                  inputProps={{ step: '0.01', min: '0.01' }}
                  helperText="Auto-filled from Product Base Price. Required for variant creation."
                  disabled={!canCreate}
                />
              </Stack>
            </Paper>

            {createVariant.isPending && <Alert severity="info">Saving...</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={requestDialogActionsSx}>
          <Button onClick={() => setOpenCreate(false)} disabled={createVariant.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={submitCreate}
            disabled={
              createVariant.isPending ||
              !canCreate ||
              typeof productId !== 'number' ||
              !sku.trim() ||
              !variantName.trim() ||
              !defaultPrice.trim()
            }
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openEdit} onClose={closeEditDialog} fullWidth maxWidth="sm">
        <DialogTitle>Edit Variant</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="SKU *"
              value={editSku}
              onChange={(e) => setEditSku(e.target.value)}
              disabled={!canUpdate || updateVariant.isPending}
            />

            <TextField
              label="Variant Name *"
              value={editVariantName}
              onChange={(e) => setEditVariantName(e.target.value)}
              disabled={!canUpdate || updateVariant.isPending}
            />

            <TextField
              label="Flavor"
              value={editVariantFlavor}
              onChange={(e) => setEditVariantFlavor(e.target.value)}
              disabled={!canUpdate || updateVariant.isPending}
            />

            <TextField
              label="Price *"
              type="number"
              value={editDefaultPrice}
              onChange={(e) => setEditDefaultPrice(e.target.value)}
              inputProps={{ step: '0.01', min: '0.01' }}
              disabled={!canUpdate || updateVariant.isPending}
            />

            {updateVariant.isPending && <Alert severity="info">Saving...</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditDialog} disabled={updateVariant.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={submitEdit}
            disabled={
              !canUpdate ||
              updateVariant.isPending ||
              !editSku.trim() ||
              !editVariantName.trim() ||
              !editDefaultPrice.trim()
            }
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={stockOpen} onClose={() => setStockOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Stock (Opening)</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Alert severity="info">This creates and posts an adjustment (inventory + ledger).</Alert>

            <TextField label="Variant" value={stockVariant?.sku ?? ''} disabled />
            {canBranchView ? (
              <TextField
                select
                label="Branch"
                value={stockBranchId}
                onChange={(e) => {
                  const next = e.target.value === '' ? '' : Number(e.target.value);
                  setStockBranchId(next);
                  if (typeof next === 'number') authStorage.setLastBranchId(next);
                }}
                disabled={branchesQuery.isLoading || !canQuickAdjustStock}
              >
                <MenuItem value="">Select branch</MenuItem>
                {(branchesQuery.data ?? []).map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField label="Branch" value={user?.branch?.name ?? 'No branch assigned'} disabled />
            )}

            <TextField
              label="Qty to add"
              type="number"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              inputProps={{ step: '1' }}
              disabled={!canQuickAdjustStock}
            />
            <TextField
              label="Unit cost (optional)"
              type="number"
              value={stockUnitCost}
              onChange={(e) => setStockUnitCost(e.target.value)}
              inputProps={{ step: '0.01', min: '0' }}
              helperText="Auto-filled from variant default cost. If cost is 0, it falls back to variant price."
              disabled={!canQuickAdjustStock}
            />
            <TextField
              label="Notes (optional)"
              value={stockNotes}
              onChange={(e) => setStockNotes(e.target.value)}
              disabled={!canQuickAdjustStock}
            />

            {quickPostAdj.isPending && <Alert severity="info">Posting adjustment...</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStockOpen(false)} disabled={quickPostAdj.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={submitStock}
            disabled={quickPostAdj.isPending || !canQuickAdjustStock}
          >
            Post
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!disableConfirmTarget} onClose={() => setDisableConfirmTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberRoundedIcon color="warning" />
          Disable Variant?
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              This will move <b>{disableConfirmTarget?.sku ?? '-'}</b> to inactive status.
            </Typography>
            <Alert severity="info">
              Inactive variants stay in history and can be re-enabled later.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisableConfirmTarget(null)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" color="warning" onClick={confirmDisable} disabled={busy}>
            Disable
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteConfirmTarget} onClose={() => setDeleteConfirmTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberRoundedIcon color="error" />
          Delete Variant Permanently?
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              You are deleting <b>{deleteConfirmTarget?.sku ?? '-'}</b>. This action starts a permanent delete.
            </Typography>
            <Alert severity="warning">
              You can still undo for {DELETE_UNDO_MS / 1000} seconds after confirming.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmTarget(null)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={confirmDelete} disabled={busy}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={pendingDelete ? DELETE_UNDO_MS : 2600}
        onClose={(_, reason) => {
          if (pendingDelete && reason !== 'timeout') return;
          setSnack((s) => ({ ...s, open: false }));
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {pendingDelete ? (
          <Paper
            sx={{
              px: 1.5,
              pt: 1.2,
              pb: 0.8,
              minWidth: { xs: 'calc(100vw - 20px)', sm: 440 },
              borderColor: 'warning.light',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2">Delete queued</Typography>
                <Typography variant="caption" color="text.secondary">
                  {snack.message}
                </Typography>
              </Box>
              {canDelete && (
                <Button
                  variant="contained"
                  color="secondary"
                  size="small"
                  startIcon={<UndoRoundedIcon fontSize="small" />}
                  onClick={undoDelete}
                >
                  Undo
                </Button>
              )}
            </Stack>
            <LinearProgress color="warning" sx={{ mt: 1.1, borderRadius: 999 }} />
          </Paper>
        ) : (
          <Alert
            severity={snack.severity}
            onClose={() => setSnack((s) => ({ ...s, open: false }))}
          >
            {snack.message}
          </Alert>
        )}
      </Snackbar>
    </Stack>
  );
}



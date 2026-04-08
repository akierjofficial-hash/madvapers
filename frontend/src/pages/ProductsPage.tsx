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
import type { ProductType } from '../api/products';
import { PRODUCT_TYPES } from '../api/products';
import {
  useBrandsQuery,
  useCreateBrandMutation,
  useCreateProductMutation,
  useDisableProductMutation,
  useEnableProductMutation,
  usePurgeProductMutation,
  useProductsQuery,
  useUpdateProductMutation,
} from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import {
  requestDialogActionsSx,
  requestDialogContentSx,
  requestDialogSx,
  requestDialogTitleSx,
  requestSectionSx,
} from '../components/requestDialogStyles';
import type { Product } from '../types/models';

type FormState = {
  name: string;
  product_type: ProductType;
  brand_id: number | '';
  base_price: string;
  description: string;
  is_active: boolean;
};

type SnackState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info';
};

const DELETE_UNDO_MS = 5000;

const DEFAULT_FORM: FormState = {
  name: '',
  product_type: 'DEVICE',
  brand_id: '',
  base_price: '',
  description: '',
  is_active: true,
};

const TYPE_LABELS: Record<string, string> = {
  DEVICE: 'Device',
  DISPOSABLE: 'Disposable',
  POD_CARTRIDGE: 'Pod Cartridge',
  JUICE_FREEBASE: 'Juice - Freebase',
  JUICE_SALT: 'Juice - Salt',
  COIL_ACCESSORY: 'Coil/Accessory',
};

function normalizeProductTypeCode(value: string): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toProductType(value: string): ProductType {
  const normalized = normalizeProductTypeCode(value);
  return normalized || 'DEVICE';
}

function formatProductTypeLabel(value: string | null | undefined): string {
  const code = normalizeProductTypeCode(String(value ?? ''));
  if (!code) return '-';
  if (TYPE_LABELS[code]) return TYPE_LABELS[code];
  return code
    .split('_')
    .map((part) => (part ? part[0] + part.slice(1).toLowerCase() : ''))
    .join(' ');
}

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(2);
}

export function ProductsPage() {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const { can } = useAuth();
  const canView = can('PRODUCT_VIEW');
  const canCreate = can('PRODUCT_CREATE');
  const canUpdate = can('PRODUCT_UPDATE');
  const canDisable = can('PRODUCT_DISABLE');
  const canDelete = can('PRODUCT_DELETE');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | ''>('');
  const [brandFilter, setBrandFilter] = useState<number | ''>('');
  const [includeInactive, setIncludeInactive] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [newProductType, setNewProductType] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [disableConfirmTarget, setDisableConfirmTarget] = useState<Product | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<Product | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);
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

  const productsQuery = useProductsQuery(
    {
      page,
      search: debouncedSearch || undefined,
      product_type: typeFilter || undefined,
      brand_id: typeof brandFilter === 'number' ? brandFilter : undefined,
      include_inactive: includeInactive ? true : undefined,
    },
    canView
  );
  const brandsQuery = useBrandsQuery({ page: 1, per_page: 500 }, canView);
  const createMut = useCreateProductMutation();
  const createBrandMut = useCreateBrandMutation();
  const updateMut = useUpdateProductMutation();
  const disableMut = useDisableProductMutation();
  const enableMut = useEnableProductMutation();
  const purgeMut = usePurgeProductMutation();

  const rows = productsQuery.data?.data ?? [];
  const totalPages = productsQuery.data?.last_page ?? 1;
  const brandOptions = brandsQuery.data?.data ?? [];

  const busy =
    createMut.isPending ||
    createBrandMut.isPending ||
    updateMut.isPending ||
    disableMut.isPending ||
    enableMut.isPending ||
    purgeMut.isPending ||
    !!pendingDelete;

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)),
    [rows]
  );

  const productTypeOptions = useMemo(() => {
    const set = new Set<string>(PRODUCT_TYPES as readonly string[]);

    rows.forEach((row) => {
      const normalized = normalizeProductTypeCode(String(row.product_type ?? ''));
      if (normalized) set.add(normalized);
    });

    const formType = normalizeProductTypeCode(form.product_type);
    if (formType) set.add(formType);

    const filterType = normalizeProductTypeCode(typeFilter || '');
    if (filterType) set.add(filterType);

    return Array.from(set).sort();
  }, [rows, form.product_type, typeFilter]);

  const openCreate = () => {
    if (!canCreate) {
      setSnack({ open: true, message: 'Not authorized: PRODUCT_CREATE', severity: 'error' });
      return;
    }
    setEditing(null);
    setForm(DEFAULT_FORM);
    setNewProductType('');
    setNewBrandName('');
    setOpen(true);
  };

  const openEdit = (product: Product) => {
    if (!canUpdate) {
      setSnack({ open: true, message: 'Not authorized: PRODUCT_UPDATE', severity: 'error' });
      return;
    }
    setEditing(product);
    setForm({
      name: product.name ?? '',
      product_type: toProductType(product.product_type ?? 'DEVICE'),
      brand_id: product.brand?.id ?? '',
      base_price: product.base_price == null ? '' : String(product.base_price),
      description: product.description ?? '',
      is_active: product.is_active ?? true,
    });
    setNewProductType('');
    setNewBrandName('');
    setOpen(true);
  };

  const save = async () => {
    const name = form.name.trim();
    if (!name) {
      setSnack({ open: true, message: 'Product name is required.', severity: 'error' });
      return;
    }
    if (typeof form.brand_id !== 'number') {
      setSnack({ open: true, message: 'Brand is required.', severity: 'error' });
      return;
    }
    const productType = normalizeProductTypeCode(form.product_type);
    if (!productType) {
      setSnack({ open: true, message: 'Product type is required.', severity: 'error' });
      return;
    }
    if (productType.length > 40) {
      setSnack({ open: true, message: 'Product type is too long (max 40 characters).', severity: 'error' });
      return;
    }
    const basePrice = form.base_price.trim();
    if (basePrice && (!Number.isFinite(Number(basePrice)) || Number(basePrice) < 0)) {
      setSnack({
        open: true,
        message: 'Retail cost must be a valid number greater than or equal to 0.',
        severity: 'error',
      });
      return;
    }

    const basePayload = {
      name,
      product_type: productType,
      brand_id: form.brand_id,
      base_price: basePrice === '' ? null : Number(basePrice),
      description: form.description.trim() || null,
    };

    if (editing) {
      if (!canUpdate) {
        setSnack({ open: true, message: 'Not authorized: PRODUCT_UPDATE', severity: 'error' });
        return;
      }
      await updateMut.mutateAsync({ id: editing.id, input: basePayload });
    } else {
      if (!canCreate) {
        setSnack({ open: true, message: 'Not authorized: PRODUCT_CREATE', severity: 'error' });
        return;
      }
      await createMut.mutateAsync({ ...basePayload, is_active: form.is_active });
    }

    setOpen(false);
  };

  const disable = async (product: Product) => {
    if (!canDisable) {
      setSnack({ open: true, message: 'Not authorized: PRODUCT_DISABLE', severity: 'error' });
      return;
    }
    try {
      await disableMut.mutateAsync(product.id);
      setSnack({
        open: true,
        message: `"${product.name}" moved to inactive.`,
        severity: 'success',
      });
    } catch (e: any) {
      setSnack({
        open: true,
        message: e?.response?.data?.message || 'Failed to disable product.',
        severity: 'error',
      });
    }
  };

  const requestDisable = (product: Product) => {
    if (!canDisable) {
      setSnack({ open: true, message: 'Not authorized: PRODUCT_DISABLE', severity: 'error' });
      return;
    }
    setDisableConfirmTarget(product);
  };

  const confirmDisable = async () => {
    if (!disableConfirmTarget) return;
    const target = disableConfirmTarget;
    setDisableConfirmTarget(null);
    await disable(target);
  };

  const enable = async (product: Product) => {
    if (!canDisable) {
      setSnack({ open: true, message: 'Not authorized: PRODUCT_DISABLE', severity: 'error' });
      return;
    }
    try {
      await enableMut.mutateAsync(product.id);
      setSnack({
        open: true,
        message: `"${product.name}" restored.`,
        severity: 'success',
      });
    } catch (e: any) {
      setSnack({
        open: true,
        message: e?.response?.data?.message || 'Failed to restore product.',
        severity: 'error',
      });
    }
  };

  const commitPurge = async (product: Product) => {
    try {
      await purgeMut.mutateAsync(product.id);
      setSnack({
        open: true,
        message: `"${product.name}" deleted permanently.`,
        severity: 'success',
      });
    } catch (e: any) {
      setSnack({
        open: true,
        message: e?.response?.data?.message || 'Failed to delete product permanently.',
        severity: 'error',
      });
    } finally {
      deleteTimerRef.current = null;
      setPendingDelete((current) => (current?.id === product.id ? null : current));
    }
  };

  const purge = async (product: Product) => {
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

    setPendingDelete({ id: product.id, name: product.name ?? `#${product.id}` });
    deleteTimerRef.current = setTimeout(() => {
      void commitPurge(product);
    }, DELETE_UNDO_MS);

    setSnack({
      open: true,
      message: `"${product.name}" will be deleted permanently in ${DELETE_UNDO_MS / 1000} seconds.`,
      severity: 'info',
    });
  };

  const requestDelete = (product: Product) => {
    if (!canDelete) {
      setSnack({ open: true, message: 'Not authorized: PRODUCT_DELETE', severity: 'error' });
      return;
    }
    setDeleteConfirmTarget(product);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    const target = deleteConfirmTarget;
    setDeleteConfirmTarget(null);
    await purge(target);
  };

  const undoDelete = () => {
    if (!pendingDelete) return;
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    const name = pendingDelete.name;
    setPendingDelete(null);
    setSnack({
      open: true,
      message: `Delete canceled for "${name}".`,
      severity: 'success',
    });
  };

  const createProductTypeInline = () => {
    if (!canCreate && !canUpdate) {
      setSnack({ open: true, message: 'Not authorized to manage product type.', severity: 'error' });
      return;
    }

    const normalized = normalizeProductTypeCode(newProductType);
    if (!normalized) {
      setSnack({ open: true, message: 'Product type is required.', severity: 'error' });
      return;
    }
    if (normalized.length > 40) {
      setSnack({ open: true, message: 'Product type is too long (max 40 characters).', severity: 'error' });
      return;
    }

    setForm((prev) => ({ ...prev, product_type: normalized }));
    setNewProductType('');
    setSnack({ open: true, message: `Product type "${normalized}" selected.`, severity: 'success' });
  };

  const createBrandInline = async () => {
    if (!canCreate) {
      setSnack({ open: true, message: 'Not authorized: PRODUCT_CREATE', severity: 'error' });
      return;
    }
    const name = newBrandName.trim();
    if (!name) {
      setSnack({ open: true, message: 'Brand name is required.', severity: 'error' });
      return;
    }

    try {
      const brand = await createBrandMut.mutateAsync({ name, is_active: true });
      setForm((prev) => ({ ...prev, brand_id: brand.id }));
      setNewBrandName('');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to create brand.';
      setSnack({ open: true, message: msg, severity: 'error' });
    }
  };

  if (!canView) {
    return <Alert severity="error">Not authorized to view Products (PRODUCT_VIEW).</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
      >
        <Typography variant="h5">Products</Typography>
        <Button
          variant="contained"
          onClick={openCreate}
          disabled={!canCreate}
          sx={{ alignSelf: { xs: 'stretch', sm: 'auto' } }}
        >
          New Product
        </Button>
      </Stack>

      {!canCreate && !canUpdate && !canDisable && !canDelete && (
        <Alert severity="info">You have view-only access to products.</Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
        <TextField
          size="small"
          label="Search name/type/brand"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: { md: 280 }, flex: 1 }}
        />

        <TextField
          select
          size="small"
          label="Type"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value === '' ? '' : toProductType(e.target.value));
            setPage(1);
          }}
          sx={{ width: { xs: '100%', md: 210 } }}
        >
          <MenuItem value="">All Types</MenuItem>
          {productTypeOptions.map((type) => (
            <MenuItem key={type} value={type}>
              {formatProductTypeLabel(type)}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Brand"
          value={brandFilter}
          onChange={(e) => {
            setBrandFilter(e.target.value === '' ? '' : Number(e.target.value));
            setPage(1);
          }}
          sx={{ width: { xs: '100%', md: 210 } }}
          disabled={brandsQuery.isLoading}
        >
          <MenuItem value="">All Brands</MenuItem>
          {brandOptions.map((brand) => (
            <MenuItem key={brand.id} value={brand.id}>
              {brand.name}
            </MenuItem>
          ))}
        </TextField>

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

      {productsQuery.isLoading ? (
        <Alert severity="info">Loading products...</Alert>
      ) : productsQuery.isError ? (
        <Alert severity="error">Failed to load products.</Alert>
      ) : sortedRows.length === 0 ? (
        <Alert severity="warning">No products found.</Alert>
      ) : isCompact ? (
        <Stack spacing={1.1}>
          {sortedRows.map((row) => {
            const active = row.is_active ?? true;
            return (
              <Paper key={row.id} variant="outlined" sx={{ p: 1.2, borderRadius: 2, opacity: active ? 1 : 0.72 }}>
                <Stack spacing={0.65}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                    <Typography sx={{ fontWeight: 700, minWidth: 0 }}>{row.name}</Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        px: 1,
                        py: 0.2,
                        borderRadius: 999,
                        border: '1px solid',
                        borderColor: active ? 'success.light' : 'warning.light',
                        color: active ? 'success.dark' : 'warning.dark',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {active ? 'Active' : 'Inactive'}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {formatProductTypeLabel(row.product_type ?? 'DEVICE')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Brand: {row.brand?.name ?? '-'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Retail Cost: {formatMoney(row.base_price)} • Variants: {row.variants_count ?? 0}
                  </Typography>
                  {(canUpdate || canDisable || canDelete) && (
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ pt: 0.3 }}>
                      {canUpdate && (
                        <Button size="small" variant="outlined" onClick={() => openEdit(row)} disabled={busy}>
                          Edit
                        </Button>
                      )}
                      {active ? (
                        <>
                          {canDisable && (
                            <Button
                              size="small"
                              color="warning"
                              variant="outlined"
                              onClick={() => requestDisable(row)}
                              disabled={busy}
                            >
                              Disable
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              onClick={() => requestDelete(row)}
                              disabled={busy}
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
                              onClick={() => enable(row)}
                              disabled={busy}
                            >
                              Enable
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              onClick={() => requestDelete(row)}
                              disabled={busy}
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
            );
          })}
        </Stack>
      ) : (
        <Paper variant="outlined">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell width={80}>ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell width={180}>Type</TableCell>
                <TableCell>Brand</TableCell>
                <TableCell align="right" width={120}>Retail Cost</TableCell>
                <TableCell align="right" width={100}>
                  Variants
                </TableCell>
                <TableCell width={110}>Status</TableCell>
                {(canUpdate || canDisable || canDelete) && (
                  <TableCell align="right" width={240}>
                    Actions
                  </TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRows.map((row) => {
                const active = row.is_active ?? true;
                return (
                  <TableRow key={row.id} hover sx={{ opacity: active ? 1 : 0.55 }}>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{row.id}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{formatProductTypeLabel(row.product_type ?? 'DEVICE')}</TableCell>
                    <TableCell>{row.brand?.name ?? '-'}</TableCell>
                    <TableCell align="right">{formatMoney(row.base_price)}</TableCell>
                    <TableCell align="right">{row.variants_count ?? 0}</TableCell>
                    <TableCell>{active ? 'Active' : 'Inactive'}</TableCell>
                    {(canUpdate || canDisable || canDelete) && (
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {canUpdate && (
                            <Button size="small" onClick={() => openEdit(row)} disabled={busy}>
                              Edit
                            </Button>
                          )}
                          {active ? (
                            <>
                              {canDisable && (
                                <Button size="small" color="warning" onClick={() => requestDisable(row)} disabled={busy}>
                                  Disable
                                </Button>
                              )}
                              {canDelete && (
                                <Button size="small" color="error" onClick={() => requestDelete(row)} disabled={busy}>
                                  Delete
                                </Button>
                              )}
                            </>
                          ) : (
                            <>
                              {canDisable && (
                                <Button size="small" color="success" onClick={() => enable(row)} disabled={busy}>
                                  Enable
                                </Button>
                              )}
                              {canDelete && (
                                <Button size="small" color="error" onClick={() => requestDelete(row)} disabled={busy}>
                                  Delete
                                </Button>
                              )}
                            </>
                          )}
                        </Stack>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      )}

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, next) => setPage(next)}
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" sx={requestDialogSx}>
        <DialogTitle sx={requestDialogTitleSx}>
          <Stack spacing={0.35}>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
              {editing ? 'Edit Product' : 'New Product'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Define the catalog item baseline before adding sellable variants.
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={requestDialogContentSx}>
          <Stack spacing={1.5}>
            <Paper variant="outlined" sx={requestSectionSx}>
              <Stack spacing={1.5}>
                <TextField
                  label="Product Name *"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  fullWidth
                  disabled={busy}
                />

                <TextField
                  select
                  label="Product Type *"
                  value={form.product_type}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      product_type: toProductType(e.target.value),
                    }))
                  }
                  fullWidth
                  disabled={busy}
                  helperText="Type controls how variants are structured in day-to-day catalog use."
                >
                  {productTypeOptions.map((type) => (
                    <MenuItem key={type} value={type}>
                      {formatProductTypeLabel(type)}
                    </MenuItem>
                  ))}
                </TextField>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                  <TextField
                    fullWidth
                    label="New Product Type"
                    value={newProductType}
                    onChange={(e) => setNewProductType(e.target.value)}
                    disabled={busy || (!canCreate && !canUpdate)}
                    helperText="Example: MOD_KIT or POD_REFILL. It will be normalized to uppercase snake_case."
                  />
                  <Button
                    variant="outlined"
                    onClick={createProductTypeInline}
                    disabled={busy || !newProductType.trim() || (!canCreate && !canUpdate)}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    Add Type
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={requestSectionSx}>
              <Stack spacing={1.5}>
                <TextField
                  select
                  label="Brand *"
                  value={form.brand_id}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      brand_id: e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                  fullWidth
                  disabled={busy || brandsQuery.isLoading}
                >
                  <MenuItem value="">Select brand</MenuItem>
                  {brandOptions.map((brand) => (
                    <MenuItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </MenuItem>
                  ))}
                </TextField>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                  <TextField
                    fullWidth
                    label="New Brand"
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                    disabled={busy || !canCreate}
                    helperText="If the brand you need is missing, add it here and it will be selected automatically."
                  />
                  <Button
                    variant="outlined"
                    onClick={createBrandInline}
                    disabled={busy || !canCreate || !newBrandName.trim()}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    Add Brand
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={requestSectionSx}>
              <Stack spacing={1.5}>
                <TextField
                  label="Description (optional)"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  multiline
                  minRows={2}
                  fullWidth
                  disabled={busy}
                />

                <TextField
                  label="Retail Cost (optional)"
                  type="number"
                  value={form.base_price}
                  onChange={(e) => setForm((prev) => ({ ...prev, base_price: e.target.value }))}
                  inputProps={{ step: '0.01', min: '0' }}
                  fullWidth
                  disabled={busy}
                  helperText="Template retail cost used to prefill new variants for this product."
                />

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.is_active}
                      onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                      disabled={busy || !!editing}
                    />
                  }
                  label={editing ? 'Active (use Disable/Enable action from table)' : 'Active'}
                />
              </Stack>
            </Paper>

            {(createMut.isError || updateMut.isError || disableMut.isError || purgeMut.isError) && (
              <Alert severity="error">
                {String(
                  (createMut.error as any)?.response?.data?.message ??
                    (updateMut.error as any)?.response?.data?.message ??
                    (disableMut.error as any)?.response?.data?.message ??
                    (purgeMut.error as any)?.response?.data?.message ??
                    'Failed to save product.'
                )}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={requestDialogActionsSx}>
          <Button onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={busy || !form.name.trim() || typeof form.brand_id !== 'number'}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!disableConfirmTarget} onClose={() => setDisableConfirmTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberRoundedIcon color="warning" />
          Disable Product?
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              This will move <b>{disableConfirmTarget?.name ?? '-'}</b> to inactive status.
            </Typography>
            <Alert severity="info">
              Inactive products stay in history and can be re-enabled later.
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
          Delete Product Permanently?
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              You are deleting <b>{deleteConfirmTarget?.name ?? '-'}</b>. This action starts a permanent delete.
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



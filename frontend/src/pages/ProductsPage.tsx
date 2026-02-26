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
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import type { ProductType } from '../api/products';
import { PRODUCT_TYPES } from '../api/products';
import {
  useBrandsQuery,
  useCategoriesQuery,
  useCreateBrandMutation,
  useCreateCategoryMutation,
  useCreateProductMutation,
  useDisableProductMutation,
  useEnableProductMutation,
  usePurgeProductMutation,
  useProductsQuery,
  useUpdateProductMutation,
} from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import type { Product } from '../types/models';

type FormState = {
  name: string;
  product_type: ProductType;
  brand_id: number | '';
  category_id: number | '';
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
  category_id: '',
  base_price: '',
  description: '',
  is_active: true,
};

const TYPE_LABELS: Record<ProductType, string> = {
  DEVICE: 'Device',
  DISPOSABLE: 'Disposable',
  POD_CARTRIDGE: 'Pod Cartridge',
  JUICE_FREEBASE: 'Juice - Freebase',
  JUICE_SALT: 'Juice - Salt',
  COIL_ACCESSORY: 'Coil/Accessory',
};

function toProductType(value: string): ProductType {
  return (PRODUCT_TYPES as readonly string[]).includes(value) ? (value as ProductType) : 'DEVICE';
}

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(2);
}

export function ProductsPage() {
  const { can } = useAuth();
  const canView = can('PRODUCT_VIEW');
  const canCreate = can('PRODUCT_CREATE');
  const canUpdate = can('PRODUCT_UPDATE');
  const canDisable = can('PRODUCT_DISABLE');
  const canDelete = can('PRODUCT_DELETE');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ProductType | ''>('');
  const [brandFilter, setBrandFilter] = useState<number | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
  const [includeInactive, setIncludeInactive] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [newBrandName, setNewBrandName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
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
      category_id: typeof categoryFilter === 'number' ? categoryFilter : undefined,
      include_inactive: includeInactive ? true : undefined,
    },
    canView
  );
  const brandsQuery = useBrandsQuery({ page: 1 }, canView);
  const categoriesQuery = useCategoriesQuery({ page: 1 }, canView);
  const createMut = useCreateProductMutation();
  const createBrandMut = useCreateBrandMutation();
  const createCategoryMut = useCreateCategoryMutation();
  const updateMut = useUpdateProductMutation();
  const disableMut = useDisableProductMutation();
  const enableMut = useEnableProductMutation();
  const purgeMut = usePurgeProductMutation();

  const rows = productsQuery.data?.data ?? [];
  const totalPages = productsQuery.data?.last_page ?? 1;
  const brandOptions = brandsQuery.data?.data ?? [];
  const categoryOptions = categoriesQuery.data?.data ?? [];

  const busy =
    createMut.isPending ||
    createBrandMut.isPending ||
    createCategoryMut.isPending ||
    updateMut.isPending ||
    disableMut.isPending ||
    enableMut.isPending ||
    purgeMut.isPending ||
    !!pendingDelete;

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)),
    [rows]
  );

  const openCreate = () => {
    if (!canCreate) {
      setSnack({ open: true, message: 'Not authorized: PRODUCT_CREATE', severity: 'error' });
      return;
    }
    setEditing(null);
    setForm(DEFAULT_FORM);
    setNewBrandName('');
    setNewCategoryName('');
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
      category_id: product.category?.id ?? '',
      base_price: product.base_price == null ? '' : String(product.base_price),
      description: product.description ?? '',
      is_active: product.is_active ?? true,
    });
    setNewBrandName('');
    setNewCategoryName('');
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
    const basePrice = form.base_price.trim();
    if (basePrice && (!Number.isFinite(Number(basePrice)) || Number(basePrice) < 0)) {
      setSnack({
        open: true,
        message: 'Base price must be a valid number greater than or equal to 0.',
        severity: 'error',
      });
      return;
    }

    const basePayload = {
      name,
      product_type: form.product_type,
      brand_id: form.brand_id,
      category_id: typeof form.category_id === 'number' ? form.category_id : null,
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

  const createCategoryInline = async () => {
    if (!canCreate) {
      setSnack({ open: true, message: 'Not authorized: PRODUCT_CREATE', severity: 'error' });
      return;
    }
    const name = newCategoryName.trim();
    if (!name) {
      setSnack({ open: true, message: 'Category name is required.', severity: 'error' });
      return;
    }

    try {
      const category = await createCategoryMut.mutateAsync({ name, is_active: true });
      setForm((prev) => ({ ...prev, category_id: category.id }));
      setNewCategoryName('');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to create category.';
      setSnack({ open: true, message: msg, severity: 'error' });
    }
  };

  if (!canView) {
    return <Alert severity="error">Not authorized to view Products (PRODUCT_VIEW).</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h5">Products</Typography>
        <Button variant="contained" onClick={openCreate} disabled={!canCreate}>
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
          sx={{ minWidth: 280, flex: 1 }}
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
          sx={{ width: 210 }}
        >
          <MenuItem value="">All Types</MenuItem>
          {PRODUCT_TYPES.map((type) => (
            <MenuItem key={type} value={type}>
              {TYPE_LABELS[type]}
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
          sx={{ width: 210 }}
          disabled={brandsQuery.isLoading}
        >
          <MenuItem value="">All Brands</MenuItem>
          {brandOptions.map((brand) => (
            <MenuItem key={brand.id} value={brand.id}>
              {brand.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Category"
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value === '' ? '' : Number(e.target.value));
            setPage(1);
          }}
          sx={{ width: 220 }}
          disabled={categoriesQuery.isLoading}
        >
          <MenuItem value="">All Categories</MenuItem>
          {categoryOptions.map((category) => (
            <MenuItem key={category.id} value={category.id}>
              {category.name}
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
      ) : (
        <Paper variant="outlined">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell width={80}>ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell width={180}>Type</TableCell>
                <TableCell>Brand</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right" width={120}>Base Price</TableCell>
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
                    <TableCell>{TYPE_LABELS[toProductType(row.product_type ?? 'DEVICE')]}</TableCell>
                    <TableCell>{row.brand?.name ?? '-'}</TableCell>
                    <TableCell>{row.category?.name ?? '-'}</TableCell>
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

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Edit Product' : 'New Product'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
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
              {PRODUCT_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {TYPE_LABELS[type]}
                </MenuItem>
              ))}
            </TextField>

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

            <TextField
              select
              label="Category (optional)"
              value={form.category_id}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  category_id: e.target.value === '' ? '' : Number(e.target.value),
                }))
              }
              fullWidth
              disabled={busy || categoriesQuery.isLoading}
            >
              <MenuItem value="">No Category</MenuItem>
              {categoryOptions.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <TextField
                fullWidth
                label="New Category (optional)"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                disabled={busy || !canCreate}
                helperText="If category dropdown is empty, add category here then select automatically."
              />
              <Button
                variant="outlined"
                onClick={createCategoryInline}
                disabled={busy || !canCreate || !newCategoryName.trim()}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Add Category
              </Button>
            </Stack>

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
              label="Base Price (optional)"
              type="number"
              value={form.base_price}
              onChange={(e) => setForm((prev) => ({ ...prev, base_price: e.target.value }))}
              inputProps={{ step: '0.01', min: '0' }}
              fullWidth
              disabled={busy}
              helperText="Template price used to prefill new variants for this product."
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
        <DialogActions>
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



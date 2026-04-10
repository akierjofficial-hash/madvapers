import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Pagination,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
  useEnableProductMutation,
  useEnableVariantMutation,
  useProductsQuery,
  usePurgeProductMutation,
  usePurgeVariantMutation,
  useVariantsQuery,
} from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import type { Product, ProductVariant } from '../types/models';

type TabValue = 'products' | 'variants';

type SnackState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info';
};

type DeleteTarget =
  | { kind: 'product'; row: Product }
  | { kind: 'variant'; row: ProductVariant };

type ApiErrorLike = {
  response?: {
    data?: {
      message?: string;
      errors?: Record<string, string[]>;
    };
  };
};

function parseError(error: unknown, fallback: string) {
  const e = error as ApiErrorLike;
  const message = e?.response?.data?.message;
  if (typeof message === 'string' && message.trim()) return message;

  const errors = e?.response?.data?.errors;
  if (errors) {
    const firstKey = Object.keys(errors)[0];
    const firstMsg = firstKey ? errors[firstKey]?.[0] : null;
    if (firstMsg) return firstMsg;
  }

  return fallback;
}

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(2);
}

function formatProductTypeLabel(value: string | null | undefined): string {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalized) return '-';

  return normalized
    .split('_')
    .map((part) => (part ? part[0] + part.slice(1).toLowerCase() : ''))
    .join(' ');
}

export function InactiveItemsPage() {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const { can } = useAuth();

  const canView = can('PRODUCT_VIEW');
  const canRestore = can('PRODUCT_DISABLE');
  const canDelete = can('PRODUCT_DELETE');

  const [tab, setTab] = useState<TabValue>('products');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [variantPage, setVariantPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [snack, setSnack] = useState<SnackState>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const productsQuery = useProductsQuery(
    {
      page: productPage,
      per_page: 20,
      search: debouncedSearch || undefined,
      only_inactive: true,
    },
    canView
  );

  const variantsQuery = useVariantsQuery(
    {
      page: variantPage,
      per_page: 20,
      search: debouncedSearch || undefined,
      only_inactive: true,
    },
    canView
  );

  const enableProduct = useEnableProductMutation();
  const enableVariant = useEnableVariantMutation();
  const purgeProduct = usePurgeProductMutation();
  const purgeVariant = usePurgeVariantMutation();

  const inactiveProducts = useMemo(
    () => (productsQuery.data?.data ?? []).filter((row) => row.is_active === false),
    [productsQuery.data?.data]
  );
  const inactiveVariants = useMemo(
    () => (variantsQuery.data?.data ?? []).filter((row) => row.is_active === false),
    [variantsQuery.data?.data]
  );

  const activeBusy =
    enableProduct.isPending ||
    enableVariant.isPending ||
    purgeProduct.isPending ||
    purgeVariant.isPending;

  const handleRestoreProduct = async (row: Product) => {
    try {
      await enableProduct.mutateAsync(row.id);
      setSnack({
        open: true,
        message: `"${row.name}" restored to active products.`,
        severity: 'success',
      });
    } catch (error) {
      setSnack({
        open: true,
        message: parseError(error, 'Failed to restore product.'),
        severity: 'error',
      });
    }
  };

  const handleRestoreVariant = async (row: ProductVariant) => {
    try {
      await enableVariant.mutateAsync(row.id);
      setSnack({
        open: true,
        message: `${row.sku} restored to active variants.`,
        severity: 'success',
      });
    } catch (error) {
      setSnack({
        open: true,
        message: parseError(error, 'Failed to restore variant.'),
        severity: 'error',
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.kind === 'product') {
        await purgeProduct.mutateAsync(deleteTarget.row.id);
        setSnack({
          open: true,
          message: `"${deleteTarget.row.name}" permanently deleted.`,
          severity: 'success',
        });
      } else {
        await purgeVariant.mutateAsync(deleteTarget.row.id);
        setSnack({
          open: true,
          message: `${deleteTarget.row.sku} permanently deleted.`,
          severity: 'success',
        });
      }
      setDeleteTarget(null);
    } catch (error) {
      setSnack({
        open: true,
        message: parseError(error, 'Failed to permanently delete inactive item.'),
        severity: 'error',
      });
    }
  };

  const renderProductCards = () => (
    <Stack spacing={1.25}>
      {inactiveProducts.map((row) => (
        <Paper key={row.id} sx={{ p: 1.5, borderRadius: 3 }}>
          <Stack spacing={1}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {row.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {row.brand?.name ?? '-'} • {formatProductTypeLabel(row.product_type)}
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary">
              Variants: {row.variants_count ?? 0}
            </Typography>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {canRestore ? (
                <Button size="small" variant="outlined" onClick={() => void handleRestoreProduct(row)}>
                  Restore
                </Button>
              ) : null}
              {canDelete ? (
                <Button size="small" color="error" onClick={() => setDeleteTarget({ kind: 'product', row })}>
                  Delete
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );

  const renderVariantCards = () => (
    <Stack spacing={1.25}>
      {inactiveVariants.map((row) => (
        <Paper key={row.id} sx={{ p: 1.5, borderRadius: 3 }}>
          <Stack spacing={1}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {row.sku}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {row.product?.name ?? '-'}
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary">
              Variant: {row.variant_name || '-'} • Flavor: {row.flavor || '-'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Retail cost: ₱{formatMoney(row.default_price)}
            </Typography>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {canRestore ? (
                <Button size="small" variant="outlined" onClick={() => void handleRestoreVariant(row)}>
                  Restore
                </Button>
              ) : null}
              {canDelete ? (
                <Button size="small" color="error" onClick={() => setDeleteTarget({ kind: 'variant', row })}>
                  Delete
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );

  const renderProductsTable = () => (
    <Paper sx={{ overflowX: 'auto', borderRadius: 3 }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Brand</TableCell>
            <TableCell>Type</TableCell>
            <TableCell align="center">Variants</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {inactiveProducts.map((row) => (
            <TableRow key={row.id} hover>
              <TableCell sx={{ fontWeight: 700 }}>{row.name}</TableCell>
              <TableCell>{row.brand?.name ?? '-'}</TableCell>
              <TableCell>{formatProductTypeLabel(row.product_type)}</TableCell>
              <TableCell align="center">{row.variants_count ?? 0}</TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  {canRestore ? (
                    <Button size="small" variant="outlined" onClick={() => void handleRestoreProduct(row)}>
                      Restore
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button size="small" color="error" onClick={() => setDeleteTarget({ kind: 'product', row })}>
                      Delete
                    </Button>
                  ) : null}
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );

  const renderVariantsTable = () => (
    <Paper sx={{ overflowX: 'auto', borderRadius: 3 }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>SKU</TableCell>
            <TableCell>Product</TableCell>
            <TableCell>Variant</TableCell>
            <TableCell>Flavor</TableCell>
            <TableCell align="right">Retail Cost</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {inactiveVariants.map((row) => (
            <TableRow key={row.id} hover>
              <TableCell sx={{ fontWeight: 700 }}>{row.sku}</TableCell>
              <TableCell>{row.product?.name ?? '-'}</TableCell>
              <TableCell>{row.variant_name || '-'}</TableCell>
              <TableCell>{row.flavor || '-'}</TableCell>
              <TableCell align="right">₱{formatMoney(row.default_price)}</TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  {canRestore ? (
                    <Button size="small" variant="outlined" onClick={() => void handleRestoreVariant(row)}>
                      Restore
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button size="small" color="error" onClick={() => setDeleteTarget({ kind: 'variant', row })}>
                      Delete
                    </Button>
                  ) : null}
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );

  const currentEmpty = tab === 'products' ? inactiveProducts.length === 0 : inactiveVariants.length === 0;
  const currentLoading = tab === 'products' ? productsQuery.isLoading : variantsQuery.isLoading;
  const currentError = tab === 'products' ? productsQuery.isError : variantsQuery.isError;
  const currentPage = tab === 'products' ? productPage : variantPage;
  const currentTotalPages = tab === 'products' ? productsQuery.data?.last_page ?? 1 : variantsQuery.data?.last_page ?? 1;
  const currentFrom = tab === 'products' ? productsQuery.data?.from ?? 0 : variantsQuery.data?.from ?? 0;
  const currentTo = tab === 'products' ? productsQuery.data?.to ?? 0 : variantsQuery.data?.to ?? 0;
  const currentTotal = tab === 'products' ? productsQuery.data?.total ?? 0 : variantsQuery.data?.total ?? 0;

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h5">Inactive Items</Typography>
        <Typography variant="body2" color="text.secondary">
          Review archived products and variants in one place. Restore them if needed, or permanently delete them here.
        </Typography>
      </Stack>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Alert severity="info">
            This page only shows inactive catalog items. Restore is reversible. Delete is permanent.
          </Alert>

          <TextField
            label="Search inactive product / variant / flavor / SKU"
            size="small"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setProductPage(1);
              setVariantPage(1);
            }}
            fullWidth
          />

          <Tabs
            value={tab}
            onChange={(_, next: TabValue) => setTab(next)}
            variant={isCompact ? 'fullWidth' : 'standard'}
          >
            <Tab label={`Products (${productsQuery.data?.total ?? 0})`} value="products" />
            <Tab label={`Variants (${variantsQuery.data?.total ?? 0})`} value="variants" />
          </Tabs>

          {activeBusy ? <LinearProgress /> : null}

          {currentLoading ? (
            <Alert severity="info">Loading inactive items...</Alert>
          ) : currentError ? (
            <Alert severity="error">Failed to load inactive items.</Alert>
          ) : currentEmpty ? (
            <Alert severity="success">No inactive {tab} found for the current filter.</Alert>
          ) : (
            <>
              {tab === 'products'
                ? (isCompact ? renderProductCards() : renderProductsTable())
                : (isCompact ? renderVariantCards() : renderVariantsTable())}

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
              >
                <Typography variant="body2" color="text.secondary">
                  Showing {currentFrom} to {currentTo} of {currentTotal} inactive {tab}
                </Typography>
                <Pagination
                  page={currentPage}
                  count={currentTotalPages}
                  onChange={(_, nextPage) => {
                    if (tab === 'products') setProductPage(nextPage);
                    else setVariantPage(nextPage);
                  }}
                  color="primary"
                  shape="rounded"
                />
              </Stack>
            </>
          )}
        </Stack>
      </Paper>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberRoundedIcon color="warning" />
          Permanently Delete Inactive Item
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.25} sx={{ pt: 0.5 }}>
            <Typography variant="body2">
              {deleteTarget?.kind === 'product' ? (
                <>
                  Delete inactive product <b>{deleteTarget.row.name}</b> permanently?
                </>
              ) : (
                <>
                  Delete inactive variant <b>{deleteTarget?.row.sku}</b> permanently?
                </>
              )}
            </Typography>
            <Alert severity="warning">
              This action cannot be undone.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" onClick={() => void handleConfirmDelete()} disabled={activeBusy}>
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3200}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return;
          setSnack((prev) => ({ ...prev, open: false }));
        }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}

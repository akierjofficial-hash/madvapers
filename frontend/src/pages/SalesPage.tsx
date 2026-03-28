
import {
  Alert,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BranchSelect } from '../components/BranchSelect';
import { authStorage } from '../auth/authStorage';
import { useAuth } from '../auth/AuthProvider';
import {
  useApproveSaleVoidRequestMutation,
  useAddSalePaymentMutation,
  useBranchesQuery,
  useCreateSaleMutation,
  usePostSaleMutation,
  useRejectSaleVoidRequestMutation,
  useRequestSaleVoidMutation,
  useSaleQuery,
  useSalesQuery,
  useVoidSaleMutation,
  useVariantsQuery,
} from '../api/queries';
import type { SaleItem } from '../api/sales';
import { getVariants } from '../api/variants';
import type { ProductVariant } from '../types/models';

const STATUSES = ['', 'DRAFT', 'POSTED', 'VOIDED'] as const;
const PAYMENT_STATUSES = ['', 'UNPAID', 'PARTIAL', 'PAID'] as const;
const VOID_REQUEST_STATUSES = ['', 'PENDING', 'REJECTED', 'APPROVED'] as const;
const PAYMENT_METHODS = ['CASH', 'GCASH', 'CARD', 'BANK'] as const;

function toInt(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function qtyFmt(v: unknown) {
  const n = toNum(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function money(v: unknown) {
  const n = toNum(v);
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function mobileCategoryKey(productType: unknown): 'pod' | 'disposable' | 'device' {
  const raw = String(productType ?? '').toLowerCase();
  if (raw.includes('pod')) return 'pod';
  if (raw.includes('disposable')) return 'disposable';
  return 'device';
}

function mobileCategoryLabel(key: 'pod' | 'disposable' | 'device'): string {
  if (key === 'pod') return 'POD';
  if (key === 'disposable') return 'DIS';
  return 'DEV';
}

function cashierCategoryLabel(value: string): string {
  const key = String(value ?? '').trim().toUpperCase();
  if (key === 'ALL') return 'All';
  if (key === 'POD' || key === 'PODS' || key === 'POD CARTRIDGE') return 'Pod Cartridge';
  if (key === 'DISPOSABLE' || key === 'DISPOSABLES') return 'Disposable';
  if (key === 'DEVICE' || key === 'DEVICES') return 'Device';
  return value;
}

function statusChipColor(status: string): 'default' | 'warning' | 'success' | 'error' {
  switch (String(status).toUpperCase()) {
    case 'DRAFT':
      return 'warning';
    case 'POSTED':
      return 'success';
    case 'VOIDED':
      return 'error';
    default:
      return 'default';
  }
}

function paymentChipColor(status: string): 'default' | 'warning' | 'success' {
  switch (String(status).toUpperCase()) {
    case 'PARTIAL':
      return 'warning';
    case 'PAID':
      return 'success';
    default:
      return 'default';
  }
}

function checkoutActivityLabel(row: any): string {
  const status = String(row?.status ?? '').toUpperCase();
  const paymentStatus = String(row?.payment_status ?? '').toUpperCase();
  const voidRequestStatus = String(row?.void_request_status ?? '').toUpperCase();

  if (status === 'VOIDED') return 'Checkout voided';
  if (voidRequestStatus === 'PENDING') return 'Void approval requested';
  if (voidRequestStatus === 'REJECTED') return 'Void request rejected';
  if (status === 'DRAFT') return 'Draft checkout created';
  if (status === 'POSTED' && paymentStatus === 'PAID') return 'Checkout completed';
  if (status === 'POSTED' && paymentStatus === 'PARTIAL') return 'Partial payment received';
  if (status === 'POSTED') return 'Checkout posted, waiting payment';
  return 'Checkout updated';
}

function checkoutActivityAt(row: any): number {
  const iso = row?.updated_at ?? row?.posted_at ?? row?.created_at;
  if (!iso) return 0;
  const ts = new Date(String(iso)).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function checkoutActivityTimeText(row: any): string {
  const iso = row?.updated_at ?? row?.posted_at ?? row?.created_at;
  if (!iso) return '-';
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

function variantOnHand(variant: any): number {
  return toNum(variant?.qty_on_hand ?? 0);
}

function createClientTxnId(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === 'function') {
    return randomUUID.call(globalThis.crypto);
  }
  return `salepay-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type DraftSaleItem = {
  product_variant_id: number;
  sku?: string | null;
  productName?: string | null;
  variantName?: string | null;
  qty: number;
  max_qty: number;
  unit_price: number;
  line_discount: number;
  line_tax: number;
};

type CashierMobileView = 'CATALOG' | 'CART' | 'QUEUE' | 'ACTIVITY';

type ConfirmActionConfig = {
  title: string;
  message: string;
  detail?: string;
  confirmLabel: string;
  confirmColor?: 'primary' | 'error' | 'inherit' | 'warning' | 'success' | 'info';
  onConfirm: () => Promise<void>;
};

type ConfirmActionState = {
  open: boolean;
  title: string;
  message: string;
  detail: string;
  confirmLabel: string;
  confirmColor: 'primary' | 'error' | 'inherit' | 'warning' | 'success' | 'info';
  onConfirm: (() => Promise<void>) | null;
};

function emptyConfirmActionState(): ConfirmActionState {
  return {
    open: false,
    title: '',
    message: '',
    detail: '',
    confirmLabel: 'Confirm',
    confirmColor: 'primary',
    onConfirm: null,
  };
}

function EmptyStateNotice({
  title,
  description,
  severity = 'info',
}: {
  title: string;
  description: string;
  severity?: 'success' | 'info' | 'warning' | 'error';
}) {
  return (
    <Alert severity={severity}>
      <Stack spacing={0.2}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {description}
        </Typography>
      </Stack>
    </Alert>
  );
}

export function SalesPage() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const isCompactCashier = useMediaQuery(theme.breakpoints.down('lg'));
  const isCompactAdminList = useMediaQuery(theme.breakpoints.down('md'));
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const isCashierRole = user?.role?.code === 'CASHIER';
  const canBranchView = can('BRANCH_VIEW');
  const canSalesView = can('SALES_VIEW');
  const canSalesCreate = can('SALES_CREATE');
  const canSalesPost = can('SALES_POST');
  // Cashier flow is request-based; allow UI fallback by role in case permission payload is stale until next re-login.
  const canSalesVoidRequest = can('SALES_VOID_REQUEST') || isCashierRole;
  const canSalesVoid = can('SALES_VOID') && !isCashierRole;
  const canSalesPayment = can('SALES_PAYMENT');
  const canLedgerView = can('LEDGER_VIEW');

  const [searchParams, setSearchParams] = useSearchParams();
  const branchesQuery = useBranchesQuery(canBranchView);

  const [branchId, setBranchId] = useState<number | ''>(() => {
    const fromUrl = toInt(searchParams.get('branch_id'));
    if (fromUrl) return fromUrl;
    const fromStorage = authStorage.getLastBranchId();
    return fromStorage ?? (user?.branch_id ?? '');
  });
  const [status, setStatus] = useState<string>(() => searchParams.get('status') ?? '');
  const [paymentStatus, setPaymentStatus] = useState<string>(() => searchParams.get('payment_status') ?? '');
  const [voidRequestStatus, setVoidRequestStatus] = useState<string>(() => searchParams.get('void_request_status') ?? '');
  const [page, setPage] = useState<number>(() => toInt(searchParams.get('page')) ?? 1);
  const [search, setSearch] = useState<string>(() => searchParams.get('search') ?? '');
  const [searchDebounced, setSearchDebounced] = useState<string>(() => searchParams.get('search') ?? '');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const saleQuery = useSaleQuery(selectedId ?? 0, !!selectedId && canSalesView);
  const selected = saleQuery.data ?? null;
  const selectedItems = (selected?.items ?? []) as SaleItem[];
  const selectedPayments = selected?.payments ?? [];

  const [openCreate, setOpenCreate] = useState(false);
  const [createBranchId, setCreateBranchId] = useState<number | ''>(branchId);
  const [notes, setNotes] = useState('');
  const [variantSearch, setVariantSearch] = useState('');
  const [variantSearchDebounced, setVariantSearchDebounced] = useState('');
  const [pickedVariant, setPickedVariant] = useState<any | null>(null);
  const [itemQty, setItemQty] = useState('1');
  const [itemPrice, setItemPrice] = useState('0');
  const [itemDiscount, setItemDiscount] = useState('0');
  const [itemTax, setItemTax] = useState('0');
  const [draftItems, setDraftItems] = useState<DraftSaleItem[]>([]);
  const [isScanResolving, setIsScanResolving] = useState(false);
  const [cashierAutoOpened, setCashierAutoOpened] = useState(false);
  const [cashierCategory, setCashierCategory] = useState<string>('ALL');

  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentClientTxnId, setPaymentClientTxnId] = useState<string>(() => createClientTxnId());
  const [cashierMobileView, setCashierMobileView] = useState<CashierMobileView>('CATALOG');
  const [snack, setSnack] = useState<{ severity: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState>(() => emptyConfirmActionState());
  const [confirmActionBusy, setConfirmActionBusy] = useState(false);
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const catalogSectionRef = useRef<HTMLDivElement | null>(null);
  const cartSectionRef = useRef<HTMLDivElement | null>(null);
  const queueSectionRef = useRef<HTMLDivElement | null>(null);
  const activitySectionRef = useRef<HTMLDivElement | null>(null);

  const createMut = useCreateSaleMutation();
  const postMut = usePostSaleMutation();
  const paymentMut = useAddSalePaymentMutation();
  const voidMut = useVoidSaleMutation();
  const requestVoidMut = useRequestSaleVoidMutation();
  const approveVoidMut = useApproveSaleVoidRequestMutation();
  const rejectVoidMut = useRejectSaleVoidRequestMutation();

  const syncApprovalNotifications = async () => {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['dashboardApprovalQueue'], type: 'active' }),
      queryClient.refetchQueries({ queryKey: ['dashboardSummary'], type: 'active' }),
    ]);
  };

  const openConfirmAction = ({
    title,
    message,
    detail = '',
    confirmLabel,
    confirmColor = 'primary',
    onConfirm,
  }: ConfirmActionConfig) => {
    setConfirmAction({
      open: true,
      title,
      message,
      detail,
      confirmLabel,
      confirmColor,
      onConfirm,
    });
  };

  const closeConfirmAction = () => {
    if (confirmActionBusy) return;
    setConfirmAction(emptyConfirmActionState());
  };

  const submitConfirmAction = async () => {
    if (!confirmAction.onConfirm || confirmActionBusy) return;
    setConfirmActionBusy(true);
    try {
      await confirmAction.onConfirm();
      setConfirmAction(emptyConfirmActionState());
    } finally {
      setConfirmActionBusy(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 260);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!openCreate) return;
    const t = setTimeout(() => setVariantSearchDebounced(variantSearch.trim()), 260);
    return () => clearTimeout(t);
  }, [variantSearch, openCreate]);

  useEffect(() => {
    if (!canBranchView) return;
    if (branchId !== '' || !branchesQuery.data?.length) return;
    const preferred = user?.branch_id ? branchesQuery.data.find((b) => b.id === user.branch_id) : null;
    const first = preferred ?? branchesQuery.data[0];
    setBranchId(first.id);
    authStorage.setLastBranchId(first.id);
  }, [canBranchView, branchId, branchesQuery.data, user?.branch_id]);

  useEffect(() => {
    if (branchId === '') return;
    const next = new URLSearchParams();
    next.set('branch_id', String(branchId));
    if (!isCashierRole) {
      if (status) next.set('status', status);
      if (paymentStatus) next.set('payment_status', paymentStatus);
      if (voidRequestStatus) next.set('void_request_status', voidRequestStatus);
      if (page !== 1) next.set('page', String(page));
      if (searchDebounced) next.set('search', searchDebounced);
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, isCashierRole, status, paymentStatus, voidRequestStatus, page, searchDebounced]);

  const salesQuery = useSalesQuery(
    {
      page: isCashierRole ? 1 : page,
      branch_id: branchId === '' ? undefined : branchId,
      status: isCashierRole ? undefined : status || undefined,
      payment_status: isCashierRole ? undefined : paymentStatus || undefined,
      void_request_status: isCashierRole ? undefined : voidRequestStatus || undefined,
      search: isCashierRole ? undefined : searchDebounced || undefined,
    },
    branchId !== '' && canSalesView
  );

  const variantLookup = useVariantsQuery(
    {
      page: 1,
      search: variantSearchDebounced || undefined,
      branch_id: typeof createBranchId === 'number' ? createBranchId : undefined,
    },
    openCreate && canSalesCreate && variantSearchDebounced.length >= 2
  );
  const variantOptions = variantLookup.data?.data ?? [];
  const cashierCatalogQuery = useVariantsQuery(
    {
      page: 1,
      search: variantSearchDebounced || undefined,
      branch_id: typeof createBranchId === 'number' ? createBranchId : undefined,
    },
    isCashierRole && canSalesCreate && typeof createBranchId === 'number'
  );
  const cashierCatalogVariants = useMemo(
    () => (cashierCatalogQuery.data?.data ?? []).filter((variant: any) => variant?.is_active !== false),
    [cashierCatalogQuery.data?.data]
  );

  const rows = salesQuery.data?.data ?? [];
  const rowsByRecentAction = useMemo(
    () => [...rows].sort((a: any, b: any) => checkoutActivityAt(b) - checkoutActivityAt(a)),
    [rows]
  );
  const totalPages = salesQuery.data?.last_page ?? 1;
  const cashierActionRows = useMemo(
    () =>
      rowsByRecentAction
        .filter((row: any) => {
          const status = String(row?.status ?? '').toUpperCase();
          const paymentStatus = String(row?.payment_status ?? '').toUpperCase();
          if (status === 'DRAFT') return true;
          if (status === 'POSTED' && paymentStatus !== 'PAID') return true;
          return false;
        })
        .slice(0, 8),
    [rowsByRecentAction]
  );
  const cashierActivityRows = useMemo(() => rowsByRecentAction.slice(0, 10), [rowsByRecentAction]);
  const showCatalogPanel = !isPhone || cashierMobileView === 'CATALOG';
  const showCartPanel = !isPhone || cashierMobileView === 'CART';
  const showQueuePanel = !isPhone || cashierMobileView === 'QUEUE';
  const showActivityPanel = !isPhone || cashierMobileView === 'ACTIVITY';

  const draftGrandTotal = useMemo(
    () =>
      draftItems.reduce(
        (sum, row) => sum + Math.max(0, row.qty * row.unit_price - row.line_discount + row.line_tax),
        0
      ),
    [draftItems]
  );
  const draftQtyTotal = useMemo(
    () => draftItems.reduce((sum, row) => sum + row.qty, 0),
    [draftItems]
  );
  const draftSubTotal = useMemo(
    () => draftItems.reduce((sum, row) => sum + row.qty * row.unit_price, 0),
    [draftItems]
  );
  const draftDiscountTotal = useMemo(
    () => draftItems.reduce((sum, row) => sum + row.line_discount, 0),
    [draftItems]
  );
  const draftTaxTotal = useMemo(
    () => draftItems.reduce((sum, row) => sum + row.line_tax, 0),
    [draftItems]
  );

  const selectedGrandTotal = toNum(selected?.grand_total);
  const selectedPaidTotal = toNum(selected?.paid_total);
  const dueAmount = Math.max(0, selectedGrandTotal - selectedPaidTotal);
  const selectedVoidRequestStatus = String(selected?.void_request_status ?? '').toUpperCase();
  const hasPendingVoidRequest = selectedVoidRequestStatus === 'PENDING';
  const selectedNotes = String(selected?.notes ?? '').trim();
  const selectedVoidedByName = String((selected?.voided_by ?? selected?.voidedBy)?.name ?? '').trim();
  const selectedVoidRequestedByName = String((selected?.void_requested_by ?? selected?.voidRequestedBy)?.name ?? '').trim();
  const selectedVoidRejectedByName = String((selected?.void_rejected_by ?? selected?.voidRejectedBy)?.name ?? '').trim();
  const selectedVoidRequestedAtText = selected?.void_requested_at
    ? new Date(selected.void_requested_at).toLocaleString()
    : '';
  const selectedVoidRejectedAtText = selected?.void_rejected_at
    ? new Date(selected.void_rejected_at).toLocaleString()
    : '';
  const selectedVoidRequestNotes = String(selected?.void_request_notes ?? '').trim();
  const selectedVoidRejectionNotes = String(selected?.void_rejection_notes ?? '').trim();

  const cashierCategoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const variant of cashierCatalogVariants) {
      const raw = String(variant?.product?.product_type ?? '').trim();
      if (raw) set.add(raw.toUpperCase());
    }
    return ['ALL', ...Array.from(set)];
  }, [cashierCatalogVariants]);

  const filteredCashierCatalog = useMemo(() => {
    if (cashierCategory === 'ALL') return cashierCatalogVariants;
    return cashierCatalogVariants.filter(
      (variant) => String(variant?.product?.product_type ?? '').toUpperCase() === cashierCategory
    );
  }, [cashierCatalogVariants, cashierCategory]);
  const draftVariantIdSet = useMemo(
    () => new Set(draftItems.map((row) => Number(row.product_variant_id))),
    [draftItems]
  );

  useEffect(() => {
    if (!isCashierRole) return;
    if (cashierCategoryOptions.includes(cashierCategory)) return;
    setCashierCategory('ALL');
  }, [cashierCategory, cashierCategoryOptions, isCashierRole]);

  const openNewSale = (options?: { focusSearch?: boolean }) => {
    if (!canSalesCreate) {
      setSnack({ severity: 'error', message: 'Not authorized: SALES_CREATE' });
      return;
    }

    setOpenCreate(true);
    setCreateBranchId(branchId);
    setNotes('');
    setVariantSearch('');
    setVariantSearchDebounced('');
    setPickedVariant(null);
    setItemQty('1');
    setItemPrice('0');
    setItemDiscount('0');
    setItemTax('0');
    setDraftItems([]);
    setIsScanResolving(false);
    setCashierCategory('ALL');
    setCashierMobileView('CATALOG');
    if (isCashierRole && options?.focusSearch) {
      focusScanInput();
    }
  };

  useEffect(() => {
    if (!isCashierRole || cashierAutoOpened || !canSalesCreate || branchId === '') return;
    openNewSale({ focusSearch: false });
    setCashierAutoOpened(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCashierRole, cashierAutoOpened, canSalesCreate, branchId]);

  useEffect(() => {
    if (!selectedId) return;
    setPaymentClientTxnId(createClientTxnId());
  }, [selectedId]);

  const focusScanInput = () => {
    window.requestAnimationFrame(() => {
      scanInputRef.current?.focus();
      scanInputRef.current?.select();
    });
  };

  const scrollToCashierSection = (ref: RefObject<HTMLDivElement>) => {
    window.requestAnimationFrame(() => {
      ref.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const openCashierMobilePanel = (panel: CashierMobileView) => {
    setCashierMobileView(panel);
    if (!isPhone) return;
    if (panel === 'CATALOG') {
      scrollToCashierSection(catalogSectionRef);
      return;
    }
    if (panel === 'CART') {
      scrollToCashierSection(cartSectionRef);
      return;
    }
    if (panel === 'QUEUE') {
      scrollToCashierSection(queueSectionRef);
      return;
    }
    scrollToCashierSection(activitySectionRef);
  };

  const jumpToCart = () => {
    if (isPhone) {
      openCashierMobilePanel('CART');
      return;
    }
    scrollToCashierSection(cartSectionRef);
  };

  const pushDraftItem = (
    variant: ProductVariant,
    qty: number,
    unitPrice: number,
    lineDiscount: number,
    lineTax: number
  ) => {
    const variantId = Number(variant?.id);
    const onHand = Math.max(0, variantOnHand(variant));
    const variantLabel = variant?.sku ?? variant?.variant_name ?? `Variant #${variantId}`;
    if (!Number.isFinite(variantId) || variantId <= 0) {
      setSnack({ severity: 'error', message: 'Invalid variant selection.' });
      return;
    }
    if (onHand <= 0) {
      setSnack({ severity: 'error', message: `${variantLabel} is unavailable (no stock).` });
      return;
    }

    const nextItem: DraftSaleItem = {
      product_variant_id: variantId,
      sku: variant?.sku ?? null,
      productName: variant?.product?.name ?? null,
      variantName: variant?.variant_name ?? null,
      qty,
      max_qty: onHand,
      unit_price: unitPrice,
      line_discount: lineDiscount,
      line_tax: lineTax,
    };

    let exceededStock = false;
    setDraftItems((prev) => {
      const idx = prev.findIndex((x) => x.product_variant_id === variantId);
      if (idx < 0) {
        if (nextItem.qty > onHand + 1e-9) {
          exceededStock = true;
          return prev;
        }
        return [...prev, nextItem];
      }

      const clone = [...prev];
      const nextQty = clone[idx].qty + nextItem.qty;
      if (nextQty > onHand + 1e-9) {
        exceededStock = true;
        return prev;
      }
      clone[idx] = {
        ...clone[idx],
        qty: nextQty,
        max_qty: onHand,
        unit_price: nextItem.unit_price,
        line_discount: clone[idx].line_discount + nextItem.line_discount,
        line_tax: clone[idx].line_tax + nextItem.line_tax,
      };
      return clone;
    });

    if (exceededStock) {
      setSnack({
        severity: 'error',
        message: `${variantLabel} has only ${qtyFmt(onHand)} stock available.`,
      });
    }
  };

  const addVariantFromCatalog = (variant: ProductVariant) => {
    const onHand = variantOnHand(variant);
    const variantId = Number(variant?.id);
    const variantLabel = variant.sku ?? `Variant #${variant.id}`;
    if (onHand <= 0) {
      setSnack({ severity: 'error', message: `${variantLabel} is unavailable (no stock).` });
      return;
    }
    if (!Number.isFinite(variantId) || variantId <= 0) {
      setSnack({ severity: 'error', message: 'Invalid variant selection.' });
      return;
    }

    const existed = draftItems.some((row) => row.product_variant_id === variantId);

    setDraftItems((prev) => {
      if (prev.some((row) => row.product_variant_id === variantId)) {
        return prev.filter((row) => row.product_variant_id !== variantId);
      }

      return [
        ...prev,
        {
          product_variant_id: variantId,
          sku: variant?.sku ?? null,
          productName: variant?.product?.name ?? null,
          variantName: variant?.variant_name ?? null,
          qty: 1,
          max_qty: Math.max(0, onHand),
          unit_price: toNum(variant.default_price),
          line_discount: 0,
          line_tax: 0,
        },
      ];
    });

    setSnack({
      severity: existed ? 'info' : 'success',
      message: existed
        ? `${variantLabel} removed from cart.`
        : `${variantLabel} added.`,
    });
    if (!isPhone) {
      focusScanInput();
    }
  };

  const changeDraftQty = (variantId: number, delta: number) => {
    let exceededStock = false;
    let blockedLabel = `Variant #${variantId}`;
    let blockedMax = 0;
    setDraftItems((prev) => {
      return prev
        .map((row) => {
          if (row.product_variant_id !== variantId) return row;
          const nextQty = row.qty + delta;
          if (delta > 0 && nextQty > toNum(row.max_qty) + 1e-9) {
            exceededStock = true;
            blockedLabel = row.sku ?? row.variantName ?? blockedLabel;
            blockedMax = toNum(row.max_qty);
            return row;
          }
          return { ...row, qty: nextQty };
        })
        .filter((row) => row.qty > 0);
    });

    if (exceededStock) {
      setSnack({
        severity: 'error',
        message: `${blockedLabel} has only ${qtyFmt(blockedMax)} stock available.`,
      });
    }
  };

  const addDraftItem = () => {
    const variant = pickedVariant as ProductVariant | null;
    const variantId = Number(variant?.id);
    const qty = Number(itemQty);
    const unitPrice = Number(itemPrice);
    const lineDiscount = Number(itemDiscount || '0');
    const lineTax = Number(itemTax || '0');

    if (!Number.isFinite(variantId) || variantId <= 0) {
      setSnack({ severity: 'error', message: 'Pick a variant first.' });
      return;
    }
    if (variantOnHand(variant) <= 0) {
      setSnack({ severity: 'error', message: `${variant?.sku ?? `Variant #${variantId}`} is unavailable (no stock).` });
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setSnack({ severity: 'error', message: 'Qty must be greater than zero.' });
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setSnack({ severity: 'error', message: 'Unit price must be zero or higher.' });
      return;
    }
    if (!Number.isFinite(lineDiscount) || lineDiscount < 0 || !Number.isFinite(lineTax) || lineTax < 0) {
      setSnack({ severity: 'error', message: 'Discount and tax must be zero or higher.' });
      return;
    }

    pushDraftItem(variant!, qty, unitPrice, lineDiscount, lineTax);

    setItemQty('1');
    setPickedVariant(null);
    focusScanInput();
  };

  const resolveScanCode = async () => {
    const code = variantSearch.trim();
    if (!code) {
      setSnack({ severity: 'error', message: 'Scan or type a barcode/SKU first.' });
      return;
    }

    const activeBranchId = typeof createBranchId === 'number' ? createBranchId : null;
    if (!activeBranchId) {
      setSnack({ severity: 'error', message: 'Select a branch before scanning.' });
      return;
    }

    setIsScanResolving(true);
    try {
      const exactResponse = await getVariants({
        page: 1,
        code,
        branch_id: activeBranchId,
      });
      const exactMatches = (exactResponse.data ?? []) as ProductVariant[];

      if (exactMatches.length === 1) {
        const matched = exactMatches[0];
        if (variantOnHand(matched) <= 0) {
          setSnack({ severity: 'error', message: `${matched.sku ?? `Variant #${matched.id}`} is unavailable (no stock).` });
          return;
        }
        pushDraftItem(matched, 1, toNum(matched.default_price), 0, 0);
        setSnack({ severity: 'success', message: `Scanned: ${matched.sku ?? `Variant #${matched.id}`} added.` });
        setVariantSearch('');
        setVariantSearchDebounced('');
        setPickedVariant(null);
        focusScanInput();
        return;
      }

      if (exactMatches.length > 1) {
        const first = exactMatches.find((row) => variantOnHand(row) > 0) ?? exactMatches[0];
        if (variantOnHand(first) <= 0) {
          setSnack({ severity: 'error', message: 'Matched variants are all unavailable (no stock).' });
          return;
        }
        setPickedVariant(first);
        setItemPrice(String(toNum(first.default_price)));
        setSnack({
          severity: 'info',
          message: 'Multiple exact code matches found. Pick the correct variant from the list.',
        });
        setVariantSearch(code);
        setVariantSearchDebounced(code);
        return;
      }

      const searchResponse = await getVariants({
        page: 1,
        search: code,
        branch_id: activeBranchId,
      });
      const fuzzyMatches = (searchResponse.data ?? []) as ProductVariant[];

      if (fuzzyMatches.length === 1) {
        const matched = fuzzyMatches[0];
        if (variantOnHand(matched) <= 0) {
          setSnack({ severity: 'error', message: `${matched.sku ?? `Variant #${matched.id}`} is unavailable (no stock).` });
          return;
        }
        pushDraftItem(matched, 1, toNum(matched.default_price), 0, 0);
        setSnack({ severity: 'success', message: `Matched: ${matched.sku ?? `Variant #${matched.id}`} added.` });
        setVariantSearch('');
        setVariantSearchDebounced('');
        setPickedVariant(null);
        focusScanInput();
        return;
      }

      if (fuzzyMatches.length > 1) {
        const first = fuzzyMatches.find((row) => variantOnHand(row) > 0) ?? fuzzyMatches[0];
        if (variantOnHand(first) <= 0) {
          setSnack({ severity: 'error', message: 'Matched variants are all unavailable (no stock).' });
          return;
        }
        setPickedVariant(first);
        setItemPrice(String(toNum(first.default_price)));
        setSnack({
          severity: 'info',
          message: 'No exact code match. Showing closest matches, pick the correct variant.',
        });
        setVariantSearch(code);
        setVariantSearchDebounced(code);
        return;
      }

      setSnack({ severity: 'error', message: 'No variant found for this barcode/SKU.' });
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to resolve scanned code.';
      setSnack({ severity: 'error', message });
    } finally {
      setIsScanResolving(false);
      if (isCashierRole) {
        focusScanInput();
      }
    }
  };

  const submitCreateSale = async () => {
    try {
      const b = typeof createBranchId === 'number' ? createBranchId : null;
      if (!b) {
        setSnack({ severity: 'error', message: 'Please select a branch.' });
        return;
      }
      if (draftItems.length === 0) {
        setSnack({ severity: 'error', message: 'Add at least one item.' });
        return;
      }

      const payload = {
        branch_id: b,
        notes: notes.trim() || null,
        items: draftItems.map((row) => ({
          product_variant_id: row.product_variant_id,
          qty: row.qty,
          unit_price: row.unit_price,
          line_discount: row.line_discount,
          line_tax: row.line_tax,
          notes: null,
        })),
      };

      const created = await createMut.mutateAsync(payload);
      setOpenCreate(false);
      setSelectedId(created.id);

      if (isCashierRole && canSalesPost) {
        try {
          await postMut.mutateAsync({ id: created.id });
          const total = toNum(created.grand_total);
          setPaymentMethod('CASH');
          setPaymentAmount(total > 0 ? total.toFixed(2) : '');
          setSnack({ severity: 'success', message: `Sale #${created.id} created and posted. Proceed to payment.` });
          await Promise.all([salesQuery.refetch(), cashierCatalogQuery.refetch()]);
        } catch (postError: any) {
          const postMessage =
            postError?.response?.data?.errors?.stock?.[0] ??
            postError?.response?.data?.message ??
            'Sale created but posting failed. Please post manually.';
          setSnack({ severity: 'info', message: postMessage });
        }
        return;
      }

      setSnack({
        severity: 'success',
        message: isCashierRole
          ? `Sale #${created.id} saved as DRAFT. Stock will decrease only after posting the sale.`
          : `Sale #${created.id} created.`,
      });
      await salesQuery.refetch();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to create sale.';
      setSnack({ severity: 'error', message });
    }
  };

  const runPostSale = async () => {
    if (!selected) return;
    try {
      await postMut.mutateAsync({ id: selected.id });
      if (isCashierRole && dueAmount > 0) {
        setPaymentMethod('CASH');
        setPaymentAmount(dueAmount.toFixed(2));
      }
      setSnack({ severity: 'success', message: `Sale #${selected.id} posted.` });
      await Promise.all([saleQuery.refetch(), salesQuery.refetch(), cashierCatalogQuery.refetch()]);
    } catch (error: any) {
      const details = error?.response?.data?.errors?.stock?.[0] ?? error?.response?.data?.message;
      setSnack({ severity: 'error', message: details || 'Failed to post sale.' });
    }
  };

  const runAddPayment = async () => {
    if (!selected) return;
    if (dueAmount <= 0) {
      setSnack({ severity: 'error', message: 'Sale is already fully paid.' });
      return;
    }

    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSnack({ severity: 'error', message: 'Payment amount must be greater than zero.' });
      return;
    }

    try {
      await paymentMut.mutateAsync({
        id: selected.id,
        input: {
          method: paymentMethod,
          amount,
          reference_no: paymentRef.trim() || null,
          client_txn_id: paymentClientTxnId,
          notes: paymentNotes.trim() || null,
        },
      });
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
      setPaymentClientTxnId(createClientTxnId());
      setSnack({ severity: 'success', message: 'Payment recorded.' });
      await Promise.all([saleQuery.refetch(), salesQuery.refetch()]);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to add payment.';
      setSnack({ severity: 'error', message });
    }
  };

  const runVoidSale = () => {
    if (!selected) return;
    const status = String(selected.status ?? '').toUpperCase();
    if (status !== 'DRAFT' && status !== 'POSTED') {
      setSnack({ severity: 'error', message: 'Only draft or posted sales can be voided.' });
      return;
    }
    if (selectedVoidRequestStatus === 'PENDING' && !canSalesVoid) {
      setSnack({ severity: 'error', message: 'This sale already has a pending void request.' });
      return;
    }

    const saleId = selected.id;
    const isPaid = String(selected.payment_status ?? '').toUpperCase() === 'PAID';
    openConfirmAction({
      title: `Void Sale #${saleId}?`,
      message: isPaid
        ? 'This paid checkout will be marked as void and sold stock will be returned to inventory.'
        : 'This checkout will be marked as void.',
      detail: 'Use this for canceled or incorrect transactions that should not remain active.',
      confirmLabel: 'Void Sale',
      confirmColor: 'error',
      onConfirm: async () => {
        try {
          await voidMut.mutateAsync({ id: saleId });
          authStorage.pingApprovalQueue();
          setPaymentAmount('');
          setPaymentRef('');
          setPaymentNotes('');
          setSnack({ severity: 'success', message: `Sale #${saleId} voided.` });
          await Promise.all([
            saleQuery.refetch(),
            salesQuery.refetch(),
            cashierCatalogQuery.refetch(),
            syncApprovalNotifications(),
          ]);
        } catch (error: any) {
          const message =
            error?.response?.data?.errors?.status?.[0] ?? error?.response?.data?.message ?? 'Failed to void sale.';
          setSnack({ severity: 'error', message });
        }
      },
    });
  };

  const runRequestVoid = () => {
    if (!selected) return;
    const status = String(selected.status ?? '').toUpperCase();
    if (status !== 'DRAFT' && status !== 'POSTED') {
      setSnack({ severity: 'error', message: 'Only draft or posted sales can request void.' });
      return;
    }
    if (selectedVoidRequestStatus === 'PENDING') {
      setSnack({ severity: 'error', message: 'This sale already has a pending void request.' });
      return;
    }

    const saleId = selected.id;
    const isPaid = String(selected.payment_status ?? '').toUpperCase() === 'PAID';
    openConfirmAction({
      title: `Request Void for Sale #${saleId}?`,
      message: isPaid
        ? 'Admin approval will be required before the sale is voided and stock is returned.'
        : 'This will submit a void request for admin approval.',
      detail: 'This keeps an approval trail and prevents accidental direct voiding.',
      confirmLabel: 'Submit Request',
      confirmColor: 'warning',
      onConfirm: async () => {
        try {
          await requestVoidMut.mutateAsync({ id: saleId });
          authStorage.pingApprovalQueue();
          setSnack({ severity: 'success', message: `Void request submitted for Sale #${saleId}.` });
          await Promise.all([saleQuery.refetch(), salesQuery.refetch(), syncApprovalNotifications()]);
        } catch (error: any) {
          const message =
            error?.response?.data?.errors?.void_request_status?.[0] ??
            error?.response?.data?.errors?.status?.[0] ??
            error?.response?.data?.message ??
            'Failed to submit void request.';
          setSnack({ severity: 'error', message });
        }
      },
    });
  };

  const runApproveVoidRequest = () => {
    if (!selected) return;
    if (selectedVoidRequestStatus !== 'PENDING') {
      setSnack({ severity: 'error', message: 'No pending void request to approve.' });
      return;
    }

    const saleId = selected.id;
    const isPaid = String(selected.payment_status ?? '').toUpperCase() === 'PAID';
    openConfirmAction({
      title: `Approve Void Request for Sale #${saleId}?`,
      message: isPaid
        ? 'Approving this request will void the sale and return sold stock to inventory.'
        : 'Approving this request will void this sale.',
      detail: 'This action is recorded in audit history.',
      confirmLabel: 'Approve and Void',
      confirmColor: 'error',
      onConfirm: async () => {
        try {
          await approveVoidMut.mutateAsync({ id: saleId });
          authStorage.pingApprovalQueue();
          setPaymentAmount('');
          setPaymentRef('');
          setPaymentNotes('');
          setSnack({ severity: 'success', message: `Void request approved. Sale #${saleId} is now voided.` });
          await Promise.all([
            saleQuery.refetch(),
            salesQuery.refetch(),
            cashierCatalogQuery.refetch(),
            syncApprovalNotifications(),
          ]);
        } catch (error: any) {
          const message =
            error?.response?.data?.errors?.void_request_status?.[0] ??
            error?.response?.data?.errors?.status?.[0] ??
            error?.response?.data?.message ??
            'Failed to approve void request.';
          setSnack({ severity: 'error', message });
        }
      },
    });
  };

  const runRejectVoidRequest = () => {
    if (!selected) return;
    if (selectedVoidRequestStatus !== 'PENDING') {
      setSnack({ severity: 'error', message: 'No pending void request to reject.' });
      return;
    }

    const saleId = selected.id;
    openConfirmAction({
      title: `Reject Void Request for Sale #${saleId}?`,
      message: 'This keeps the sale active and allows payment flow to continue.',
      detail: 'Only reject if the checkout should remain valid.',
      confirmLabel: 'Reject Request',
      confirmColor: 'inherit',
      onConfirm: async () => {
        try {
          await rejectVoidMut.mutateAsync({ id: saleId });
          authStorage.pingApprovalQueue();
          setSnack({ severity: 'success', message: `Void request rejected for Sale #${saleId}.` });
          await Promise.all([saleQuery.refetch(), salesQuery.refetch(), syncApprovalNotifications()]);
        } catch (error: any) {
          const message =
            error?.response?.data?.errors?.void_request_status?.[0] ??
            error?.response?.data?.message ??
            'Failed to reject void request.';
          setSnack({ severity: 'error', message });
        }
      },
    });
  };

  const goToLedgerForSale = () => {
    if (!selected) return;
    const params = new URLSearchParams();
    params.set('branch_id', String(selected.branch_id));
    params.set('ref_type', 'sales');
    params.set('ref_id', String(selected.id));
    navigate(`/ledger?${params.toString()}`);
  };

  const openSaleFromRow = (row: any) => {
    const id = Number(row?.id ?? row?.sale_id ?? 0);
    if (!Number.isFinite(id) || id <= 0) {
      setSnack({ severity: 'error', message: 'Unable to open this sale record.' });
      return;
    }
    if (String(row?.void_request_status ?? '').toUpperCase() === 'PENDING') {
      authStorage.markSeenPending(user?.id, 'voidRequests', id);
      authStorage.markSeenPendingAt(user?.id, 'voidRequests', row?.void_requested_at ?? null);
    }
    setSelectedId(id);
  };

  if (!canSalesView) {
    return <Alert severity="error">Not authorized to view sales.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ md: 'center' }}>
        <Box>
          <Typography variant="h5">{isCashierRole ? 'Cashier Terminal' : 'Sales / Cashier'}</Typography>
          <Typography variant="body2" color="text.secondary">
            {isCashierRole
              ? isPhone
                ? 'Fast scan-to-cart checkout.'
                : 'Scanner-first checkout with fast posting and payment capture.'
              : 'Create sales, post stock-out movements, and record cash collections.'}
          </Typography>
        </Box>
        {(!isCashierRole || !isPhone) && (
          <Tooltip
            title={
              isCashierRole
                ? 'Start a fresh checkout cart for scanner-first sales.'
                : 'Create a new sale draft with selected items.'
            }
            arrow
          >
            <span>
              <Button
                variant="contained"
                onClick={() => openNewSale({ focusSearch: isCashierRole && !isPhone })}
                disabled={!canSalesCreate}
              >
                {isCashierRole ? 'Start New Checkout' : 'New Sale'}
              </Button>
            </span>
          </Tooltip>
        )}
      </Stack>

      {canBranchView && branchesQuery.isError && <Alert severity="error">Failed to load branches.</Alert>}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ md: 'center' }}>
        <Box sx={{ flex: 1, minWidth: 260 }}>
          {canBranchView ? (
            <BranchSelect
              branches={branchesQuery.data ?? []}
              value={branchId}
              onChange={(id) => {
                setBranchId(id);
                authStorage.setLastBranchId(id);
                setPage(1);
              }}
            />
          ) : (
            <TextField
              size="small"
              fullWidth
              label="Branch"
              value={user?.branch?.name ?? (typeof branchId === 'number' ? `Branch #${branchId}` : '-')}
              disabled
            />
          )}
        </Box>
        {isCashierRole && !isPhone ? (
          <EmptyStateNotice
            severity="info"
            title="Scanner Ready"
            description="Scan barcode or SKU then press Enter. Unique match is auto-added to cart."
          />
        ) : !isCashierRole ? (
          <>
            <TextField
              select
              size="small"
              label="Status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              sx={{ width: { xs: '100%', md: 170 } }}
            >
              {STATUSES.map((value) => (
                <MenuItem key={value || 'ALL'} value={value}>
                  {value || 'All'}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Payment"
              value={paymentStatus}
              onChange={(event) => {
                setPaymentStatus(event.target.value);
                setPage(1);
              }}
              sx={{ width: { xs: '100%', md: 170 } }}
            >
              {PAYMENT_STATUSES.map((value) => (
                <MenuItem key={value || 'ALL'} value={value}>
                  {value || 'All'}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Void Req."
              value={voidRequestStatus}
              onChange={(event) => {
                setVoidRequestStatus(event.target.value);
                setPage(1);
              }}
              sx={{ width: { xs: '100%', md: 170 } }}
            >
              {VOID_REQUEST_STATUSES.map((value) => (
                <MenuItem key={value || 'ALL'} value={value}>
                  {value || 'All'}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Search"
              placeholder="Sale #, notes, id..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              sx={{ minWidth: { xs: 0, md: 240 }, flex: 1 }}
            />
          </>
        ) : null}
      </Stack>

      {branchId === '' ? (
        <EmptyStateNotice
          severity={canBranchView ? 'info' : 'error'}
          title={canBranchView ? 'Branch Required' : 'No Branch Assigned'}
          description={
            canBranchView
              ? 'Select a branch to view and manage sales.'
              : 'Your account has no branch assignment yet. Ask admin to assign one.'
          }
        />
      ) : isCashierRole ? (
        <>
        <Box
          className={isPhone ? 'cashier-mobile-surface' : undefined}
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: '1.7fr 1fr' },
            alignItems: 'start',
            pb: isPhone ? 19 : 0,
          }}
        >
          {showCatalogPanel && (
          <Paper
            ref={catalogSectionRef}
            variant="outlined"
            className={isPhone ? 'cashier-mobile-panel' : undefined}
            sx={{ p: isPhone ? 1 : 1.25 }}
          >
            <Stack spacing={isPhone ? 1 : 1.25}>
              {isCompactCashier && !isPhone && (
                <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap" alignItems="center">
                  <Chip size="small" label={`Items ${qtyFmt(draftQtyTotal)}`} />
                  <Chip size="small" color="primary" label={`Total ${money(draftGrandTotal)}`} />
                  <Tooltip title="Scroll to the cart and payment actions." arrow>
                    <Button size="small" variant="outlined" onClick={jumpToCart}>
                      Jump to Cart
                    </Button>
                  </Tooltip>
                </Stack>
              )}
              <Stack direction="row" spacing={0.8} alignItems="center" className={isPhone ? 'cashier-mobile-search-row' : undefined}>
                <TextField
                  inputRef={scanInputRef}
                  size="small"
                  label="Search product / Scan barcode"
                  placeholder={isPhone ? 'Scan barcode / SKU' : 'Scan code then press Enter'}
                  value={variantSearch}
                  onChange={(event) => setVariantSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    void resolveScanCode();
                  }}
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root': isPhone
                      ? {
                          borderRadius: '14px',
                          backgroundColor: '#f4f5f8',
                        }
                      : undefined,
                  }}
                />
                <Button
                  variant="contained"
                  onClick={() => void resolveScanCode()}
                  disabled={isScanResolving || !variantSearch.trim()}
                  sx={{
                    minWidth: isPhone ? 64 : 130,
                    px: isPhone ? 1.25 : 2,
                    minHeight: isPhone ? 48 : undefined,
                    borderRadius: isPhone ? '14px' : undefined,
                    bgcolor: isPhone ? '#0f172a' : undefined,
                    '&:hover': isPhone ? { bgcolor: '#111827' } : undefined,
                  }}
                >
                  {isScanResolving ? (isPhone ? '...' : 'Scanning...') : isPhone ? 'Add' : 'Scan/Add'}
                </Button>
              </Stack>
              {isPhone && (
                <Typography variant="caption" color="text.secondary">
                  Tip: Tap product once to add, tap again to unselect.
                </Typography>
              )}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <TextField
                  select
                  size="small"
                  label="Type"
                  value={cashierCategory}
                  onChange={(event) => setCashierCategory(event.target.value)}
                  sx={{ width: { xs: '100%', sm: 240 } }}
                >
                  {cashierCategoryOptions.map((category) => (
                    <MenuItem key={category} value={category}>
                      {cashierCategoryLabel(category)}
                    </MenuItem>
                  ))}
                </TextField>
                <Typography variant="caption" color="text.secondary">
                  {filteredCashierCatalog.length} result(s)
                </Typography>
              </Stack>

              {cashierCatalogQuery.isLoading ? (
                <Alert severity="info">Loading product catalog...</Alert>
              ) : cashierCatalogQuery.isError ? (
                <Alert severity="error">Failed to load product catalog.</Alert>
              ) : filteredCashierCatalog.length === 0 ? (
                <EmptyStateNotice
                  severity="warning"
                  title="No Matching Products"
                  description="Try another SKU/barcode, switch category to All, or clear your current search."
                />
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1,
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' },
                  }}
                >
                  {filteredCashierCatalog.map((variant) => {
                    const onHand = variantOnHand(variant as any);
                    const unavailable = onHand <= 0;
                    const selected = draftVariantIdSet.has(Number(variant?.id));
                    const label = String(variant.variant_name ?? '').trim() || String(variant.sku ?? `#${variant.id}`);
                    const categoryKey = mobileCategoryKey(variant?.product?.product_type);
                    const statusClass = unavailable ? 'unavailable' : onHand <= 5 ? 'low_stock' : 'available';
                    const statusText = unavailable ? 'Unavailable' : onHand <= 5 ? 'Low Stock' : 'In Stock';
                    const stockCountText = `${qtyFmt(onHand)} stock`;

                    return (
                      <Paper
                        key={variant.id}
                        variant="outlined"
                        className={`cashier-mobile-card ${categoryKey}${selected ? ' selected' : ''}`}
                          onClick={() => {
                            if (unavailable) return;
                            addVariantFromCatalog(variant as ProductVariant);
                          }}
                        role={unavailable ? undefined : 'button'}
                        tabIndex={unavailable ? -1 : 0}
                        aria-disabled={unavailable}
                        onKeyDown={(event) => {
                          if (unavailable) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            addVariantFromCatalog(variant as ProductVariant);
                          }
                        }}
                        sx={{
                          p: isPhone ? 0 : 1.1,
                          cursor: unavailable ? 'not-allowed' : 'pointer',
                          opacity: unavailable ? 0.6 : 1,
                          borderColor: selected ? 'primary.main' : undefined,
                          bgcolor: selected ? 'action.selected' : 'background.paper',
                          transition: 'transform 120ms ease, box-shadow 120ms ease',
                          '&:hover': unavailable ? undefined : { transform: 'translateY(-1px)', boxShadow: 3 },
                        }}
                      >
                        {isPhone ? (
                          <Stack direction="row" alignItems="stretch" spacing={0}>
                            <Box className="cashier-mobile-card-accent" sx={{ width: 4, flexShrink: 0 }} />
                            <Box
                              className="cashier-mobile-card-icon"
                              sx={{
                                width: 52,
                                height: 52,
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                ml: 1.2,
                                my: 1.35,
                                flexShrink: 0,
                              }}
                            >
                              <Typography className="cashier-mobile-card-icon-text">
                                {mobileCategoryLabel(categoryKey)}
                              </Typography>
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1, px: 1.1, py: 1.3 }}>
                              <Typography variant="subtitle2" sx={{ lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {variant.product?.name ?? '-'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {label}
                              </Typography>
                            </Box>
                            <Stack sx={{ pr: 1.2, py: 1.2 }} alignItems="flex-end" justifyContent="space-between" spacing={0.8}>
                              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                {money((variant as any).default_price ?? 0)}
                              </Typography>
                              <Box
                                component="span"
                                className={`cashier-mobile-status-badge ${selected ? 'in_cart' : statusClass}`}
                              >
                                {selected ? `In Cart (${qtyFmt(
                                  draftItems.find((item) => item.product_variant_id === Number(variant?.id))?.qty ?? 0
                                )})` : statusText}
                              </Box>
                              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                                {stockCountText}
                              </Typography>
                            </Stack>
                          </Stack>
                        ) : (
                          <>
                            <Typography variant="subtitle2" sx={{ lineHeight: 1.15 }}>
                              {variant.product?.name ?? '-'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {label}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.8 }}>
                              {money((variant as any).default_price ?? 0)}
                            </Typography>
                            <Stack direction="row" justifyContent="flex-end" alignItems="center" sx={{ mt: 0.8 }}>
                              <Chip
                                size="small"
                                color={unavailable ? 'error' : onHand <= 5 ? 'warning' : 'success'}
                                label={onHand > 0 ? `${qtyFmt(onHand)} pcs` : 'Unavailable'}
                              />
                            </Stack>
                            {selected && (
                              <Chip
                                size="small"
                                color="primary"
                                variant="outlined"
                                label="Selected"
                                sx={{ mt: 0.8 }}
                              />
                            )}
                          </>
                        )}
                      </Paper>
                    );
                  })}
                </Box>
              )}
            </Stack>
          </Paper>
          )}

          {showCartPanel && (
          <Paper
            ref={cartSectionRef}
            variant="outlined"
            className={isPhone ? 'cashier-mobile-panel cashier-mobile-cartbar' : undefined}
            sx={{ p: isPhone ? 1 : 1.25, position: { xl: 'sticky' }, top: { xl: 92 } }}
          >
            <Stack spacing={1}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Current Cart
              </Typography>
              {draftItems.length === 0 ? (
                <EmptyStateNotice
                  severity="info"
                  title="Cart Is Empty"
                  description="Scan a barcode or tap a product card to start checkout."
                />
              ) : (
                <>
                  <Stack spacing={0.8}>
                    {draftItems.map((row) => {
                      const canIncrease = row.qty + 1 <= toNum(row.max_qty) + 1e-9;
                      return (
                        <Paper key={row.product_variant_id} variant="outlined" sx={{ p: 0.8 }}>
                          <Stack spacing={0.45}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {row.productName ?? '-'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {row.variantName ?? `Variant #${row.product_variant_id}`}
                            </Typography>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Stack direction="row" spacing={0.7} alignItems="center">
                                <Tooltip title="Decrease quantity" arrow>
                                  <Button size="small" variant="outlined" onClick={() => changeDraftQty(row.product_variant_id, -1)}>
                                    -
                                  </Button>
                                </Tooltip>
                                <Typography variant="body2" sx={{ minWidth: 26, textAlign: 'center', fontWeight: 700 }}>
                                  {qtyFmt(row.qty)}
                                </Typography>
                                <Tooltip title="Increase quantity" arrow>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => changeDraftQty(row.product_variant_id, 1)}
                                    disabled={!canIncrease}
                                  >
                                    +
                                  </Button>
                                </Tooltip>
                              </Stack>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {money(row.qty * row.unit_price)}
                              </Typography>
                            </Stack>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>

                  <Divider />

                  <Stack spacing={0.45}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        Items
                      </Typography>
                      <Typography variant="body2">{qtyFmt(draftQtyTotal)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        Subtotal
                      </Typography>
                      <Typography variant="body2">{money(draftSubTotal)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        Discount
                      </Typography>
                      <Typography variant="body2">{money(draftDiscountTotal)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        Tax
                      </Typography>
                      <Typography variant="body2">{money(draftTaxTotal)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Total
                      </Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {money(draftGrandTotal)}
                      </Typography>
                    </Stack>
                  </Stack>

                  <TextField
                    size="small"
                    multiline
                    minRows={2}
                    label="Notes (optional)"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />

                  {isPhone ? (
                    <Stack direction="row" justifyContent="flex-end">
                      <Tooltip title="Remove all draft items from this cart." arrow>
                        <Button variant="text" color="inherit" onClick={() => setDraftItems([])}>
                          Clear Cart
                        </Button>
                      </Tooltip>
                    </Stack>
                  ) : (
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{
                        position: isCompactCashier ? 'sticky' : 'static',
                        bottom: isCompactCashier ? 10 : undefined,
                        zIndex: 2,
                        pt: isCompactCashier ? 1 : 0,
                        pb: isCompactCashier ? 0.4 : 0,
                        borderTop: isCompactCashier ? `1px solid ${theme.palette.divider}` : 'none',
                        bgcolor: isCompactCashier ? 'background.paper' : 'transparent',
                      }}
                    >
                      {isCompactCashier && (
                        <Tooltip title="Jump back to scanner field to continue scanning." arrow>
                          <Button
                            variant="outlined"
                            color="inherit"
                            onClick={() => openCashierMobilePanel('CATALOG')}
                            sx={{ flex: 1 }}
                          >
                            Back to Scan
                          </Button>
                        </Tooltip>
                      )}
                      <Tooltip title="Remove all draft items from this cart." arrow>
                        <Button variant="outlined" color="inherit" onClick={() => setDraftItems([])} sx={{ flex: 1 }}>
                          Clear Cart
                        </Button>
                      </Tooltip>
                      <Tooltip
                        title={
                          canSalesPost
                            ? 'Create the checkout then post it so payment can be captured.'
                            : 'Save this checkout as draft. Stock changes only after posting.'
                        }
                        arrow
                      >
                        <span style={{ display: 'flex', flex: 1.35 }}>
                          <Button
                            variant="contained"
                            onClick={submitCreateSale}
                            disabled={createMut.isPending || draftItems.length === 0}
                            sx={{ flex: 1.35 }}
                          >
                            {canSalesPost ? 'Create and Post Sale' : 'Create Draft Sale'}
                          </Button>
                        </span>
                      </Tooltip>
                    </Stack>
                  )}
                </>
              )}
            </Stack>
          </Paper>
          )}

          {showQueuePanel && (
          <Paper ref={queueSectionRef} variant="outlined" sx={{ p: 1.25 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Checkout Queue
              </Typography>
              {salesQuery.isLoading ? (
                <Alert severity="info">Loading checkout queue...</Alert>
              ) : salesQuery.isError ? (
                <Alert severity="error">Failed to load checkout queue.</Alert>
              ) : cashierActionRows.length === 0 ? (
                <EmptyStateNotice
                  severity="success"
                  title="Queue Is Clear"
                  description="No open checkouts right now. Posted and paid transactions appear in Recent Activity."
                />
              ) : (
                <Stack spacing={0.7}>
                  {cashierActionRows.map((row: any) => (
                    <Tooltip key={row.id} title="Open checkout details" arrow placement="left">
                      <Paper
                        variant="outlined"
                        role="button"
                        tabIndex={0}
                        onClick={() => openSaleFromRow(row)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openSaleFromRow(row);
                          }
                        }}
                        sx={{ p: 0.8, cursor: 'pointer' }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                              {row.sale_number ?? `Sale #${row.id}`}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {checkoutActivityTimeText(row)}
                            </Typography>
                          </Box>
                          <Stack alignItems="flex-end" spacing={0.3}>
                            <Chip size="small" color={statusChipColor(String(row.status ?? ''))} label={row.status ?? '-'} />
                            <Chip
                              size="small"
                              color={paymentChipColor(String(row.payment_status ?? ''))}
                              label={row.payment_status ?? '-'}
                            />
                            {String(row.void_request_status ?? '').toUpperCase() === 'PENDING' && (
                              <Chip size="small" color="warning" label="VOID PENDING" />
                            )}
                          </Stack>
                        </Stack>
                      </Paper>
                    </Tooltip>
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>
          )}

          {showActivityPanel && (
          <Paper ref={activitySectionRef} variant="outlined" sx={{ p: 1.25 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Recent Activity
              </Typography>
              {salesQuery.isLoading ? (
                <Alert severity="info">Loading recent activity...</Alert>
              ) : salesQuery.isError ? (
                <Alert severity="error">Failed to load recent activity.</Alert>
              ) : cashierActivityRows.length === 0 ? (
                <EmptyStateNotice
                  severity="info"
                  title="No Cashier Activity Yet"
                  description="Completed and updated checkouts will appear here once transactions start."
                />
              ) : (
                <Stack spacing={0.7}>
                  {cashierActivityRows.map((row: any) => (
                    <Paper
                      key={`activity-${row.id}`}
                      variant="outlined"
                      role="button"
                      tabIndex={0}
                      onClick={() => openSaleFromRow(row)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openSaleFromRow(row);
                        }
                      }}
                      sx={{ p: 0.75, cursor: 'pointer' }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {row.sale_number ?? `Sale #${row.id}`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {checkoutActivityLabel(row)}
                          </Typography>
                        </Box>
                        <Stack alignItems="flex-end" spacing={0.2}>
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            {money(row.grand_total)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {checkoutActivityTimeText(row)}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>
          )}
        </Box>
        {isPhone && !selectedId && (
          <>
            <Paper
              variant="outlined"
              className="cashier-mobile-cartbar"
              sx={{
                position: 'fixed',
                left: 10,
                right: 10,
                bottom: 72,
                p: 1.15,
                borderRadius: 2.2,
                zIndex: 1201,
                bgcolor: 'background.paper',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {draftQtyTotal > 0 ? `${qtyFmt(draftQtyTotal)} item(s) in cart` : 'Cart is empty'}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
                    {money(draftGrandTotal)}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="contained"
                  onClick={submitCreateSale}
                  disabled={createMut.isPending || draftItems.length === 0}
                  sx={{
                    minHeight: 50,
                    borderRadius: '14px',
                    px: 2.1,
                    fontWeight: 700,
                  }}
                >
                  {createMut.isPending ? 'Saving...' : canSalesPost ? 'Checkout' : 'Save Draft'}
                </Button>
              </Stack>
            </Paper>

            <Paper
              className="cashier-mobile-panel"
              square
              variant="outlined"
              sx={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1200,
                borderBottom: 'none',
                borderRadius: '18px 18px 0 0',
              }}
            >
              <BottomNavigation
                showLabels
                value={cashierMobileView}
                onChange={(_, value) => openCashierMobilePanel(value as CashierMobileView)}
              >
                <BottomNavigationAction value="CATALOG" label="Products" icon={<Inventory2OutlinedIcon />} />
                <BottomNavigationAction
                  value="CART"
                  label={draftQtyTotal > 0 ? `Cart (${qtyFmt(draftQtyTotal)})` : 'Cart'}
                  icon={<ShoppingCartOutlinedIcon />}
                />
                <BottomNavigationAction
                  value="QUEUE"
                  label={cashierActionRows.length > 0 ? `Queue (${cashierActionRows.length})` : 'Queue'}
                  icon={<AssignmentTurnedInOutlinedIcon />}
                />
                <BottomNavigationAction value="ACTIVITY" label="Recent" icon={<HistoryOutlinedIcon />} />
              </BottomNavigation>
            </Paper>
          </>
        )}
        </>
      ) : salesQuery.isLoading ? (
        <Alert severity="info">Loading sales...</Alert>
      ) : salesQuery.isError ? (
        <Alert severity="error">Failed to load sales.</Alert>
      ) : rows.length === 0 ? (
        <EmptyStateNotice
          severity="warning"
          title="No Sales Found"
          description="Try adjusting status/payment filters, changing branch, or widening your search."
        />
      ) : isCompactAdminList ? (
        <Stack spacing={1}>
          {rows.map((row: any) => (
            <Paper
              key={row.id}
              variant="outlined"
              role="button"
              tabIndex={0}
              onClick={() => openSaleFromRow(row)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openSaleFromRow(row);
                }
              }}
              sx={{ p: 1.2, cursor: 'pointer' }}
            >
              <Stack spacing={0.7}>
                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                  <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                    {row.sale_number ?? `Sale #${row.id}`}
                  </Typography>
                  <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap">
                    <Chip size="small" color={statusChipColor(String(row.status ?? ''))} label={row.status ?? '-'} />
                    <Chip
                      size="small"
                      color={paymentChipColor(String(row.payment_status ?? ''))}
                      label={row.payment_status ?? '-'}
                    />
                  </Stack>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {row.created_at ? new Date(row.created_at).toLocaleString() : '-'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Branch: {row.branch?.name ?? row.branch_id}
                </Typography>
                <Stack direction="row" spacing={1.2} useFlexGap flexWrap="wrap">
                  <Typography variant="caption" color="text.secondary">
                    Qty: {qtyFmt(row.total_qty ?? 0)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total: {money(row.grand_total)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Paid: {money(row.paid_total)}
                  </Typography>
                </Stack>
                {String(row.void_request_status ?? '').toUpperCase() && (
                  <Stack direction="row" justifyContent="flex-end">
                    <Chip
                      size="small"
                      color={String(row.void_request_status ?? '').toUpperCase() === 'PENDING' ? 'warning' : 'default'}
                      label={`VOID ${row.void_request_status}`}
                    />
                  </Stack>
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 920 }}>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Sale #</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Payment</TableCell>
                <TableCell>Branch</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Grand Total</TableCell>
                <TableCell align="right">Paid</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row: any) => (
                <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => openSaleFromRow(row)}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{row.sale_number ?? '-'}</TableCell>
                  <TableCell>{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</TableCell>
                  <TableCell>
                    <Chip size="small" color={statusChipColor(String(row.status ?? ''))} label={row.status ?? '-'} />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap">
                      <Chip
                        size="small"
                        color={paymentChipColor(String(row.payment_status ?? ''))}
                        label={row.payment_status ?? '-'}
                      />
                      {String(row.void_request_status ?? '').toUpperCase() && (
                        <Chip
                          size="small"
                          color={String(row.void_request_status ?? '').toUpperCase() === 'PENDING' ? 'warning' : 'default'}
                          label={`VOID ${row.void_request_status}`}
                        />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>{row.branch?.name ?? row.branch_id}</TableCell>
                  <TableCell align="right">{qtyFmt(row.total_qty ?? 0)}</TableCell>
                  <TableCell align="right">{money(row.grand_total)}</TableCell>
                  <TableCell align="right">{money(row.paid_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {!isCashierRole && branchId !== '' && totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination count={totalPages} page={page} onChange={(_, next) => setPage(next)} showFirstButton showLastButton />
        </Box>
      )}

      {!isCashierRole && (
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="lg">
        <DialogTitle>{isCashierRole ? 'Cashier Checkout' : 'New Sale'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.25} sx={{ pt: 0.5 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
              <Box sx={{ flex: 1, minWidth: 260 }}>
                {canBranchView ? (
                  <BranchSelect
                    branches={branchesQuery.data ?? []}
                    value={createBranchId}
                    onChange={(id) => setCreateBranchId(id)}
                  />
                ) : (
                  <TextField
                    size="small"
                    fullWidth
                    label="Branch"
                    value={user?.branch?.name ?? '-'}
                    disabled
                  />
                )}
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flex: 1, minWidth: 280 }}>
                <TextField
                  size="small"
                  label="Scan barcode / SKU"
                  placeholder="Scan code then press Enter"
                  autoFocus={isCashierRole}
                  value={variantSearch}
                  onChange={(event) => setVariantSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    void resolveScanCode();
                  }}
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="contained"
                  onClick={() => void resolveScanCode()}
                  disabled={isScanResolving || !variantSearch.trim()}
                  sx={{ minWidth: { sm: 116 } }}
                >
                  {isScanResolving ? 'Scanning...' : 'Scan/Add'}
                </Button>
              </Stack>
            </Stack>

            {isCashierRole && (
              <Paper variant="outlined" sx={{ p: 1, bgcolor: 'rgba(25, 118, 210, 0.05)' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={0.4}>
                  <Typography variant="body2">
                    Draft lines: <b>{draftItems.length}</b> | Qty: <b>{qtyFmt(draftQtyTotal)}</b>
                  </Typography>
                  <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
                    {money(draftGrandTotal)}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Keep cursor in the scan field for rapid barcode entry.
                </Typography>
              </Paper>
            )}

            {variantSearchDebounced.length >= 2 && (
              <Paper variant="outlined" sx={{ maxHeight: 180, overflow: 'auto' }}>
                {variantLookup.isLoading ? (
                  <Alert severity="info">Searching variants...</Alert>
                ) : variantOptions.length === 0 ? (
                  <EmptyStateNotice
                    severity="warning"
                    title="No Variant Match"
                    description="Try another barcode/SKU or search using product/variant keywords."
                  />
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell>Product</TableCell>
                        <TableCell>Variant</TableCell>
                        <TableCell align="right">Default Price</TableCell>
                        <TableCell align="right">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {variantOptions.map((variant: any) => (
                        <TableRow key={variant.id} hover>
                          <TableCell>{variant.id}</TableCell>
                          <TableCell>{variant.sku ?? '-'}</TableCell>
                          <TableCell>{variant.product?.name ?? '-'}</TableCell>
                          <TableCell>{variant.variant_name ?? '-'}</TableCell>
                          <TableCell align="right">{money(variant.default_price ?? 0)}</TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              onClick={() => {
                                setPickedVariant(variant);
                                setItemPrice(String(toNum(variant.default_price)));
                              }}
                            >
                              Pick
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            )}

            <Paper variant="outlined" sx={{ p: 1 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                <TextField
                  size="small"
                  label="Picked variant"
                  value={pickedVariant ? `${pickedVariant.sku ?? '-'} | ${pickedVariant.product?.name ?? '-'}` : ''}
                  placeholder="Pick from results"
                  sx={{ minWidth: 240, flex: 1 }}
                  disabled
                />
                <TextField
                  size="small"
                  label="Qty"
                  value={itemQty}
                  onChange={(e) => setItemQty(e.target.value)}
                  onKeyDown={(event) => {
                    if (!isCashierRole || event.key !== 'Enter') return;
                    event.preventDefault();
                    addDraftItem();
                  }}
                  sx={{ width: 110 }}
                />
                <TextField
                  size="small"
                  label="Unit price"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  sx={{ width: 140 }}
                  disabled={isCashierRole}
                />
                {!isCashierRole && (
                  <TextField
                    size="small"
                    label="Discount"
                    value={itemDiscount}
                    onChange={(e) => setItemDiscount(e.target.value)}
                    sx={{ width: 120 }}
                  />
                )}
                {!isCashierRole && (
                  <TextField
                    size="small"
                    label="Tax"
                    value={itemTax}
                    onChange={(e) => setItemTax(e.target.value)}
                    sx={{ width: 120 }}
                  />
                )}
                <Button variant="contained" onClick={addDraftItem} disabled={!pickedVariant}>
                  Add Item
                </Button>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="body2">
                  Draft items: <b>{draftItems.length}</b> | Grand total: <b>{money(draftGrandTotal)}</b>
                </Typography>
                <Button size="small" onClick={() => setDraftItems([])}>
                  Clear
                </Button>
              </Stack>
              {draftItems.length === 0 ? (
                <EmptyStateNotice
                  severity="warning"
                  title="No Draft Items Yet"
                  description="Pick a variant and click Add Item to build this sale draft."
                />
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>SKU</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell>Variant</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Discount</TableCell>
                      <TableCell align="right">Tax</TableCell>
                      <TableCell align="right">Line Total</TableCell>
                      <TableCell align="right">Remove</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {draftItems.map((row) => (
                      <TableRow key={row.product_variant_id}>
                        <TableCell>{row.sku ?? '-'}</TableCell>
                        <TableCell>{row.productName ?? '-'}</TableCell>
                        <TableCell>{row.variantName ?? '-'}</TableCell>
                        <TableCell align="right">{qtyFmt(row.qty)}</TableCell>
                        <TableCell align="right">{money(row.unit_price)}</TableCell>
                        <TableCell align="right">{money(row.line_discount)}</TableCell>
                        <TableCell align="right">{money(row.line_tax)}</TableCell>
                        <TableCell align="right">{money(row.qty * row.unit_price - row.line_discount + row.line_tax)}</TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            color="error"
                            onClick={() => setDraftItems((prev) => prev.filter((x) => x.product_variant_id !== row.product_variant_id))}
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
              multiline
              minRows={2}
              label="Notes (optional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />

            {createMut.isError && <Alert severity="error">Failed to create sale.</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitCreateSale} disabled={createMut.isPending || draftItems.length === 0}>
            {isCashierRole ? (canSalesPost ? 'Create and Post Sale' : 'Create Draft Sale') : 'Create Sale'}
          </Button>
        </DialogActions>
      </Dialog>
      )}

      <Dialog
        open={confirmAction.open}
        onClose={closeConfirmAction}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{confirmAction.title || 'Confirm Action'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            <Alert
              severity={confirmAction.confirmColor === 'error' ? 'warning' : 'info'}
              sx={{ alignItems: 'flex-start' }}
            >
              {confirmAction.message}
            </Alert>
            {confirmAction.detail ? (
              <Typography variant="caption" color="text.secondary">
                {confirmAction.detail}
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirmAction} disabled={confirmActionBusy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={confirmAction.confirmColor}
            onClick={() => void submitConfirmAction()}
            disabled={confirmActionBusy || !confirmAction.onConfirm}
          >
            {confirmActionBusy ? 'Processing...' : confirmAction.confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer anchor="right" open={!!selectedId} onClose={() => setSelectedId(null)} ModalProps={{ disableScrollLock: true }}>
        <Box sx={{ width: { xs: '100vw', sm: 560 }, maxWidth: '100vw', p: { xs: 2, sm: 2.5 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Sale</Typography>
            <Button onClick={() => setSelectedId(null)}>Close</Button>
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          {saleQuery.isLoading ? (
            <Alert severity="info">Loading sale...</Alert>
          ) : saleQuery.isError ? (
            <Alert severity="error">Failed to load sale.</Alert>
          ) : !selected ? (
            <EmptyStateNotice
              severity="warning"
              title="No Sale Selected"
              description="Pick a sale from the list or cashier queue to view full checkout details."
            />
          ) : (
            <Stack spacing={1.25}>
              <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Stack spacing={0.8}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                      {selected.sale_number ?? `Sale #${selected.id}`}
                    </Typography>
                    <Stack direction="row" spacing={0.8}>
                      <Chip size="small" color={statusChipColor(selected.status)} label={selected.status} />
                      <Chip size="small" color={paymentChipColor(selected.payment_status)} label={selected.payment_status} />
                      {selected.void_request_status && (
                        <Chip
                          size="small"
                          color={selected.void_request_status === 'PENDING' ? 'warning' : selected.void_request_status === 'REJECTED' ? 'default' : 'success'}
                          label={`VOID ${selected.void_request_status}`}
                        />
                      )}
                    </Stack>
                  </Stack>
                  <Typography variant="body2">
                    <b>Branch:</b> {selected.branch?.name ?? selected.branch_id}
                  </Typography>
                  <Typography variant="body2">
                    <b>Created:</b> {selected.created_at ? new Date(selected.created_at).toLocaleString() : '-'}
                  </Typography>
                  {selected.posted_at && (
                    <Typography variant="body2">
                      <b>Posted:</b> {new Date(selected.posted_at).toLocaleString()}
                    </Typography>
                  )}
                  {selected.voided_at && (
                    <Typography variant="body2">
                      <b>Voided:</b> {new Date(selected.voided_at).toLocaleString()}
                    </Typography>
                  )}
                  {selectedVoidedByName && (
                    <Typography variant="body2">
                      <b>Voided by:</b> {selectedVoidedByName}
                    </Typography>
                  )}
                  {selectedVoidRequestStatus && (
                    <Typography variant="body2">
                      <b>Void request:</b> {selectedVoidRequestStatus}
                    </Typography>
                  )}
                  {selectedVoidRequestedByName && (
                    <Typography variant="body2">
                      <b>Requested by:</b> {selectedVoidRequestedByName}
                    </Typography>
                  )}
                  {selectedVoidRequestedAtText && (
                    <Typography variant="body2">
                      <b>Requested at:</b> {selectedVoidRequestedAtText}
                    </Typography>
                  )}
                  {selectedVoidRequestNotes && (
                    <Typography variant="body2">
                      <b>Request notes:</b> {selectedVoidRequestNotes}
                    </Typography>
                  )}
                  {selectedVoidRejectedByName && (
                    <Typography variant="body2">
                      <b>Rejected by:</b> {selectedVoidRejectedByName}
                    </Typography>
                  )}
                  {selectedVoidRejectedAtText && (
                    <Typography variant="body2">
                      <b>Rejected at:</b> {selectedVoidRejectedAtText}
                    </Typography>
                  )}
                  {selectedVoidRejectionNotes && (
                    <Typography variant="body2">
                      <b>Rejection notes:</b> {selectedVoidRejectionNotes}
                    </Typography>
                  )}
                  <Typography variant="body2">
                    <b>Subtotal:</b> {money(selected.subtotal)} | <b>Discount:</b> {money(selected.discount_total)} |{' '}
                    <b>Tax:</b> {money(selected.tax_total)}
                  </Typography>
                  <Typography variant="body2">
                    <b>Grand total:</b> {money(selected.grand_total)} | <b>Paid:</b> {money(selected.paid_total)} |{' '}
                    <b>Due:</b> {money(dueAmount)}
                  </Typography>
                  {selectedNotes && (
                    <Typography variant="body2">
                      <b>Notes:</b> {selectedNotes}
                    </Typography>
                  )}
                </Stack>
              </Paper>

              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {canLedgerView && (
                  <Tooltip title="Open stock ledger entries for this sale." arrow>
                    <Button variant="outlined" onClick={goToLedgerForSale}>
                      View Ledger
                    </Button>
                  </Tooltip>
                )}
                {canSalesPost && selected.status === 'DRAFT' && (
                  <Tooltip title="Post this checkout so stock movement and payment actions are enabled." arrow>
                    <span>
                      <Button variant="contained" onClick={runPostSale} disabled={postMut.isPending}>
                        {isCashierRole ? 'Post and Continue to Payment' : 'Post Sale'}
                      </Button>
                    </span>
                  </Tooltip>
                )}
                {canSalesVoidRequest && !canSalesVoid && (selected.status === 'DRAFT' || selected.status === 'POSTED') && !hasPendingVoidRequest && (
                  <Tooltip title="Cashier submits a void request for admin approval." arrow>
                    <span>
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={runRequestVoid}
                        disabled={requestVoidMut.isPending || postMut.isPending || paymentMut.isPending}
                      >
                        {requestVoidMut.isPending ? 'Requesting...' : 'Request Void'}
                      </Button>
                    </span>
                  </Tooltip>
                )}
                {canSalesVoid && hasPendingVoidRequest && selected.status !== 'VOIDED' && (
                  <Tooltip title="Approve request and void this sale." arrow>
                    <span>
                      <Button
                        variant="contained"
                        color="error"
                        onClick={runApproveVoidRequest}
                        disabled={approveVoidMut.isPending || rejectVoidMut.isPending || postMut.isPending || paymentMut.isPending}
                      >
                        {approveVoidMut.isPending ? 'Approving...' : 'Approve Void'}
                      </Button>
                    </span>
                  </Tooltip>
                )}
                {canSalesVoid && hasPendingVoidRequest && selected.status !== 'VOIDED' && (
                  <Tooltip title="Reject request and keep sale active." arrow>
                    <span>
                      <Button
                        variant="outlined"
                        color="inherit"
                        onClick={runRejectVoidRequest}
                        disabled={approveVoidMut.isPending || rejectVoidMut.isPending || postMut.isPending || paymentMut.isPending}
                      >
                        {rejectVoidMut.isPending ? 'Rejecting...' : 'Reject Request'}
                      </Button>
                    </span>
                  </Tooltip>
                )}
                {canSalesVoid && !hasPendingVoidRequest && (selected.status === 'DRAFT' || selected.status === 'POSTED') && (
                  <Tooltip title="Directly void this sale." arrow>
                    <span>
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={runVoidSale}
                        disabled={voidMut.isPending || postMut.isPending || paymentMut.isPending}
                      >
                        {voidMut.isPending ? 'Voiding...' : 'Void Sale'}
                      </Button>
                    </span>
                  </Tooltip>
                )}
              </Stack>

              <Divider sx={{ my: 0.4 }} />
              <Typography variant="subtitle2">Items</Typography>
              {selectedItems.length === 0 ? (
                <EmptyStateNotice
                  severity="warning"
                  title="No Items In This Sale"
                  description="This sale has no item lines yet."
                />
              ) : (
                <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 700 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>SKU</TableCell>
                        <TableCell>Product</TableCell>
                        <TableCell>Variant</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell align="right">Unit Price</TableCell>
                        <TableCell align="right">Line Total</TableCell>
                        <TableCell align="right">COGS</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.variant?.sku ?? '-'}</TableCell>
                          <TableCell>{item.variant?.product?.name ?? '-'}</TableCell>
                          <TableCell>{item.variant?.variant_name ?? '-'}</TableCell>
                          <TableCell align="right">{qtyFmt(item.qty)}</TableCell>
                          <TableCell align="right">{money(item.unit_price)}</TableCell>
                          <TableCell align="right">{money(item.line_total)}</TableCell>
                          <TableCell align="right">{money(item.line_cogs ?? 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}

              <Divider sx={{ my: 0.4 }} />
              <Typography variant="subtitle2">Payments</Typography>
              {selectedPayments.length === 0 ? (
                <EmptyStateNotice
                  severity="info"
                  title="No Payments Recorded"
                  description="Add payment entries to settle the sale amount."
                />
              ) : (
                <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 640 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell>Reference</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>By</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedPayments.map((payment: any) => (
                        <TableRow key={payment.id}>
                          <TableCell>{payment.paid_at ? new Date(payment.paid_at).toLocaleString() : '-'}</TableCell>
                          <TableCell>{payment.method ?? '-'}</TableCell>
                          <TableCell>{payment.reference_no ?? '-'}</TableCell>
                          <TableCell align="right">{money(payment.amount)}</TableCell>
                          <TableCell>{(payment.received_by ?? payment.receivedBy)?.name ?? '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}

              {hasPendingVoidRequest && selected.status === 'POSTED' && (
                <Alert severity="warning">Void request is pending approval. Payment is temporarily locked.</Alert>
              )}

              {canSalesPayment && selected.status === 'POSTED' && dueAmount > 0 && !hasPendingVoidRequest && (
                <Paper variant="outlined" sx={{ p: 1.2 }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">Record Payment</Typography>
                    {isCashierRole && (
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          Due amount: {money(dueAmount)}
                        </Typography>
                        <Tooltip title="Auto-fill exact remaining balance." arrow>
                          <Button
                            size="small"
                            onClick={() => setPaymentAmount(dueAmount > 0 ? dueAmount.toFixed(2) : '')}
                          >
                            Use Due Amount
                          </Button>
                        </Tooltip>
                      </Stack>
                    )}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField
                        select
                        size="small"
                        label="Method"
                        value={paymentMethod}
                        onChange={(event) => setPaymentMethod(event.target.value)}
                        sx={{ width: { sm: 140 } }}
                      >
                        {PAYMENT_METHODS.map((method) => (
                          <MenuItem key={method} value={method}>
                            {method}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        size="small"
                        label="Amount"
                        value={paymentAmount}
                        onChange={(event) => setPaymentAmount(event.target.value)}
                        helperText={isCashierRole ? 'Enter exact amount received.' : undefined}
                        sx={{ width: { sm: 160 } }}
                      />
                      <TextField
                        size="small"
                        label="Reference (optional)"
                        value={paymentRef}
                        onChange={(event) => setPaymentRef(event.target.value)}
                        sx={{ flex: 1 }}
                      />
                    </Stack>
                    <TextField
                      size="small"
                      label="Notes (optional)"
                      value={paymentNotes}
                      onChange={(event) => setPaymentNotes(event.target.value)}
                    />
                    <Stack direction="row" justifyContent="flex-end">
                      <Tooltip title="Record this payment against the selected checkout." arrow>
                        <span>
                          <Button variant="contained" onClick={runAddPayment} disabled={paymentMut.isPending}>
                            Add Payment
                          </Button>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Paper>
              )}
              {selected.status === 'POSTED' && dueAmount <= 0 && (
                <Alert severity="success">This sale is fully paid.</Alert>
              )}
            </Stack>
          )}
        </Box>
      </Drawer>

      {snack && (
        <Alert
          severity={snack.severity}
          onClose={() => setSnack(null)}
        >
          {snack.message}
        </Alert>
      )}
    </Stack>
  );
}

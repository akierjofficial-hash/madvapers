import {
  Alert,
  Box,
  ButtonBase,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Pagination,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import RemoveShoppingCartOutlinedIcon from '@mui/icons-material/RemoveShoppingCartOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import AutoGraphOutlinedIcon from '@mui/icons-material/AutoGraphOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import GppGoodOutlinedIcon from '@mui/icons-material/GppGoodOutlined';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import ViewInArOutlinedIcon from '@mui/icons-material/ViewInArOutlined';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { authStorage } from '../auth/authStorage';
import { useBranchesQuery, useDashboardKpiDetailsQuery, useDashboardSummaryQuery } from '../api/queries';
import type {
  DashboardAdjustmentQueueItem,
  DashboardAlert,
  DashboardKpiDetailType,
  DashboardPurchaseOrderQueueItem,
  DashboardSaleVoidRequestQueueItem,
  DashboardTransferQueueItem,
  DashboardBranchHealth,
  DashboardInventoryKpiItem,
} from '../api/dashboard';

const QUICK_ACTION_PERMISSION: Record<string, string> = {
  '/purchase-orders': 'PO_VIEW',
  '/sales': 'SALES_CREATE',
  '/expenses': 'EXPENSE_CREATE',
  '/transfers': 'TRANSFER_VIEW',
  '/adjustments': 'ADJUSTMENT_VIEW',
  '/branches': 'BRANCH_MANAGE',
  '/accounts': 'USER_VIEW',
  '/ledger': 'LEDGER_VIEW',
};

const MOBILE_ACTION_ACCENT: Record<string, { bg: string; hover: string; text: string }> = {
  '/purchase-orders': { bg: '#4338CA', hover: '#3730A3', text: '#ffffff' },
  '/sales': { bg: '#059669', hover: '#047857', text: '#ffffff' },
  '/expenses': { bg: '#B91C1C', hover: '#991B1B', text: '#ffffff' },
};

function getMobileActionAccent(path: string, label: string): { bg: string; hover: string; text: string } {
  const byPath = MOBILE_ACTION_ACCENT[path];
  if (byPath) return byPath;

  const pathLower = String(path ?? '').toLowerCase();
  const labelLower = String(label ?? '').toLowerCase();

  if (pathLower.includes('purchase') || labelLower.includes('purchase')) {
    return { bg: '#4338CA', hover: '#3730A3', text: '#ffffff' };
  }
  if (pathLower.includes('sale') || labelLower.includes('sale')) {
    return { bg: '#059669', hover: '#047857', text: '#ffffff' };
  }
  if (pathLower.includes('expense') || labelLower.includes('expense')) {
    return { bg: '#B91C1C', hover: '#991B1B', text: '#ffffff' };
  }
  return { bg: '#64748B', hover: '#475569', text: '#ffffff' };
}

const QUEUE_TABS = [
  { key: 'adjustments', label: 'Adjustments' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'purchase_orders', label: 'Purchase Orders' },
  { key: 'void_requests', label: 'Void Requests' },
] as const;

type QueueTabKey = (typeof QUEUE_TABS)[number]['key'];
type BranchHealthDetailTab = 'low' | 'out' | 'open';
type AlertDetailFilter = 'ALL' | 'NEGATIVE_STOCK' | 'OVERDUE_TRANSFERS' | 'STALE_PO_DRAFTS';

type KpiCardKey =
  | 'low-stock'
  | 'out-of-stock'
  | 'pending-adjustments'
  | 'pending-po'
  | 'pending-transfers'
  | 'inventory-value';

type PieBreakdownItem = {
  label: string;
  value: number;
  color: string;
  tooltip?: string;
};

const KPI_DETAIL_TYPE_BY_CARD: Record<KpiCardKey, DashboardKpiDetailType> = {
  'low-stock': 'low_stock',
  'out-of-stock': 'out_of_stock',
  'pending-adjustments': 'pending_adjustments',
  'pending-po': 'pending_po',
  'pending-transfers': 'pending_transfers',
  'inventory-value': 'inventory_value',
};

const PIE_COLORS = ['#0f766e', '#2ea99f', '#f59e0b', '#b45309', '#475467', '#64748b', '#7c8ea3'];
const SURFACE_BORDER = alpha('#d9e2ec', 0.92);
const SURFACE_SX = {
  border: `1px solid ${SURFACE_BORDER}`,
  borderRadius: 2,
  bgcolor: 'background.paper',
  boxShadow: '0 4px 14px rgba(16, 24, 40, 0.035)',
} as const;
const SECTION_PAPER_SX = { ...SURFACE_SX, p: { xs: 1.25, md: 1.5 } } as const;
const SECTION_PAPER_LG_SX = { ...SURFACE_SX, p: { xs: 1.4, md: 1.7 } } as const;

function toInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toLocalDateInput(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function normalizeDateInput(value: string | null, fallback: string): string {
  if (!value) return fallback;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatWordDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function money(value: number): string {
  return Number(value ?? 0).toLocaleString(undefined, {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  });
}

function formatStatus(raw?: string | null): string {
  const value = String(raw ?? '').trim();
  if (!value) return '-';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
    .join(' ');
}

function statusChipColor(
  status?: string | null
): 'default' | 'info' | 'warning' | 'success' | 'error' {
  switch (String(status ?? '').toUpperCase()) {
    case 'SUBMITTED':
    case 'REQUESTED':
      return 'info';
    case 'APPROVED':
    case 'IN_TRANSIT':
      return 'warning';
    case 'POSTED':
    case 'RECEIVED':
      return 'success';
    case 'CANCELLED':
    case 'REJECTED':
      return 'error';
    default:
      return 'default';
  }
}

function movementChipColor(
  movementType?: string | null
): 'default' | 'info' | 'warning' | 'success' {
  switch (String(movementType ?? '').toUpperCase()) {
    case 'ADJUSTMENT':
      return 'warning';
    case 'TRANSFER':
      return 'info';
    case 'PURCHASE':
      return 'success';
    default:
      return 'default';
  }
}

function riskColor(score: number): 'success' | 'warning' | 'error' {
  if (score >= 8) return 'error';
  if (score >= 4) return 'warning';
  return 'success';
}

function riskScore(item: DashboardBranchHealth): number {
  const openCount =
    Number(item.open_workflows.adjustments ?? 0) +
    Number(item.open_workflows.purchase_orders ?? 0) +
    Number(item.open_workflows.transfers ?? 0);

  return Number(item.out_of_stock_count ?? 0) * 3 + Number(item.low_stock_count ?? 0) + openCount;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  // Gauge angles are standard polar degrees:
  // 180 = left, 90 = top, 0 = right (top half spans 180 -> 0).
  const toGaugePoint = (angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(angleInRadians),
      y: cy - radius * Math.sin(angleInRadians),
    };
  };

  const start = toGaugePoint(startAngle);
  const end = toGaugePoint(endAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? '1' : '0';
  const sweepFlag = startAngle >= endAngle ? '1' : '0';

  return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, sweepFlag, end.x, end.y].join(' ');
}

function describePieSlice(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
}

export function DashboardPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, can } = useAuth();

  const canDashboardView = can('USER_VIEW');
  const canBranchView = can('BRANCH_VIEW');
  const canUseApprovalCenter =
    can('ADJUSTMENT_APPROVE') || can('TRANSFER_APPROVE') || can('PO_APPROVE') || can('SALES_VOID');

  const defaultDateTo = useMemo(() => toLocalDateInput(new Date()), []);
  const defaultDateFrom = useMemo(() => toLocalDateInput(startOfMonth(new Date())), []);

  const [branchId, setBranchId] = useState<number | ''>(() => {
    const fromUrl = toInt(searchParams.get('branch_id'));
    if (fromUrl) return fromUrl;
    const fromStorage = authStorage.getLastBranchId();
    if (fromStorage) return fromStorage;
    return user?.branch_id ?? '';
  });

  const [dateFrom, setDateFrom] = useState<string>(() =>
    normalizeDateInput(searchParams.get('date_from'), defaultDateFrom)
  );
  const [dateTo, setDateTo] = useState<string>(() =>
    normalizeDateInput(searchParams.get('date_to'), defaultDateTo)
  );
  const [queueTab, setQueueTab] = useState<QueueTabKey>('adjustments');
  const [activeKpiKey, setActiveKpiKey] = useState<KpiCardKey | null>(null);
  const [kpiDetailsPage, setKpiDetailsPage] = useState(1);
  const [kpiDetailsSearch, setKpiDetailsSearch] = useState('');
  const [kpiDetailsSearchDebounced, setKpiDetailsSearchDebounced] = useState('');
  const [activeBranchHealthId, setActiveBranchHealthId] = useState<number | null>(null);
  const [branchHealthDetailTab, setBranchHealthDetailTab] = useState<BranchHealthDetailTab>('low');
  const [activeAlertFilter, setActiveAlertFilter] = useState<AlertDetailFilter | null>(null);
  const [rangeAnchorEl, setRangeAnchorEl] = useState<HTMLElement | null>(null);
  const dateFromInputRef = useRef<HTMLInputElement | null>(null);
  const dateToInputRef = useRef<HTMLInputElement | null>(null);

  const branchesQuery = useBranchesQuery(canBranchView);

  useEffect(() => {
    if (canBranchView) return;
    const assignedBranchId = user?.branch_id ?? '';
    if (branchId !== assignedBranchId) {
      setBranchId(assignedBranchId);
    }
  }, [canBranchView, user?.branch_id, branchId]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (typeof branchId === 'number') next.set('branch_id', String(branchId));
    next.set('date_from', dateFrom);
    next.set('date_to', dateTo);

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [branchId, dateFrom, dateTo, searchParams, setSearchParams]);

  useEffect(() => {
    setActiveKpiKey(null);
  }, [branchId, dateFrom, dateTo]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setKpiDetailsSearchDebounced(kpiDetailsSearch.trim());
    }, 280);
    return () => clearTimeout(timer);
  }, [kpiDetailsSearch]);

  useEffect(() => {
    setKpiDetailsPage(1);
    setKpiDetailsSearch('');
    setKpiDetailsSearchDebounced('');
  }, [activeKpiKey]);

  const hasDateRangeError = dateFrom > dateTo;

  const summaryQuery = useDashboardSummaryQuery(
    {
      branch_id: typeof branchId === 'number' ? branchId : undefined,
      date_from: dateFrom,
      date_to: dateTo,
    },
    canDashboardView && !hasDateRangeError
  );

  const summary = summaryQuery.data;
  const queueAdjustments = summary?.approval_queue.adjustments ?? [];
  const queueTransfers = summary?.approval_queue.transfers ?? [];
  const queuePurchaseOrders = summary?.approval_queue.purchase_orders ?? [];
  const queueVoidRequests = summary?.approval_queue.void_requests ?? [];
  const alerts = summary?.alerts ?? [];
  const finance = summary?.finance ?? {
    revenue: 0,
    cash_in: 0,
    cogs: 0,
    gross_profit: 0,
    sf_charged_total: 0,
    restock_spend: 0,
    net_cashflow: 0,
    expense_total: 0,
    sf_expense_total: 0,
    operating_expense_total: 0,
    net_income: 0,
    voided_sales_count: 0,
    voided_sales_amount: 0,
    voided_paid_amount: 0,
  };
  const branchHealth = summary?.branch_health ?? [];
  const trends = summary?.trends ?? [];
  const activityFeed = summary?.activity_feed ?? [];
  const inventoryValueKpiRows = summary?.kpi_details.inventory_value ?? [];

  const activeKpiType: DashboardKpiDetailType = activeKpiKey
    ? KPI_DETAIL_TYPE_BY_CARD[activeKpiKey]
    : 'low_stock';

  const kpiDetailsQuery = useDashboardKpiDetailsQuery(
    {
      type: activeKpiType,
      branch_id: typeof branchId === 'number' ? branchId : undefined,
      date_from: dateFrom,
      date_to: dateTo,
      search: kpiDetailsSearchDebounced || undefined,
      page: kpiDetailsPage,
      per_page: 20,
    },
    Boolean(activeKpiKey) && canDashboardView && !hasDateRangeError
  );

  const activeBranchHealth = useMemo(
    () => branchHealth.find((item) => item.branch_id === activeBranchHealthId) ?? null,
    [branchHealth, activeBranchHealthId]
  );

  useEffect(() => {
    if (!activeBranchHealthId) return;
    if (branchHealth.some((item) => item.branch_id === activeBranchHealthId)) return;
    setActiveBranchHealthId(null);
  }, [activeBranchHealthId, branchHealth]);

  useEffect(() => {
    if (!activeBranchHealthId) return;
    setBranchHealthDetailTab('low');
  }, [activeBranchHealthId]);

  const branchHealthKpiType: DashboardKpiDetailType | null =
    branchHealthDetailTab === 'low'
      ? 'low_stock'
      : branchHealthDetailTab === 'out'
        ? 'out_of_stock'
        : null;

  const branchHealthInventoryQuery = useDashboardKpiDetailsQuery(
    {
      type: branchHealthKpiType ?? 'low_stock',
      branch_id: activeBranchHealthId ?? undefined,
      date_from: dateFrom,
      date_to: dateTo,
      page: 1,
      per_page: 100,
    },
    Boolean(activeBranchHealthId) &&
      branchHealthKpiType !== null &&
      canDashboardView &&
      !hasDateRangeError
  );

  const branchHealthAdjustmentsQuery = useDashboardKpiDetailsQuery(
    {
      type: 'pending_adjustments',
      branch_id: activeBranchHealthId ?? undefined,
      date_from: dateFrom,
      date_to: dateTo,
      page: 1,
      per_page: 10,
    },
    Boolean(activeBranchHealthId) &&
      branchHealthDetailTab === 'open' &&
      canDashboardView &&
      !hasDateRangeError
  );

  const branchHealthPurchaseOrdersQuery = useDashboardKpiDetailsQuery(
    {
      type: 'pending_po',
      branch_id: activeBranchHealthId ?? undefined,
      date_from: dateFrom,
      date_to: dateTo,
      page: 1,
      per_page: 10,
    },
    Boolean(activeBranchHealthId) &&
      branchHealthDetailTab === 'open' &&
      canDashboardView &&
      !hasDateRangeError
  );

  const branchHealthTransfersQuery = useDashboardKpiDetailsQuery(
    {
      type: 'pending_transfers',
      branch_id: activeBranchHealthId ?? undefined,
      date_from: dateFrom,
      date_to: dateTo,
      page: 1,
      per_page: 10,
    },
    Boolean(activeBranchHealthId) &&
      branchHealthDetailTab === 'open' &&
      canDashboardView &&
      !hasDateRangeError
  );

  const branchLabel =
    user?.branch?.name ??
    (typeof branchId === 'number' ? `Branch #${branchId}` : 'No branch assigned');
  const selectedBranchLabel = useMemo(() => {
    if (typeof branchId !== 'number') {
      return canBranchView ? 'All branches' : branchLabel;
    }
    const selectedBranch = (branchesQuery.data ?? []).find((branch) => branch.id === branchId);
    if (!selectedBranch) return branchLabel;
    return `${selectedBranch.code} - ${selectedBranch.name}`;
  }, [branchId, branchesQuery.data, branchLabel, canBranchView]);

  const filteredQuickActions = (summary?.quick_actions ?? []).filter((action) => {
    const requiredPermission = QUICK_ACTION_PERMISSION[action.path];
    return !requiredPermission || can(requiredPermission);
  });
  const mobileQuickActions = useMemo(
    () =>
      [
        canUseApprovalCenter
          ? {
              key: 'approvals',
              label: 'Approvals',
              to: '/approvals',
              bg: alpha('#3B82F6', 0.2),
              icon: <GppGoodOutlinedIcon sx={{ fontSize: 20, color: '#ffffff' }} />,
            }
          : null,
        can('PO_VIEW')
          ? {
              key: 'purchase',
              label: 'Purchase',
              to: '/purchase-orders',
              bg: alpha('#10B981', 0.22),
              icon: <LoginRoundedIcon sx={{ fontSize: 20, color: '#ffffff' }} />,
            }
          : null,
        can('SALES_CREATE')
          ? {
              key: 'sale',
              label: 'Sale',
              to: '/sales',
              bg: alpha('#F59E0B', 0.22),
              icon: <ShoppingBagOutlinedIcon sx={{ fontSize: 20, color: '#ffffff' }} />,
            }
          : null,
        can('EXPENSE_CREATE')
          ? {
              key: 'expense',
              label: 'Expense',
              to: '/expenses',
              bg: alpha('#EF4444', 0.2),
              icon: <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 20, color: '#ffffff' }} />,
            }
          : null,
      ].filter(Boolean) as Array<{
        key: string;
        label: string;
        to: string;
        bg: string;
        icon: ReactNode;
      }>,
    [can, canUseApprovalCenter]
  );

  const maxBranchRisk = useMemo(() => {
    if (branchHealth.length === 0) return 1;
    return Math.max(1, ...branchHealth.map((item) => riskScore(item)));
  }, [branchHealth]);

  const recentTrends = useMemo(() => trends.slice(-14), [trends]);

  const maxTrendQty = useMemo(() => {
    if (recentTrends.length === 0) return 1;
    return Math.max(
      1,
      ...recentTrends.map((point) => Math.max(Number(point.in_qty ?? 0), Number(point.out_qty ?? 0)))
    );
  }, [recentTrends]);

  const trendWorkflowTotals = useMemo(() => {
    return recentTrends.reduce(
      (acc, point) => {
        acc.adjustments += Number(point.adjustments ?? 0);
        acc.transfers += Number(point.transfers ?? 0);
        acc.poCreated += Number(point.po_created ?? 0);
        acc.poReceived += Number(point.po_received ?? 0);
        return acc;
      },
      { adjustments: 0, transfers: 0, poCreated: 0, poReceived: 0 }
    );
  }, [recentTrends]);

  const movementHasLedgerData = useMemo(
    () =>
      recentTrends.some(
        (point) => Number(point.in_qty ?? 0) > 0 || Number(point.out_qty ?? 0) > 0
      ),
    [recentTrends]
  );

  const movementHasWorkflowData = useMemo(
    () =>
      recentTrends.some(
        (point) =>
          Number(point.adjustments ?? 0) > 0 ||
          Number(point.transfers ?? 0) > 0 ||
          Number(point.po_created ?? 0) > 0 ||
          Number(point.po_received ?? 0) > 0
      ),
    [recentTrends]
  );

  const hasMovementSeriesData = movementHasLedgerData || movementHasWorkflowData;

  const movementSeries = useMemo(() => {
    let runningValue = 0;
    return recentTrends.map((point) => {
      const inQty = Number(point.in_qty ?? 0);
      const outQty = Number(point.out_qty ?? 0);
      const workflowCount =
        Number(point.adjustments ?? 0) +
        Number(point.transfers ?? 0) +
        Number(point.po_created ?? 0) +
        Number(point.po_received ?? 0);

      if (movementHasLedgerData) {
        runningValue += inQty - outQty;
      } else if (movementHasWorkflowData) {
        runningValue += workflowCount;
      }

      return {
        date: point.date,
        label: formatShortDate(point.date),
        value: runningValue,
        inQty,
        outQty,
        workflowCount,
      };
    });
  }, [movementHasLedgerData, movementHasWorkflowData, recentTrends]);

  const movementHeadline = useMemo(() => {
    if (movementSeries.length === 0 || !hasMovementSeriesData) {
      return { current: 0, deltaPct: 0 };
    }

    const first = movementSeries[0].value;
    const last = movementSeries[movementSeries.length - 1].value;
    const base = Math.max(Math.abs(first), 1);
    const deltaPct = ((last - first) / base) * 100;

    return { current: last, deltaPct };
  }, [hasMovementSeriesData, movementSeries]);

  const topMovingItemsData = useMemo(() => {
    const bucket = new Map<string, number>();

    for (const row of activityFeed) {
      const qty = Math.abs(Number(row.qty_delta ?? 0));
      if (!qty || Number.isNaN(qty)) continue;
      const key = row.product_name ?? row.variant_name ?? row.sku ?? `Item #${row.product_variant_id ?? row.id}`;
      bucket.set(key, (bucket.get(key) ?? 0) + qty);
    }

    const movementItems = Array.from(bucket.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value], idx) => ({
        label,
        value,
        color: PIE_COLORS[idx % PIE_COLORS.length],
        tooltip: `${label} | ${value.toLocaleString(undefined, { maximumFractionDigits: 3 })} moved`,
      }));

    if (movementItems.length > 0) {
      return { mode: 'movement' as const, items: movementItems };
    }

    const fallbackItems = inventoryValueKpiRows
      .filter((row) => Number(row.stock_value ?? 0) > 0)
      .sort((a, b) => Number(b.stock_value ?? 0) - Number(a.stock_value ?? 0))
      .slice(0, 6)
      .map((row, idx) => {
        const product = row.product_name ?? 'Product';
        const variant = row.variant_name ?? '';
        const sku = row.sku ?? '';
        const label = variant && variant.toLowerCase() !== product.toLowerCase() ? `${product} - ${variant}` : product;
        const stockValue = Number(row.stock_value ?? 0);

        return {
          label,
          value: stockValue,
          color: PIE_COLORS[idx % PIE_COLORS.length],
          tooltip: `${product}${variant ? ` | ${variant}` : ''}${sku ? ` | ${sku}` : ''} | Value ${money(stockValue)}`,
        };
      });

    if (fallbackItems.length > 0) {
      return { mode: 'inventory' as const, items: fallbackItems };
    }

    return { mode: 'none' as const, items: [] as PieBreakdownItem[] };
  }, [activityFeed, inventoryValueKpiRows]);

  const topMovingItems = topMovingItemsData.items;
  const inventorySnapshotSeries = useMemo(() => {
    return inventoryValueKpiRows
      .filter((row) => Number(row.stock_value ?? 0) > 0)
      .sort((a, b) => Number(b.stock_value ?? 0) - Number(a.stock_value ?? 0))
      .slice(0, 14)
      .map((row, idx) => {
        const rawLabel =
          row.sku ??
          row.variant_name ??
          row.product_name ??
          `Item ${idx + 1}`;
        const label = rawLabel.length > 11 ? `${rawLabel.slice(0, 11)}...` : rawLabel;

        return {
          label,
          value: Number(row.stock_value ?? 0),
          tooltip: `${row.product_name ?? row.variant_name ?? row.sku ?? `Item ${idx + 1}`} | Value ${Number(
            row.stock_value ?? 0
          ).toLocaleString(undefined, { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 })}`,
        };
      });
  }, [inventoryValueKpiRows]);

  const showInventorySnapshotChart = !hasMovementSeriesData && inventorySnapshotSeries.length > 0;
  const trackedVariantsCount = Number(summary?.kpis.tracked_variant_count ?? 0);

  const stockGaugeData = useMemo(() => {
    const critical = Number(summary?.kpis.out_of_stock_count ?? 0);
    const warning = Number(summary?.kpis.low_stock_count ?? 0);
    const base = Math.max(trackedVariantsCount, critical + warning, 1);
    const healthy = Math.max(0, base - critical - warning);

    return [
      { label: 'Out of stock', value: critical, color: '#dc2626' },
      { label: 'Low stock', value: warning, color: '#f59e0b' },
      { label: 'Healthy tracked', value: healthy, color: '#0f766e' },
    ];
  }, [summary?.kpis.low_stock_count, summary?.kpis.out_of_stock_count, trackedVariantsCount]);

  const alertCountByCode = useMemo(() => {
    const map = new Map<string, number>();
    alerts.forEach((alert) => {
      map.set(alert.code, Number(alert.count ?? 0));
    });
    return map;
  }, [alerts]);

  const actionableAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const count = Number(alert.count ?? 0);
      return alert.code !== 'NO_CRITICAL_ALERTS' && alert.severity !== 'success' && count > 0;
    });
  }, [alerts]);

  const alertDetailsTitle = useMemo(() => {
    switch (activeAlertFilter) {
      case 'NEGATIVE_STOCK':
        return 'Negative Stock Alerts';
      case 'OVERDUE_TRANSFERS':
        return 'Overdue Transfer Alerts';
      case 'STALE_PO_DRAFTS':
        return 'Stale PO Draft Alerts';
      case 'ALL':
      default:
        return 'Active Alerts';
    }
  }, [activeAlertFilter]);

  const alertDetailsRows = useMemo(() => {
    if (!activeAlertFilter) return [] as DashboardAlert[];
    if (activeAlertFilter === 'ALL') return actionableAlerts;
    return actionableAlerts.filter((alert) => alert.code === activeAlertFilter);
  }, [activeAlertFilter, actionableAlerts]);

  const queueCounts = {
    adjustments: queueAdjustments.length,
    transfers: queueTransfers.length,
    purchase_orders: queuePurchaseOrders.length,
    void_requests: queueVoidRequests.length,
  };
  const queueTotalCount =
    queueCounts.adjustments + queueCounts.transfers + queueCounts.purchase_orders + queueCounts.void_requests;

  const kpiCards: Array<{
    key: KpiCardKey;
    label: string;
    value: string;
    hint: string;
    icon: ReactNode;
    accent: string;
  }> = [
    {
      key: 'low-stock',
      label: 'Low Stock',
      value: Number(summary?.kpis.low_stock_count ?? 0).toLocaleString(),
      hint: 'Needs replenishment',
      icon: <WarningAmberRoundedIcon fontSize="small" />,
      accent: '#a16207',
    },
    {
      key: 'out-of-stock',
      label: 'Out Of Stock',
      value: Number(summary?.kpis.out_of_stock_count ?? 0).toLocaleString(),
      hint: 'Unavailable items',
      icon: <RemoveShoppingCartOutlinedIcon fontSize="small" />,
      accent: '#991b1b',
    },
    {
      key: 'pending-adjustments',
      label: 'Pending Adjustments',
      value: Number(summary?.kpis.pending_adjustments ?? 0).toLocaleString(),
      hint: 'Draft / submit / approve',
      icon: <ReceiptLongOutlinedIcon fontSize="small" />,
      accent: '#475569',
    },
    {
      key: 'pending-po',
      label: 'Pending PO Approvals',
      value: Number(summary?.kpis.pending_po_approvals ?? 0).toLocaleString(),
      hint: 'Waiting approval',
      icon: <TaskAltOutlinedIcon fontSize="small" />,
      accent: '#64748b',
    },
    {
      key: 'pending-transfers',
      label: 'Pending Transfers',
      value: Number(summary?.kpis.pending_transfers ?? 0).toLocaleString(),
      hint: 'Requested / in transit',
      icon: <SwapHorizOutlinedIcon fontSize="small" />,
      accent: '#0f766e',
    },
    {
      key: 'inventory-value',
      label: 'Inventory Value',
      value: Number(summary?.kpis.inventory_value ?? 0).toLocaleString(undefined, {
        style: 'currency',
        currency: 'PHP',
        maximumFractionDigits: 2,
      }),
      hint: 'Wholesale cost estimate',
      icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />,
      accent: '#0f766e',
    },
  ];

  const activeKpiCard = useMemo(
    () => (activeKpiKey ? kpiCards.find((card) => card.key === activeKpiKey) ?? null : null),
    [activeKpiKey, kpiCards]
  );

  const handleApplyQuickRange = (mode: '7d' | '14d' | '30d' | 'month') => {
    const today = new Date();
    let from = new Date(today);
    if (mode === '7d') from = addDays(today, -6);
    if (mode === '14d') from = addDays(today, -13);
    if (mode === '30d') from = addDays(today, -29);
    if (mode === 'month') from = startOfMonth(today);

    setDateFrom(toLocalDateInput(from));
    setDateTo(toLocalDateInput(today));
    setRangeAnchorEl(null);
  };

  const openDatePicker = (inputRef: RefObject<HTMLInputElement>) => {
    const input = inputRef.current;
    if (!input) return;
    try {
      (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      // Fallback for browsers without showPicker.
    }
    input.focus();
    input.click();
  };

  const openAdjustments = (targetBranchId?: number | null) => {
    const params = new URLSearchParams();
    params.set('status', 'SUBMITTED');
    if (targetBranchId) params.set('branch_id', String(targetBranchId));
    navigate(`/adjustments?${params.toString()}`);
  };

  const openPurchaseOrders = (targetBranchId?: number | null) => {
    const params = new URLSearchParams();
    params.set('status', 'SUBMITTED');
    if (targetBranchId) params.set('branch_id', String(targetBranchId));
    navigate(`/purchase-orders?${params.toString()}`);
  };

  const openTransfers = () => {
    const params = new URLSearchParams();
    params.set('status', 'REQUESTED');
    navigate(`/transfers?${params.toString()}`);
  };

  const openSalesVoidRequests = (saleId?: number | null, requestedAt?: string | null) => {
    if (saleId && saleId > 0) {
      authStorage.markSeenPending(user?.id, 'voidRequests', saleId);
      authStorage.markSeenPendingAt(user?.id, 'voidRequests', requestedAt);
    }

    const params = new URLSearchParams();
    params.set('void_request_status', 'PENDING');
    if (typeof branchId === 'number') params.set('branch_id', String(branchId));
    navigate(`/sales?${params.toString()}`);
  };

  const renderQueueTable = () => {
    if (queueTab === 'adjustments') {
      return (
        <QueueAdjustmentsTable
          rows={queueAdjustments}
          onOpen={openAdjustments}
        />
      );
    }

    if (queueTab === 'transfers') {
      return <QueueTransfersTable rows={queueTransfers} onOpen={openTransfers} />;
    }

    if (queueTab === 'void_requests') {
      return <QueueSaleVoidRequestsTable rows={queueVoidRequests} onOpen={openSalesVoidRequests} />;
    }

    return (
      <QueuePurchaseOrdersTable
        rows={queuePurchaseOrders}
        onOpen={openPurchaseOrders}
      />
    );
  };

  const openInventoryModule = (targetBranchId?: number | null) => {
    const params = new URLSearchParams();
    if (typeof targetBranchId === 'number') {
      params.set('branch_id', String(targetBranchId));
    } else if (typeof branchId === 'number') {
      params.set('branch_id', String(branchId));
    }
    setActiveKpiKey(null);
    setActiveBranchHealthId(null);
    navigate(`/inventory${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const openAdjustmentsFromDetails = (targetBranchId?: number | null) => {
    setActiveKpiKey(null);
    setActiveBranchHealthId(null);
    openAdjustments(targetBranchId);
  };

  const openPurchaseOrdersFromDetails = (targetBranchId?: number | null) => {
    setActiveKpiKey(null);
    setActiveBranchHealthId(null);
    openPurchaseOrders(targetBranchId);
  };

  const openTransfersFromDetails = () => {
    setActiveKpiKey(null);
    setActiveBranchHealthId(null);
    openTransfers();
  };

  const openBranchHealthDetails = (targetBranchId: number) => {
    setActiveBranchHealthId(targetBranchId);
    setBranchHealthDetailTab('low');
  };

  const renderBranchHealthDetailsContent = () => {
    if (!activeBranchHealth) {
      return <Alert severity="info">Branch details are unavailable for the selected filters.</Alert>;
    }

    if (branchHealthDetailTab === 'low' || branchHealthDetailTab === 'out') {
      const rows = (branchHealthInventoryQuery.data?.data ?? []) as DashboardInventoryKpiItem[];
      if (branchHealthInventoryQuery.isError) {
        return <Alert severity="error">Failed to load branch inventory details.</Alert>;
      }
      if (branchHealthInventoryQuery.isLoading && rows.length === 0) {
        return <Alert severity="info">Loading branch inventory details...</Alert>;
      }

      return (
        <InventoryKpiTable
          rows={rows}
          emptyMessage={
            branchHealthDetailTab === 'low'
              ? 'No low-stock items for this branch.'
              : 'No out-of-stock items for this branch.'
          }
        />
      );
    }

    const adjustmentRows = (branchHealthAdjustmentsQuery.data?.data ?? []) as DashboardAdjustmentQueueItem[];
    const purchaseOrderRows = (branchHealthPurchaseOrdersQuery.data?.data ?? []) as DashboardPurchaseOrderQueueItem[];
    const transferRows = (branchHealthTransfersQuery.data?.data ?? []) as DashboardTransferQueueItem[];

    if (
      branchHealthAdjustmentsQuery.isError ||
      branchHealthPurchaseOrdersQuery.isError ||
      branchHealthTransfersQuery.isError
    ) {
      return <Alert severity="error">Failed to load open workflow details.</Alert>;
    }

    return (
      <Stack spacing={1.2}>
        {(branchHealthAdjustmentsQuery.isFetching ||
          branchHealthPurchaseOrdersQuery.isFetching ||
          branchHealthTransfersQuery.isFetching) && (
          <LinearProgress sx={{ borderRadius: 999, height: 5 }} />
        )}

        <Paper variant="outlined" sx={{ p: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.7 }}>
            Pending Adjustments
          </Typography>
          <QueueAdjustmentsTable
            rows={adjustmentRows}
            onOpen={openAdjustmentsFromDetails}
            emptyMessage="No pending adjustments for this branch."
          />
        </Paper>

        <Paper variant="outlined" sx={{ p: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.7 }}>
            Pending Purchase Orders
          </Typography>
          <QueuePurchaseOrdersTable
            rows={purchaseOrderRows}
            onOpen={openPurchaseOrdersFromDetails}
            emptyMessage="No pending purchase orders for this branch."
          />
        </Paper>

        <Paper variant="outlined" sx={{ p: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.7 }}>
            Pending Transfers (touching this branch)
          </Typography>
          <QueueTransfersTable
            rows={transferRows}
            onOpen={openTransfersFromDetails}
            emptyMessage="No pending transfers for this branch."
          />
        </Paper>
      </Stack>
    );
  };

  const renderKpiDetailsContent = () => {
    const rows = kpiDetailsQuery.data?.data ?? [];

    if (kpiDetailsQuery.isError) {
      return <Alert severity="error">Failed to load KPI details.</Alert>;
    }

    if (kpiDetailsQuery.isLoading && rows.length === 0) {
      return <Alert severity="info">Loading details...</Alert>;
    }

    switch (activeKpiKey) {
      case 'low-stock':
        return (
          <InventoryKpiTable
            rows={rows as DashboardInventoryKpiItem[]}
            emptyMessage="No low-stock items for the selected filters."
          />
        );
      case 'out-of-stock':
        return (
          <InventoryKpiTable
            rows={rows as DashboardInventoryKpiItem[]}
            emptyMessage="No out-of-stock items for the selected filters."
          />
        );
      case 'inventory-value':
        return (
          <InventoryKpiTable
            rows={rows as DashboardInventoryKpiItem[]}
            emptyMessage="No inventory value rows found for the selected filters."
          />
        );
      case 'pending-adjustments':
        return (
          <QueueAdjustmentsTable
            rows={rows as DashboardAdjustmentQueueItem[]}
            onOpen={openAdjustmentsFromDetails}
            emptyMessage="No pending adjustments for the selected filters."
          />
        );
      case 'pending-po':
        return (
          <QueuePurchaseOrdersTable
            rows={rows as DashboardPurchaseOrderQueueItem[]}
            onOpen={openPurchaseOrdersFromDetails}
            emptyMessage="No pending purchase orders for the selected filters."
          />
        );
      case 'pending-transfers':
        return (
          <QueueTransfersTable
            rows={rows as DashboardTransferQueueItem[]}
            onOpen={openTransfersFromDetails}
            emptyMessage="No pending transfers for the selected filters."
          />
        );
      default:
        return <Alert severity="info">Select a KPI card to view details.</Alert>;
    }
  };

  if (!canDashboardView) {
    return <Alert severity="error">Not authorized to view dashboard.</Alert>;
  }

  return (
    <Stack spacing={2} className="mobile-premium-page">
      <Paper
        sx={{
          ...SURFACE_SX,
          p: { xs: 1.5, md: 2 },
          backgroundImage: 'none',
          borderColor: { xs: alpha('#2b3446', 0.95), md: SURFACE_BORDER },
          bgcolor: { xs: alpha('#1b2230', 0.92), md: 'background.paper' },
          boxShadow: { xs: '0 10px 24px rgba(4, 8, 18, 0.35)', md: '0 4px 14px rgba(16, 24, 40, 0.035)' },
        }}
      >
        <Stack spacing={1.5}>
          <Box sx={{ minWidth: 0, display: { xs: 'none', sm: 'block' } }}>
            <Typography variant="h5" sx={{ mb: 0.3 }}>
              {can('BRANCH_MANAGE') ? 'Admin Dashboard' : 'Operations Dashboard'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Operations command center for approvals, risk, and branch performance.
            </Typography>
            {!isMobile && (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={0.75}
                sx={{
                  mt: 1,
                  '& .MuiChip-root': {
                    maxWidth: '100%',
                    justifyContent: 'flex-start',
                    borderRadius: 1.25,
                    height: { xs: 30, sm: 28 },
                    '& .MuiChip-label': {
                      width: '100%',
                      px: 1.05,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    },
                  },
                }}
                useFlexGap
                flexWrap={{ xs: 'nowrap', md: 'wrap' }}
              >
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Branch: ${selectedBranchLabel}`}
                  sx={{
                    borderColor: alpha('#0f766e', 0.25),
                    bgcolor: alpha('#0f766e', 0.05),
                    maxWidth: { xs: '100%', md: 360 },
                  }}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Period: ${formatShortDate(dateFrom)} - ${formatShortDate(dateTo)}`}
                />
                <Chip
                  size="small"
                  color={queueTotalCount > 0 ? 'warning' : 'default'}
                  variant={queueTotalCount > 0 ? 'filled' : 'outlined'}
                  label={`Open Queue: ${queueTotalCount.toLocaleString()}`}
                />
              </Stack>
            )}
          </Box>

          {isMobile ? (
            <Paper
              variant="outlined"
              sx={{
                p: 1.1,
                borderRadius: 2.5,
                borderColor: alpha('#3a465e', 0.82),
                bgcolor: alpha('#242d3d', 0.92),
                boxShadow: 'none',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.85, fontSize: '0.95rem' }}>
                Quick Actions
              </Typography>
              {mobileQuickActions.length === 0 ? (
                <Alert severity="info">No quick actions available for this account.</Alert>
              ) : (
                <Stack direction="row" spacing={1} justifyContent="space-between">
                  {mobileQuickActions.map((action) => (
                    <ButtonBase
                      key={action.key}
                      onClick={() => navigate(action.to)}
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 0.55,
                        py: 0.2,
                        borderRadius: 2,
                        color: 'inherit',
                      }}
                    >
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2.2,
                          bgcolor: alpha(action.bg, 0.92),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {action.icon}
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.2 }}>
                        {action.label}
                      </Typography>
                    </ButtonBase>
                  ))}
                </Stack>
              )}
            </Paper>
          ) : (
            <Box
              sx={{
                width: { xs: '100%', lg: 'auto' },
                display: 'grid',
                gap: 1,
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: 'repeat(4, auto)',
                },
                '& .MuiButton-root': {
                  minHeight: { xs: 54, sm: 44, lg: 38 },
                  fontSize: { xs: '0.9rem', sm: '0.88rem', lg: '0.86rem' },
                  fontWeight: { xs: 700, lg: 600 },
                  px: { xs: 1.1, sm: 1.35 },
                  minWidth: 0,
                  borderRadius: { xs: 2, lg: 1.4 },
                  whiteSpace: { xs: 'normal', lg: 'nowrap' },
                  lineHeight: { xs: 1.12, lg: 1.2 },
                  textAlign: 'center',
                  justifyContent: 'center',
                },
              }}
            >
              {canUseApprovalCenter && (
                <Button size="small" variant="contained" color="warning" onClick={() => navigate('/approvals')}>
                  Open Approval Center
                </Button>
              )}
              {filteredQuickActions.slice(0, 3).map((action) => {
                const mobileAccent = getMobileActionAccent(action.path, action.label);
                return (
                  <Button
                    key={action.path}
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(action.path)}
                    sx={{
                      whiteSpace: 'nowrap',
                      bgcolor: { xs: mobileAccent?.bg ?? '#E2E8F0', lg: 'transparent' },
                      color: { xs: mobileAccent?.text ?? '#0f172a', lg: 'inherit' },
                      borderColor: { xs: alpha(mobileAccent?.bg ?? '#64748B', 0.35), lg: undefined },
                      '&:hover': {
                        bgcolor: { xs: mobileAccent?.hover ?? '#CBD5E1', lg: undefined },
                        borderColor: { xs: alpha(mobileAccent?.bg ?? '#64748B', 0.5), lg: undefined },
                      },
                    }}
                  >
                    {action.label}
                  </Button>
                );
              })}
            </Box>
          )}

          <Paper
            variant="outlined"
            sx={{
              p: { xs: 1.0, md: 1.35 },
              borderRadius: 3,
              borderColor: alpha(theme.palette.divider, isMobile ? 0.95 : 0.35),
              bgcolor: alpha('#0f766e', 0.03),
              boxShadow: 'none',
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gap: 0.9,
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: canBranchView ? '2fr 1fr 1fr auto' : '2fr 1fr auto',
                },
                alignItems: { xs: 'stretch', lg: 'center' },
              }}
            >
              {canBranchView ? (
                <FormControl
                  size="small"
                  fullWidth
                  sx={{
                    gridColumn: { xs: '1 / -1', lg: 'auto' },
                    '& .MuiInputLabel-root': isMobile
                      ? {
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          fontSize: 10,
                        }
                      : undefined,
                    '& .MuiSelect-select': isMobile
                      ? {
                          fontSize: '0.95rem',
                          py: 1.05,
                        }
                      : undefined,
                    '& .MuiOutlinedInput-root': isMobile
                      ? {
                          borderRadius: 1,
                        }
                      : undefined,
                  }}
                >
                  <InputLabel id="dashboard-branch-label">Branch</InputLabel>
                  <Select
                    labelId="dashboard-branch-label"
                    value={branchId}
                    label="Branch"
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setBranchId('');
                        authStorage.clearLastBranchId();
                        return;
                      }
                      const parsed = Number(raw);
                      if (Number.isFinite(parsed) && parsed > 0) {
                        setBranchId(parsed);
                        authStorage.setLastBranchId(parsed);
                      }
                    }}
                  >
                    <MenuItem value="">All branches</MenuItem>
                    {(branchesQuery.data ?? []).map((branch) => (
                      <MenuItem key={branch.id} value={branch.id}>
                        {branch.code} - {branch.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <TextField
                  size="small"
                  label="Branch"
                  value={branchLabel}
                  disabled
                  fullWidth
                  sx={{ gridColumn: { xs: '1 / -1', lg: 'auto' } }}
                />
              )}

              {isMobile ? (
                <>
                  <Box sx={{ position: 'relative' }}>
                    <ButtonBase
                      onClick={() => openDatePicker(dateFromInputRef)}
                      sx={{
                        width: '100%',
                        minHeight: 62,
                        px: 1,
                        py: 0.7,
                        borderRadius: 1,
                        border: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
                        bgcolor: alpha(theme.palette.background.paper, 0.98),
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                      }}
                    >
                      <Stack spacing={0.1}>
                        <Typography
                          variant="caption"
                          sx={{
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: 'text.secondary',
                            fontSize: 9.5,
                          }}
                        >
                          From
                        </Typography>
                        <Typography sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.9rem', lineHeight: 1.2 }}>
                          {formatWordDate(dateFrom)}
                        </Typography>
                      </Stack>
                    </ButtonBase>
                    <Box
                      component="input"
                      ref={dateFromInputRef}
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      sx={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                      tabIndex={-1}
                      aria-hidden
                    />
                  </Box>
                  <Box sx={{ position: 'relative' }}>
                    <ButtonBase
                      onClick={() => openDatePicker(dateToInputRef)}
                      sx={{
                        width: '100%',
                        minHeight: 62,
                        px: 1,
                        py: 0.7,
                        borderRadius: 1,
                        border: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
                        bgcolor: alpha(theme.palette.background.paper, 0.98),
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                      }}
                    >
                      <Stack spacing={0.1}>
                        <Typography
                          variant="caption"
                          sx={{
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: 'text.secondary',
                            fontSize: 9.5,
                          }}
                        >
                          To
                        </Typography>
                        <Typography sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.9rem', lineHeight: 1.2 }}>
                          {formatWordDate(dateTo)}
                        </Typography>
                      </Stack>
                    </ButtonBase>
                    <Box
                      component="input"
                      ref={dateToInputRef}
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      sx={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                      tabIndex={-1}
                      aria-hidden
                    />
                  </Box>
                </>
              ) : (
                <>
                  <TextField
                    label="Date from"
                    type="date"
                    size="small"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      '& .MuiInputLabel-root': {
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        fontSize: 11,
                      },
                    }}
                  />
                  <TextField
                    label="Date to"
                    type="date"
                    size="small"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      '& .MuiInputLabel-root': {
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        fontSize: 11,
                      },
                    }}
                  />
                </>
              )}

              <Stack
                direction="row"
                spacing={1}
                justifyContent={{ xs: 'stretch', lg: 'flex-end' }}
                sx={{
                  gridColumn: { xs: '1 / -1', lg: 'auto' },
                  width: { xs: '100%', lg: 'auto' },
                  '& .MuiButton-root': {
                    flex: { xs: '1 1 0', lg: '0 0 auto' },
                    minHeight: { xs: 34, lg: 40 },
                    fontSize: { xs: '0.86rem', lg: '0.9rem' },
                    borderRadius: { xs: 1, lg: 1.4 },
                    whiteSpace: 'nowrap',
                  },
                }}
              >
                <Button
                  size="small"
                  variant="outlined"
                  onClick={(event) => setRangeAnchorEl(event.currentTarget)}
                  sx={
                    isMobile
                      ? {
                          bgcolor: alpha(theme.palette.background.paper, 0.98),
                          borderColor: alpha(theme.palette.divider, 0.95),
                          color: 'text.primary',
                        }
                      : undefined
                  }
                >
                  Quick range
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<RefreshRoundedIcon />}
                  onClick={() => void summaryQuery.refetch()}
                  disabled={summaryQuery.isFetching}
                  sx={
                    isMobile
                      ? {
                          bgcolor: '#3f6ed7',
                          color: '#ffffff',
                          '&:hover': { bgcolor: '#345fc0' },
                        }
                      : undefined
                  }
                >
                  Refresh
                </Button>
              </Stack>
            </Box>
          </Paper>

          <Menu
            anchorEl={rangeAnchorEl}
            open={Boolean(rangeAnchorEl)}
            onClose={() => setRangeAnchorEl(null)}
          >
            <MenuItem onClick={() => handleApplyQuickRange('7d')}>Last 7 days</MenuItem>
            <MenuItem onClick={() => handleApplyQuickRange('14d')}>Last 14 days</MenuItem>
            <MenuItem onClick={() => handleApplyQuickRange('30d')}>Last 30 days</MenuItem>
            <MenuItem onClick={() => handleApplyQuickRange('month')}>This month</MenuItem>
          </Menu>
        </Stack>

        {summaryQuery.isFetching && (
          <LinearProgress sx={{ mt: 1.5, borderRadius: 999, height: 6 }} />
        )}
      </Paper>

      {hasDateRangeError && (
        <Alert severity="warning">Date range is invalid. "Date from" cannot be later than "Date to".</Alert>
      )}

      {summaryQuery.isError && (
        <Alert severity="error">Failed to load dashboard summary.</Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: '1.3fr 1.3fr 1fr 1fr' },
        }}
      >
        <Paper
          className="inventory-overview-section"
          sx={{
            ...SECTION_PAPER_SX,
            border: { xs: 'none !important', md: `1px solid ${SURFACE_BORDER}` },
            bgcolor: { xs: alpha('#1f2736', 0.96), md: 'background.paper' },
            boxShadow: { xs: 'none', md: '0 4px 14px rgba(16, 24, 40, 0.035)' },
          }}
        >
          <SectionHeader title="Inventory Overview" />
          <Box
            className="inventory-overview-grid"
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(2, 1fr)' },
            }}
          >
            <MetricTile
              label="Inventory Value"
              value={Number(summary?.kpis.inventory_value ?? 0).toLocaleString(undefined, {
                style: 'currency',
                currency: 'PHP',
                maximumFractionDigits: 2,
              })}
              accent="#3b82f6"
              icon={<AccountBalanceWalletOutlinedIcon sx={{ fontSize: 14 }} />}
              clean
              onClick={() => setActiveKpiKey('inventory-value')}
            />
            <MetricTile
              label="Missing Wholesale Cost"
              value={Number(summary?.kpis.missing_cost_count ?? 0).toLocaleString()}
              accent="#f59e0b"
              icon={<WarningAmberRoundedIcon sx={{ fontSize: 14 }} />}
              clean
            />
            <MetricTile
              label="Low Stock"
              value={Number(summary?.kpis.low_stock_count ?? 0).toLocaleString()}
              accent="#ef4444"
              icon={<TrendingDownRoundedIcon sx={{ fontSize: 14 }} />}
              clean
              onClick={() => setActiveKpiKey('low-stock')}
            />
            <MetricTile
              label="Total SKUs"
              value={trackedVariantsCount.toLocaleString()}
              accent="#10b981"
              icon={<ViewInArOutlinedIcon sx={{ fontSize: 14 }} />}
              clean
            />
          </Box>
        </Paper>

        <Paper sx={SECTION_PAPER_SX}>
          <SectionHeader
            title="Workflow Overview"
            subtitle="Approvals and pending operational tasks"
            icon={<AccessTimeOutlinedIcon sx={{ fontSize: 16 }} />}
          />
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
            <MetricTile
              label="Pending Adj."
              value={Number(summary?.kpis.pending_adjustments ?? 0).toLocaleString()}
              accent="#475569"
              hint="Draft / submit / approve"
              icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 14 }} />}
              onClick={() => setActiveKpiKey('pending-adjustments')}
            />
            <MetricTile
              label="Pending PO"
              value={Number(summary?.kpis.pending_po_approvals ?? 0).toLocaleString()}
              accent="#64748b"
              hint="Waiting approval"
              icon={<TaskAltOutlinedIcon sx={{ fontSize: 14 }} />}
              onClick={() => setActiveKpiKey('pending-po')}
            />
            <MetricTile
              label="Pending Transfers"
              value={Number(summary?.kpis.pending_transfers ?? 0).toLocaleString()}
              accent="#0f766e"
              hint="Requested / in transit"
              icon={<SwapHorizOutlinedIcon sx={{ fontSize: 14 }} />}
              onClick={() => setActiveKpiKey('pending-transfers')}
            />
            <MetricTile
              label="Void Requests"
              value={Number(summary?.kpis.pending_void_requests ?? 0).toLocaleString()}
              accent="#7f1d1d"
              hint="Waiting approval"
              icon={<WarningAmberRoundedIcon sx={{ fontSize: 14 }} />}
              onClick={() => openSalesVoidRequests()}
            />
            <MetricTile
              label="Queue Total"
              value={queueTotalCount.toLocaleString()}
              accent="#64748b"
              hint="Actionable items"
              icon={<AccessTimeOutlinedIcon sx={{ fontSize: 14 }} />}
            />
          </Box>
        </Paper>

        <Paper sx={SECTION_PAPER_SX}>
          <SectionHeader
            title="Stock Health"
            subtitle="Availability split of tracked variants"
            icon={<WarningAmberRoundedIcon sx={{ fontSize: 16 }} />}
          />
          <HalfGaugeChart
            data={stockGaugeData}
            centerLabel={trackedVariantsCount.toLocaleString()}
            subLabel="Tracked Variants"
          />
        </Paper>

        <Paper sx={SECTION_PAPER_SX}>
          <SectionHeader
            title="Risk Snapshot"
            subtitle="Current exceptions requiring attention"
            icon={<WarningAmberRoundedIcon sx={{ fontSize: 16 }} />}
          />
          <Stack spacing={1}>
            <MetricLine
              label="Active Alerts"
              value={Number(actionableAlerts.length ?? 0).toLocaleString()}
              tone="#475569"
              onClick={() => setActiveAlertFilter('ALL')}
            />
            <MetricLine
              label="Negative Stock"
              value={Number(alertCountByCode.get('NEGATIVE_STOCK') ?? 0).toLocaleString()}
              tone="#9a3412"
              onClick={() => setActiveAlertFilter('NEGATIVE_STOCK')}
            />
            <MetricLine
              label="Overdue Transfers"
              value={Number(alertCountByCode.get('OVERDUE_TRANSFERS') ?? 0).toLocaleString()}
              tone="#7f1d1d"
              onClick={() => setActiveAlertFilter('OVERDUE_TRANSFERS')}
            />
            <MetricLine
              label="Stale PO Drafts"
              value={Number(alertCountByCode.get('STALE_PO_DRAFTS') ?? 0).toLocaleString()}
              tone="#334155"
              onClick={() => setActiveAlertFilter('STALE_PO_DRAFTS')}
            />
            <MetricLine
              label="Pending Void Requests"
              value={Number(summary?.kpis.pending_void_requests ?? 0).toLocaleString()}
              tone="#7f1d1d"
              onClick={() => openSalesVoidRequests()}
            />
          </Stack>
        </Paper>
      </Box>

      <Paper sx={SECTION_PAPER_SX}>
        <SectionHeader
          title="Finance Overview"
          subtitle="Cashflow and profitability for selected period"
          icon={<AccountBalanceWalletOutlinedIcon sx={{ fontSize: 16 }} />}
        />
        <Box
          sx={{
            display: 'grid',
            gap: 1,
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)', xl: 'repeat(10, 1fr)' },
          }}
        >
          <MetricTile
            label="Cash In"
            value={money(finance.cash_in)}
            accent="#14532d"
            hint="Collected payments"
            icon={<AccountBalanceWalletOutlinedIcon sx={{ fontSize: 14 }} />}
          />
          <MetricTile
            label="Revenue"
            value={money(finance.revenue)}
            accent="#334155"
            hint="Sales amount + SF charged"
            icon={<TaskAltOutlinedIcon sx={{ fontSize: 14 }} />}
          />
          <MetricTile
            label="COGS"
            value={money(finance.cogs)}
            accent="#78716c"
            hint="Cost of sold goods"
            icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 14 }} />}
          />
          <MetricTile
            label="Gross Profit"
            value={money(finance.gross_profit)}
            accent="#0f766e"
            hint="Revenue - COGS"
            icon={<AutoGraphOutlinedIcon sx={{ fontSize: 14 }} />}
          />
          <MetricTile
            label="SF Charged"
            value={money(finance.sf_charged_total)}
            accent="#2563eb"
            hint="Shipping fee charged to customer"
            icon={<TaskAltOutlinedIcon sx={{ fontSize: 14 }} />}
          />
          <MetricTile
            label="Restock Spend"
            value={money(finance.restock_spend)}
            accent="#9a3412"
            hint="Received purchase costs"
            icon={<SwapHorizOutlinedIcon sx={{ fontSize: 14 }} />}
          />
          <MetricTile
            label="SF Expense"
            value={money(finance.sf_expense_total)}
            accent="#7f1d1d"
            hint="Shipping fee paid by shop"
            icon={<WarningAmberRoundedIcon sx={{ fontSize: 14 }} />}
          />
          <MetricTile
            label="Other Expenses"
            value={money(finance.operating_expense_total)}
            accent="#7f1d1d"
            hint="Operating expenses (excl. SF)"
            icon={<WarningAmberRoundedIcon sx={{ fontSize: 14 }} />}
          />
          <MetricTile
            label="Expense Total"
            value={money(finance.expense_total)}
            accent="#7f1d1d"
            hint="SF expense + other expenses"
            icon={<WarningAmberRoundedIcon sx={{ fontSize: 14 }} />}
          />
          <MetricTile
            label="Net Income"
            value={money(finance.net_income)}
            accent={finance.net_income >= 0 ? '#334155' : '#7f1d1d'}
            hint="Gross profit - SF expense - other expenses"
            icon={<AutoGraphOutlinedIcon sx={{ fontSize: 14 }} />}
          />
          <MetricTile
            label="Net Cashflow"
            value={money(finance.net_cashflow)}
            accent={finance.net_cashflow >= 0 ? '#0f766e' : '#7f1d1d'}
            hint="Cash in - restock spend - expenses"
            icon={<AccountBalanceWalletOutlinedIcon sx={{ fontSize: 14 }} />}
          />
        </Box>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', xl: '1.75fr 1fr' },
          alignItems: 'start',
        }}
      >
        <Paper sx={SECTION_PAPER_SX}>
          <SectionHeader
            title="Stock Movement Overview"
            subtitle={movementHasLedgerData ? 'Net inbound vs outbound quantity trend' : 'Workflow activity trend'}
            icon={<AutoGraphOutlinedIcon sx={{ fontSize: 16 }} />}
            action={
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {(hasMovementSeriesData
                    ? movementHeadline.current
                    : showInventorySnapshotChart
                      ? inventorySnapshotSeries[0]?.value ?? 0
                      : 0
                  ).toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </Typography>
                <Chip
                  size="small"
                  color={
                    hasMovementSeriesData
                      ? movementHeadline.deltaPct >= 0
                        ? 'success'
                        : 'error'
                      : showInventorySnapshotChart
                        ? 'info'
                      : 'default'
                  }
                  variant={hasMovementSeriesData ? 'filled' : 'outlined'}
                  label={
                    hasMovementSeriesData
                      ? `${movementHeadline.deltaPct >= 0 ? '+' : ''}${movementHeadline.deltaPct.toFixed(1)}%`
                      : showInventorySnapshotChart
                        ? 'Snapshot'
                        : 'No movement'
                  }
                />
              </Stack>
            }
          />

          {movementSeries.length === 0 ? (
            <Alert severity="info">No trend data available for selected period.</Alert>
          ) : showInventorySnapshotChart ? (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                No movement in this range. Showing top inventory-value snapshot instead.
              </Typography>
              <AreaTrendChart data={inventorySnapshotSeries} />
            </>
          ) : !hasMovementSeriesData ? (
            <Alert severity="info">
              No posted stock movement was found in this range. Try a wider date range or create/post inventory movements.
            </Alert>
          ) : (
            <AreaTrendChart
              data={movementSeries.map((point) => ({
                label: point.label,
                value: point.value,
                tooltip: movementHasLedgerData
                  ? `${point.date} | In ${point.inQty.toLocaleString()} / Out ${point.outQty.toLocaleString()}`
                  : `${point.date} | Workflows ${point.workflowCount.toLocaleString()}`,
              }))}
            />
          )}
        </Paper>

        <Paper sx={SECTION_PAPER_SX}>
          <SectionHeader
            title="Top Moving Items"
            subtitle={
              topMovingItemsData.mode === 'movement'
                ? 'Most active SKUs by quantity moved'
                : 'Fallback to top inventory value when movement is empty'
            }
            icon={<AutoGraphOutlinedIcon sx={{ fontSize: 16 }} />}
          />
          {topMovingItemsData.mode === 'inventory' && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              No movement records in this period. Showing top inventory-value items instead.
            </Typography>
          )}
          {topMovingItems.length === 0 ? (
            <Alert severity="info">No movement or inventory-value breakdown available.</Alert>
          ) : (
            <PieBreakdownChart data={topMovingItems} />
          )}
        </Paper>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', xl: '1.7fr 1fr' },
          alignItems: 'start',
        }}
      >
        <Paper sx={{ ...SURFACE_SX, p: 0, overflow: 'hidden' }}>
          <Box sx={{ px: 2, pt: 1.5, pb: 0.2 }}>
            <SectionHeader
              title="Approval Queue"
              subtitle="Items requiring action right now"
              icon={<AccessTimeOutlinedIcon sx={{ fontSize: 16 }} />}
            />
          </Box>

          <Tabs
            value={queueTab}
            onChange={(_, value: QueueTabKey) => setQueueTab(value)}
            variant="scrollable"
            allowScrollButtonsMobile
            sx={{ px: 1.5, minHeight: 42 }}
          >
            {QUEUE_TABS.map((tab) => (
              <Tab
                key={tab.key}
                value={tab.key}
                label={`${tab.label} (${queueCounts[tab.key]})`}
                sx={{ minHeight: 42, textTransform: 'none' }}
              />
            ))}
          </Tabs>

          <Box sx={{ px: 1.5, pb: 1.5 }}>
            {renderQueueTable()}
          </Box>
        </Paper>

        <Paper sx={SECTION_PAPER_LG_SX}>
          <SectionHeader
            title="Alerts"
            subtitle="Exceptions and compliance checks"
            icon={<WarningAmberRoundedIcon sx={{ fontSize: 16 }} />}
          />

          <Stack spacing={1}>
            {alerts.length === 0 ? (
              <Alert severity="success">No active alerts.</Alert>
            ) : (
              alerts.map((alert) => (
                <Alert
                  key={alert.code}
                  severity={alert.severity}
                  action={
                    alert.path ? (
                      <Button
                        size="small"
                        color="inherit"
                        onClick={() => navigate(alert.path!)}
                        sx={{ minWidth: 0, px: 1 }}
                      >
                        Open
                      </Button>
                    ) : undefined
                  }
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {alert.title}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
                    {alert.message}
                  </Typography>
                </Alert>
              ))
            )}
          </Stack>
        </Paper>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', xl: '1.5fr 1fr' },
          alignItems: 'start',
        }}
      >
        <Paper sx={SECTION_PAPER_LG_SX}>
          <SectionHeader
            title="Branch Health"
            subtitle="Risk, stock and workflow snapshot per branch"
            icon={<TaskAltOutlinedIcon sx={{ fontSize: 16 }} />}
          />

          {branchHealth.length === 0 ? (
            <Alert severity="info">No branch health data available for the selected filters.</Alert>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              }}
            >
              {branchHealth.map((item) => {
                const score = riskScore(item);
                const percent = Math.max(5, Math.min(100, (score / maxBranchRisk) * 100));
                const openCount =
                  Number(item.open_workflows.adjustments ?? 0) +
                  Number(item.open_workflows.purchase_orders ?? 0) +
                  Number(item.open_workflows.transfers ?? 0);

                return (
                  <Paper
                    key={item.branch_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openBranchHealthDetails(item.branch_id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openBranchHealthDetails(item.branch_id);
                      }
                    }}
                    sx={{
                      ...SURFACE_SX,
                      p: 1.4,
                      cursor: 'pointer',
                      transition: 'border-color 120ms ease, box-shadow 120ms ease',
                      '&:hover': {
                        borderColor: alpha('#0f766e', 0.35),
                        boxShadow: '0 8px 16px rgba(15,118,110,0.08)',
                      },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" noWrap>
                          {item.branch_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.branch_code}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        color={item.is_active ? 'success' : 'default'}
                        label={item.is_active ? 'ACTIVE' : 'INACTIVE'}
                      />
                    </Stack>

                    <Stack direction="row" spacing={1} sx={{ mb: 0.8, flexWrap: 'wrap' }}>
                      <Chip size="small" label={`Low ${item.low_stock_count}`} />
                      <Chip size="small" color="error" label={`Out ${item.out_of_stock_count}`} />
                      <Chip size="small" color="info" label={`Open ${openCount}`} />
                    </Stack>

                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
                      <Typography variant="caption" color="text.secondary">
                        Risk index
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {score}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={percent}
                      color={riskColor(score)}
                      sx={{ height: 7, borderRadius: 999, mb: 0.9 }}
                    />

                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Stock value:{' '}
                      {Number(item.stock_value ?? 0).toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'PHP',
                        maximumFractionDigits: 2,
                      })}
                    </Typography>

                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Recent movements: {Number(item.recent_movements ?? 0).toLocaleString()}
                    </Typography>

                    {item.top_moving_item && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Top mover: {item.top_moving_item.product_name ?? item.top_moving_item.sku ?? 'Item'} (
                        {Number(item.top_moving_item.moved_qty ?? 0).toLocaleString()})
                      </Typography>
                    )}

                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Click for low / out / open details
                    </Typography>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Paper>

        <Paper sx={SECTION_PAPER_LG_SX}>
          <SectionHeader
            title="14-Day Trend"
            subtitle="Inbound and outbound daily movement"
            icon={<AutoGraphOutlinedIcon sx={{ fontSize: 16 }} />}
          />

          {recentTrends.length === 0 ? (
            <Alert severity="info">No trend data for selected period.</Alert>
          ) : (
            <>
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="flex-end"
                sx={{
                  overflowX: 'auto',
                  pb: 1,
                  minHeight: 166,
                }}
              >
                {recentTrends.map((point) => {
                  const inQty = Number(point.in_qty ?? 0);
                  const outQty = Number(point.out_qty ?? 0);
                  const inHeight = Math.max(4, Math.round((inQty / maxTrendQty) * 96));
                  const outHeight = Math.max(4, Math.round((outQty / maxTrendQty) * 96));
                  return (
                    <Tooltip
                      key={point.date}
                      title={`In: ${inQty.toLocaleString()} / Out: ${outQty.toLocaleString()} on ${point.date}`}
                    >
                      <Box sx={{ minWidth: 24, textAlign: 'center' }}>
                        <Stack direction="row" spacing={0.4} alignItems="flex-end" justifyContent="center">
                          <Box
                            sx={{
                              width: 8,
                              height: inHeight,
                              borderRadius: 0.8,
                              bgcolor: 'primary.main',
                            }}
                          />
                          <Box
                            sx={{
                              width: 8,
                              height: outHeight,
                              borderRadius: 0.8,
                              bgcolor: 'secondary.main',
                            }}
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {formatShortDate(point.date)}
                        </Typography>
                      </Box>
                    </Tooltip>
                  );
                })}
              </Stack>

              <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                <Chip size="small" label={`Adj ${trendWorkflowTotals.adjustments}`} />
                <Chip size="small" label={`Transfers ${trendWorkflowTotals.transfers}`} />
                <Chip size="small" label={`PO Created ${trendWorkflowTotals.poCreated}`} />
                <Chip size="small" label={`PO Received ${trendWorkflowTotals.poReceived}`} />
              </Stack>
            </>
          )}
        </Paper>
      </Box>

      <Paper sx={SECTION_PAPER_LG_SX}>
        <SectionHeader
          title="Recent Activity"
          subtitle="Latest posted stock movements"
          icon={<AccessTimeOutlinedIcon sx={{ fontSize: 16 }} />}
          action={
            <Button variant="outlined" size="small" onClick={() => navigate('/ledger')}>
              Open Ledger
            </Button>
          }
        />

        {activityFeed.length === 0 ? (
          <Alert severity="info">No stock movement activity in this period.</Alert>
        ) : (
          <TableContainer
            sx={{
              maxHeight: { xs: 300, md: 360 },
              border: `1px solid ${SURFACE_BORDER}`,
              borderRadius: 2,
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Movement</TableCell>
                  <TableCell>Branch</TableCell>
                  <TableCell>Item</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell>Ref</TableCell>
                  <TableCell>By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activityFeed.map((row) => {
                  const qtyDelta = Number(row.qty_delta ?? 0);
                  return (
                    <TableRow key={row.id} hover>
                      <TableCell>{formatDateTime(row.posted_at)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={movementChipColor(row.movement_type)}
                          label={formatStatus(row.movement_type)}
                        />
                      </TableCell>
                      <TableCell>{row.branch_name ?? row.branch_id}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.product_name ?? '-'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.variant_name ?? row.sku ?? '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ color: qtyDelta < 0 ? 'error.main' : 'success.main' }}>
                        {qtyDelta > 0 ? '+' : ''}
                        {qtyDelta.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                      </TableCell>
                      <TableCell>
                        {row.ref_type && row.ref_id ? `${row.ref_type} #${row.ref_id}` : '-'}
                      </TableCell>
                      <TableCell>{row.performed_by ?? '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={Boolean(activeBranchHealth)} onClose={() => setActiveBranchHealthId(null)} fullWidth maxWidth="lg">
        <DialogTitle>{activeBranchHealth ? `${activeBranchHealth.branch_name} Details` : 'Branch Details'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            {activeBranchHealth && (
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                <Chip size="small" label={`Low ${activeBranchHealth.low_stock_count}`} />
                <Chip size="small" color="error" label={`Out ${activeBranchHealth.out_of_stock_count}`} />
                <Chip
                  size="small"
                  color="info"
                  label={`Open ${
                    Number(activeBranchHealth.open_workflows.adjustments ?? 0) +
                    Number(activeBranchHealth.open_workflows.purchase_orders ?? 0) +
                    Number(activeBranchHealth.open_workflows.transfers ?? 0)
                  }`}
                />
                <Chip
                  size="small"
                  color={activeBranchHealth.is_active ? 'success' : 'default'}
                  label={activeBranchHealth.is_active ? 'ACTIVE' : 'INACTIVE'}
                />
              </Stack>
            )}

            <Tabs
              value={branchHealthDetailTab}
              onChange={(_, value: BranchHealthDetailTab) => setBranchHealthDetailTab(value)}
              variant="scrollable"
              allowScrollButtonsMobile
              sx={{ minHeight: 42 }}
            >
              <Tab
                value="low"
                label={`Low (${
                  Number(activeBranchHealth?.low_stock_count ?? 0).toLocaleString()
                })`}
                sx={{ minHeight: 42, textTransform: 'none' }}
              />
              <Tab
                value="out"
                label={`Out (${
                  Number(activeBranchHealth?.out_of_stock_count ?? 0).toLocaleString()
                })`}
                sx={{ minHeight: 42, textTransform: 'none' }}
              />
              <Tab
                value="open"
                label={`Open (${
                  (
                    Number(activeBranchHealth?.open_workflows.adjustments ?? 0) +
                    Number(activeBranchHealth?.open_workflows.purchase_orders ?? 0) +
                    Number(activeBranchHealth?.open_workflows.transfers ?? 0)
                  ).toLocaleString()
                })`}
                sx={{ minHeight: 42, textTransform: 'none' }}
              />
            </Tabs>

            {renderBranchHealthDetailsContent()}
          </Stack>
        </DialogContent>
        <DialogActions>
          {(branchHealthDetailTab === 'low' || branchHealthDetailTab === 'out') && (
            <Button
              variant="outlined"
              onClick={() => openInventoryModule(activeBranchHealth?.branch_id ?? null)}
            >
              Open Branch Inventory
            </Button>
          )}
          <Button onClick={() => setActiveBranchHealthId(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(activeKpiKey)} onClose={() => setActiveKpiKey(null)} fullWidth maxWidth="lg">
        <DialogTitle>{activeKpiCard?.label ?? 'KPI'} Details</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
            >
              <TextField
                size="small"
                label="Search details"
                placeholder="SKU, product, branch, status, reference..."
                value={kpiDetailsSearch}
                onChange={(event) => {
                  setKpiDetailsSearch(event.target.value);
                  setKpiDetailsPage(1);
                }}
                sx={{ minWidth: { md: 320 } }}
              />
              <Chip
                size="small"
                label={`${Number(kpiDetailsQuery.data?.total ?? 0).toLocaleString()} row(s)`}
                sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}
              />
            </Stack>

            {kpiDetailsQuery.isFetching && <LinearProgress sx={{ borderRadius: 999, height: 5 }} />}

            {renderKpiDetailsContent()}

            {(kpiDetailsQuery.data?.last_page ?? 1) > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Pagination
                  count={kpiDetailsQuery.data?.last_page ?? 1}
                  page={kpiDetailsPage}
                  onChange={(_, value) => setKpiDetailsPage(value)}
                  showFirstButton
                  showLastButton
                />
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          {(activeKpiKey === 'low-stock' ||
            activeKpiKey === 'out-of-stock' ||
            activeKpiKey === 'inventory-value') && (
            <Button variant="outlined" onClick={() => openInventoryModule()}>
              Open Inventory
            </Button>
          )}
          <Button onClick={() => setActiveKpiKey(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(activeAlertFilter)} onClose={() => setActiveAlertFilter(null)} fullWidth maxWidth="sm">
        <DialogTitle>{alertDetailsTitle}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            {alertDetailsRows.length === 0 ? (
              <Alert severity="info">No alerts found for this category.</Alert>
            ) : (
              alertDetailsRows.map((alert) => (
                <Alert
                  key={`${alert.code}-${alert.title}`}
                  severity={alert.severity}
                  action={
                    alert.path ? (
                      <Button
                        size="small"
                        color="inherit"
                        onClick={() => {
                          setActiveAlertFilter(null);
                          navigate(alert.path!);
                        }}
                        sx={{ minWidth: 0, px: 1 }}
                      >
                        Open
                      </Button>
                    ) : undefined
                  }
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {alert.title}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
                    {alert.message}
                  </Typography>
                </Alert>
              ))
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActiveAlertFilter(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function SectionHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={0.8}
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      justifyContent="space-between"
      sx={{ mb: 1.1 }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        {icon && (
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: 1,
              bgcolor: isMobile ? alpha('#3a465e', 0.55) : alpha('#0f766e', 0.08),
              color: isMobile ? '#d3def4' : 'primary.main',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        )}
        <Box>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 700, lineHeight: 1.2, fontSize: isMobile ? '0.95rem' : undefined }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
      {action}
    </Stack>
  );
}

function MetricTile({
  label,
  value,
  accent,
  hint,
  icon,
  onClick,
  clean,
}: {
  label: string;
  value: string;
  accent: string;
  hint?: string;
  icon?: ReactNode;
  onClick?: () => void;
  clean?: boolean;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  if (clean) {
    return (
      <Paper
        className={isMobile ? 'inventory-overview-tile' : undefined}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : -1}
        onClick={onClick}
        onKeyDown={(event) => {
          if (!onClick) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
          }
        }}
        sx={{
          p: 1.05,
          border: isMobile ? 'none !important' : `1px solid ${SURFACE_BORDER}`,
          borderRadius: isMobile ? 2.4 : 1.5,
          minHeight: isMobile ? 110 : 100,
          bgcolor: isMobile ? alpha('#242d3d', 0.96) : 'background.paper',
          cursor: onClick ? 'pointer' : 'default',
          transition: 'transform 120ms ease, box-shadow 120ms ease',
          '&:hover': onClick
            ? {
                transform: 'translateY(-1px)',
                boxShadow: isMobile
                  ? '0 10px 18px rgba(2, 8, 20, 0.32)'
                  : `0 0 0 1px ${alpha(accent, 0.12)}, 0 6px 16px rgba(16,24,40,0.06)`,
              }
            : undefined,
        }}
      >
        <Stack spacing={0.7} sx={{ height: '100%' }}>
          {icon && (
            <Box
              sx={{
                width: 22,
                height: 22,
                borderRadius: 0.9,
                bgcolor: alpha(accent, isMobile ? 0.2 : 0.11),
                color: accent,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="h5" sx={{ mt: 0.05, fontWeight: 700, lineHeight: 1.08, color: 'text.primary' }}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.2, fontSize: isMobile ? '0.86rem' : undefined }}>
            {label}
          </Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : -1}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      sx={{
        p: 1.25,
        border: `1px solid ${isMobile ? alpha('#3a465e', 0.82) : SURFACE_BORDER}`,
        borderLeft: isMobile ? `1px solid ${alpha('#3a465e', 0.82)}` : `3px solid ${alpha(accent, 0.45)}`,
        borderRadius: 1.5,
        minHeight: 100,
        bgcolor: isMobile ? alpha('#242d3d', 0.94) : 'background.paper',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        '&:hover': onClick
          ? {
              borderColor: isMobile ? alpha('#4a5a77', 0.9) : alpha(accent, 0.55),
              boxShadow: isMobile
                ? '0 8px 18px rgba(2, 8, 20, 0.35)'
                : `0 0 0 1px ${alpha(accent, 0.12)}, 0 6px 16px rgba(16,24,40,0.06)`,
            }
          : undefined,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={0.75}>
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
          {label}
        </Typography>
        {icon && (
          <Box
            sx={{
              width: 22,
              height: 22,
              borderRadius: 0.8,
              bgcolor: isMobile ? alpha('#3a465e', 0.55) : alpha(accent, 0.11),
              color: isMobile ? '#d3def4' : accent,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        )}
      </Stack>
      <Typography variant="h6" sx={{ mt: 0.4, fontWeight: 700, lineHeight: 1.25, color: 'text.primary' }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.15 }}>
          {hint}
        </Typography>
      )}
    </Paper>
  );
}

function MetricLine({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  tone: string;
  onClick?: () => void;
}) {
  const clickable = typeof onClick === 'function';
  return (
    <Box
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!clickable) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
      sx={{
        border: `1px solid ${SURFACE_BORDER}`,
        borderRadius: 1.2,
        px: 1,
        py: 0.75,
        borderLeft: `2px solid ${alpha(tone, 0.4)}`,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'all 0.18s ease',
        '&:hover': clickable
          ? {
              borderColor: alpha(tone, 0.48),
              bgcolor: alpha(tone, 0.05),
            }
          : undefined,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
      </Stack>
    </Box>
  );
}

function HalfGaugeChart({
  data,
  centerLabel,
  subLabel,
}: {
  data: Array<{ label: string; value: number; color: string }>;
  centerLabel: string;
  subLabel: string;
}) {
  const total = Math.max(
    1,
    data.reduce((sum, item) => sum + Math.max(0, Number(item.value ?? 0)), 0)
  );

  let currentAngle = 180;
  const arcs = data.map((item) => {
    const share = (Math.max(0, Number(item.value ?? 0)) / total) * 180;
    const start = currentAngle;
    const end = currentAngle - share;
    currentAngle = end;

    return {
      ...item,
      d: describeArc(110, 110, 78, start, end),
    };
  });

  return (
    <Stack spacing={1}>
      <Box sx={{ display: 'grid', placeItems: 'center' }}>
        <Box component="svg" viewBox="0 0 220 140" sx={{ width: '100%', maxWidth: 260 }}>
          <path d={describeArc(110, 110, 78, 180, 0)} stroke="#dbe5ef" strokeWidth={18} fill="none" />
          {arcs.map((arc) => (
            <path key={arc.label} d={arc.d} stroke={arc.color} strokeWidth={18} fill="none" />
          ))}
          <text x="110" y="100" textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f172a">
            {centerLabel}
          </text>
          <text x="110" y="118" textAnchor="middle" fontSize="10" fill="#64748b">
            {subLabel}
          </text>
        </Box>
      </Box>
      <Stack spacing={0.6}>
        {data.map((item) => (
          <Stack key={item.label} direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={0.6} alignItems="center">
              <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: item.color }} />
              <Typography variant="caption" color="text.secondary">
                {item.label}
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {Number(item.value ?? 0).toLocaleString()}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

function AreaTrendChart({
  data,
}: {
  data: Array<{ label: string; value: number; tooltip: string }>;
}) {
  if (data.length === 0) {
    return null;
  }

  const width = 760;
  const height = 290;
  const padX = 34;
  const padTop = 16;
  const padBottom = 38;
  const chartW = width - padX * 2;
  const chartH = height - padTop - padBottom;

  const values = data.map((point) => Number(point.value ?? 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = data.map((point, idx) => {
    const x = padX + (idx / Math.max(1, data.length - 1)) * chartW;
    const y = padTop + ((max - Number(point.value ?? 0)) / range) * chartH;
    return { ...point, x, y };
  });

  const linePath = points
    .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padBottom} L ${points[0].x} ${
    height - padBottom
  } Z`;

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <Box component="svg" viewBox={`0 0 ${width} ${height}`} sx={{ width: '100%', minWidth: 560 }}>
        <defs>
          <linearGradient id="movementAreaFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0f766e" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = padTop + chartH * step;
          return <line key={step} x1={padX} x2={width - padX} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />;
        })}

        {points.map((point, idx) => (
          <line
            key={point.label + idx}
            x1={point.x}
            x2={point.x}
            y1={padTop}
            y2={height - padBottom}
            stroke={idx % 3 === 0 ? '#eef2f7' : 'transparent'}
            strokeWidth={1}
          />
        ))}

        <path d={areaPath} fill="url(#movementAreaFill)" />
        <path d={linePath} fill="none" stroke="#0f766e" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />

        {points.map((point, idx) => (
          <g key={`point-${idx}`}>
            <circle cx={point.x} cy={point.y} r={2.8} fill="#0b4d48" />
            <title>{point.tooltip}</title>
          </g>
        ))}

        {points.map((point, idx) =>
          idx % Math.ceil(points.length / 7) === 0 || idx === points.length - 1 ? (
            <text key={`label-${idx}`} x={point.x} y={height - 14} textAnchor="middle" fontSize="10" fill="#64748b">
              {point.label}
            </text>
          ) : null
        )}
      </Box>
    </Box>
  );
}

function PieBreakdownChart({
  data,
}: {
  data: PieBreakdownItem[];
}) {
  const [hoveredSliceIndex, setHoveredSliceIndex] = useState<number | null>(null);
  const total = Math.max(
    1,
    data.reduce((sum, item) => sum + Math.max(0, Number(item.value ?? 0)), 0)
  );

  let angle = -90;
  const slices = data.map((item) => {
    const sweep = (Math.max(0, Number(item.value ?? 0)) / total) * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    return {
      ...item,
      path: describePieSlice(110, 110, 88, start, end),
      pct: (Math.max(0, Number(item.value ?? 0)) / total) * 100,
    };
  });
  const activeSlice = hoveredSliceIndex !== null ? slices[hoveredSliceIndex] ?? null : null;

  return (
    <Stack spacing={1}>
      <Box sx={{ display: 'grid', placeItems: 'center' }}>
        <Box component="svg" viewBox="0 0 220 220" sx={{ width: '100%', maxWidth: 250 }}>
          {slices.map((slice, idx) => (
            <g key={`${slice.label}-${idx}`}>
              <path
                d={slice.path}
                fill={slice.color}
                stroke="#ffffff"
                strokeWidth={2}
                style={{
                  cursor: 'pointer',
                  opacity: hoveredSliceIndex === null || hoveredSliceIndex === idx ? 1 : 0.5,
                  transition: 'opacity 120ms ease',
                }}
                tabIndex={0}
                onMouseEnter={() => setHoveredSliceIndex(idx)}
                onMouseLeave={() => setHoveredSliceIndex((current) => (current === idx ? null : current))}
                onFocus={() => setHoveredSliceIndex(idx)}
                onBlur={() => setHoveredSliceIndex((current) => (current === idx ? null : current))}
              />
              <title>{slice.tooltip ?? `${slice.label} | ${slice.pct.toFixed(1)}%`}</title>
            </g>
          ))}
        </Box>
      </Box>
      <Box
        sx={{
          px: 1,
          py: 0.75,
          borderRadius: 1.2,
          border: `1px dashed ${alpha('#0f766e', 0.35)}`,
          bgcolor: alpha('#0f766e', 0.04),
          minHeight: 34,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          {activeSlice
            ? activeSlice.tooltip ?? `${activeSlice.label} | ${activeSlice.pct.toFixed(1)}%`
            : 'Hover a pie slice to view product details.'}
        </Typography>
      </Box>

      <Stack spacing={0.6}>
        {slices.map((slice, idx) => (
          <Stack key={`${slice.label}-legend-${idx}`} direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={0.6} alignItems="center" sx={{ minWidth: 0 }}>
              <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: slice.color, flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary" noWrap>
                {slice.label}
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {slice.pct.toFixed(0)}%
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

function QueueAdjustmentsTable({
  rows,
  onOpen,
  emptyMessage = 'No submitted adjustments waiting for approval.',
}: {
  rows: DashboardAdjustmentQueueItem[];
  onOpen: (branchId?: number | null) => void;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <Alert severity="success">{emptyMessage}</Alert>;
  }

  return (
    <TableContainer sx={{ maxHeight: 320, borderRadius: 2, border: `1px solid ${SURFACE_BORDER}` }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Created</TableCell>
            <TableCell>Branch</TableCell>
            <TableCell>Ref</TableCell>
            <TableCell align="right">Qty</TableCell>
            <TableCell>By</TableCell>
            <TableCell align="right" width={96}>
              Action
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} hover>
              <TableCell>{row.id}</TableCell>
              <TableCell>{formatDateTime(row.created_at)}</TableCell>
              <TableCell>{row.branch_name ?? row.branch_id}</TableCell>
              <TableCell>{row.reference_no?.trim() || `ADJ-${row.id}`}</TableCell>
              <TableCell align="right">
                {Number(row.total_qty_delta ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}
              </TableCell>
              <TableCell>{row.created_by ?? '-'}</TableCell>
              <TableCell align="right">
                <Button size="small" onClick={() => onOpen(row.branch_id)}>
                  Open
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function QueueTransfersTable({
  rows,
  onOpen,
  emptyMessage = 'No transfer requests waiting for approval.',
}: {
  rows: DashboardTransferQueueItem[];
  onOpen: () => void;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <Alert severity="success">{emptyMessage}</Alert>;
  }

  return (
    <TableContainer sx={{ maxHeight: 320, borderRadius: 2, border: `1px solid ${SURFACE_BORDER}` }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Created</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Route</TableCell>
            <TableCell align="right">Qty</TableCell>
            <TableCell>By</TableCell>
            <TableCell align="right" width={96}>
              Action
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} hover>
              <TableCell>{row.id}</TableCell>
              <TableCell>{formatDateTime(row.created_at)}</TableCell>
              <TableCell>
                <Chip size="small" color={statusChipColor(row.status)} label={formatStatus(row.status)} />
              </TableCell>
              <TableCell>
                {(row.from_branch_name ?? row.from_branch_id) + ' -> ' + (row.to_branch_name ?? row.to_branch_id)}
              </TableCell>
              <TableCell align="right">
                {Number(row.total_qty ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}
              </TableCell>
              <TableCell>{row.created_by ?? '-'}</TableCell>
              <TableCell align="right">
                <Button size="small" onClick={onOpen}>
                  Open
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function QueuePurchaseOrdersTable({
  rows,
  onOpen,
  emptyMessage = 'No purchase orders waiting for approval.',
}: {
  rows: DashboardPurchaseOrderQueueItem[];
  onOpen: (branchId?: number | null) => void;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <Alert severity="success">{emptyMessage}</Alert>;
  }

  return (
    <TableContainer sx={{ maxHeight: 320, borderRadius: 2, border: `1px solid ${SURFACE_BORDER}` }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Created</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Supplier</TableCell>
            <TableCell>Branch</TableCell>
            <TableCell align="right">Qty</TableCell>
            <TableCell align="right" width={96}>
              Action
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} hover>
              <TableCell>{row.id}</TableCell>
              <TableCell>{formatDateTime(row.created_at)}</TableCell>
              <TableCell>
                <Chip size="small" color={statusChipColor(row.status)} label={formatStatus(row.status)} />
              </TableCell>
              <TableCell>{row.supplier_name ?? '-'}</TableCell>
              <TableCell>{row.branch_name ?? row.branch_id}</TableCell>
              <TableCell align="right">
                {Number(row.total_qty_ordered ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}
              </TableCell>
              <TableCell align="right">
                <Button size="small" onClick={() => onOpen(row.branch_id)}>
                  Open
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function QueueSaleVoidRequestsTable({
  rows,
  onOpen,
  emptyMessage = 'No sale void requests waiting for approval.',
}: {
  rows: DashboardSaleVoidRequestQueueItem[];
  onOpen: (saleId?: number | null, requestedAt?: string | null) => void;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <Alert severity="success">{emptyMessage}</Alert>;
  }

  return (
    <TableContainer sx={{ maxHeight: 320, borderRadius: 2, border: `1px solid ${SURFACE_BORDER}` }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Sale</TableCell>
            <TableCell>Requested</TableCell>
            <TableCell>Branch</TableCell>
            <TableCell>By</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Grand Total</TableCell>
            <TableCell align="right" width={96}>
              Action
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} hover>
              <TableCell sx={{ fontFamily: 'monospace' }}>{row.sale_number?.trim() || `Sale #${row.id}`}</TableCell>
              <TableCell>{formatDateTime(row.void_requested_at)}</TableCell>
              <TableCell>{row.branch_name ?? row.branch_id}</TableCell>
              <TableCell>{row.requested_by ?? row.cashier_name ?? '-'}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  color={String(row.void_request_status ?? '').toUpperCase() === 'PENDING' ? 'warning' : 'default'}
                  label={`${formatStatus(row.void_request_status)} / ${formatStatus(row.payment_status)}`}
                />
              </TableCell>
              <TableCell align="right">{money(Number(row.grand_total ?? 0))}</TableCell>
              <TableCell align="right">
                <Button size="small" onClick={() => onOpen(row.id, row.void_requested_at ?? null)}>
                  Open
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function InventoryKpiTable({
  rows,
  emptyMessage,
}: {
  rows: DashboardInventoryKpiItem[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <Alert severity="info">{emptyMessage}</Alert>;
  }

  return (
    <TableContainer sx={{ maxHeight: 420, borderRadius: 2, border: `1px solid ${SURFACE_BORDER}` }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Branch</TableCell>
            <TableCell>SKU</TableCell>
            <TableCell>Product</TableCell>
            <TableCell>Variant</TableCell>
            <TableCell align="right">Qty</TableCell>
            <TableCell align="right">Wholesale Cost</TableCell>
            <TableCell align="right">Stock Value</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.inventory_balance_id} hover>
              <TableCell>{row.branch_name ?? row.branch_code ?? row.branch_id}</TableCell>
              <TableCell>{row.sku ?? '-'}</TableCell>
              <TableCell>{row.product_name ?? '-'}</TableCell>
              <TableCell>{row.variant_name ?? '-'}</TableCell>
              <TableCell align="right">
                {Number(row.qty_on_hand ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}
              </TableCell>
              <TableCell align="right">
                {Number(row.default_cost ?? 0).toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'PHP',
                  maximumFractionDigits: 2,
                })}
              </TableCell>
              <TableCell align="right">
                {Number(row.stock_value ?? 0).toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'PHP',
                  maximumFractionDigits: 2,
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}


import {
  Alert,
  Box,
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
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import RemoveShoppingCartOutlinedIcon from '@mui/icons-material/RemoveShoppingCartOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import AutoGraphOutlinedIcon from '@mui/icons-material/AutoGraphOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { authStorage } from '../auth/authStorage';
import { useBranchesQuery, useDashboardKpiDetailsQuery, useDashboardSummaryQuery } from '../api/queries';
import type {
  DashboardAdjustmentQueueItem,
  DashboardKpiDetailType,
  DashboardPurchaseOrderQueueItem,
  DashboardTransferQueueItem,
  DashboardBranchHealth,
  DashboardInventoryKpiItem,
} from '../api/dashboard';

const QUICK_ACTION_PERMISSION: Record<string, string> = {
  '/purchase-orders': 'PO_VIEW',
  '/transfers': 'TRANSFER_VIEW',
  '/adjustments': 'ADJUSTMENT_VIEW',
  '/branches': 'BRANCH_MANAGE',
  '/accounts': 'USER_VIEW',
  '/ledger': 'LEDGER_VIEW',
};

const QUEUE_TABS = [
  { key: 'adjustments', label: 'Adjustments' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'purchase_orders', label: 'Purchase Orders' },
] as const;

type QueueTabKey = (typeof QUEUE_TABS)[number]['key'];
type BranchHealthDetailTab = 'low' | 'out' | 'open';

type KpiCardKey =
  | 'low-stock'
  | 'out-of-stock'
  | 'pending-adjustments'
  | 'pending-po'
  | 'pending-transfers'
  | 'inventory-value';

const KPI_DETAIL_TYPE_BY_CARD: Record<KpiCardKey, DashboardKpiDetailType> = {
  'low-stock': 'low_stock',
  'out-of-stock': 'out_of_stock',
  'pending-adjustments': 'pending_adjustments',
  'pending-po': 'pending_po',
  'pending-transfers': 'pending_transfers',
  'inventory-value': 'inventory_value',
};

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

export function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, can } = useAuth();

  const canDashboardView = can('USER_VIEW');
  const canBranchView = can('BRANCH_VIEW');

  const defaultDateTo = useMemo(() => toLocalDateInput(new Date()), []);
  const defaultDateFrom = useMemo(() => toLocalDateInput(addDays(new Date(), -13)), []);

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
  const [rangeAnchorEl, setRangeAnchorEl] = useState<HTMLElement | null>(null);

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
  const alerts = summary?.alerts ?? [];
  const branchHealth = summary?.branch_health ?? [];
  const trends = summary?.trends ?? [];
  const activityFeed = summary?.activity_feed ?? [];

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

  const filteredQuickActions = (summary?.quick_actions ?? []).filter((action) => {
    const requiredPermission = QUICK_ACTION_PERMISSION[action.path];
    return !requiredPermission || can(requiredPermission);
  });

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

  const queueCounts = {
    adjustments: queueAdjustments.length,
    transfers: queueTransfers.length,
    purchase_orders: queuePurchaseOrders.length,
  };

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
      accent: '#f59e0b',
    },
    {
      key: 'out-of-stock',
      label: 'Out Of Stock',
      value: Number(summary?.kpis.out_of_stock_count ?? 0).toLocaleString(),
      hint: 'Unavailable items',
      icon: <RemoveShoppingCartOutlinedIcon fontSize="small" />,
      accent: '#ef4444',
    },
    {
      key: 'pending-adjustments',
      label: 'Pending Adjustments',
      value: Number(summary?.kpis.pending_adjustments ?? 0).toLocaleString(),
      hint: 'Draft / submit / approve',
      icon: <ReceiptLongOutlinedIcon fontSize="small" />,
      accent: '#0f766e',
    },
    {
      key: 'pending-po',
      label: 'Pending PO Approvals',
      value: Number(summary?.kpis.pending_po_approvals ?? 0).toLocaleString(),
      hint: 'Waiting approval',
      icon: <TaskAltOutlinedIcon fontSize="small" />,
      accent: '#0891b2',
    },
    {
      key: 'pending-transfers',
      label: 'Pending Transfers',
      value: Number(summary?.kpis.pending_transfers ?? 0).toLocaleString(),
      hint: 'Requested / in transit',
      icon: <SwapHorizOutlinedIcon fontSize="small" />,
      accent: '#7c3aed',
    },
    {
      key: 'inventory-value',
      label: 'Inventory Value',
      value: Number(summary?.kpis.inventory_value ?? 0).toLocaleString(undefined, {
        style: 'currency',
        currency: 'PHP',
        maximumFractionDigits: 2,
      }),
      hint: 'Cost-based estimate',
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
    if (mode === 'month') from = new Date(today.getFullYear(), today.getMonth(), 1);

    setDateFrom(toLocalDateInput(from));
    setDateTo(toLocalDateInput(today));
    setRangeAnchorEl(null);
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
    <Stack spacing={2}>
      <Paper
        sx={{
          p: { xs: 1.5, md: 2 },
          borderColor: alpha('#0f766e', 0.2),
          backgroundImage:
            'linear-gradient(135deg, rgba(15,118,110,0.09) 0%, rgba(255,255,255,0.95) 44%, rgba(245,158,11,0.08) 100%)',
        }}
      >
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={1.5}
          >
            <Box>
              <Typography variant="h5" sx={{ mb: 0.3 }}>
                {can('BRANCH_MANAGE') ? 'Admin Dashboard' : 'Operations Dashboard'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Operations command center for approvals, risk, and branch performance.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {filteredQuickActions.slice(0, 3).map((action) => (
                <Button
                  key={action.path}
                  size="small"
                  variant="outlined"
                  onClick={() => navigate(action.path)}
                  sx={{ bgcolor: alpha('#ffffff', 0.8) }}
                >
                  {action.label}
                </Button>
              ))}
            </Stack>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gap: 1.25,
              gridTemplateColumns: {
                xs: '1fr',
                sm: '1.4fr 1fr',
                lg: canBranchView ? '2fr 1fr 1fr auto' : '2fr 1fr auto',
              },
              alignItems: 'center',
            }}
          >
            {canBranchView ? (
              <FormControl size="small" fullWidth>
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
              <TextField size="small" label="Branch" value={branchLabel} disabled fullWidth />
            )}

            <TextField
              label="Date from"
              type="date"
              size="small"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Date to"
              type="date"
              size="small"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}>
              <Button
                size="small"
                variant="outlined"
                onClick={(event) => setRangeAnchorEl(event.currentTarget)}
              >
                Quick range
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<RefreshRoundedIcon />}
                onClick={() => void summaryQuery.refetch()}
                disabled={summaryQuery.isFetching}
              >
                Refresh
              </Button>
            </Stack>
          </Box>

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
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' },
        }}
      >
        {kpiCards.map((card) => (
          <Paper
            key={card.key}
            role="button"
            tabIndex={0}
            onClick={() => setActiveKpiKey(card.key)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setActiveKpiKey(card.key);
              }
            }}
            sx={{
              p: 1.6,
              borderColor: alpha(card.accent, 0.28),
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'transform 140ms ease, box-shadow 140ms ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 6,
              },
              ...(activeKpiKey === card.key
                ? {
                    boxShadow: 7,
                    borderColor: alpha(card.accent, 0.6),
                  }
                : {}),
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                backgroundColor: alpha(card.accent, 0.95),
              },
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
              <Typography variant="body2" color="text.secondary">
                {card.label}
              </Typography>
              <Box
                sx={{
                  color: card.accent,
                  width: 30,
                  height: 30,
                  borderRadius: 1.5,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha(card.accent, 0.12),
                  border: `1px solid ${alpha(card.accent, 0.22)}`,
                }}
              >
                {card.icon}
              </Box>
            </Stack>

            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.15 }}>
              {card.value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {card.hint}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
              Click for details
            </Typography>
          </Paper>
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', xl: '1.7fr 1fr' },
          alignItems: 'start',
        }}
      >
        <Paper sx={{ p: 0, overflow: 'hidden' }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={0.5}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            sx={{ px: 2, pt: 1.5, pb: 0.5 }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <AccessTimeOutlinedIcon fontSize="small" color="primary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Approval Queue
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Items that need action now
            </Typography>
          </Stack>

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

        <Paper sx={{ p: 1.6 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <WarningAmberRoundedIcon fontSize="small" color="warning" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Alerts
            </Typography>
          </Stack>

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
        <Paper sx={{ p: 1.6 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Branch Health
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Risk and workflow snapshot
            </Typography>
          </Stack>

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
                      p: 1.4,
                      borderColor: alpha('#0f766e', 0.2),
                      bgcolor: alpha('#ffffff', 0.92),
                      cursor: 'pointer',
                      transition: 'transform 120ms ease, box-shadow 120ms ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: 4,
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

        <Paper sx={{ p: 1.6 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <AutoGraphOutlinedIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              14-Day Trend
            </Typography>
          </Stack>

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

      <Paper sx={{ p: 1.6 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Recent Activity
          </Typography>
          <Button variant="outlined" size="small" onClick={() => navigate('/ledger')}>
            Open Ledger
          </Button>
        </Stack>

        {activityFeed.length === 0 ? (
          <Alert severity="info">No stock movement activity in this period.</Alert>
        ) : (
          <TableContainer
            sx={{
              maxHeight: { xs: 300, md: 360 },
              border: `1px solid ${alpha('#d9e2ec', 0.85)}`,
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
    <TableContainer sx={{ maxHeight: 320, borderRadius: 2, border: `1px solid ${alpha('#d9e2ec', 0.85)}` }}>
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
    <TableContainer sx={{ maxHeight: 320, borderRadius: 2, border: `1px solid ${alpha('#d9e2ec', 0.85)}` }}>
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
    <TableContainer sx={{ maxHeight: 320, borderRadius: 2, border: `1px solid ${alpha('#d9e2ec', 0.85)}` }}>
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
    <TableContainer sx={{ maxHeight: 420, borderRadius: 2, border: `1px solid ${alpha('#d9e2ec', 0.85)}` }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Branch</TableCell>
            <TableCell>SKU</TableCell>
            <TableCell>Product</TableCell>
            <TableCell>Variant</TableCell>
            <TableCell align="right">Qty</TableCell>
            <TableCell align="right">Unit Cost</TableCell>
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

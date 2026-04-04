import { api } from '../lib/http';
import type { LaravelPaginator } from '../types/api';

export type DashboardSummaryQuery = {
  branch_id?: number;
  date_from?: string;
  date_to?: string;
};

export type DashboardApprovalQueueQuery = {
  branch_id?: number;
};

export type DashboardKpiDetailType =
  | 'low_stock'
  | 'out_of_stock'
  | 'inventory_value'
  | 'missing_cost'
  | 'pending_adjustments'
  | 'pending_po'
  | 'pending_transfers';

export type DashboardKpiDetailsQuery = DashboardSummaryQuery & {
  type: DashboardKpiDetailType;
  search?: string;
  page?: number;
  per_page?: number;
};

export type DashboardKpis = {
  low_stock_count: number;
  out_of_stock_count: number;
  pending_adjustments: number;
  pending_po_approvals: number;
  pending_transfers: number;
  pending_void_requests: number;
  inventory_value: number;
  missing_cost_count: number;
  tracked_variant_count: number;
};

export type DashboardInventoryKpiItem = {
  inventory_balance_id: number;
  branch_id: number;
  branch_code?: string | null;
  branch_name?: string | null;
  product_variant_id: number;
  sku?: string | null;
  product_name?: string | null;
  variant_name?: string | null;
  brand_name?: string | null;
  qty_on_hand: number;
  default_cost: number;
  stock_value: number;
};

export type DashboardAlert = {
  severity: 'success' | 'info' | 'warning' | 'error';
  code: string;
  title: string;
  message: string;
  count: number;
  path?: string | null;
};

export type DashboardAdjustmentQueueItem = {
  id: number;
  status: string;
  branch_id: number;
  branch_name?: string | null;
  reason_code?: string | null;
  reference_no?: string | null;
  items_count: number;
  total_qty_delta: number;
  created_at?: string | null;
  created_by?: string | null;
};

export type DashboardTransferQueueItem = {
  id: number;
  status: string;
  from_branch_id: number;
  to_branch_id: number;
  from_branch_name?: string | null;
  to_branch_name?: string | null;
  created_at: string;
  created_by?: string | null;
  items_count: number;
  total_qty: number;
};

export type DashboardPurchaseOrderQueueItem = {
  id: number;
  status: string;
  branch_id: number;
  branch_name?: string | null;
  supplier_name?: string | null;
  created_at: string;
  created_by?: string | null;
  items_count: number;
  total_qty_ordered: number;
};

export type DashboardSaleVoidRequestQueueItem = {
  id: number;
  sale_number?: string | null;
  status: string;
  void_request_status: string;
  payment_status: string;
  branch_id: number;
  branch_name?: string | null;
  void_requested_at?: string | null;
  requested_by?: string | null;
  cashier_name?: string | null;
  grand_total: number;
  paid_total: number;
  void_request_notes?: string | null;
};

export type DashboardStaffAttendanceQueueItem = {
  id: number;
  user_id: number;
  branch_id?: number | null;
  branch_name?: string | null;
  staff_name?: string | null;
  staff_email?: string | null;
  clock_in_requested_at?: string | null;
  scheduled_start_at?: string | null;
  late_minutes?: number | null;
  request_notes?: string | null;
};

export type DashboardBranchHealth = {
  branch_id: number;
  branch_code: string;
  branch_name: string;
  is_active: boolean;
  low_stock_count: number;
  out_of_stock_count: number;
  stock_value: number;
  open_workflows: {
    adjustments: number;
    purchase_orders: number;
    transfers: number;
  };
  recent_movements: number;
  top_moving_item?: {
    product_variant_id: number;
    sku?: string | null;
    product_name?: string | null;
    variant_name?: string | null;
    moved_qty: number;
  } | null;
};

export type DashboardActivityItem = {
  id: number;
  posted_at?: string | null;
  movement_type: string;
  reason_code?: string | null;
  qty_delta: number;
  branch_id: number;
  branch_name?: string | null;
  product_variant_id: number;
  sku?: string | null;
  product_name?: string | null;
  variant_name?: string | null;
  ref_type?: string | null;
  ref_id?: number | null;
  performed_by?: string | null;
  notes?: string | null;
};

export type DashboardTrendPoint = {
  date: string;
  in_qty: number;
  out_qty: number;
  adjustments: number;
  transfers: number;
  po_created: number;
  po_received: number;
};

export type DashboardFinance = {
  revenue: number;
  cash_in: number;
  cogs: number;
  gross_profit: number;
  sf_charged_total: number;
  restock_spend: number;
  net_cashflow: number;
  expense_total: number;
  sf_expense_total: number;
  operating_expense_total: number;
  net_income: number;
  voided_sales_count: number;
  voided_sales_amount: number;
  voided_paid_amount: number;
};

export type DashboardTopSellingProduct = {
  product_variant_id: number;
  sku?: string | null;
  product_name?: string | null;
  variant_name?: string | null;
  qty_sold: number;
  sales_amount: number;
  cogs: number;
  gross_profit: number;
  sales_count: number;
};

export type DashboardVoidedSalesBranch = {
  branch_id: number;
  branch_code?: string | null;
  branch_name?: string | null;
  voided_sales_count: number;
  voided_sales_amount: number;
  voided_paid_amount: number;
};

export type DashboardSummaryResponse = {
  filters: {
    branch_id?: number | null;
    date_from: string;
    date_to: string;
    applied_branch_ids?: number[] | null;
  };
  kpis: DashboardKpis;
  kpi_details: {
    low_stock: DashboardInventoryKpiItem[];
    out_of_stock: DashboardInventoryKpiItem[];
    inventory_value: DashboardInventoryKpiItem[];
    missing_cost: DashboardInventoryKpiItem[];
  };
  finance: DashboardFinance;
  voided_sales_by_branch: DashboardVoidedSalesBranch[];
  top_selling_products: DashboardTopSellingProduct[];
  approval_queue: {
    adjustments: DashboardAdjustmentQueueItem[];
    transfers: DashboardTransferQueueItem[];
    purchase_orders: DashboardPurchaseOrderQueueItem[];
    void_requests: DashboardSaleVoidRequestQueueItem[];
    staff_attendance_requests?: DashboardStaffAttendanceQueueItem[];
  };
  alerts: DashboardAlert[];
  branch_health: DashboardBranchHealth[];
  activity_feed: DashboardActivityItem[];
  trends: DashboardTrendPoint[];
  quick_actions: Array<{ label: string; path: string }>;
};

export type DashboardApprovalQueueResponse = {
  filters: {
    branch_id?: number | null;
    applied_branch_ids?: number[] | null;
  };
  counts: {
    adjustments: number;
    transfers: number;
    purchase_orders: number;
    void_requests: number;
    staff_attendance_requests?: number;
    total: number;
  };
  approval_queue: DashboardSummaryResponse['approval_queue'];
  generated_at: string;
};

export type DashboardKpiDetailRow =
  | DashboardInventoryKpiItem
  | DashboardAdjustmentQueueItem
  | DashboardTransferQueueItem
  | DashboardPurchaseOrderQueueItem;

export async function getDashboardSummary(params: DashboardSummaryQuery) {
  const res = await api.get<DashboardSummaryResponse>('/dashboard/summary', { params });
  return res.data;
}

export async function getDashboardApprovalQueue(params: DashboardApprovalQueueQuery) {
  const res = await api.get<DashboardApprovalQueueResponse>('/dashboard/approval-queue', { params });
  return res.data;
}

export async function getDashboardKpiDetails(
  params: DashboardKpiDetailsQuery
): Promise<LaravelPaginator<DashboardKpiDetailRow>> {
  const res = await api.get<LaravelPaginator<DashboardKpiDetailRow>>('/dashboard/kpi-details', { params });
  return res.data;
}

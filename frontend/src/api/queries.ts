import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { LaravelPaginator } from '../types/api';
import type {
  Branch,
  Brand,
  InventoryBalance,
  Product,
  ProductVariant,
  StockLedger,
  User,
  UserRole,
} from '../types/models';

import {
  getBranches,
  createBranch,
  updateBranch,
  type BranchesQuery,
  type BranchInput,
  type BranchUpdateInput,
} from './branches';
import {
  getBrands,
  createBrand,
  type CatalogQuery,
  type CreateBrandInput,
} from './catalog';
import { getInventory, type InventoryQuery } from './inventory';
import { getLedger, type LedgerQuery } from './ledger';
import { login, logout, me, type LoginInput, type LoginResponse, type MeResponse } from './auth';
import {
  getRoles,
  getUsers,
  createUser,
  updateUser,
  setUserPassword,
  disableUser,
  enableUser,
  type UsersQuery,
  type CreateUserInput,
  type UpdateUserInput,
} from './accounts';

// Suppliers (CRUD)
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  type Supplier,
  type SupplierInput,
} from './suppliers';

// Transfers
import {
  getTransfers,
  getTransfer,
  createTransfer,
  requestTransfer,
  approveTransfer,
  dispatchTransfer,
  receiveTransfer,
  cancelTransfer,
  type TransfersQuery,
  type Transfer,
  type CreateTransferInput,
} from './transfers';

// Purchase Orders
import {
  getPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
  receivePurchaseOrder,
  type PurchaseOrdersQuery,
  type PurchaseOrder,
  type CreatePurchaseOrderInput,
  type ReceivePurchaseOrderPayload,
} from './purchaseOrders';

// Products + Variants
import {
  getProducts,
  createProduct,
  updateProduct,
  disableProduct,
  enableProduct,
  purgeProduct,
  type ProductsQuery,
  type CreateProductInput,
  type UpdateProductInput,
} from './products';
import {
  getVariants,
  createVariant,
  updateVariant,
  disableVariant,
  enableVariant,
  purgeVariant,
  type VariantsQuery,
  type CreateVariantInput,
  type UpdateVariantInput,
} from './variants';

// Adjustments
import {
  getAdjustments,
  getAdjustment,
  createAdjustment,
  submitAdjustment,
  approveAdjustment,
  postAdjustment,
  quickPostAdjustment,
  type AdjustmentsQuery,
  type StockAdjustment,
  type CreateAdjustmentInput,
} from './adjustments';
import {
  getDashboardSummary,
  getDashboardKpiDetails,
  type DashboardKpiDetailRow,
  type DashboardKpiDetailsQuery,
  type DashboardSummaryQuery,
  type DashboardSummaryResponse,
} from './dashboard';

function parsePollMs(value: string | undefined, fallbackMs: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallbackMs;
  return Math.floor(n);
}

const REALTIME_POLLING_ENABLED = String(import.meta.env.VITE_REALTIME_POLLING ?? 'true').toLowerCase() !== 'false';

const POLL_MS = {
  inventory: parsePollMs(import.meta.env.VITE_REALTIME_INVENTORY_MS, 5000),
  ledger: parsePollMs(import.meta.env.VITE_REALTIME_LEDGER_MS, 5000),
  adjustments: parsePollMs(import.meta.env.VITE_REALTIME_ADJUSTMENTS_MS, 5000),
  transfers: parsePollMs(import.meta.env.VITE_REALTIME_TRANSFERS_MS, 6000),
  purchaseOrders: parsePollMs(import.meta.env.VITE_REALTIME_PURCHASE_ORDERS_MS, 6000),
} as const;

function realtimeInterval(enabled: boolean, ms: number): number | false {
  if (!enabled || !REALTIME_POLLING_ENABLED) return false;
  return ms;
}

export const qk = {
  me: ['me'] as const,
  dashboardSummary: (params: DashboardSummaryQuery) => ['dashboardSummary', params] as const,
  dashboardKpiDetails: (params: DashboardKpiDetailsQuery) => ['dashboardKpiDetails', params] as const,
  branches: ['branches'] as const,
  brands: (params: CatalogQuery) => ['brands', params] as const,
  roles: ['roles'] as const,
  users: (params: UsersQuery) => ['users', params] as const,
  suppliers: ['suppliers'] as const,

  inventory: (params: InventoryQuery) => ['inventory', params] as const,
  ledger: (params: LedgerQuery) => ['ledger', params] as const,

  transfers: (params: TransfersQuery) => ['transfers', params] as const,
  transfer: (id: number) => ['transfer', id] as const,

  purchaseOrders: (params: PurchaseOrdersQuery) => ['purchaseOrders', params] as const,
  purchaseOrder: (id: number) => ['purchaseOrder', id] as const,

  products: (params: ProductsQuery) => ['products', params] as const,
  variants: (params: VariantsQuery) => ['variants', params] as const,

  adjustments: (params: AdjustmentsQuery) => ['adjustments', params] as const,
  adjustment: (id: number) => ['adjustment', id] as const,
};

/* =========================
   AUTH
   ========================= */

export function useMeQuery(enabled?: boolean) {
  return useQuery<MeResponse>({
    queryKey: qk.me,
    queryFn: me,
    enabled: enabled ?? true,
    staleTime: 60_000,
  });
}

export function useDashboardSummaryQuery(params: DashboardSummaryQuery, enabled = true) {
  return useQuery<DashboardSummaryResponse>({
    queryKey: qk.dashboardSummary(params),
    queryFn: () => getDashboardSummary(params),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: realtimeInterval(enabled, 10_000),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useDashboardKpiDetailsQuery(params: DashboardKpiDetailsQuery, enabled = true) {
  return useQuery<LaravelPaginator<DashboardKpiDetailRow>>({
    queryKey: qk.dashboardKpiDetails(params),
    queryFn: () => getDashboardKpiDetails(params),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });
}

export function useLoginMutation() {
  const qc = useQueryClient();
  return useMutation<LoginResponse, unknown, LoginInput>({
    mutationFn: login,
    onSuccess: (data) => {
      const meData: MeResponse = {
        user: data.user as User,
        permissions: data.permissions ?? [],
      };

      qc.setQueryData(qk.me, meData);
    },
  });
}

export function useLogoutMutation() {
  const qc = useQueryClient();
  return useMutation<{ status: string }, unknown, void>({
    mutationFn: logout as any,
    onSettled: () => {
      qc.clear();
    },
  });
}

/* =========================
   BRANCHES
   ========================= */

export function useBranchesQuery(enabled = true) {
  const params: BranchesQuery = {};
  return useQuery<Branch[]>({
    queryKey: [...qk.branches, params],
    queryFn: () => getBranches(params),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useBranchesQueryWithParams(params: BranchesQuery = {}, enabled = true) {
  return useQuery<Branch[]>({
    queryKey: [...qk.branches, params],
    queryFn: () => getBranches(params),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useCreateBranchMutation() {
  const qc = useQueryClient();
  return useMutation<Branch, unknown, BranchInput>({
    mutationFn: createBranch,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}

export function useUpdateBranchMutation() {
  const qc = useQueryClient();
  return useMutation<Branch, unknown, { id: number; input: BranchUpdateInput }>({
    mutationFn: ({ id, input }) => updateBranch(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}

export function useBrandsQuery(params: CatalogQuery = {}, enabled = true) {
  return useQuery<LaravelPaginator<Brand>>({
    queryKey: qk.brands(params),
    queryFn: () => getBrands(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useCreateBrandMutation() {
  const qc = useQueryClient();
  return useMutation<Brand, unknown, CreateBrandInput>({
    mutationFn: createBrand,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brands'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

/* =========================
   ROLES / USERS (ACCOUNTS)
   ========================= */

export function useRolesQuery(enabled = true) {
  return useQuery<UserRole[]>({
    queryKey: qk.roles,
    queryFn: getRoles,
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useUsersQuery(params: UsersQuery, enabled = true) {
  return useQuery<LaravelPaginator<User>>({
    queryKey: qk.users(params),
    queryFn: () => getUsers(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

function invalidateUsers(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['users'] });
  qc.invalidateQueries({ queryKey: ['me'] });
}

export function useCreateUserMutation() {
  const qc = useQueryClient();
  return useMutation<User, unknown, CreateUserInput>({
    mutationFn: createUser,
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useUpdateUserMutation() {
  const qc = useQueryClient();
  return useMutation<User, unknown, { id: number; input: UpdateUserInput }>({
    mutationFn: ({ id, input }) => updateUser(id, input),
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useSetUserPasswordMutation() {
  const qc = useQueryClient();
  return useMutation<{ status: string }, unknown, { id: number; password: string }>({
    mutationFn: ({ id, password }) => setUserPassword(id, password),
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useDisableUserMutation() {
  const qc = useQueryClient();
  return useMutation<{ status: string }, unknown, number>({
    mutationFn: (id) => disableUser(id),
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useEnableUserMutation() {
  const qc = useQueryClient();
  return useMutation<{ status: string }, unknown, number>({
    mutationFn: (id) => enableUser(id),
    onSuccess: () => invalidateUsers(qc),
  });
}

/* =========================
   SUPPLIERS (CRUD)
   ========================= */

export function useSuppliersQuery(enabled = true) {
  return useQuery<Supplier[]>({
    queryKey: qk.suppliers,
    queryFn: getSuppliers,
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useCreateSupplierMutation() {
  const qc = useQueryClient();
  return useMutation<Supplier, unknown, SupplierInput>({
    mutationFn: createSupplier,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.suppliers }),
  });
}

export function useUpdateSupplierMutation() {
  const qc = useQueryClient();
  return useMutation<Supplier, unknown, { id: number; input: SupplierInput }>({
    mutationFn: ({ id, input }) => updateSupplier(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.suppliers }),
  });
}

export function useDeleteSupplierMutation() {
  const qc = useQueryClient();
  return useMutation<{ status: string }, unknown, number>({
    mutationFn: deleteSupplier,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.suppliers }),
  });
}

/* =========================
   INVENTORY / LEDGER
   ========================= */

export function useInventoryQuery(params: InventoryQuery, enabled = true) {
  return useQuery<LaravelPaginator<InventoryBalance>>({
    queryKey: qk.inventory(params),
    queryFn: () => getInventory(params),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: realtimeInterval(enabled, POLL_MS.inventory),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useLedgerQuery(params: LedgerQuery, enabled = true) {
  return useQuery<LaravelPaginator<StockLedger>>({
    queryKey: qk.ledger(params),
    queryFn: () => getLedger(params),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: realtimeInterval(enabled, POLL_MS.ledger),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

/* =========================
   TRANSFERS
   ========================= */

export function useTransfersQuery(params: TransfersQuery, enabled = true) {
  return useQuery<LaravelPaginator<Transfer>>({
    queryKey: qk.transfers(params),
    queryFn: () => getTransfers(params),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: realtimeInterval(enabled, POLL_MS.transfers),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useTransferQuery(id: number, enabled = true) {
  return useQuery<Transfer>({
    queryKey: qk.transfer(id),
    queryFn: () => getTransfer(id),
    enabled,
    refetchInterval: realtimeInterval(enabled, POLL_MS.transfers),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

function invalidateTransfers(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['transfers'] });
  qc.invalidateQueries({ queryKey: ['transfer'] });
  qc.invalidateQueries({ queryKey: ['ledger'] });
  qc.invalidateQueries({ queryKey: ['inventory'] });
}

export function useCreateTransferMutation() {
  const qc = useQueryClient();
  return useMutation<Transfer, unknown, CreateTransferInput>({
    mutationFn: (input) => createTransfer(input),
    onSuccess: () => invalidateTransfers(qc),
  });
}

export function useRequestTransferMutation() {
  const qc = useQueryClient();
  return useMutation<Transfer, unknown, number>({
    mutationFn: (id) => requestTransfer(id),
    onSuccess: () => invalidateTransfers(qc),
  });
}

export function useApproveTransferMutation() {
  const qc = useQueryClient();
  return useMutation<Transfer, unknown, number>({
    mutationFn: (id) => approveTransfer(id),
    onSuccess: () => invalidateTransfers(qc),
  });
}

export function useDispatchTransferMutation() {
  const qc = useQueryClient();
  return useMutation<Transfer, unknown, number>({
    mutationFn: (id) => dispatchTransfer(id),
    onSuccess: () => invalidateTransfers(qc),
  });
}

export function useReceiveTransferMutation() {
  const qc = useQueryClient();
  return useMutation<Transfer, unknown, number>({
    mutationFn: (id) => receiveTransfer(id),
    onSuccess: () => invalidateTransfers(qc),
  });
}

export function useCancelTransferMutation() {
  const qc = useQueryClient();
  return useMutation<Transfer, unknown, number>({
    mutationFn: (id) => cancelTransfer(id),
    onSuccess: () => invalidateTransfers(qc),
  });
}

/* =========================
   PURCHASE ORDERS
   ========================= */

export function usePurchaseOrdersQuery(params: PurchaseOrdersQuery, enabled = true) {
  return useQuery<LaravelPaginator<PurchaseOrder>>({
    queryKey: qk.purchaseOrders(params),
    queryFn: () => getPurchaseOrders(params),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: realtimeInterval(enabled, POLL_MS.purchaseOrders),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function usePurchaseOrderQuery(id: number, enabled = true) {
  return useQuery<PurchaseOrder>({
    queryKey: qk.purchaseOrder(id),
    queryFn: () => getPurchaseOrder(id),
    enabled,
    refetchInterval: realtimeInterval(enabled, POLL_MS.purchaseOrders),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

function invalidatePurchaseOrders(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['purchaseOrders'] });
  qc.invalidateQueries({ queryKey: ['purchaseOrder'] });
  qc.invalidateQueries({ queryKey: ['inventory'] });
  qc.invalidateQueries({ queryKey: ['ledger'] });
}

export function useCreatePurchaseOrderMutation() {
  const qc = useQueryClient();
  return useMutation<PurchaseOrder, unknown, CreatePurchaseOrderInput>({
    mutationFn: (input) => createPurchaseOrder(input),
    onSuccess: () => invalidatePurchaseOrders(qc),
  });
}

export function useSubmitPurchaseOrderMutation() {
  const qc = useQueryClient();
  return useMutation<{ status: string; purchase_order: PurchaseOrder }, unknown, number>({
    mutationFn: (id) => submitPurchaseOrder(id),
    onSuccess: () => invalidatePurchaseOrders(qc),
  });
}

export function useApprovePurchaseOrderMutation() {
  const qc = useQueryClient();
  return useMutation<{ status: string; purchase_order: PurchaseOrder }, unknown, number>({
    mutationFn: (id) => approvePurchaseOrder(id),
    onSuccess: () => invalidatePurchaseOrders(qc),
  });
}

export function useReceivePurchaseOrderMutation() {
  const qc = useQueryClient();
  return useMutation<
    { status: string; purchase_order: PurchaseOrder },
    unknown,
    { id: number; payload?: ReceivePurchaseOrderPayload }
  >({
    mutationFn: (args) => receivePurchaseOrder(args.id, args.payload),
    onSuccess: () => invalidatePurchaseOrders(qc),
  });
}

/* =========================
   PRODUCTS
   ========================= */

export function useProductsQuery(params: ProductsQuery, enabled = true) {
  return useQuery<LaravelPaginator<Product>>({
    queryKey: qk.products(params),
    queryFn: () => getProducts(params),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useCreateProductMutation() {
  const qc = useQueryClient();
  return useMutation<Product, unknown, CreateProductInput>({
    mutationFn: createProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['variants'] });
    },
  });
}

export function useUpdateProductMutation() {
  const qc = useQueryClient();
  return useMutation<Product, unknown, { id: number; input: UpdateProductInput }>({
    mutationFn: ({ id, input }) => updateProduct(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['variants'] });
    },
  });
}

export function useDisableProductMutation() {
  const qc = useQueryClient();
  return useMutation<{ status: string }, unknown, number>({
    mutationFn: (id) => disableProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['variants'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useEnableProductMutation() {
  const qc = useQueryClient();
  return useMutation<{ status: string }, unknown, number>({
    mutationFn: (id) => enableProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['variants'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function usePurgeProductMutation() {
  const qc = useQueryClient();
  return useMutation<{ status: string }, unknown, number>({
    mutationFn: (id) => purgeProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['variants'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

/* =========================
   VARIANTS
   ========================= */

export function useVariantsQuery(params: VariantsQuery, enabled = true) {
  return useQuery<LaravelPaginator<ProductVariant>>({
    queryKey: qk.variants(params),
    queryFn: () => getVariants(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useCreateVariantMutation() {
  const qc = useQueryClient();
  return useMutation<ProductVariant, unknown, CreateVariantInput>({
    mutationFn: createVariant,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['variants'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useUpdateVariantMutation() {
  const qc = useQueryClient();
  return useMutation<ProductVariant, unknown, { id: number; input: UpdateVariantInput }>({
    mutationFn: ({ id, input }) => updateVariant(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['variants'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useDisableVariantMutation() {
  const qc = useQueryClient();
  return useMutation<{ status: string }, unknown, number>({
    mutationFn: (id) => disableVariant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['variants'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useEnableVariantMutation() {
  const qc = useQueryClient();
  return useMutation<{ status: string }, unknown, number>({
    mutationFn: (id) => enableVariant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['variants'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function usePurgeVariantMutation() {
  const qc = useQueryClient();
  return useMutation<{ status: string }, unknown, number>({
    mutationFn: (id) => purgeVariant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['variants'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

/* =========================
   ADJUSTMENTS
   ========================= */

export function useAdjustmentsQuery(params: AdjustmentsQuery, enabled = true) {
  return useQuery<LaravelPaginator<StockAdjustment>>({
    queryKey: qk.adjustments(params),
    queryFn: () => getAdjustments(params),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: realtimeInterval(enabled, POLL_MS.adjustments),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useAdjustmentQuery(id: number, enabled = true) {
  return useQuery<StockAdjustment>({
    queryKey: qk.adjustment(id),
    queryFn: () => getAdjustment(id),
    enabled,
    refetchInterval: realtimeInterval(enabled, POLL_MS.adjustments),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useSubmitAdjustmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => submitAdjustment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adjustments'] });
    },
  });
}

export function useApproveAdjustmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => approveAdjustment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adjustments'] });
    },
  });
}

export function usePostAdjustmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => postAdjustment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adjustments'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}

export function useCreateAdjustmentMutation() {
  const qc = useQueryClient();
  return useMutation<StockAdjustment, unknown, CreateAdjustmentInput>({
    mutationFn: (input) => createAdjustment(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adjustments'] }),
  });
}

export function useQuickPostAdjustmentMutation() {
  const qc = useQueryClient();
  return useMutation<{ status: string }, unknown, CreateAdjustmentInput>({
    mutationFn: (input) => quickPostAdjustment(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
      qc.invalidateQueries({ queryKey: ['variants'] });
      qc.invalidateQueries({ queryKey: ['adjustments'] });
    },
  });
}

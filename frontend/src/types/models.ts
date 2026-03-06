export type UserRole = {
  id: number;
  code: string;
  name: string;
};

export type UserBranch = {
  id: number;
  code: string;
  name: string;
};

export type User = {
  id: number;
  name: string;
  email: string;
  is_active?: boolean;
  role_id?: number | null;
  branch_id?: number | null;
  branch_ids?: number[];
  created_at?: string;
  updated_at?: string;

  role?: UserRole | null;
  branch?: UserBranch | null;
  branches?: UserBranch[];
};

export type Branch = {
  id: number;
  code: string;
  name: string;
  address?: string | null;
  locator?: string | null;
  cellphone_no?: string | null;
  is_active: boolean;
};

export type Brand = {
  id: number;
  name: string;
};

export type Product = {
  id: number;
  name: string;
  product_type?: string;
  description?: string | null;
  base_price?: string | number | null;
  is_active?: boolean;
  variants_count?: number;
  brand?: Brand | null;
};

export type ProductVariant = {
  id: number;
  sku: string;
  barcode?: string | null;
  variant_name?: string | null;
  default_cost?: string | number | null;
  default_price?: string | number | null;
  product?: Product | null;
  is_active?: boolean;
  qty_on_hand?: string | number | null;
};


export type InventoryBalance = {
  id: number;
  branch_id: number;
  product_variant_id: number;
  qty_on_hand: string; // Laravel returns decimal as string
  branch?: Branch;
  variant?: ProductVariant;
};

export type StockLedger = {
  id: number;
  posted_at: string;
  branch_id: number;
  product_variant_id: number;
  qty_delta: string;
  movement_type: string;
  reason_code?: string | null;
  ref_type?: string | null;
  ref_id?: number | null;
  performed_by_user_id?: number | null;
  unit_cost?: string | null;
  unit_price?: string | null;
  notes?: string | null;
  branch?: Branch;
  variant?: ProductVariant;
  // backend relation is performedBy (likely serialized as performed_by)
  performed_by?: User | null;
  performedBy?: User | null;
};

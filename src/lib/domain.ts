export type Money = number | string;
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type ItemMetadata = Record<string, JsonValue>;
export type BaseRow = { id: string; created_at: string; created_by: string };
export type Customer = BaseRow & {
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
};
export type Supplier = Customer & { lead_days: number };
export type Project = BaseRow & {
  customer_id: string;
  name: string;
  status: string;
};
export type Environment = BaseRow & {
  project_id: string;
  supplier_id: string;
  name: string;
};
export type VersionItem = {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  costCents: number;
  saleCents: number;
  metadata?: ItemMetadata;
};
export type EnvironmentVersion = BaseRow & {
  environment_id: string;
  version_number: number;
  file_name: string;
  sha256: string;
  import_fingerprint: string;
  snapshot: {
    name: string;
    items: VersionItem[];
    sourceEnvironmentIndex?: number;
    mapping?: Record<string, JsonValue>;
    fingerprint?: string;
  };
  cost_cents: Money;
  sale_cents: Money;
};
export type Budget = BaseRow & {
  project_id: string;
  name: string;
  status: string;
  total_cents: Money;
  cost_cents: Money;
};
export type BudgetItem = BaseRow & {
  budget_id: string;
  environment_id: string;
  environment_version_id: string;
  source_item_index: number;
  supplier_id: string;
  code: string;
  description: string;
  unit: string;
  variant_key: string;
  metadata: ItemMetadata;
  quantity: number | string;
  unit_cost_cents: Money;
  unit_sale_cents: Money;
  cost_cents: Money;
  sale_cents: Money;
};
export type Contract = BaseRow & {
  number: number;
  budget_id: string;
  project_id: string;
  customer_id: string;
  status: string;
  total_cents: Money;
  signed_at: string | null;
  commercial_approved_at: string | null;
  financial_approved_at: string | null;
  cancellation_reason?: string | null;
};
export type ReviewSnapshot = {
  environments: {
    environmentId: string;
    name: string;
    supplierId: string;
    versionId: string;
    versionNumber: number;
    snapshot: EnvironmentVersion["snapshot"];
  }[];
};
export type TechnicalReview = BaseRow & {
  contract_id: string;
  revision_number: number;
  status: string;
  snapshot: ReviewSnapshot;
  sale_cents: Money;
  cost_cents: Money;
  difference_cents: Money;
  has_difference: boolean;
  difference_reason: string | null;
};
export type PurchaseOrder = BaseRow & {
  number: number;
  technical_review_id: string;
  contract_id: string;
  supplier_id: string;
  status: string;
  total_cents: Money;
  sent_at: string | null;
};
export type PurchaseItem = BaseRow & {
  purchase_order_id: string;
  inventory_item_id: string;
  environment_id: string;
  code: string;
  description: string;
  unit: string;
  quantity: number | string;
  received_quantity: number | string;
  unit_cost_cents: Money;
  total_cents: Money;
};
export type InventoryItem = BaseRow & {
  supplier_id: string;
  code: string;
  description: string;
  unit: string;
  variant_key: string;
};
export type StockBalance = {
  inventory_item_id: string;
  on_hand: string | number;
  reserved: string | number;
  available: string | number;
  updated_at: string;
};
export type StockReservation = BaseRow & {
  contract_id: string;
  inventory_item_id: string;
  quantity: number | string;
  status: string;
};
export type StockMovement = BaseRow & {
  inventory_item_id: string;
  contract_id: string | null;
  kind: string;
  quantity_delta: number | string;
  reserved_delta: number | string;
  reason: string | null;
};
export type Appointment = BaseRow & {
  contract_id: string;
  kind: string;
  assigned_to: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  status: string;
  completed_at: string | null;
};
export type AssistanceTicket = BaseRow & {
  contract_id: string | null;
  customer_id: string;
  title: string;
  status: string;
  closed_at: string | null;
};
export type AssistanceOccurrence = BaseRow & {
  ticket_id: string;
  description: string;
  payer: string;
  status: string;
  resolution: string | null;
};
export type FinancialTitle = BaseRow & {
  number: number;
  direction: string;
  origin: string;
  contract_id: string | null;
  purchase_order_id: string | null;
  customer_id: string | null;
  supplier_id: string | null;
  description: string;
  amount_cents: Money;
  paid_cents: Money;
  balance_cents: Money;
  due_date: string;
  status: string;
};
export type Settlement = BaseRow & {
  financial_title_id: string;
  amount_cents: Money;
  paid_at: string;
  request_id: string;
};
export type SettlementReversal = BaseRow & {
  settlement_id: string;
  reason: string;
  request_id: string;
};
export type AuditEvent = BaseRow & {
  entity_type: string;
  entity_id: string;
  action: string;
  details: Record<string, unknown>;
};
export type Profile = {
  id: string;
  name: string;
  role: string;
  active: boolean;
};

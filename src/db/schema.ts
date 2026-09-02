import { pgTable, text, timestamp, boolean, integer, numeric, uuid, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

// 1. STORES
export const stores = pgTable("stores", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  managerName: text("manager_name"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 2. USERS & ROLES
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(), // ADMINISTRATOR, SUPERVISOR, STOCK_TAKER, STORE_MANAGER, AUDITOR
  phone: text("phone"),
  storeId: uuid("store_id").references(() => stores.id),
  isActive: boolean("is_active").default(true).notNull(),
  avatarUrl: text("avatar_url"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_users_role").on(t.role),
  index("idx_users_store").on(t.storeId),
]);

// 3. DEPARTMENTS, CATEGORIES, SUBCATEGORIES, SUPPLIERS
export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  departmentId: uuid("department_id").references(() => departments.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subcategories = pgTable("subcategories", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id").references(() => categories.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 4. LOCATIONS
export const locations = pgTable("locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id").references(() => stores.id),
  departmentId: uuid("department_id").references(() => departments.id),
  locationCode: text("location_code").notNull().unique(),
  locationName: text("location_name").notNull(),
  aisle: text("aisle"),
  shelfSection: text("shelf_section"),
  barcode: text("barcode"),
  description: text("description"),
  status: text("status").default("ACTIVE").notNull(), // ACTIVE, INACTIVE, MAINTENANCE
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_locations_code").on(t.locationCode),
  index("idx_locations_store").on(t.storeId),
  index("idx_locations_dept").on(t.departmentId),
]);

// 5. ITEM MASTER
export const items = pgTable("items", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemName: text("item_name").notNull(),
  itemCode: text("item_code").notNull().unique(),
  eanCode: text("ean_code").notNull(),
  sku: text("sku"),
  departmentId: uuid("department_id").references(() => departments.id),
  categoryId: uuid("category_id").references(() => categories.id),
  subcategoryId: uuid("subcategory_id").references(() => subcategories.id),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  storeId: uuid("store_id").references(() => stores.id),
  brand: text("brand"),
  uom: text("uom").default("PCS").notNull(), // PCS, PACK, BOX, KG, LTR, CAN, BTL
  packSize: text("pack_size").default("1"),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }).default("0.00").notNull(),
  sellingPrice: numeric("selling_price", { precision: 12, scale: 2 }).default("0.00").notNull(),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("16.00").notNull(),
  reorderLevel: integer("reorder_level").default(10).notNull(),
  minStock: integer("min_stock").default(5).notNull(),
  maxStock: integer("max_stock").default(200).notNull(),
  currentSystemStock: integer("current_system_stock").default(0).notNull(),
  defaultLocationId: uuid("default_location_id").references(() => locations.id),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_items_code").on(t.itemCode),
  index("idx_items_ean").on(t.eanCode),
  index("idx_items_sku").on(t.sku),
  index("idx_items_name").on(t.itemName),
  index("idx_items_dept").on(t.departmentId),
  index("idx_items_active").on(t.isActive),
  // Composite indexes for common query patterns
  index("idx_items_lookup").on(t.isActive, t.itemCode),
  index("idx_items_ean_active").on(t.isActive, t.eanCode),
  index("idx_items_sku_active").on(t.isActive, t.sku),
]);

// 6. STOCK-TAKING SESSIONS
export const stockTakes = pgTable("stock_takes", {
  id: uuid("id").defaultRandom().primaryKey(),
  stockTakeNumber: text("stock_take_number").notNull().unique(), // ST-2026-00001
  name: text("name").notNull(),
  storeId: uuid("store_id").references(() => stores.id),
  type: text("type").default("FULL").notNull(), // FULL, DEPARTMENT, LOCATION, CYCLE_COUNT, RECOUNT
  status: text("status").default("DRAFT").notNull(), // DRAFT, PLANNED, OPEN, IN_PROGRESS, COUNTING, REVIEW, RECOUNT, APPROVED, FINALIZED, CANCELLED
  startDate: timestamp("start_date").defaultNow().notNull(),
  plannedEndDate: timestamp("planned_end_date"),
  notes: text("notes"),
  // Rules & Controls
  isBlindCount: boolean("is_blind_count").default(false).notNull(),
  require100Percent: boolean("require_100_percent").default(true).notNull(),
  twoPersonControl: boolean("two_person_control").default(false).notNull(),
  allowPartialSubmission: boolean("allow_partial_submission").default(false).notNull(),
  qtyVarianceThreshold: integer("qty_variance_threshold").default(5).notNull(),
  valVarianceThreshold: numeric("val_variance_threshold", { precision: 12, scale: 2 }).default("100.00").notNull(),
  pctVarianceThreshold: numeric("pct_variance_threshold", { precision: 6, scale: 2 }).default("10.00").notNull(),
  // Locking & Finalization
  isLocked: boolean("is_locked").default(false).notNull(),
  lockedAt: timestamp("locked_at"),
  lockedBy: uuid("locked_by").references(() => users.id),
  unlockReason: text("unlock_reason"),
  finalizedAt: timestamp("finalized_at"),
  finalizedBy: uuid("finalized_by").references(() => users.id),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_st_number").on(t.stockTakeNumber),
  index("idx_st_status").on(t.status),
  index("idx_st_store").on(t.storeId),
]);

// 7. STOCK TAKE LOCATIONS & ASSIGNMENTS
export const stockTakeLocations = pgTable("stock_take_locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  stockTakeId: uuid("stock_take_id").references(() => stockTakes.id, { onDelete: "cascade" }).notNull(),
  locationId: uuid("location_id").references(() => locations.id).notNull(),
  assignedUserId: uuid("assigned_user_id").references(() => users.id),
  verifierUserId: uuid("verifier_user_id").references(() => users.id),
  status: text("status").default("NOT_ASSIGNED").notNull(), // NOT_ASSIGNED, ASSIGNED, STARTED, IN_PROGRESS, PAUSED, SUBMITTED, UNDER_REVIEW, RECOUNT_REQUIRED, APPROVED, COMPLETED, LOCKED
  expectedItemsCount: integer("expected_items_count").default(0).notNull(),
  countedItemsCount: integer("counted_items_count").default(0).notNull(),
  startedAt: timestamp("started_at"),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: uuid("approved_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("uidx_st_location").on(t.stockTakeId, t.locationId),
  index("idx_stl_user").on(t.assignedUserId),
  index("idx_stl_status").on(t.status),
]);

// 8. STOCK COUNTS (Physical count lines)
export const stockCounts = pgTable("stock_counts", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientUuid: text("client_uuid"), // For offline idempotent sync
  stockTakeId: uuid("stock_take_id").references(() => stockTakes.id, { onDelete: "cascade" }).notNull(),
  stockTakeLocationId: uuid("stock_take_location_id").references(() => stockTakeLocations.id, { onDelete: "cascade" }).notNull(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(), // Who counted
  verifierId: uuid("verifier_id").references(() => users.id), // For 2-person verification
  systemQuantity: integer("system_quantity").default(0).notNull(),
  physicalQuantity: integer("physical_quantity").notNull(),
  verificationQuantity: integer("verification_quantity"),
  varianceQuantity: integer("variance_quantity").notNull(), // physical - system
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }).default("0.00").notNull(),
  varianceValue: numeric("variance_value", { precision: 12, scale: 2 }).default("0.00").notNull(), // varianceQty * costPrice
  variancePercentage: numeric("variance_percentage", { precision: 6, scale: 2 }).default("0.00"),
  countRound: integer("count_round").default(1).notNull(), // 1 = initial, 2 = recount
  countStatus: text("count_status").default("COUNTED").notNull(), // COUNTED, SUBMITTED, RECOUNT_REQUIRED, RECOUNTED, APPROVED, ADJUSTED
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_sc_st").on(t.stockTakeId),
  index("idx_sc_stl").on(t.stockTakeLocationId),
  index("idx_sc_item").on(t.itemId),
  index("idx_sc_user").on(t.userId),
]);

// 9. RECOUNTS
export const recounts = pgTable("recounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  stockTakeId: uuid("stock_take_id").references(() => stockTakes.id, { onDelete: "cascade" }).notNull(),
  stockTakeLocationId: uuid("stock_take_location_id").references(() => stockTakeLocations.id, { onDelete: "cascade" }).notNull(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  originalStockCountId: uuid("original_stock_count_id").references(() => stockCounts.id),
  requestedBy: uuid("requested_by").references(() => users.id).notNull(),
  assignedTo: uuid("assigned_to").references(() => users.id),
  reason: text("reason").notNull(), // LARGE_VARIANCE, HIGH_VALUE, COUNT_MISMATCH, SUPERVISOR_REQUEST, MANUAL_REVIEW, DUPLICATE_COUNT, SUSPICIOUS
  systemQty: integer("system_qty").default(0).notNull(),
  originalPhysicalQty: integer("original_physical_qty").notNull(),
  recountPhysicalQty: integer("recount_physical_qty"),
  difference: integer("difference"), // recount - original
  finalQuantity: integer("final_quantity"),
  status: text("status").default("PENDING").notNull(), // PENDING, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED
  notes: text("notes"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_recount_st").on(t.stockTakeId),
  index("idx_recount_status").on(t.status),
]);

// 10. STOCK ADJUSTMENTS
export const stockAdjustments = pgTable("stock_adjustments", {
  id: uuid("id").defaultRandom().primaryKey(),
  stockTakeId: uuid("stock_take_id").references(() => stockTakes.id).notNull(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  locationId: uuid("location_id").references(() => locations.id),
  previousStock: integer("previous_stock").notNull(),
  adjustmentQty: integer("adjustment_qty").notNull(),
  newStock: integer("new_stock").notNull(),
  reason: text("reason"),
  approvedBy: uuid("approved_by").references(() => users.id).notNull(),
  status: text("status").default("APPLIED").notNull(), // PENDING, APPLIED, REJECTED
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_adj_st").on(t.stockTakeId),
  index("idx_adj_item").on(t.itemId),
]);

// 11. AUDIT LOGS (Immutable historical log)
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  userName: text("user_name").notNull(),
  userRole: text("user_role"),
  action: text("action").notNull(), // LOGIN, LOGOUT, ITEM_CREATE, ITEM_IMPORT, COUNT_ENTRY, COUNT_EDIT, RECOUNT_REQUEST, APPROVE_LOCATION, FINALIZE_STOCK_TAKE, UNLOCK_STOCK_TAKE, EXPORT_REPORT, ADJUST_STOCK
  entityType: text("entity_type").notNull(), // USER, ITEM, LOCATION, STOCK_TAKE, STOCK_COUNT, RECOUNT, SETTING
  entityId: text("entity_id"),
  previousValue: text("previous_value"), // JSON or string
  newValue: text("new_value"), // JSON or string
  ipAddress: text("ip_address"),
  deviceInfo: text("device_info"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_audit_action").on(t.action),
  index("idx_audit_entity").on(t.entityType, t.entityId),
  index("idx_audit_user").on(t.userId),
  index("idx_audit_created").on(t.createdAt),
]);

// 12. SYSTEM SETTINGS
export const systemSettings = pgTable("system_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(), // JSON serialized
  category: text("category").default("GENERAL").notNull(),
  description: text("description"),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 13. IMPORT BATCHES
export const importBatches = pgTable("import_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  fileName: text("file_name").notNull(),
  importedBy: uuid("imported_by").references(() => users.id).notNull(),
  totalRows: integer("total_rows").notNull(),
  successfulRows: integer("successful_rows").notNull(),
  updatedRows: integer("updated_rows").default(0).notNull(),
  failedRows: integer("failed_rows").default(0).notNull(),
  status: text("status").default("COMPLETED").notNull(), // PENDING, VALIDATED, COMPLETED, FAILED
  errorDetails: text("error_details"), // JSON serialized string of errors
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 14. NOTIFICATIONS
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").default("INFO").notNull(), // INFO, ASSIGNMENT, RECOUNT, APPROVAL, ALERT
  isRead: boolean("is_read").default(false).notNull(),
  link: text("link"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_notif_user").on(t.userId),
  index("idx_notif_read").on(t.isRead),
]);

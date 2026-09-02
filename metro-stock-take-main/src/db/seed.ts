import { db } from "./index";
import {
  stores,
  users,
  departments,
  categories,
  suppliers,
  locations,
  items,
  systemSettings,
  auditLogs,
} from "./schema";
import bcrypt from "bcryptjs";

export async function seedDatabase() {
  console.log("Starting production database setup...");

  // 1. MAIN STORE
  const storeRows = await db
    .insert(stores)
    .values([
      {
        code: "STR-001",
        name: "Metro Grand Hypermarket (Main)",
        address: "Commercial Hub, Main Supermarket Center",
        phone: "+1 800 555 0199",
        managerName: "Administrator",
      },
    ])
    .onConflictDoNothing()
    .returning();

  const mainStore = storeRows[0] || (await db.select().from(stores).limit(1))[0];

  // 2. ADMINISTRATOR USER ONLY
  const passwordHash = await bcrypt.hash("password123", 10);

  await db
    .insert(users)
    .values([
      {
        username: "admin",
        email: "admin@supermarket.com",
        passwordHash,
        fullName: "System Administrator",
        role: "ADMINISTRATOR" as const,
        phone: "+1 800 555 0100",
        storeId: mainStore.id,
        isActive: true,
      },
    ])
    .onConflictDoNothing();

  const adminUser = (await db.select().from(users).limit(1))[0];

  // 3. DEPARTMENTS
  const deptEntries = [
    { code: "BEV", name: "Beverages & Drinks", description: "Soft drinks, water, juices, and hot beverages" },
    { code: "GROC", name: "Packaged Groceries & Pantry", description: "Flour, grains, sugar, pasta, and canned foods" },
    { code: "DAIRY", name: "Dairy, Chilled & Frozen", description: "Fresh milk, cheese, yoghurt, and butter" },
    { code: "FRESH", name: "Fresh Produce & Bakery", description: "Bakery breads, pastries, fresh fruits and vegetables" },
    { code: "HHPC", name: "Household & Personal Care", description: "Soaps, detergents, cleaners, and toiletries" },
    { code: "ELEC", name: "Electronics & Appliances", description: "Small kitchen appliances, accessories, and electronics" },
  ];
  await db.insert(departments).values(deptEntries).onConflictDoNothing();
  const allDepts = await db.select().from(departments);
  const bevDept = allDepts.find((d) => d.code === "BEV")!;
  const grocDept = allDepts.find((d) => d.code === "GROC")!;
  const dairyDept = allDepts.find((d) => d.code === "DAIRY")!;
  const hhpcDept = allDepts.find((d) => d.code === "HHPC")!;
  const elecDept = allDepts.find((d) => d.code === "ELEC")!;

  // 4. CATEGORIES
  const catEntries = [
    { departmentId: bevDept.id, code: "SOFT_DRINKS", name: "Carbonated Soft Drinks" },
    { departmentId: bevDept.id, code: "WATER_JUICE", name: "Bottled Water & Juices" },
    { departmentId: grocDept.id, code: "GRAINS_FLOUR", name: "Grains, Cereals & Flours" },
    { departmentId: grocDept.id, code: "OILS_SAUCES", name: "Cooking Oils, Sauces & Spices" },
    { departmentId: dairyDept.id, code: "MILK_YOGHURT", name: "Milk, Cream & Yoghurts" },
    { departmentId: dairyDept.id, code: "CHEESE_BUTTER", name: "Butter, Margarine & Cheese" },
    { departmentId: hhpcDept.id, code: "DETERGENTS", name: "Laundry & Dish Detergents" },
    { departmentId: elecDept.id, code: "APPLIANCES", name: "Kitchen & Home Appliances" },
  ];
  await db.insert(categories).values(catEntries).onConflictDoNothing();
  const allCats = await db.select().from(categories);
  const softDrinksCat = allCats.find((c) => c.code === "SOFT_DRINKS")!;
  const waterJuiceCat = allCats.find((c) => c.code === "WATER_JUICE")!;
  const grainsCat = allCats.find((c) => c.code === "GRAINS_FLOUR")!;
  const oilsCat = allCats.find((c) => c.code === "OILS_SAUCES")!;
  const milkCat = allCats.find((c) => c.code === "MILK_YOGHURT")!;
  const butterCat = allCats.find((c) => c.code === "CHEESE_BUTTER")!;
  const detCat = allCats.find((c) => c.code === "DETERGENTS")!;
  const appCat = allCats.find((c) => c.code === "APPLIANCES")!;

  // 5. SUPPLIERS
  const supplierEntries = [
    { code: "SUP-001", name: "Beverages Distribution Global", contactPerson: "Commercial Sales", phone: "+1 800 555 1111", email: "orders@beverages.com" },
    { code: "SUP-002", name: "Fresh Dairy Supplies Ltd", contactPerson: "Dairy Logistics", phone: "+1 800 555 2222", email: "supply@freshdairy.com" },
    { code: "SUP-003", name: "Household Essentials Corp", contactPerson: "FMCG Wholesale", phone: "+1 800 555 3333", email: "sales@essentials.com" },
    { code: "SUP-004", name: "Agri-Staples Millers", contactPerson: "Grain Distribution", phone: "+1 800 555 4444", email: "orders@agristaples.com" },
    { code: "SUP-005", name: "Consumer Tech Logistics", contactPerson: "Electronics Desk", phone: "+1 800 555 5555", email: "trade@consumertech.com" },
  ];
  await db.insert(suppliers).values(supplierEntries).onConflictDoNothing();
  const allSuppliers = await db.select().from(suppliers);
  const bevSup = allSuppliers.find((s) => s.code === "SUP-001")!;
  const dairySup = allSuppliers.find((s) => s.code === "SUP-002")!;
  const fmcgSup = allSuppliers.find((s) => s.code === "SUP-003")!;
  const grainSup = allSuppliers.find((s) => s.code === "SUP-004")!;
  const techSup = allSuppliers.find((s) => s.code === "SUP-005")!;

  // 6. LOCATIONS
  const locationEntries = [
    {
      storeId: mainStore.id,
      departmentId: bevDept.id,
      locationCode: "AISLE-01",
      locationName: "Aisle 01 — Carbonated Drinks & Juices",
      aisle: "01",
      shelfSection: "Bay A & B",
      barcode: "LOC-AISLE-01",
      description: "Beverages racks on front left",
      status: "ACTIVE",
    },
    {
      storeId: mainStore.id,
      departmentId: grocDept.id,
      locationCode: "AISLE-02",
      locationName: "Aisle 02 — Breakfast Cereals & Pasta",
      aisle: "02",
      shelfSection: "Bay A to D",
      barcode: "LOC-AISLE-02",
      description: "Dry breakfast and pasta aisles",
      status: "ACTIVE",
    },
    {
      storeId: mainStore.id,
      departmentId: grocDept.id,
      locationCode: "AISLE-03",
      locationName: "Aisle 03 — Flours, Rice & Grains",
      aisle: "03",
      shelfSection: "Heavy Pallet Shelves",
      barcode: "LOC-AISLE-03",
      description: "Grains and cooking staples",
      status: "ACTIVE",
    },
    {
      storeId: mainStore.id,
      departmentId: grocDept.id,
      locationCode: "AISLE-04",
      locationName: "Aisle 04 — Cooking Oils & Canned Food",
      aisle: "04",
      shelfSection: "Bay 1 to 4",
      barcode: "LOC-AISLE-04",
      description: "Oils, condiments and canned preserves",
      status: "ACTIVE",
    },
    {
      storeId: mainStore.id,
      departmentId: hhpcDept.id,
      locationCode: "AISLE-05",
      locationName: "Aisle 05 — Detergents & Cleaners",
      aisle: "05",
      shelfSection: "Middle Section",
      barcode: "LOC-AISLE-05",
      description: "Washing powders, bleach and soaps",
      status: "ACTIVE",
    },
    {
      storeId: mainStore.id,
      departmentId: dairyDept.id,
      locationCode: "AISLE-07",
      locationName: "Aisle 07 — Dairy Chillers & Butter",
      aisle: "07",
      shelfSection: "Chilled Open Display 1-3",
      barcode: "LOC-AISLE-07",
      description: "Fresh milk, yoghurts and cheeses",
      status: "ACTIVE",
    },
    {
      storeId: mainStore.id,
      departmentId: elecDept.id,
      locationCode: "AISLE-08",
      locationName: "Aisle 08 — Electronics & Appliances",
      aisle: "08",
      shelfSection: "Glass Secure Display",
      barcode: "LOC-AISLE-08",
      description: "High-value appliances and accessories",
      status: "ACTIVE",
    },
    {
      storeId: mainStore.id,
      departmentId: dairyDept.id,
      locationCode: "COLD-01",
      locationName: "Cold Room 01 — Back Dairy Chiller",
      aisle: "Backroom",
      shelfSection: "Walk-in Cooler",
      barcode: "LOC-COLD-01",
      description: "Temperature controlled storage at 4°C",
      status: "ACTIVE",
    },
    {
      storeId: mainStore.id,
      departmentId: grocDept.id,
      locationCode: "WAREHOUSE-01",
      locationName: "Central Warehouse — Pallet Racks",
      aisle: "WH-A",
      shelfSection: "Tier 1 & 2",
      barcode: "LOC-WH-01",
      description: "Bulk overflow inventory",
      status: "ACTIVE",
    },
  ];
  await db.insert(locations).values(locationEntries).onConflictDoNothing();
  const allLocations = await db.select().from(locations);
  const aisle01 = allLocations.find((l) => l.locationCode === "AISLE-01")!;
  const aisle02 = allLocations.find((l) => l.locationCode === "AISLE-02")!;
  const aisle03 = allLocations.find((l) => l.locationCode === "AISLE-03")!;
  const aisle04 = allLocations.find((l) => l.locationCode === "AISLE-04")!;
  const aisle05 = allLocations.find((l) => l.locationCode === "AISLE-05")!;
  const aisle07 = allLocations.find((l) => l.locationCode === "AISLE-07")!;
  const aisle08 = allLocations.find((l) => l.locationCode === "AISLE-08")!;

  // 7. INITIAL ITEM MASTER CATALOG
  const catalogItems = [
    {
      itemName: "Coca-Cola Original Taste 500ml PET",
      itemCode: "BEV-CC-500",
      eanCode: "5449000000996",
      sku: "SKU-CC-500",
      departmentId: bevDept.id,
      categoryId: softDrinksCat.id,
      supplierId: bevSup.id,
      storeId: mainStore.id,
      brand: "Coca-Cola",
      uom: "BTL",
      packSize: "1",
      costPrice: "0.60",
      sellingPrice: "0.95",
      taxRate: "16.00",
      reorderLevel: 40,
      minStock: 20,
      maxStock: 300,
      currentSystemStock: 120,
      defaultLocationId: aisle01.id,
    },
    {
      itemName: "Coca-Cola Zero Sugar 500ml PET",
      itemCode: "BEV-CCZ-500",
      eanCode: "5449000131805",
      sku: "SKU-CCZ-500",
      departmentId: bevDept.id,
      categoryId: softDrinksCat.id,
      supplierId: bevSup.id,
      storeId: mainStore.id,
      brand: "Coca-Cola",
      uom: "BTL",
      packSize: "1",
      costPrice: "0.62",
      sellingPrice: "0.95",
      taxRate: "16.00",
      reorderLevel: 25,
      minStock: 15,
      maxStock: 200,
      currentSystemStock: 80,
      defaultLocationId: aisle01.id,
    },
    {
      itemName: "Fanta Orange Refreshing 500ml PET",
      itemCode: "BEV-FO-500",
      eanCode: "5449000011527",
      sku: "SKU-FO-500",
      departmentId: bevDept.id,
      categoryId: softDrinksCat.id,
      supplierId: bevSup.id,
      storeId: mainStore.id,
      brand: "Fanta",
      uom: "BTL",
      packSize: "1",
      costPrice: "0.58",
      sellingPrice: "0.95",
      taxRate: "16.00",
      reorderLevel: 30,
      minStock: 15,
      maxStock: 250,
      currentSystemStock: 95,
      defaultLocationId: aisle01.id,
    },
    {
      itemName: "Sprite Crisp Lemon-Lime 500ml PET",
      itemCode: "BEV-SP-500",
      eanCode: "5449000014535",
      sku: "SKU-SP-500",
      departmentId: bevDept.id,
      categoryId: softDrinksCat.id,
      supplierId: bevSup.id,
      storeId: mainStore.id,
      brand: "Sprite",
      uom: "BTL",
      packSize: "1",
      costPrice: "0.58",
      sellingPrice: "0.95",
      taxRate: "16.00",
      reorderLevel: 25,
      minStock: 10,
      maxStock: 200,
      currentSystemStock: 74,
      defaultLocationId: aisle01.id,
    },
    {
      itemName: "Minute Maid Mango Fruit Juice 1 Litre",
      itemCode: "BEV-MM-1L",
      eanCode: "5449000145222",
      sku: "SKU-MM-1L",
      departmentId: bevDept.id,
      categoryId: waterJuiceCat.id,
      supplierId: bevSup.id,
      storeId: mainStore.id,
      brand: "Minute Maid",
      uom: "TETRA",
      packSize: "1",
      costPrice: "1.40",
      sellingPrice: "2.10",
      taxRate: "16.00",
      reorderLevel: 20,
      minStock: 10,
      maxStock: 150,
      currentSystemStock: 48,
      defaultLocationId: aisle01.id,
    },
    {
      itemName: "Purified Mineral Water 1.5 Litre",
      itemCode: "BEV-WAT-15L",
      eanCode: "5449000050885",
      sku: "SKU-WAT-15L",
      departmentId: bevDept.id,
      categoryId: waterJuiceCat.id,
      supplierId: bevSup.id,
      storeId: mainStore.id,
      brand: "Dasani",
      uom: "BTL",
      packSize: "1",
      costPrice: "0.45",
      sellingPrice: "0.80",
      taxRate: "16.00",
      reorderLevel: 50,
      minStock: 25,
      maxStock: 400,
      currentSystemStock: 150,
      defaultLocationId: aisle01.id,
    },
    {
      itemName: "Kellogg's Corn Flakes 500g Box",
      itemCode: "GROC-KEL-500",
      eanCode: "5010029000147",
      sku: "SKU-KEL-500",
      departmentId: grocDept.id,
      categoryId: grainsCat.id,
      supplierId: fmcgSup.id,
      storeId: mainStore.id,
      brand: "Kellogg's",
      uom: "BOX",
      packSize: "1",
      costPrice: "3.20",
      sellingPrice: "4.80",
      taxRate: "16.00",
      reorderLevel: 15,
      minStock: 8,
      maxStock: 80,
      currentSystemStock: 35,
      defaultLocationId: aisle02.id,
    },
    {
      itemName: "Barilla Spaghetti No. 5 500g",
      itemCode: "GROC-BAR-500",
      eanCode: "8076809513753",
      sku: "SKU-BAR-500",
      departmentId: grocDept.id,
      categoryId: grainsCat.id,
      supplierId: fmcgSup.id,
      storeId: mainStore.id,
      brand: "Barilla",
      uom: "PACK",
      packSize: "1",
      costPrice: "1.30",
      sellingPrice: "2.10",
      taxRate: "16.00",
      reorderLevel: 30,
      minStock: 15,
      maxStock: 150,
      currentSystemStock: 68,
      defaultLocationId: aisle02.id,
    },
    {
      itemName: "Premium All-Purpose Wheat Flour 2kg",
      itemCode: "GROC-PEM-2KG",
      eanCode: "6161101230012",
      sku: "SKU-PEM-2KG",
      departmentId: grocDept.id,
      categoryId: grainsCat.id,
      supplierId: grainSup.id,
      storeId: mainStore.id,
      brand: "Pembe",
      uom: "BAG",
      packSize: "1",
      costPrice: "1.50",
      sellingPrice: "2.20",
      taxRate: "0.00",
      reorderLevel: 50,
      minStock: 25,
      maxStock: 300,
      currentSystemStock: 145,
      defaultLocationId: aisle03.id,
    },
    {
      itemName: "Pure Corn Cooking Oil 3 Litres",
      itemCode: "GROC-ELI-3L",
      eanCode: "6161101230067",
      sku: "SKU-ELI-3L",
      departmentId: grocDept.id,
      categoryId: oilsCat.id,
      supplierId: grainSup.id,
      storeId: mainStore.id,
      brand: "Elianto",
      uom: "JUG",
      packSize: "1",
      costPrice: "6.20",
      sellingPrice: "8.90",
      taxRate: "16.00",
      reorderLevel: 20,
      minStock: 10,
      maxStock: 100,
      currentSystemStock: 45,
      defaultLocationId: aisle04.id,
    },
    {
      itemName: "Auto Laundry Detergent Powder 2kg",
      itemCode: "HHPC-OMO-2KG",
      eanCode: "6001087358476",
      sku: "SKU-OMO-2KG",
      departmentId: hhpcDept.id,
      categoryId: detCat.id,
      supplierId: fmcgSup.id,
      storeId: mainStore.id,
      brand: "Omo",
      uom: "BAG",
      packSize: "1",
      costPrice: "4.20",
      sellingPrice: "6.20",
      taxRate: "16.00",
      reorderLevel: 25,
      minStock: 12,
      maxStock: 120,
      currentSystemStock: 50,
      defaultLocationId: aisle05.id,
    },
    {
      itemName: "Fresh Whole Milk 500ml Pouch",
      itemCode: "DAIRY-BK-500",
      eanCode: "6161102000010",
      sku: "SKU-BK-500",
      departmentId: dairyDept.id,
      categoryId: milkCat.id,
      supplierId: dairySup.id,
      storeId: mainStore.id,
      brand: "Brookside",
      uom: "POUCH",
      packSize: "1",
      costPrice: "0.45",
      sellingPrice: "0.65",
      taxRate: "0.00",
      reorderLevel: 50,
      minStock: 25,
      maxStock: 250,
      currentSystemStock: 115,
      defaultLocationId: aisle07.id,
    },
    {
      itemName: "Salted Dairy Butter 500g Block",
      itemCode: "DAIRY-BK-BUT",
      eanCode: "6161102000034",
      sku: "SKU-BK-BUT",
      departmentId: dairyDept.id,
      categoryId: butterCat.id,
      supplierId: dairySup.id,
      storeId: mainStore.id,
      brand: "Brookside",
      uom: "PACK",
      packSize: "1",
      costPrice: "3.60",
      sellingPrice: "5.20",
      taxRate: "16.00",
      reorderLevel: 15,
      minStock: 8,
      maxStock: 80,
      currentSystemStock: 32,
      defaultLocationId: aisle07.id,
    },
    {
      itemName: "Smart LED TV 32-inch High Definition",
      itemCode: "ELEC-SAM-32",
      eanCode: "8806091234561",
      sku: "SKU-SAM-32",
      departmentId: elecDept.id,
      categoryId: appCat.id,
      supplierId: techSup.id,
      storeId: mainStore.id,
      brand: "Samsung",
      uom: "UNIT",
      packSize: "1",
      costPrice: "140.00",
      sellingPrice: "185.00",
      taxRate: "16.00",
      reorderLevel: 4,
      minStock: 2,
      maxStock: 15,
      currentSystemStock: 8,
      defaultLocationId: aisle08.id,
    },
  ];

  await db.insert(items).values(catalogItems).onConflictDoNothing();

  // 8. SYSTEM CONFIGURATION SETTINGS
  const initialSettings = [
    {
      key: "DEFAULT_BLIND_COUNT",
      value: JSON.stringify(false),
      category: "STOCK_TAKE",
      description: "Hide system quantity and variance from stock takers by default during count entry",
      updatedBy: adminUser.id,
    },
    {
      key: "QTY_VARIANCE_THRESHOLD",
      value: JSON.stringify(5),
      category: "VARIANCE",
      description: "Automatic review required if quantity variance exceeds this number of units",
      updatedBy: adminUser.id,
    },
    {
      key: "VAL_VARIANCE_THRESHOLD",
      value: JSON.stringify(100.0),
      category: "VARIANCE",
      description: "Automatic review required if variance financial value exceeds this amount",
      updatedBy: adminUser.id,
    },
    {
      key: "PCT_VARIANCE_THRESHOLD",
      value: JSON.stringify(10.0),
      category: "VARIANCE",
      description: "Automatic review required if percentage variance exceeds this percentage",
      updatedBy: adminUser.id,
    },
    {
      key: "REQUIRE_100_PERCENT_COUNT",
      value: JSON.stringify(true),
      category: "CONTROLS",
      description: "Block location completion if expected items remain uncounted unless overridden",
      updatedBy: adminUser.id,
    },
    {
      key: "ALLOW_PARTIAL_SUBMISSION",
      value: JSON.stringify(false),
      category: "CONTROLS",
      description: "Allow stock taker to submit location before all products are verified",
      updatedBy: adminUser.id,
    },
    {
      key: "TWO_PERSON_VERIFICATION",
      value: JSON.stringify(false),
      category: "CONTROLS",
      description: "Require a second independent verifier count before location submission",
      updatedBy: adminUser.id,
    },
    {
      key: "SESSION_TIMEOUT_MINUTES",
      value: JSON.stringify(60),
      category: "SECURITY",
      description: "Staff session inactivity expiration period in minutes",
      updatedBy: adminUser.id,
    },
  ];

  for (const s of initialSettings) {
    await db
      .insert(systemSettings)
      .values(s)
      .onConflictDoNothing({ target: systemSettings.key });
  }

  // Audit log initialization
  await db.insert(auditLogs).values([
    {
      userId: adminUser.id,
      userName: adminUser.fullName,
      userRole: adminUser.role,
      action: "SYSTEM_INITIALIZED",
      entityType: "SYSTEM",
      entityId: adminUser.id,
      reason: "Live production environment initialized with Administrator account",
    },
  ]);

  console.log("Production setup completed successfully!");
}

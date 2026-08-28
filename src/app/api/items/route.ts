import { NextResponse } from "next/server";
import { db } from "@/db";
import { items, departments, categories, suppliers, locations } from "@/db/schema";
import { eq, or, ilike, and, desc, sql } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query")?.trim() || "";
    const departmentId = searchParams.get("departmentId") || "";
    const categoryId = searchParams.get("categoryId") || "";
    const status = searchParams.get("status") || "ALL";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query) {
      conditions.push(
        or(
          ilike(items.itemName, `%${query}%`),
          ilike(items.itemCode, `%${query}%`),
          ilike(items.eanCode, `%${query}%`),
          ilike(items.sku, `%${query}%`)
        )
      );
    }

    if (departmentId && departmentId !== "ALL") {
      conditions.push(eq(items.departmentId, departmentId));
    }

    if (categoryId && categoryId !== "ALL") {
      conditions.push(eq(items.categoryId, categoryId));
    }

    if (status === "ACTIVE") {
      conditions.push(eq(items.isActive, true));
    } else if (status === "INACTIVE") {
      conditions.push(eq(items.isActive, false));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total
    const totalCountResult = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(items)
      .where(whereClause);

    const total = totalCountResult[0]?.count || 0;

    // Fetch items with joined relations
    const rows = await db
      .select({
        id: items.id,
        itemName: items.itemName,
        itemCode: items.itemCode,
        eanCode: items.eanCode,
        sku: items.sku,
        brand: items.brand,
        uom: items.uom,
        packSize: items.packSize,
        costPrice: items.costPrice,
        sellingPrice: items.sellingPrice,
        taxRate: items.taxRate,
        reorderLevel: items.reorderLevel,
        minStock: items.minStock,
        maxStock: items.maxStock,
        currentSystemStock: items.currentSystemStock,
        isActive: items.isActive,
        createdAt: items.createdAt,
        departmentId: items.departmentId,
        departmentName: departments.name,
        departmentCode: departments.code,
        categoryId: items.categoryId,
        categoryName: categories.name,
        supplierId: items.supplierId,
        supplierName: suppliers.name,
        defaultLocationId: items.defaultLocationId,
        defaultLocationCode: locations.locationCode,
      })
      .from(items)
      .leftJoin(departments, eq(items.departmentId, departments.id))
      .leftJoin(categories, eq(items.categoryId, categories.id))
      .leftJoin(suppliers, eq(items.supplierId, suppliers.id))
      .leftJoin(locations, eq(items.defaultLocationId, locations.id))
      .where(whereClause)
      .orderBy(desc(items.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      items: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Items fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "MANAGE_ITEMS")) {
      return NextResponse.json({ error: "Forbidden: Only administrators can create items" }, { status: 403 });
    }

    const body = await req.json();
    const {
      itemName,
      itemCode,
      eanCode,
      sku,
      departmentId,
      categoryId,
      subcategoryId,
      supplierId,
      brand,
      uom = "PCS",
      packSize = "1",
      costPrice = "0.00",
      sellingPrice = "0.00",
      taxRate = "16.00",
      reorderLevel = 10,
      minStock = 5,
      maxStock = 100,
      currentSystemStock = 0,
      defaultLocationId,
    } = body;

    // Validation
    if (!itemName?.trim()) {
      return NextResponse.json({ error: "Item Name is required" }, { status: 400 });
    }
    if (!itemCode?.trim()) {
      return NextResponse.json({ error: "Item Code is required" }, { status: 400 });
    }
    if (!eanCode?.trim()) {
      return NextResponse.json({ error: "EAN Code is required" }, { status: 400 });
    }

    // Check duplicate code or EAN
    const existingCode = await db.select().from(items).where(eq(items.itemCode, itemCode.trim())).limit(1);
    if (existingCode.length > 0) {
      return NextResponse.json({ error: `Item Code '${itemCode}' already exists.` }, { status: 409 });
    }

    const inserted = await db
      .insert(items)
      .values({
        itemName: itemName.trim(),
        itemCode: itemCode.trim(),
        eanCode: eanCode.trim(),
        sku: sku?.trim() || null,
        departmentId: departmentId || null,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        supplierId: supplierId || null,
        brand: brand?.trim() || null,
        uom: uom || "PCS",
        packSize: String(packSize || "1"),
        costPrice: String(costPrice || "0.00"),
        sellingPrice: String(sellingPrice || "0.00"),
        taxRate: String(taxRate || "16.00"),
        reorderLevel: Number(reorderLevel) || 10,
        minStock: Number(minStock) || 5,
        maxStock: Number(maxStock) || 100,
        currentSystemStock: Number(currentSystemStock) || 0,
        defaultLocationId: defaultLocationId || null,
      })
      .returning();

    const newItem = inserted[0];

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "ITEM_CREATE",
      entityType: "ITEM",
      entityId: newItem.id,
      newValue: { itemName: newItem.itemName, itemCode: newItem.itemCode, eanCode: newItem.eanCode },
    });

    return NextResponse.json({ success: true, item: newItem }, { status: 201 });
  } catch (error) {
    console.error("Item creation error:", error);
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "MANAGE_ITEMS")) {
      return NextResponse.json({ error: "Forbidden: Only administrators can delete items" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0) : [];
    const deleteAll = body.deleteAll === true;

    if (!deleteAll && ids.length === 0) {
      return NextResponse.json({ error: "Select at least one item to delete" }, { status: 400 });
    }

    const condition = deleteAll ? undefined : sql`${items.id} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`;
    const deleted = await db.delete(items).where(condition).returning({ id: items.id });

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "ITEM_DELETE",
      entityType: "ITEM",
      entityId: deleted[0]?.id || "BULK",
      newValue: { deletedCount: deleted.length, deleteAll },
      reason: deleteAll ? "All items deleted by administrator" : "Selected items deleted by administrator",
    });

    return NextResponse.json({ success: true, deletedCount: deleted.length });
  } catch (error) {
    console.error("Item deletion error:", error);
    return NextResponse.json({ error: "Unable to delete items. Items already used in stock counts cannot be deleted." }, { status: 409 });
  }
}

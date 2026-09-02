import { NextResponse } from "next/server";
import { db } from "@/db";
import { items, stockCounts, stockTakes, locations, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const itemRows = await db.select().from(items).where(eq(items.id, id)).limit(1);

    if (itemRows.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const item = itemRows[0];

    // Get count history across stock takes
    const historyRows = await db
      .select({
        id: stockCounts.id,
        createdAt: stockCounts.createdAt,
        systemQuantity: stockCounts.systemQuantity,
        physicalQuantity: stockCounts.physicalQuantity,
        varianceQuantity: stockCounts.varianceQuantity,
        varianceValue: stockCounts.varianceValue,
        countStatus: stockCounts.countStatus,
        stockTakeNumber: stockTakes.stockTakeNumber,
        stockTakeName: stockTakes.name,
        locationCode: locations.locationCode,
        locationName: locations.locationName,
        countedBy: users.fullName,
      })
      .from(stockCounts)
      .leftJoin(stockTakes, eq(stockCounts.stockTakeId, stockTakes.id))
      .leftJoin(locations, eq(stockCounts.stockTakeLocationId, locations.id))
      .leftJoin(users, eq(stockCounts.userId, users.id))
      .where(eq(stockCounts.itemId, id))
      .orderBy(desc(stockCounts.createdAt))
      .limit(20);

    return NextResponse.json({ item, history: historyRows });
  } catch (error) {
    console.error("Item detail fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch item details" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "MANAGE_ITEMS")) {
      return NextResponse.json({ error: "Forbidden: You don't have permission to modify items" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const existingRows = await db.select().from(items).where(eq(items.id, id)).limit(1);
    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const previousItem = existingRows[0];

    const updated = await db
      .update(items)
      .set({
        itemName: body.itemName?.trim() || previousItem.itemName,
        eanCode: body.eanCode?.trim() || previousItem.eanCode,
        sku: body.sku !== undefined ? body.sku : previousItem.sku,
        departmentId: body.departmentId !== undefined ? body.departmentId : previousItem.departmentId,
        categoryId: body.categoryId !== undefined ? body.categoryId : previousItem.categoryId,
        subcategoryId: body.subcategoryId !== undefined ? body.subcategoryId : previousItem.subcategoryId,
        supplierId: body.supplierId !== undefined ? body.supplierId : previousItem.supplierId,
        brand: body.brand !== undefined ? body.brand : previousItem.brand,
        uom: body.uom || previousItem.uom,
        packSize: body.packSize || previousItem.packSize,
        costPrice: body.costPrice !== undefined ? String(body.costPrice) : previousItem.costPrice,
        sellingPrice: body.sellingPrice !== undefined ? String(body.sellingPrice) : previousItem.sellingPrice,
        taxRate: body.taxRate !== undefined ? String(body.taxRate) : previousItem.taxRate,
        reorderLevel: body.reorderLevel !== undefined ? Number(body.reorderLevel) : previousItem.reorderLevel,
        minStock: body.minStock !== undefined ? Number(body.minStock) : previousItem.minStock,
        maxStock: body.maxStock !== undefined ? Number(body.maxStock) : previousItem.maxStock,
        currentSystemStock:
          body.currentSystemStock !== undefined ? Number(body.currentSystemStock) : previousItem.currentSystemStock,
        defaultLocationId:
          body.defaultLocationId !== undefined ? body.defaultLocationId : previousItem.defaultLocationId,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : previousItem.isActive,
        updatedAt: new Date(),
      })
      .where(eq(items.id, id))
      .returning();

    const newItem = updated[0];

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "ITEM_UPDATE",
      entityType: "ITEM",
      entityId: id,
      previousValue: previousItem,
      newValue: newItem,
      reason: body.changeReason || "Item details updated by administrator",
    });

    return NextResponse.json({ success: true, item: newItem });
  } catch (error) {
    console.error("Item update error:", error);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

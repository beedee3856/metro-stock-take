import { NextResponse } from "next/server";
import { db } from "@/db";
import { items, stockCounts } from "@/db/schema";
import { eq, or, and, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const barcode = searchParams.get("barcode")?.trim();
    const stockTakeLocationId = searchParams.get("stockTakeLocationId")?.trim();

    if (!barcode) {
      return NextResponse.json({ error: "Barcode/EAN code is required" }, { status: 400 });
    }

    // Search item by eanCode, itemCode, or sku
    const itemRows = await db
      .select()
      .from(items)
      .where(
        and(
          eq(items.isActive, true),
          or(
            eq(items.eanCode, barcode),
            eq(items.itemCode, barcode),
            eq(items.sku, barcode)
          )
        )
      )
      .limit(1);

    if (itemRows.length === 0) {
      return NextResponse.json(
        {
          found: false,
          error: "Barcode not found in Items & Barcodes. Upload or add this product before scanning it.",
        },
        { status: 404 }
      );
    }

    const item = itemRows[0];

    // Check if duplicate count exists in current location
    let existingCount = null;
    if (stockTakeLocationId) {
      const counts = await db
        .select()
        .from(stockCounts)
        .where(
          and(
            eq(stockCounts.stockTakeLocationId, stockTakeLocationId),
            eq(stockCounts.itemId, item.id)
          )
        )
        .orderBy(desc(stockCounts.createdAt))
        .limit(1);

      if (counts.length > 0) {
        existingCount = counts[0];
      }
    }

    return NextResponse.json({
      found: true,
      item,
      alreadyCounted: !!existingCount,
      existingCount,
    });
  } catch (error) {
    console.error("Barcode lookup error:", error);
    return NextResponse.json({ error: "Internal server error during barcode lookup" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { db } from "@/db";
import { items, stockCounts } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

// Simple in-memory cache for barcode lookups (TTL: 5 minutes)
const barcodeCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedBarcode(barcode: string) {
  const cached = barcodeCache.get(barcode.toLowerCase());
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  barcodeCache.delete(barcode.toLowerCase());
  return null;
}

function setCachedBarcode(barcode: string, data: any) {
  // Limit cache size to 10,000 items to prevent memory bloat
  if (barcodeCache.size > 10000) {
    const keysIterator = barcodeCache.keys();
    const firstKey = keysIterator.next().value;
    if (firstKey) {
      barcodeCache.delete(firstKey);
    }
  }
  barcodeCache.set(barcode.toLowerCase(), { data, timestamp: Date.now() });
}

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

    // Check cache first
    const cachedResult = getCachedBarcode(barcode);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }

    const barcodeUpper = barcode.toUpperCase();
    
    // Ultra-fast optimized query: use OR with fast index lookups
    // Database will use indexes on (isActive, eanCode), (isActive, itemCode), (isActive, sku)
    let itemRows: any[];
    try {
      itemRows = await Promise.race([
        db
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
            currentSystemStock: items.currentSystemStock,
          })
          .from(items)
          .where(
            and(
              eq(items.isActive, true),
              sql`(${items.eanCode} = ${barcodeUpper} OR ${items.itemCode} = ${barcodeUpper} OR ${items.sku} = ${barcodeUpper})`
            )
          )
          .limit(1),
        new Promise<any[]>((_, reject) =>
          setTimeout(() => reject(new Error("Lookup timeout")), 3000) // 3 second timeout
        ),
      ]);
    } catch (err) {
      return NextResponse.json(
        {
          found: false,
          error: "Barcode lookup timed out. Please try again.",
        },
        { status: 408 }
      );
    }

    if (itemRows.length === 0) {
      const errorResponse = {
        found: false,
        error: "Barcode not found in Items & Barcodes. Upload or add this product before scanning it.",
      };
      setCachedBarcode(barcode, errorResponse);
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const item = itemRows[0];

    // Check if duplicate count exists in current location (with timeout)
    let existingCount = null;
    if (stockTakeLocationId) {
      try {
        const counts = await Promise.race([
          db
            .select({
              id: stockCounts.id,
              physicalQuantity: stockCounts.physicalQuantity,
              countStatus: stockCounts.countStatus,
              createdAt: stockCounts.createdAt,
            })
            .from(stockCounts)
            .where(
              and(
                eq(stockCounts.stockTakeLocationId, stockTakeLocationId),
                eq(stockCounts.itemId, item.id)
              )
            )
            .orderBy(desc(stockCounts.createdAt))
            .limit(1),
          new Promise<any[]>((_, reject) =>
            setTimeout(() => reject(new Error("Count check timeout")), 2000)
          ),
        ]);

        if (counts && counts.length > 0) {
          existingCount = counts[0];
        }
      } catch (err) {
        // If duplicate check times out, continue without it
        console.warn("Stock count check timeout, continuing...");
      }
    }

    const successResponse = {
      found: true,
      item,
      alreadyCounted: !!existingCount,
      existingCount,
    };

    // Cache success response for faster subsequent lookups
    setCachedBarcode(barcode, successResponse);

    return NextResponse.json(successResponse);
  } catch (error) {
    console.error("Barcode lookup error:", error);
    return NextResponse.json({ error: "Internal server error during barcode lookup" }, { status: 500 });
  }
}

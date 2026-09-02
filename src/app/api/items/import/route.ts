import { NextResponse } from "next/server";
import { db } from "@/db";
import { items, importBatches } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

interface ImportRow {
  rowIndex: number;
  itemName?: string;
  itemCode?: string;
  eanCode?: string;
  sku?: string;
  department?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  uom?: string;
  packSize?: string;
  costPrice?: string | number;
  sellingPrice?: string | number;
  tax?: string | number;
  reorderLevel?: string | number;
  supplier?: string;
  openingStock?: string | number;
  errors?: string[];
  status?: "VALID" | "INVALID" | "DUPLICATE";
}

// Batch size for database operations to prevent memory issues
const BATCH_SIZE = 1000;
const MAX_VALIDATION_BATCH = 5000;

async function validateRows(rows: any[]): Promise<{
  validatedRows: ImportRow[];
  validList: ImportRow[];
  invalidList: ImportRow[];
  duplicateList: ImportRow[];
}> {
  // Fast duplicate check: only fetch codes that are in this batch to save memory
  const codesToCheck = new Set<string>();
  const eansToCheck = new Set<string>();

  for (const r of rows) {
    const itemCode = String(r.itemCode || r["Item Code"] || "").trim();
    const eanCode = String(r.eanCode || r["EAN Code"] || r.EAN || "").trim();
    if (itemCode) codesToCheck.add(itemCode.toLowerCase());
    if (eanCode) eansToCheck.add(eanCode.toLowerCase());
  }

  // Fetch only the codes we're importing (not all items!)
  const existingItems =
    codesToCheck.size > 0
      ? await db
          .select({ itemCode: items.itemCode, eanCode: items.eanCode })
          .from(items)
          .where(inArray(items.itemCode, Array.from(codesToCheck)))
      : [];

  const existingEanItems =
    eansToCheck.size > 0
      ? await db
          .select({ eanCode: items.eanCode })
          .from(items)
          .where(inArray(items.eanCode, Array.from(eansToCheck)))
      : [];

  const existingCodeSet = new Set(existingItems.map((i) => i.itemCode.toLowerCase()));
  const existingEanSet = new Set(existingEanItems.map((i) => i.eanCode.toLowerCase()));

  const seenCodesInBatch = new Set<string>();
  const seenEansInBatch = new Set<string>();

  const validatedRows: ImportRow[] = [];
  const validList: ImportRow[] = [];
  const invalidList: ImportRow[] = [];
  const duplicateList: ImportRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const errors: string[] = [];
    const rowIndex = i + 1;

    const itemName = String(r.itemName || r["Item Name"] || "").trim();
    const itemCode = String(r.itemCode || r["Item Code"] || "").trim();
    const eanCode = String(r.eanCode || r["EAN Code"] || r.EAN || "").trim();
    const sku = String(r.sku || r.SKU || "").trim();
    const brand = String(r.brand || r.Brand || "").trim();
    const uom = String(r.uom || r["Unit of Measure"] || "PCS").trim();
    const packSize = String(r.packSize || r["Pack Size"] || "1").trim();
    const costPriceVal = r.costPrice ?? r["Cost Price"] ?? 0;
    const sellingPriceVal = r.sellingPrice ?? r["Selling Price"] ?? 0;
    const taxVal = r.tax ?? r.Tax ?? 16;
    const reorderVal = r.reorderLevel ?? r["Reorder Level"] ?? 10;
    const openingStockVal = r.openingStock ?? r["Opening Stock"] ?? 0;

    // Required field checks
    if (!itemName) errors.push("Missing Item Name");
    if (!itemCode) errors.push("Missing Item Code");
    if (!eanCode) errors.push("Missing EAN Code");

    // Number checks
    const numCost = parseFloat(String(costPriceVal));
    if (isNaN(numCost) || numCost < 0) errors.push("Invalid Cost Price: must be a non-negative number");

    const numSelling = parseFloat(String(sellingPriceVal));
    if (isNaN(numSelling) || numSelling < 0) errors.push("Invalid Selling Price: must be a non-negative number");

    const numTax = parseFloat(String(taxVal));
    if (isNaN(numTax) || numTax < 0 || numTax > 100) errors.push("Invalid Tax: must be between 0 and 100%");

    const numOpeningStock = parseInt(String(openingStockVal), 10);
    if (isNaN(numOpeningStock) || numOpeningStock < 0) errors.push("Invalid Opening Stock: must be a positive integer");

    // Batch duplicate checks
    const codeLower = itemCode.toLowerCase();
    const eanLower = eanCode.toLowerCase();

    let isDuplicateInFile = false;
    if (itemCode && seenCodesInBatch.has(codeLower)) {
      errors.push(`Duplicate Item Code '${itemCode}' within this file`);
      isDuplicateInFile = true;
    }
    if (itemCode) seenCodesInBatch.add(codeLower);

    if (eanCode && seenEansInBatch.has(eanLower)) {
      errors.push(`Duplicate EAN Code '${eanCode}' within this file`);
      isDuplicateInFile = true;
    }
    if (eanCode) seenEansInBatch.add(eanLower);

    // Existing DB duplicate checks
    const existsInDb = existingCodeSet.has(codeLower) || existingEanSet.has(eanLower);

    let status: "VALID" | "INVALID" | "DUPLICATE" = "VALID";

    if (errors.length > 0) {
      status = isDuplicateInFile ? "DUPLICATE" : "INVALID";
    } else if (existsInDb) {
      status = "DUPLICATE";
    }

    const processedRow: ImportRow = {
      rowIndex,
      itemName,
      itemCode,
      eanCode,
      sku: sku || undefined,
      brand: brand || undefined,
      uom,
      packSize,
      costPrice: isNaN(numCost) ? "0.00" : numCost.toFixed(2),
      sellingPrice: isNaN(numSelling) ? "0.00" : numSelling.toFixed(2),
      tax: isNaN(numTax) ? "16.00" : numTax.toFixed(2),
      reorderLevel: isNaN(parseInt(String(reorderVal))) ? 10 : parseInt(String(reorderVal)),
      openingStock: isNaN(numOpeningStock) ? 0 : numOpeningStock,
      errors,
      status,
    };

    validatedRows.push(processedRow);
    if (status === "VALID") validList.push(processedRow);
    else if (status === "INVALID") invalidList.push(processedRow);
    else duplicateList.push(processedRow);
  }

  return { validatedRows, validList, invalidList, duplicateList };
}

async function commitImport(
  validatedRows: ImportRow[],
  updateExisting: boolean,
  existingCodeSet: Set<string>
): Promise<{ importedCount: number; updatedCount: number; rejectedCount: number }> {
  let importedCount = 0;
  let updatedCount = 0;
  let rejectedCount = 0;

  // Filter rows that can be inserted or updated
  const rowsToProcess = validatedRows.filter(
    (r) => r.status === "VALID" || (r.status === "DUPLICATE" && updateExisting && r.errors?.length === 0)
  );

  // Separate into inserts and updates
  const toInsert: typeof rowsToProcess = [];
  const toUpdate: typeof rowsToProcess = [];
  const toReject: typeof rowsToProcess = [];

  for (const r of rowsToProcess) {
    if (!r.itemCode || !r.eanCode || !r.itemName) {
      toReject.push(r);
      continue;
    }

    const isExisting = existingCodeSet.has(r.itemCode.toLowerCase());
    if (isExisting) {
      if (updateExisting) {
        toUpdate.push(r);
      } else {
        toReject.push(r);
      }
    } else {
      toInsert.push(r);
    }
  }

  rejectedCount = toReject.length;

  // BATCH INSERT in chunks (much faster than one-by-one)
  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const chunk = toInsert.slice(i, i + BATCH_SIZE);
      const values = chunk.map((r) => ({
        itemName: r.itemName!,
        itemCode: r.itemCode!,
        eanCode: r.eanCode!,
        sku: r.sku || null,
        brand: r.brand || null,
        uom: r.uom || "PCS",
        packSize: String(r.packSize || "1"),
        costPrice: String(r.costPrice),
        sellingPrice: String(r.sellingPrice),
        taxRate: String(r.tax),
        reorderLevel: Number(r.reorderLevel) || 10,
        currentSystemStock: Number(r.openingStock) || 0,
        isActive: true,
      }));

      await db.insert(items).values(values);
      importedCount += chunk.length;
    }
  }

  // BATCH UPDATE in chunks
  if (toUpdate.length > 0) {
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const chunk = toUpdate.slice(i, i + BATCH_SIZE);

      for (const r of chunk) {
        await db
          .update(items)
          .set({
            itemName: r.itemName,
            eanCode: r.eanCode,
            sku: r.sku,
            brand: r.brand,
            uom: r.uom || "PCS",
            packSize: String(r.packSize || "1"),
            costPrice: String(r.costPrice),
            sellingPrice: String(r.sellingPrice),
            taxRate: String(r.tax),
            reorderLevel: Number(r.reorderLevel) || 10,
            updatedAt: new Date(),
          })
          .where(eq(items.itemCode, r.itemCode!));
      }

      updatedCount += chunk.length;
    }
  }

  return { importedCount, updatedCount, rejectedCount };
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "IMPORT_ITEMS")) {
      return NextResponse.json({ error: "Forbidden: You don't have permission to import items" }, { status: 403 });
    }

    const body = await req.json();
    const { action, rows, fileName, updateExisting = true } = body;

    if (!action || (action !== "validate" && action !== "commit")) {
      return NextResponse.json({ error: "Invalid action. Expected 'validate' or 'commit'." }, { status: 400 });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided for import" }, { status: 400 });
    }

    // Check if file is too large for single request
    if (rows.length > 100000) {
      return NextResponse.json(
        { error: "File size exceeds maximum of 100,000 rows. Please split into multiple files." },
        { status: 413 }
      );
    }

    // Step 2 & 3: VALIDATION (process in chunks to avoid memory issues)
    let validatedRows: ImportRow[] = [];
    let validList: ImportRow[] = [];
    let invalidList: ImportRow[] = [];
    let duplicateList: ImportRow[] = [];

    for (let i = 0; i < rows.length; i += MAX_VALIDATION_BATCH) {
      const chunk = rows.slice(i, i + MAX_VALIDATION_BATCH);
      const result = await validateRows(chunk);
      validatedRows.push(...result.validatedRows);
      validList.push(...result.validList);
      invalidList.push(...result.invalidList);
      duplicateList.push(...result.duplicateList);
    }

    // If action is only validate, return preview report
    if (action === "validate") {
      return NextResponse.json({
        success: true,
        summary: {
          total: rows.length,
          validCount: validList.length,
          invalidCount: invalidList.length,
          duplicateCount: duplicateList.length,
        },
        validRows: validList.slice(0, 50),
        invalidRows: invalidList.slice(0, 100),
        duplicateRows: duplicateList.slice(0, 50),
      });
    }

    // Step 5: COMMIT TRANSACTION
    if (action === "commit") {
      // Pre-build the existing code set for fast lookup
      const codesInImport = new Set<string>();
      for (const r of validatedRows) {
        if (r.itemCode) {
          codesInImport.add(r.itemCode.toLowerCase());
        }
      }

      // Only fetch existing items that are in this import
      const existingItems =
        codesInImport.size > 0
          ? await db
              .select({ itemCode: items.itemCode })
              .from(items)
              .where(inArray(items.itemCode, Array.from(codesInImport)))
          : [];

      const existingCodeSet = new Set(existingItems.map((i) => i.itemCode.toLowerCase()));

      const { importedCount, updatedCount, rejectedCount: finalRejectedCount } = await commitImport(
        validatedRows,
        updateExisting,
        existingCodeSet
      );

      const totalRejected = invalidList.length + finalRejectedCount;

      // Record Import Batch
      const batch = await db
        .insert(importBatches)
        .values({
          fileName: fileName || "item_master_import.xlsx",
          importedBy: user.id,
          totalRows: rows.length,
          successfulRows: importedCount,
          updatedRows: updatedCount,
          failedRows: totalRejected,
          status: "COMPLETED",
          errorDetails: invalidList.length > 0 ? JSON.stringify(invalidList.slice(0, 100)) : null,
        })
        .returning();

      // Audit Log
      await logAudit({
        userId: user.id,
        userName: user.fullName,
        userRole: user.role,
        action: "ITEM_IMPORT",
        entityType: "IMPORT_BATCH",
        entityId: batch[0]?.id,
        newValue: {
          file: fileName,
          total: rows.length,
          imported: importedCount,
          updated: updatedCount,
          rejected: totalRejected,
        },
        reason: "Item Master imported via multi-step wizard",
      });

      return NextResponse.json({
        success: true,
        batchId: batch[0]?.id,
        summary: {
          total: rows.length,
          imported: importedCount,
          updated: updatedCount,
          rejected: totalRejected,
        },
        errors: invalidList.slice(0, 100),
      });
    }
  } catch (error) {
    console.error("Import processing error:", error);
    return NextResponse.json(
      {
        error:
          "Failed to process import. " + (error instanceof Error ? error.message : "Unknown error"),
      },
      { status: 500 }
    );
  }
}

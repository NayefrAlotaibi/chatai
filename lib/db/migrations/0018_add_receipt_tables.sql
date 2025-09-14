-- Migration for receipt processing tables
-- Run: tsx lib/db/migrate.ts

-- Table for storing receipt metadata
CREATE TABLE IF NOT EXISTS "Receipt" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "merchantName" TEXT NOT NULL,
  "merchantAddress" TEXT,
  "receiptDate" DATE NOT NULL,
  "receiptTime" TIME,
  "receiptNumber" TEXT,
  "subtotal" DECIMAL(10,2),
  "tax" DECIMAL(10,2),
  "tip" DECIMAL(10,2),
  "total" DECIMAL(10,2) NOT NULL,
  "paymentMethod" TEXT,
  "currency" TEXT DEFAULT 'USD',
  "imageUrl" TEXT,
  "originalImageUrl" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table for storing individual receipt items
CREATE TABLE IF NOT EXISTS "ReceiptItem" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "receiptId" UUID NOT NULL REFERENCES "Receipt"(id) ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "quantity" INTEGER DEFAULT 1,
  "unitPrice" DECIMAL(10,2),
  "totalPrice" DECIMAL(10,2) NOT NULL,
  "category" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "Receipt_userId_idx" ON "Receipt"("userId");
CREATE INDEX IF NOT EXISTS "Receipt_receiptDate_idx" ON "Receipt"("receiptDate");
CREATE INDEX IF NOT EXISTS "Receipt_merchantName_idx" ON "Receipt"("merchantName");
CREATE INDEX IF NOT EXISTS "ReceiptItem_receiptId_idx" ON "ReceiptItem"("receiptId");
CREATE INDEX IF NOT EXISTS "ReceiptItem_category_idx" ON "ReceiptItem"("category");

-- Add updated_at trigger for Receipt table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_receipt_updated_at 
    BEFORE UPDATE ON "Receipt" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

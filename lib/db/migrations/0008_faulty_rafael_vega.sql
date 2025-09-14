CREATE TABLE IF NOT EXISTS "Receipt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"merchantName" text NOT NULL,
	"merchantAddress" text,
	"receiptDate" date NOT NULL,
	"receiptTime" time,
	"receiptNumber" text,
	"subtotal" numeric(10, 2),
	"tax" numeric(10, 2),
	"tip" numeric(10, 2),
	"total" numeric(10, 2) NOT NULL,
	"paymentMethod" text,
	"currency" text DEFAULT 'USD',
	"imageUrl" text,
	"originalImageUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ReceiptItem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receiptId" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" integer DEFAULT 1,
	"unitPrice" numeric(10, 2),
	"totalPrice" numeric(10, 2) NOT NULL,
	"category" text,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ReceiptItem" ADD CONSTRAINT "ReceiptItem_receiptId_Receipt_id_fk" FOREIGN KEY ("receiptId") REFERENCES "public"."Receipt"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Receipt_userId_idx" ON "Receipt" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Receipt_receiptDate_idx" ON "Receipt" USING btree ("receiptDate");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Receipt_merchantName_idx" ON "Receipt" USING btree ("merchantName");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ReceiptItem_receiptId_idx" ON "ReceiptItem" USING btree ("receiptId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ReceiptItem_category_idx" ON "ReceiptItem" USING btree ("category");
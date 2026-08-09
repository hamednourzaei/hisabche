CREATE TABLE "invoice_item_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_item_id" uuid NOT NULL,
	"title" text NOT NULL,
	"quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"unit" text DEFAULT 'piece' NOT NULL,
	"weight_grams" numeric(12, 3),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "unit" text DEFAULT 'piece' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "weight_grams" numeric(12, 3);--> statement-breakpoint
ALTER TABLE "invoice_item_details" ADD CONSTRAINT "invoice_item_details_invoice_item_id_invoice_items_id_fk" FOREIGN KEY ("invoice_item_id") REFERENCES "public"."invoice_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_item_details_item_idx" ON "invoice_item_details" USING btree ("invoice_item_id");--> statement-breakpoint
CREATE INDEX "invoice_item_details_order_idx" ON "invoice_item_details" USING btree ("invoice_item_id","sort_order");
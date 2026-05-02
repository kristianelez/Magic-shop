ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'komercijalista';--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "sales_person_id" varchar;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "barcode" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "promo_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "promo_start_date" timestamp;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "promo_end_date" timestamp;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "promo_note" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "discount" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_sales_person_id_users_id_fk" FOREIGN KEY ("sales_person_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
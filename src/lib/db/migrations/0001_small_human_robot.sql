ALTER TABLE "vendors" ADD COLUMN "cac_certificate_url" varchar(500);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "bank_statement_url" varchar(500);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "nin_card_url" varchar(500);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "nin_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "bank_account_verified_at" timestamp;
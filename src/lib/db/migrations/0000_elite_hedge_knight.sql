CREATE TYPE "public"."auction_status" AS ENUM('scheduled', 'active', 'extended', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('draft', 'pending_approval', 'approved', 'active_auction', 'sold', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."damage_severity" AS ENUM('minor', 'moderate', 'severe');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('credit', 'debit', 'freeze', 'unfreeze');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('mobile', 'desktop', 'tablet');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('vendor', 'claims_adjuster', 'salvage_manager', 'finance_officer', 'system_admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('unverified_tier_0', 'phone_verified_tier_0', 'verified_tier_1', 'verified_tier_2', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('vehicle', 'property', 'electronics');--> statement-breakpoint
CREATE TYPE "public"."vendor_status" AS ENUM('pending', 'approved', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."vendor_tier" AS ENUM('tier1_bvn', 'tier2_full');--> statement-breakpoint
CREATE TYPE "public"."escrow_status" AS ENUM('none', 'frozen', 'released');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('paystack', 'flutterwave', 'bank_transfer', 'escrow_wallet');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'verified', 'rejected', 'overdue');--> statement-breakpoint
CREATE TABLE "auctions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"original_end_time" timestamp NOT NULL,
	"extension_count" integer DEFAULT 0 NOT NULL,
	"current_bid" numeric(12, 2),
	"current_bidder" uuid,
	"minimum_increment" numeric(12, 2) DEFAULT '10000.00' NOT NULL,
	"status" "auction_status" DEFAULT 'scheduled' NOT NULL,
	"watching_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action_type" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"device_type" "device_type" NOT NULL,
	"user_agent" varchar(500) NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"otp_verified" boolean DEFAULT false NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"device_type" "device_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salvage_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_reference" varchar(100) NOT NULL,
	"asset_type" "asset_type" NOT NULL,
	"asset_details" jsonb NOT NULL,
	"market_value" numeric(12, 2) NOT NULL,
	"estimated_salvage_value" numeric(12, 2) NOT NULL,
	"reserve_price" numeric(12, 2) NOT NULL,
	"damage_severity" "damage_severity" NOT NULL,
	"ai_assessment" jsonb NOT NULL,
	"gps_location" "point" NOT NULL,
	"location_name" varchar(255) NOT NULL,
	"photos" varchar[] NOT NULL,
	"voice_notes" varchar[],
	"status" "case_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	CONSTRAINT "salvage_cases_claim_reference_unique" UNIQUE("claim_reference")
);
--> statement-breakpoint
CREATE TABLE "escrow_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"frozen_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"available_balance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "escrow_wallets_vendor_id_unique" UNIQUE("vendor_id")
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"balance_after" numeric(12, 2) NOT NULL,
	"reference" varchar(255) NOT NULL,
	"description" varchar(500) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"status" "user_status" DEFAULT 'unverified_tier_0' NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"date_of_birth" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	"login_device_type" "device_type",
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"business_name" varchar(255),
	"tier" "vendor_tier" DEFAULT 'tier1_bvn' NOT NULL,
	"bvn_encrypted" varchar(255),
	"bvn_verified_at" timestamp,
	"cac_number" varchar(50),
	"tin" varchar(50),
	"bank_account_number" varchar(20),
	"bank_name" varchar(100),
	"bank_account_name" varchar(255),
	"categories" "asset_type"[],
	"status" "vendor_status" DEFAULT 'pending' NOT NULL,
	"performance_stats" jsonb DEFAULT '{"totalBids":0,"totalWins":0,"winRate":0,"avgPaymentTimeHours":0,"onTimePickupRate":0,"fraudFlags":0}'::jsonb NOT NULL,
	"rating" numeric(3, 2) DEFAULT '0.00' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"payment_reference" varchar(255),
	"payment_proof_url" varchar(500),
	"escrow_status" "escrow_status" DEFAULT 'none' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp,
	"auto_verified" boolean DEFAULT false NOT NULL,
	"payment_deadline" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_case_id_salvage_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."salvage_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_current_bidder_vendors_id_fk" FOREIGN KEY ("current_bidder") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salvage_cases" ADD CONSTRAINT "salvage_cases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salvage_cases" ADD CONSTRAINT "salvage_cases_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_wallets" ADD CONSTRAINT "escrow_wallets_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_escrow_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."escrow_wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

--> statement-breakpoint
-- Indexes for users table
CREATE INDEX "idx_users_email" ON "users"("email");--> statement-breakpoint
CREATE INDEX "idx_users_phone" ON "users"("phone");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users"("role");--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "users"("status");--> statement-breakpoint

-- Indexes for vendors table
CREATE INDEX "idx_vendors_user_id" ON "vendors"("user_id");--> statement-breakpoint
CREATE INDEX "idx_vendors_tier" ON "vendors"("tier");--> statement-breakpoint
CREATE INDEX "idx_vendors_status" ON "vendors"("status");--> statement-breakpoint
CREATE INDEX "idx_vendors_rating" ON "vendors"("rating" DESC);--> statement-breakpoint

-- Indexes for salvage_cases table
CREATE INDEX "idx_cases_claim_reference" ON "salvage_cases"("claim_reference");--> statement-breakpoint
CREATE INDEX "idx_cases_status" ON "salvage_cases"("status");--> statement-breakpoint
CREATE INDEX "idx_cases_created_by" ON "salvage_cases"("created_by");--> statement-breakpoint
CREATE INDEX "idx_cases_asset_type" ON "salvage_cases"("asset_type");--> statement-breakpoint
CREATE INDEX "idx_cases_created_at" ON "salvage_cases"("created_at" DESC);--> statement-breakpoint

-- Indexes for auctions table
CREATE INDEX "idx_auctions_case_id" ON "auctions"("case_id");--> statement-breakpoint
CREATE INDEX "idx_auctions_status" ON "auctions"("status");--> statement-breakpoint
CREATE INDEX "idx_auctions_end_time" ON "auctions"("end_time");--> statement-breakpoint
CREATE INDEX "idx_auctions_status_end_time" ON "auctions"("status", "end_time") WHERE "status" = 'active';--> statement-breakpoint

-- Indexes for bids table
CREATE INDEX "idx_bids_auction_id" ON "bids"("auction_id");--> statement-breakpoint
CREATE INDEX "idx_bids_vendor_id" ON "bids"("vendor_id");--> statement-breakpoint
CREATE INDEX "idx_bids_created_at" ON "bids"("created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_bids_auction_amount" ON "bids"("auction_id", "amount" DESC);--> statement-breakpoint

-- Indexes for payments table
CREATE INDEX "idx_payments_auction_id" ON "payments"("auction_id");--> statement-breakpoint
CREATE INDEX "idx_payments_vendor_id" ON "payments"("vendor_id");--> statement-breakpoint
CREATE INDEX "idx_payments_status" ON "payments"("status");--> statement-breakpoint
CREATE INDEX "idx_payments_payment_deadline" ON "payments"("payment_deadline");--> statement-breakpoint
CREATE INDEX "idx_payments_payment_reference" ON "payments"("payment_reference");--> statement-breakpoint

-- Indexes for escrow_wallets table
CREATE INDEX "idx_escrow_wallets_vendor_id" ON "escrow_wallets"("vendor_id");--> statement-breakpoint

-- Indexes for wallet_transactions table
CREATE INDEX "idx_wallet_transactions_wallet_id" ON "wallet_transactions"("wallet_id");--> statement-breakpoint
CREATE INDEX "idx_wallet_transactions_created_at" ON "wallet_transactions"("created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_wallet_transactions_reference" ON "wallet_transactions"("reference");--> statement-breakpoint

-- Indexes for audit_logs table
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs"("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action_type" ON "audit_logs"("action_type");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity_type" ON "audit_logs"("entity_type");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity_id" ON "audit_logs"("entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs"("created_at" DESC);

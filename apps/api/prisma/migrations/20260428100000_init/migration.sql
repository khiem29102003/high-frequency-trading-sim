-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$ BEGIN
  CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrderType" AS ENUM ('LIMIT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tables
CREATE TABLE IF NOT EXISTS "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "accounts" (
  "user_id" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "available_cash" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "reserved_cash" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accounts_cash_nonnegative" CHECK ("available_cash" >= 0 AND "reserved_cash" >= 0)
);

CREATE TABLE IF NOT EXISTS "assets" (
  "symbol" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "price_decimals" INTEGER NOT NULL,
  "qty_decimals" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS "holdings" (
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "symbol" TEXT NOT NULL REFERENCES "assets"("symbol") ON DELETE RESTRICT,
  "available_qty" DECIMAL(18,8) NOT NULL DEFAULT 0,
  "reserved_qty" DECIMAL(18,8) NOT NULL DEFAULT 0,
  "avg_cost" DECIMAL(18,8) NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("user_id", "symbol"),
  CONSTRAINT "holdings_qty_nonnegative" CHECK ("available_qty" >= 0 AND "reserved_qty" >= 0)
);

CREATE TABLE IF NOT EXISTS "orders" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "symbol" TEXT NOT NULL REFERENCES "assets"("symbol") ON DELETE RESTRICT,
  "side" "OrderSide" NOT NULL,
  "type" "OrderType" NOT NULL,
  "limit_price" DECIMAL(18,8) NOT NULL,
  "qty" DECIMAL(18,8) NOT NULL,
  "remaining_qty" DECIMAL(18,8) NOT NULL,
  "status" "OrderStatus" NOT NULL,
  "reserved_cash" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "reserved_qty" DECIMAL(18,8) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "order_fills" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "symbol" TEXT NOT NULL,
  "price" DECIMAL(18,8) NOT NULL,
  "qty" DECIMAL(18,8) NOT NULL,
  "maker_order_id" UUID NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT,
  "taker_order_id" UUID NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT,
  "maker_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "taker_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "executed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "market_ticks" (
  "id" BIGSERIAL PRIMARY KEY,
  "symbol" TEXT NOT NULL,
  "price" DECIMAL(18,8) NOT NULL,
  "ts" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "ticks_symbol_ts_uniq" UNIQUE ("symbol", "ts")
);

CREATE TABLE IF NOT EXISTS "outbox_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "topic" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMPTZ(6) NULL
);

CREATE TABLE IF NOT EXISTS "portfolio_snapshots" (
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "ts" TIMESTAMPTZ(6) NOT NULL,
  "equity" DECIMAL(18,2) NOT NULL,
  "cash" DECIMAL(18,2) NOT NULL,
  PRIMARY KEY ("user_id", "ts")
);

CREATE TABLE IF NOT EXISTS "leaderboard_cache" (
  "user_id" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "profit" DECIMAL(18,2) NOT NULL,
  "equity" DECIMAL(18,2) NOT NULL,
  "rank" INTEGER NOT NULL,
  "as_of" TIMESTAMPTZ(6) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS "orders_book_idx"
  ON "orders" ("symbol", "side", "status", "limit_price", "created_at");

CREATE INDEX IF NOT EXISTS "orders_user_idx"
  ON "orders" ("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "fills_maker_user_idx"
  ON "order_fills" ("maker_user_id", "executed_at" DESC);

CREATE INDEX IF NOT EXISTS "fills_taker_user_idx"
  ON "order_fills" ("taker_user_id", "executed_at" DESC);

CREATE INDEX IF NOT EXISTS "fills_symbol_idx"
  ON "order_fills" ("symbol", "executed_at" DESC);

CREATE INDEX IF NOT EXISTS "ticks_symbol_ts_idx"
  ON "market_ticks" ("symbol", "ts" DESC);

CREATE INDEX IF NOT EXISTS "outbox_publish_idx"
  ON "outbox_events" ("published_at", "created_at");

CREATE INDEX IF NOT EXISTS "leaderboard_rank_idx"
  ON "leaderboard_cache" ("rank");

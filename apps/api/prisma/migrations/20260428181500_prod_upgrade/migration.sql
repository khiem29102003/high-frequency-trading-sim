DO $$ BEGIN
  CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "accounts"
  ALTER COLUMN "available_cash" TYPE DECIMAL(20,8),
  ALTER COLUMN "reserved_cash" TYPE DECIMAL(20,8);

ALTER TABLE "holdings"
  ALTER COLUMN "available_qty" TYPE DECIMAL(20,8),
  ALTER COLUMN "reserved_qty" TYPE DECIMAL(20,8),
  ALTER COLUMN "avg_cost" TYPE DECIMAL(20,8);

ALTER TABLE "holdings"
  ADD COLUMN IF NOT EXISTS "realized_pnl" DECIMAL(20,8) NOT NULL DEFAULT 0;

ALTER TABLE "orders"
  ALTER COLUMN "limit_price" TYPE DECIMAL(20,8),
  ALTER COLUMN "qty" TYPE DECIMAL(20,8),
  ALTER COLUMN "remaining_qty" TYPE DECIMAL(20,8),
  ALTER COLUMN "reserved_cash" TYPE DECIMAL(20,8),
  ALTER COLUMN "reserved_qty" TYPE DECIMAL(20,8);

ALTER TABLE "order_fills"
  ALTER COLUMN "price" TYPE DECIMAL(20,8),
  ALTER COLUMN "qty" TYPE DECIMAL(20,8);

ALTER TABLE "market_ticks"
  ALTER COLUMN "price" TYPE DECIMAL(20,8);

ALTER TABLE "portfolio_snapshots"
  ALTER COLUMN "equity" TYPE DECIMAL(20,8),
  ALTER COLUMN "cash" TYPE DECIMAL(20,8);

ALTER TABLE "leaderboard_cache"
  ALTER COLUMN "profit" TYPE DECIMAL(20,8),
  ALTER COLUMN "equity" TYPE DECIMAL(20,8);

CREATE TABLE IF NOT EXISTS "idempotency_keys" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "idempotency_key" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "status" "IdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "request_hash" TEXT NOT NULL,
  "response_status" INTEGER NULL,
  "response_body" JSONB NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_user_key_action_uniq"
  ON "idempotency_keys" ("user_id", "idempotency_key", "action");

CREATE INDEX IF NOT EXISTS "idempotency_expiry_idx"
  ON "idempotency_keys" ("expires_at");

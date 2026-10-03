-- CreateEnum
CREATE TYPE "PageSubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "page_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "artist_id" TEXT NOT NULL,
    "monthly_amount" INTEGER NOT NULL DEFAULT 2500,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "status" "PageSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "current_period_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "download_royalties" (
    "id" TEXT NOT NULL,
    "download_id" TEXT NOT NULL,
    "artist_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "download_royalties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_subscriptions_artist_id_status_idx" ON "page_subscriptions"("artist_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "page_subscriptions_user_id_artist_id_key" ON "page_subscriptions"("user_id", "artist_id");

-- CreateIndex
CREATE INDEX "download_royalties_artist_id_period_start_idx" ON "download_royalties"("artist_id", "period_start");

-- CreateIndex
CREATE INDEX "download_royalties_user_id_idx" ON "download_royalties"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "download_royalties_download_id_period_start_key" ON "download_royalties"("download_id", "period_start");

-- AddForeignKey
ALTER TABLE "page_subscriptions" ADD CONSTRAINT "page_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_subscriptions" ADD CONSTRAINT "page_subscriptions_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_royalties" ADD CONSTRAINT "download_royalties_download_id_fkey" FOREIGN KEY ("download_id") REFERENCES "downloads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_royalties" ADD CONSTRAINT "download_royalties_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_royalties" ADD CONSTRAINT "download_royalties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


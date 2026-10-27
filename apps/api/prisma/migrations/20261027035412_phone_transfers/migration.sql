-- CreateEnum
CREATE TYPE "MobileMoneyProvider" AS ENUM ('ORANGE_MONEY', 'MTN_MONEY');

-- AlterEnum
ALTER TYPE "WalletTransactionType" ADD VALUE 'PHONE_TRANSFER';

-- DropIndex
DROP INDEX "messages_content_trgm_idx";

-- DropIndex
DROP INDEX "user_follows_following_id_idx";

-- DropIndex
DROP INDEX "users_name_trgm_idx";

-- AlterTable
ALTER TABLE "wallet_transactions" ADD COLUMN     "phone_number" TEXT,
ADD COLUMN     "provider" "MobileMoneyProvider";

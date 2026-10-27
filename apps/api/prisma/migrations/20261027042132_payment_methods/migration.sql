-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "MobileMoneyProvider" NOT NULL,
    "phone_number" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_methods_phone_number_idx" ON "payment_methods"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_user_id_provider_phone_number_key" ON "payment_methods"("user_id", "provider", "phone_number");

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

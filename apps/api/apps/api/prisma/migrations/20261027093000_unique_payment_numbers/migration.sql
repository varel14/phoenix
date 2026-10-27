-- A mobile money number is one owner: enforce global uniqueness (wallet address).
DROP INDEX IF EXISTS "payment_methods_user_id_provider_phone_number_key";
DROP INDEX IF EXISTS "payment_methods_phone_number_idx";
CREATE UNIQUE INDEX "payment_methods_phone_number_key" ON "payment_methods"("phone_number");

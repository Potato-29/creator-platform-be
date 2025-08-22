/*
  Warnings:

  - You are about to drop the column `emailVerificationToken` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."users_emailVerificationToken_key";

-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "emailVerificationToken";

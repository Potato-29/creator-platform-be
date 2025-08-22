-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('superAdmin', 'user', 'creator');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('male', 'female');

-- CreateEnum
CREATE TYPE "public"."CREATOR_ONBOARDING_STATUS" AS ENUM ('PENDING', 'CREATE_MERCHANT_PENDING', 'CREATE_MERCHANT_FAILED', 'CREATE_BANK_ACCOUNT_PENDING', 'CREATE_BANK_ACCOUNT_FAILED', 'BANK_VERIFICATION_PENDING', 'BANK_VERIFICATION_IN_PROGRESS', 'BANK_VERIFICATION_FAILED', 'IDENTITY_VERIFICATION_PENDING', 'IDENTITY_VERIFICATION_IN_PROGRESS', 'IDENTITY_VERIFICATION_FAILED', 'ADDITIONAL_REQUIREMENT_PENDING', 'ADDITIONAL_REQUIREMENT_IN_PROGRESS', 'ADDITIONAL_REQUIREMENT_FAILED', 'SUCCESS');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "public"."Gender" NOT NULL,
    "password" TEXT NOT NULL,
    "profilePic" TEXT,
    "bannerImage" TEXT,
    "role" "public"."Role" NOT NULL DEFAULT 'user',
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "merchantUid" TEXT,
    "cocNr" TEXT,
    "bankAccountUid" TEXT,
    "overviewUrl" TEXT,
    "oppVerification" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "refreshToken" TEXT,
    "refreshTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "onBoarding" "public"."CREATOR_ONBOARDING_STATUS",

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_userName_key" ON "public"."users"("userName");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_resetToken_key" ON "public"."users"("resetToken");

-- CreateIndex
CREATE UNIQUE INDEX "users_refreshToken_key" ON "public"."users"("refreshToken");

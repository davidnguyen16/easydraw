-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE');

-- DropForeignKey
ALTER TABLE "Diagram" DROP CONSTRAINT "Diagram_ownerId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_expiresAt_idx" ON "EmailVerificationToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Diagram_ownerId_updatedAt_idx" ON "Diagram"("ownerId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "Diagram_ownerId_type_idx" ON "Diagram"("ownerId", "type");

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagram" ADD CONSTRAINT "Diagram_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Hand-written below this line ────────────────────────────────────────

-- Existing users get an updatedAt equal to their createdAt rather than the
-- moment of this migration, so the column means what it says.
UPDATE "User" SET "updatedAt" = "createdAt";

-- Accounts created through Google had their address verified by Google.
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "googleId" IS NOT NULL;

-- Backfill linked Google accounts into OAuthAccount from the deprecated
-- User.googleId column. The column stays until auth.service reads this table.
INSERT INTO "OAuthAccount" ("id", "provider", "providerAccountId", "email", "userId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'GOOGLE', "googleId", "email", "id", "createdAt", "createdAt"
FROM "User"
WHERE "googleId" IS NOT NULL;

-- Carry any still-valid password reset request across to PasswordResetToken.
INSERT INTO "PasswordResetToken" ("id", "userId", "tokenHash", "expiresAt", "createdAt")
SELECT gen_random_uuid()::text, "id", "passwordResetTokenHash", "passwordResetExpiresAt", CURRENT_TIMESTAMP
FROM "User"
WHERE "passwordResetTokenHash" IS NOT NULL
  AND "passwordResetExpiresAt" IS NOT NULL
  AND "passwordResetExpiresAt" > CURRENT_TIMESTAMP;

-- The API validates these sets (CreateDiagramDto / UpdateDiagramDto); the
-- database enforces them too, so no code path can persist a value the
-- editor cannot open.
ALTER TABLE "Diagram"
  ADD CONSTRAINT "Diagram_type_check"
  CHECK ("type" IN ('erd', 'uml', 'flowchart', 'dfd', 'terrain'));
ALTER TABLE "Diagram"
  ADD CONSTRAINT "Diagram_status_check"
  CHECK ("status" IN ('draft', 'complete', 'archived'));

-- An active account must be reachable somehow: a password, or a linked
-- provider (checked at the application layer, since it spans two tables),
-- but never a verified-email timestamp before the account existed.
ALTER TABLE "User"
  ADD CONSTRAINT "User_emailVerifiedAt_check"
  CHECK ("emailVerifiedAt" IS NULL OR "emailVerifiedAt" >= "createdAt");

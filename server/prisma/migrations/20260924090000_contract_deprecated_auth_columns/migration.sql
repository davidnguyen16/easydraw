-- Contract step of expand → migrate → contract.
--
-- 20260917132414_auth_identity_and_indexes added OAuthAccount and
-- PasswordResetToken and backfilled them from these columns. auth.service now
-- reads those tables and nothing reads the columns, so they go.
--
-- Deploy order matters: this must run AFTER the code that stopped reading
-- them, or a running instance loses the only copy of a Google link.

-- Refuse to drop the column while any linked account is missing from
-- OAuthAccount. A backfill that silently did nothing would otherwise take
-- every Google sign-in with it, and there would be no way back.
DO $$
DECLARE
  unlinked integer;
BEGIN
  SELECT count(*) INTO unlinked
  FROM "User" u
  WHERE u."googleId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "OAuthAccount" o
      WHERE o."provider" = 'GOOGLE'
        AND o."providerAccountId" = u."googleId"
        AND o."userId" = u."id"
    );

  IF unlinked > 0 THEN
    RAISE EXCEPTION
      'Refusing to drop User.googleId: % account(s) were never backfilled into OAuthAccount',
      unlinked;
  END IF;
END $$;

-- Password reset links were only carried across while still valid. Anything
-- left here has expired, and an expired link is worth nothing.
ALTER TABLE "User"
  DROP COLUMN "googleId",
  DROP COLUMN "passwordResetTokenHash",
  DROP COLUMN "passwordResetExpiresAt";

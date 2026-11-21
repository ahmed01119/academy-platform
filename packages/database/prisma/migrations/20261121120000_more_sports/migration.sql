-- Academies of any sport (owner decision 2026-11-21). Additive only: new values on the SportCode enum, nothing removed
-- or changed, so existing football data is untouched. PostgreSQL cannot drop an enum value; to undo, stop offering a
-- sport in the application (packages/shared/src/constants/sports.ts) rather than removing it here.
ALTER TYPE "SportCode" ADD VALUE IF NOT EXISTS 'SWIMMING';
ALTER TYPE "SportCode" ADD VALUE IF NOT EXISTS 'TENNIS';
ALTER TYPE "SportCode" ADD VALUE IF NOT EXISTS 'PADEL';
ALTER TYPE "SportCode" ADD VALUE IF NOT EXISTS 'BASKETBALL';
ALTER TYPE "SportCode" ADD VALUE IF NOT EXISTS 'VOLLEYBALL';
ALTER TYPE "SportCode" ADD VALUE IF NOT EXISTS 'HANDBALL';
ALTER TYPE "SportCode" ADD VALUE IF NOT EXISTS 'MARTIAL_ARTS';
ALTER TYPE "SportCode" ADD VALUE IF NOT EXISTS 'GYMNASTICS';
ALTER TYPE "SportCode" ADD VALUE IF NOT EXISTS 'ATHLETICS';
ALTER TYPE "SportCode" ADD VALUE IF NOT EXISTS 'SQUASH';
ALTER TYPE "SportCode" ADD VALUE IF NOT EXISTS 'OTHER';

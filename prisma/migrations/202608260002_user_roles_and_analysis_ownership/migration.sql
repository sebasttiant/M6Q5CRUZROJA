CREATE TYPE "UserRole" AS ENUM ('SUPERADMIN', 'ADMIN', 'USER');

ALTER TABLE "AdminUser"
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

UPDATE "AdminUser"
SET "role" = 'SUPERADMIN';

ALTER TABLE "Analysis"
ADD COLUMN "creatorId" TEXT;

UPDATE "Analysis"
SET "creatorId" = (
  SELECT "id"
  FROM "AdminUser"
  ORDER BY "createdAt" ASC
  LIMIT 1
)
WHERE "creatorId" IS NULL;

ALTER TABLE "Analysis"
ADD CONSTRAINT "Analysis_creatorId_fkey"
FOREIGN KEY ("creatorId") REFERENCES "AdminUser"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Analysis_creatorId_idx" ON "Analysis"("creatorId");

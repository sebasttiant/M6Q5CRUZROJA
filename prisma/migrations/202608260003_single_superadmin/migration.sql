WITH ranked_superadmins AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS position
  FROM "AdminUser"
  WHERE "role" = 'SUPERADMIN'
)
UPDATE "AdminUser"
SET "role" = 'ADMIN'
WHERE "id" IN (
  SELECT "id" FROM ranked_superadmins WHERE position > 1
);

CREATE UNIQUE INDEX "AdminUser_single_superadmin_key"
ON "AdminUser" ("role")
WHERE "role" = 'SUPERADMIN';

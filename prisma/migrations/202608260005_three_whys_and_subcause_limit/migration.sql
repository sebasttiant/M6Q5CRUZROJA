-- The source format (AC-43!C53:G53) provides exactly three why columns per main cause.
-- Preserve any text already captured in the two removed columns by folding it into "why3"
-- instead of dropping it silently.
UPDATE "MainCause"
SET "why3" = concat_ws(
  E'\n',
  NULLIF(btrim("why3"), ''),
  NULLIF(btrim("why4"), ''),
  NULLIF(btrim("why5"), '')
)
WHERE NULLIF(btrim("why4"), '') IS NOT NULL
   OR NULLIF(btrim("why5"), '') IS NOT NULL;

ALTER TABLE "MainCause" DROP COLUMN "why4";
ALTER TABLE "MainCause" DROP COLUMN "why5";

-- AC-43!A30:A47 reserves exactly three subcause rows per 6M category. Enforce it in the
-- database so the limit does not depend on the application layer alone.
CREATE OR REPLACE FUNCTION enforce_subcause_limit() RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT count(*) FROM "Subcause" WHERE "assessmentId" = NEW."assessmentId") > 3 THEN
    RAISE EXCEPTION 'Cada categoría 6M admite máximo tres subcausas.';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "Subcause_max_three_per_assessment"
AFTER INSERT OR UPDATE ON "Subcause"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_subcause_limit();

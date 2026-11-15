-- Sprint 16 (sprint-16-domain-model.md): forecasting and aging fields on
-- opportunity. Additive; existing rows take their last update as the
-- moment they entered their current stage (the best fact available).
ALTER TABLE "opportunity" ADD COLUMN "expectedCloseAt" TIMESTAMP(3),
ADD COLUMN "probability" INTEGER,
ADD COLUMN "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "opportunity" SET "stageChangedAt" = "updatedAt";

ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_probability_range"
  CHECK ("probability" IS NULL OR ("probability" >= 0 AND "probability" <= 100));

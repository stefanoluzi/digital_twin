CREATE TABLE "CoverageSnapshot" (
  "id" SERIAL PRIMARY KEY, "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revision" INTEGER NOT NULL, "signature" TEXT NOT NULL,
  "total" INTEGER NOT NULL, "covered" INTEGER NOT NULL, "uncovered" INTEGER NOT NULL,
  "percent" INTEGER NOT NULL, "repair" INTEGER NOT NULL, "purchase" INTEGER NOT NULL,
  CONSTRAINT "coverage_counts" CHECK ("total" >= 0 AND "covered" >= 0 AND "uncovered" >= 0 AND "covered" + "uncovered" = "total" AND "percent" BETWEEN 0 AND 100 AND "repair" >= 0 AND "purchase" >= 0)
);
CREATE INDEX "CoverageSnapshot_capturedAt_id_idx" ON "CoverageSnapshot"("capturedAt", "id");
CREATE TABLE "CoverageSnapshotGroup" (
  "snapshotId" INTEGER NOT NULL, "dimension" TEXT NOT NULL, "key" TEXT NOT NULL, "name" TEXT NOT NULL,
  "responsibleId" TEXT, "responsibleName" TEXT, "areaIds" TEXT[] NOT NULL,
  "total" INTEGER NOT NULL, "covered" INTEGER NOT NULL, "uncovered" INTEGER NOT NULL,
  "percent" INTEGER NOT NULL, "repair" INTEGER NOT NULL, "purchase" INTEGER NOT NULL,
  "trackedSince" TIMESTAMP(3), "lastImprovedAt" TIMESTAMP(3),
  PRIMARY KEY ("snapshotId", "dimension", "key"),
  FOREIGN KEY ("snapshotId") REFERENCES "CoverageSnapshot"("id") ON DELETE CASCADE,
  CONSTRAINT "coverage_group_dimension" CHECK ("dimension" IN ('AREA','GMB')),
  CONSTRAINT "coverage_group_counts" CHECK ("total" >= 0 AND "covered" >= 0 AND "uncovered" >= 0 AND "covered" + "uncovered" = "total" AND "percent" BETWEEN 0 AND 100 AND "repair" >= 0 AND "purchase" >= 0)
);
CREATE INDEX "CoverageSnapshotGroup_dimension_key_snapshotId_idx" ON "CoverageSnapshotGroup"("dimension", "key", "snapshotId");

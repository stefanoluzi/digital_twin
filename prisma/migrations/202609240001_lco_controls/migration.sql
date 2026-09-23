-- CreateTable
CREATE TABLE "LcoConfig" (
    "id" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "staleDays" INTEGER NOT NULL DEFAULT 90,
    "veryStaleDays" INTEGER NOT NULL DEFAULT 180,
    "recentDays" INTEGER NOT NULL DEFAULT 30,
    "dueDays" INTEGER NOT NULL DEFAULT 60,
    "oldDays" INTEGER NOT NULL DEFAULT 90,
    "migratedLegacyFingerprints" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "LcoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LcoCage" (
    "id" TEXT NOT NULL,
    "cageNumber" INTEGER NOT NULL,
    "side" TEXT NOT NULL,
    "assetId" TEXT,

    CONSTRAINT "LcoCage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LcoShaft" (
    "id" TEXT NOT NULL,
    "cageId" TEXT NOT NULL,
    "position" TEXT NOT NULL,

    CONSTRAINT "LcoShaft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LcoCoupling" (
    "id" TEXT NOT NULL,
    "shaftId" TEXT NOT NULL,
    "side" TEXT NOT NULL,

    CONSTRAINT "LcoCoupling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LcoEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT,
    "deletedAt" TIMESTAMP(3),
    "inspector" TEXT NOT NULL DEFAULT '',
    "observations" TEXT,
    "couplingId" TEXT,
    "shaftId" TEXT,
    "reason" TEXT,
    "sapWorkOrder" TEXT,
    "notes" TEXT,
    "wearAtRemoval" INTEGER,

    CONSTRAINT "LcoEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LcoReading" (
    "eventId" TEXT NOT NULL,
    "couplingId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "wearLevel" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "conditionCode" TEXT,

    CONSTRAINT "LcoReading_pkey" PRIMARY KEY ("eventId","couplingId")
);

-- CreateTable
CREATE TABLE "LcoPhoto" (
    "eventId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "id" TEXT NOT NULL,
    "couplingId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "caption" TEXT NOT NULL,

    CONSTRAINT "LcoPhoto_pkey" PRIMARY KEY ("eventId","scope","ordinal")
);

-- CreateTable
CREATE TABLE "LcoEventVersion" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LcoEventVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LcoImportReceipt" (
    "hash" TEXT NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LcoImportReceipt_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE UNIQUE INDEX "LcoCage_cageNumber_key" ON "LcoCage"("cageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LcoShaft_cageId_position_key" ON "LcoShaft"("cageId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "LcoCoupling_shaftId_side_key" ON "LcoCoupling"("shaftId", "side");

-- CreateIndex
CREATE INDEX "LcoEvent_date_createdAt_idx" ON "LcoEvent"("date", "createdAt");

-- CreateIndex
CREATE INDEX "LcoEvent_couplingId_date_idx" ON "LcoEvent"("couplingId", "date");

-- CreateIndex
CREATE INDEX "LcoEvent_shaftId_date_idx" ON "LcoEvent"("shaftId", "date");

-- CreateIndex
CREATE INDEX "LcoReading_couplingId_idx" ON "LcoReading"("couplingId");

-- CreateIndex
CREATE UNIQUE INDEX "LcoEventVersion_eventId_revision_key" ON "LcoEventVersion"("eventId", "revision");

-- AddForeignKey
ALTER TABLE "LcoShaft" ADD CONSTRAINT "LcoShaft_cageId_fkey" FOREIGN KEY ("cageId") REFERENCES "LcoCage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LcoCoupling" ADD CONSTRAINT "LcoCoupling_shaftId_fkey" FOREIGN KEY ("shaftId") REFERENCES "LcoShaft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LcoEvent" ADD CONSTRAINT "LcoEvent_couplingId_fkey" FOREIGN KEY ("couplingId") REFERENCES "LcoCoupling"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LcoEvent" ADD CONSTRAINT "LcoEvent_shaftId_fkey" FOREIGN KEY ("shaftId") REFERENCES "LcoShaft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LcoReading" ADD CONSTRAINT "LcoReading_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "LcoEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LcoReading" ADD CONSTRAINT "LcoReading_couplingId_fkey" FOREIGN KEY ("couplingId") REFERENCES "LcoCoupling"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LcoPhoto" ADD CONSTRAINT "LcoPhoto_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "LcoEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LcoPhoto" ADD CONSTRAINT "LcoPhoto_couplingId_fkey" FOREIGN KEY ("couplingId") REFERENCES "LcoCoupling"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LcoEventVersion" ADD CONSTRAINT "LcoEventVersion_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "LcoEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "LcoConfig" ADD CONSTRAINT "LcoConfig_singleton" CHECK (id = 1 AND revision >= 0 AND "staleDays" > 0 AND "veryStaleDays" >= "staleDays" AND "recentDays" > 0 AND "dueDays" > "recentDays" AND "oldDays" > "dueDays");
ALTER TABLE "LcoCage" ADD CONSTRAINT "LcoCage_number" CHECK ("cageNumber" BETWEEN 1 AND 8 AND side IN ('NORTH','SOUTH'));
ALTER TABLE "LcoShaft" ADD CONSTRAINT "LcoShaft_position" CHECK (position IN ('UPPER','LOWER'));
ALTER TABLE "LcoCoupling" ADD CONSTRAINT "LcoCoupling_side" CHECK (side IN ('GEARBOX','STAND'));
ALTER TABLE "LcoReading" ADD CONSTRAINT "LcoReading_wear" CHECK ("wearLevel" BETWEEN 1 AND 5);
ALTER TABLE "LcoEvent" ADD CONSTRAINT "LcoEvent_target" CHECK (
 (type = 'INSPECTION' AND "couplingId" IS NULL AND "shaftId" IS NULL) OR
 (type = 'COUPLING_REPLACEMENT' AND "couplingId" IS NOT NULL AND "shaftId" IS NULL) OR
 (type = 'SHAFT_REPLACEMENT' AND "couplingId" IS NULL AND "shaftId" IS NOT NULL));
ALTER TABLE "LcoEvent" ADD CONSTRAINT "LcoEvent_wear" CHECK ("wearAtRemoval" IS NULL OR "wearAtRemoval" BETWEEN 1 AND 5);
INSERT INTO "LcoConfig" (id) VALUES (1);
INSERT INTO "LcoCage" (id, "cageNumber", side) SELECT 'J' || n, n, CASE WHEN n % 2 = 0 THEN 'NORTH' ELSE 'SOUTH' END FROM generate_series(1,8) n;
INSERT INTO "LcoShaft" (id,"cageId",position) SELECT c.id || '_' || p.suffix, c.id,p.position FROM "LcoCage" c CROSS JOIN (VALUES ('SUP','UPPER'),('INF','LOWER')) p(suffix,position);
INSERT INTO "LcoCoupling" (id,"shaftId",side) SELECT s.id || '_' || p.suffix,s.id,p.side FROM "LcoShaft" s CROSS JOIN (VALUES ('RED','GEARBOX'),('JAU','STAND')) p(suffix,side);


-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Revision" (
    "id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Responsible" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "Responsible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "responsibleGmbId" TEXT,
    "migrationCandidateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Spare" (
    "id" TEXT NOT NULL,
    "sapNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "drawingNumber" TEXT NOT NULL,
    "drawingPdf" TEXT,
    "drawingPdfName" TEXT,
    "referencePhoto" TEXT,
    "comments" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    "uncoveredAt" TEXT,

    CONSTRAINT "Spare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpareEquipment" (
    "spareId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,

    CONSTRAINT "SpareEquipment_pkey" PRIMARY KEY ("spareId","equipmentId")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "spareTypeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusSince" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "installedEquipmentId" TEXT,
    "installationDate" TEXT,
    "sapNotice" TEXT,
    "repairStartDate" TEXT,
    "solp" TEXT,
    "purchaseOrder" TEXT,
    "eta" TEXT,
    "photo" TEXT,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "History" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "spareTypeId" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "previousStatus" TEXT,
    "nextStatus" TEXT NOT NULL,
    "equipmentId" TEXT,
    "comment" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "History_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Area_code_key" ON "Area"("code");

-- CreateIndex
CREATE INDEX "Spare_area_idx" ON "Spare"("area");

-- CreateIndex
CREATE INDEX "Spare_sapNumber_idx" ON "Spare"("sapNumber");

-- CreateIndex
CREATE INDEX "Unit_spareTypeId_idx" ON "Unit"("spareTypeId");

-- CreateIndex
CREATE INDEX "Unit_status_idx" ON "Unit"("status");

-- CreateIndex
CREATE INDEX "History_spareTypeId_timestamp_idx" ON "History"("spareTypeId", "timestamp");

-- CreateIndex
CREATE INDEX "audit_log_entity_entityId_createdAt_idx" ON "audit_log"("entity", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_responsibleGmbId_fkey" FOREIGN KEY ("responsibleGmbId") REFERENCES "Responsible"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_area_fkey" FOREIGN KEY ("area") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spare" ADD CONSTRAINT "Spare_area_fkey" FOREIGN KEY ("area") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spare" ADD CONSTRAINT "Spare_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpareEquipment" ADD CONSTRAINT "SpareEquipment_spareId_fkey" FOREIGN KEY ("spareId") REFERENCES "Spare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpareEquipment" ADD CONSTRAINT "SpareEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_spareTypeId_fkey" FOREIGN KEY ("spareTypeId") REFERENCES "Spare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_installedEquipmentId_fkey" FOREIGN KEY ("installedEquipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "History" ADD CONSTRAINT "History_spareTypeId_fkey" FOREIGN KEY ("spareTypeId") REFERENCES "Spare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

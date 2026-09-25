CREATE TABLE "RepairEquipmentProfile" (
 "equipmentId" TEXT PRIMARY KEY REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "idrep" TEXT NOT NULL, "sector" TEXT NOT NULL, "trade" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX "RepairEquipmentProfile_idrep_key" ON "RepairEquipmentProfile"("idrep");
CREATE TABLE "RepairConfig" (
 "id" INTEGER PRIMARY KEY, "revision" INTEGER NOT NULL DEFAULT 0, "warningDays" INTEGER NOT NULL DEFAULT 7,
 "blockCategories" JSONB NOT NULL, "workshops" TEXT[]
);
CREATE TABLE "RepairRequest" (
 "id" TEXT PRIMARY KEY, "equipmentId" TEXT NOT NULL REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "quantity" INTEGER NOT NULL CHECK ("quantity" BETWEEN 1 AND 1000),
 "targetMonth" DATE NOT NULL CHECK (EXTRACT(DAY FROM "targetMonth")=1), "requiredDate" DATE NOT NULL,
 "criticality" TEXT NOT NULL CHECK ("criticality" IN ('NORMAL','HIGH','CRITICAL')), "criticalReason" TEXT NOT NULL,
 "fixedDeadline" BOOLEAN NOT NULL, "criticalDueDate" DATE,
 "responsibleId" TEXT REFERENCES "Responsible"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "workshop" TEXT NOT NULL, "notes" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, "createdBy" TEXT NOT NULL
);
CREATE TABLE "RepairItem" (
 "id" TEXT PRIMARY KEY, "requestId" TEXT NOT NULL REFERENCES "RepairRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "ordinal" INTEGER NOT NULL CHECK ("ordinal">0), "status" TEXT NOT NULL DEFAULT 'PLANNED' CHECK ("status" IN ('PLANNED','IN_PROGRESS','BLOCKED','DELIVERED','CANCELLED')),
 "startedAt" DATE, "sentAt" DATE
);
CREATE TABLE "RepairCommitment" (
 "id" TEXT PRIMARY KEY, "itemId" TEXT NOT NULL REFERENCES "RepairItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "date" DATE NOT NULL, "reason" TEXT NOT NULL, "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "actor" TEXT NOT NULL, "sequence" INTEGER NOT NULL CHECK ("sequence">0)
);
CREATE TABLE "RepairBlock" (
 "id" TEXT PRIMARY KEY, "itemId" TEXT NOT NULL REFERENCES "RepairItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "startedAt" DATE NOT NULL, "resolvedAt" DATE, "durationDays" INTEGER,
 "owner" TEXT NOT NULL CHECK ("owner" IN ('PLANT','WORKSHOP','PURCHASING','ENGINEERING','EXTERNAL','OTHER')),
 "category" TEXT NOT NULL, "description" TEXT NOT NULL, "comment" TEXT NOT NULL, "actor" TEXT NOT NULL,
 "resolvedBy" TEXT, "previousStatus" TEXT NOT NULL,
 CHECK ("resolvedAt" IS NULL OR "resolvedAt">="startedAt"), CHECK ("durationDays" IS NULL OR "durationDays">=0)
);
CREATE UNIQUE INDEX "RepairBlock_one_open_per_item" ON "RepairBlock"("itemId") WHERE "resolvedAt" IS NULL;
CREATE TABLE "RepairDelivery" (
 "id" TEXT PRIMARY KEY, "itemId" TEXT NOT NULL REFERENCES "RepairItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "deliveredAt" DATE NOT NULL, "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "actor" TEXT NOT NULL, "comment" TEXT NOT NULL
);
CREATE TABLE "RepairEvent" (
 "id" SERIAL PRIMARY KEY, "requestId" TEXT NOT NULL REFERENCES "RepairRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "action" TEXT NOT NULL, "actor" TEXT NOT NULL, "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "revision" INTEGER NOT NULL, "detail" JSONB NOT NULL, "snapshot" JSONB NOT NULL
);
CREATE INDEX "RepairRequest_targetMonth_equipmentId_idx" ON "RepairRequest"("targetMonth","equipmentId");
CREATE INDEX "RepairRequest_requiredDate_criticality_idx" ON "RepairRequest"("requiredDate","criticality");
CREATE INDEX "RepairRequest_workshop_responsibleId_idx" ON "RepairRequest"("workshop","responsibleId");
CREATE INDEX "RepairItem_status_idx" ON "RepairItem"("status");
CREATE UNIQUE INDEX "RepairItem_requestId_ordinal_key" ON "RepairItem"("requestId","ordinal");
CREATE UNIQUE INDEX "RepairCommitment_itemId_sequence_key" ON "RepairCommitment"("itemId","sequence");
CREATE INDEX "RepairBlock_owner_resolvedAt_idx" ON "RepairBlock"("owner","resolvedAt");
CREATE INDEX "RepairBlock_itemId_startedAt_idx" ON "RepairBlock"("itemId","startedAt");
CREATE UNIQUE INDEX "RepairDelivery_itemId_key" ON "RepairDelivery"("itemId");
CREATE INDEX "RepairDelivery_deliveredAt_idx" ON "RepairDelivery"("deliveredAt");
CREATE INDEX "RepairEvent_requestId_recordedAt_id_idx" ON "RepairEvent"("requestId","recordedAt","id");
CREATE INDEX "RepairEvent_recordedAt_id_idx" ON "RepairEvent"("recordedAt","id");

-- CreateTable
CREATE TABLE "RexConfig" (
    "id" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RexConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RexTask" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "line" TEXT NOT NULL DEFAULT 'LC1C',
    "areaId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "specialty" TEXT NOT NULL,
    "impact" TEXT NOT NULL DEFAULT '',
    "criticality" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "frequencyType" TEXT NOT NULL,
    "intervalMonths" INTEGER,
    "frequencyCriteria" TEXT NOT NULL DEFAULT '',
    "referenceOt" TEXT NOT NULL DEFAULT '',
    "technicalPlan" TEXT NOT NULL DEFAULT '',
    "controlData" TEXT NOT NULL DEFAULT '',
    "justification" TEXT NOT NULL DEFAULT '',
    "interventionTime" TEXT NOT NULL DEFAULT '',
    "resources" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "RexTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RexTaskScopeItem" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RexTaskScopeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RexTaskDocument" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "RexTaskDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RexEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "exercise" INTEGER,
    "status" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "RexEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RexExecution" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "eventId" TEXT,
    "intent" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATE,
    "performedAt" DATE,
    "ot" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "responsibleId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "taskSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "RexExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RexExecutionItem" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "scopeItemId" TEXT,
    "description" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "completed" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "RexExecutionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RexPending" (
    "id" TEXT NOT NULL,
    "originItemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "originDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RexPending_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RexPendingResolution" (
    "id" TEXT NOT NULL,
    "pendingId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "performedAt" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "RexPendingResolution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RexTask_areaId_active_idx" ON "RexTask"("areaId", "active");

-- CreateIndex
CREATE INDEX "RexTask_specialty_criticality_idx" ON "RexTask"("specialty", "criticality");

-- CreateIndex
CREATE INDEX "RexTask_equipmentId_idx" ON "RexTask"("equipmentId");

-- CreateIndex
CREATE INDEX "RexTaskScopeItem_taskId_active_ordinal_idx" ON "RexTaskScopeItem"("taskId", "active", "ordinal");

-- CreateIndex
CREATE INDEX "RexTaskDocument_taskId_idx" ON "RexTaskDocument"("taskId");

-- CreateIndex
CREATE INDEX "RexEvent_exercise_status_idx" ON "RexEvent"("exercise", "status");

-- CreateIndex
CREATE INDEX "RexExecution_taskId_performedAt_id_idx" ON "RexExecution"("taskId", "performedAt", "id");

-- CreateIndex
CREATE INDEX "RexExecution_eventId_status_idx" ON "RexExecution"("eventId", "status");

-- CreateIndex
CREATE INDEX "RexExecution_status_performedAt_idx" ON "RexExecution"("status", "performedAt");

-- CreateIndex
CREATE INDEX "RexExecution_responsibleId_idx" ON "RexExecution"("responsibleId");

-- CreateIndex
CREATE INDEX "RexExecutionItem_executionId_ordinal_idx" ON "RexExecutionItem"("executionId", "ordinal");

-- CreateIndex
CREATE INDEX "RexExecutionItem_scopeItemId_idx" ON "RexExecutionItem"("scopeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "RexPending_originItemId_key" ON "RexPending"("originItemId");

-- CreateIndex
CREATE UNIQUE INDEX "RexPendingResolution_itemId_key" ON "RexPendingResolution"("itemId");

-- CreateIndex
CREATE INDEX "RexPendingResolution_pendingId_idx" ON "RexPendingResolution"("pendingId");

-- CreateIndex
CREATE INDEX "RexPendingResolution_executionId_idx" ON "RexPendingResolution"("executionId");

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "RexTask" ADD CONSTRAINT "RexTask_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RexTask" ADD CONSTRAINT "RexTask_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RexTaskScopeItem" ADD CONSTRAINT "RexTaskScopeItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "RexTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RexTaskDocument" ADD CONSTRAINT "RexTaskDocument_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "RexTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RexExecution" ADD CONSTRAINT "RexExecution_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "RexTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RexExecution" ADD CONSTRAINT "RexExecution_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "RexEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RexExecution" ADD CONSTRAINT "RexExecution_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "Responsible"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RexExecutionItem" ADD CONSTRAINT "RexExecutionItem_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "RexExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RexExecutionItem" ADD CONSTRAINT "RexExecutionItem_scopeItemId_fkey" FOREIGN KEY ("scopeItemId") REFERENCES "RexTaskScopeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RexPending" ADD CONSTRAINT "RexPending_originItemId_fkey" FOREIGN KEY ("originItemId") REFERENCES "RexExecutionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RexPendingResolution" ADD CONSTRAINT "RexPendingResolution_pendingId_fkey" FOREIGN KEY ("pendingId") REFERENCES "RexPending"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RexPendingResolution" ADD CONSTRAINT "RexPendingResolution_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "RexExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RexPendingResolution" ADD CONSTRAINT "RexPendingResolution_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RexExecutionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RexTask" ADD CONSTRAINT "RexTask_frequency_check" CHECK ("frequencyType" IN ('PERIODIC','CONDITION_BASED','COUNTER_BASED','NO_FIXED_FREQUENCY') AND ("frequencyType" <> 'PERIODIC' OR "intervalMonths" > 0));
ALTER TABLE "RexTaskScopeItem" ADD CONSTRAINT "RexTaskScopeItem_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "RexExecutionItem" ADD CONSTRAINT "RexExecutionItem_quantity_check" CHECK ("quantity" > 0 AND "completed" >= 0 AND "completed" <= "quantity");
ALTER TABLE "RexPending" ADD CONSTRAINT "RexPending_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "RexPendingResolution" ADD CONSTRAINT "RexPendingResolution_quantity_check" CHECK ("quantity" > 0);
INSERT INTO "RexConfig" ("id", "revision") VALUES (1, 0);

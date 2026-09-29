ALTER TABLE "RexConfig"
  ADD COLUMN "hoursPerDay" DECIMAL(6,3) NOT NULL DEFAULT 9,
  ADD COLUMN "hourlyRate" DECIMAL(18,4),
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD',
  ADD CONSTRAINT "RexConfig_hours_check" CHECK ("hoursPerDay" > 0 AND "hoursPerDay" <= 24),
  ADD CONSTRAINT "RexConfig_rate_check" CHECK ("hourlyRate" >= 0);

CREATE TABLE "RexEstimate" (
  "id" SERIAL PRIMARY KEY,
  "taskId" TEXT NOT NULL REFERENCES "RexTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "durationDays" DECIMAL(10,3) NOT NULL CHECK ("durationDays" > 0),
  "mechanical" DECIMAL(8,0) NOT NULL CHECK ("mechanical" >= 0),
  "electrical" DECIMAL(8,0) NOT NULL CHECK ("electrical" >= 0),
  "mro" DECIMAL(20,2) NOT NULL CHECK ("mro" >= 0),
  "services" DECIMAL(20,2) NOT NULL CHECK ("services" >= 0),
  "ownLabor" DECIMAL(20,2) NOT NULL CHECK ("ownLabor" >= 0),
  "hoursPerDay" DECIMAL(6,3) NOT NULL CHECK ("hoursPerDay" > 0 AND "hoursPerDay" <= 24),
  "hourlyRate" DECIMAL(18,4) NOT NULL CHECK ("hourlyRate" >= 0),
  "currency" TEXT NOT NULL,
  "people" DECIMAL(9,0) NOT NULL,
  "hoursPerPerson" DECIMAL(18,6) NOT NULL,
  "manHours" DECIMAL(24,6) NOT NULL,
  "contractorLabor" DECIMAL(30,2) NOT NULL,
  "total" DECIMAL(30,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT NOT NULL,
  CONSTRAINT "RexEstimate_people_check" CHECK ("people" = "mechanical" + "electrical"),
  CONSTRAINT "RexEstimate_hours_check" CHECK ("hoursPerPerson" = "durationDays" * "hoursPerDay" AND "manHours" = "hoursPerPerson" * "people"),
  CONSTRAINT "RexEstimate_cost_check" CHECK ("contractorLabor" = ROUND("manHours" * "hourlyRate", 2) AND "total" = "mro" + "contractorLabor" + "services" + "ownLabor")
);
CREATE INDEX "RexEstimate_taskId_id_idx" ON "RexEstimate"("taskId", "id");

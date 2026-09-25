-- Preserve existing rows and event snapshots; only relax the exact-day requirement.
ALTER TABLE "RepairRequest" ALTER COLUMN "requiredDate" DROP NOT NULL;

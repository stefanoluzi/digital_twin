-- Rename the operational state only. Historical event snapshots remain immutable.
ALTER TABLE "RepairItem" DROP CONSTRAINT "RepairItem_status_check";
UPDATE "RepairItem" SET status = 'PENDING' WHERE status = 'PLANNED';
UPDATE "RepairBlock" SET "previousStatus" = 'PENDING' WHERE "previousStatus" = 'PLANNED';
ALTER TABLE "RepairItem" ALTER COLUMN status SET DEFAULT 'PENDING';
ALTER TABLE "RepairItem" ADD CONSTRAINT "RepairItem_status_check" CHECK (status IN ('PENDING','IN_PROGRESS','BLOCKED','DELIVERED','CANCELLED'));

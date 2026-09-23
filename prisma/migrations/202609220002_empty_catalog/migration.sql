-- A fresh installation starts empty, never with operational demo data.
INSERT INTO "Revision" (id, version) VALUES (1, 0);
INSERT INTO "AppUser" (id, name, role) VALUES ('local-user', 'Usuario local', 'ADMIN');
INSERT INTO "Area" (id, code, name) VALUES
('COBA','COBA','Corte de Barras'), ('HG','HG','Horno Giratorio'),
('LP','LP','Laminador Perforador'), ('REMA','REMA','Recirculacion de Mandriles'),
('LCO','LCO','Laminador Continuo'), ('ZTREF','ZTREF','Zona de Transferencia'),
('HBM','HBM','Horno de Barras Móviles'), ('LRE','LRE','Laminador Rectificador Estirador'),
('PENF','PENF','Plano de Enfriamiento'), ('SHA','SHA','Sierra de Haces'), ('CESTOS','CESTOS','Cestos');

ALTER TABLE "Unit" ADD CONSTRAINT "Unit_status_check" CHECK (status IN ('WAREHOUSE','MACHINE_SIDE','INSTALLED','IN_REPAIR','ON_ORDER'));
ALTER TABLE "AppUser" ADD CONSTRAINT "AppUser_role_check" CHECK (role IN ('ADMIN','SUPERVISOR'));

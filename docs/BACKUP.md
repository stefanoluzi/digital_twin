# Backup de toda la plataforma

La misma DB contiene Repuestos y Lco*. `pg_dump` sin filtro de tablas cubre ambos,
incluyendo fotos, correcciones históricas, configuración y comprobantes de migración.
Los exportables Excel/JSON del módulo son complementarios, NO sustituyen este backup:
el JSON operativo no contiene todas las versiones históricas ni eventos borrados.

Linux/VM, desde raíz:

```sh
sh scripts/backup-db.sh
```

El nombre del archivo conserva `critical-spares`, pero el contenido es la DB completa.
Copiar el .dump fuera de la VM; protegerlo porque contiene datos y fotos. Mantener
varias generaciones y verificar restauración en una DB de prueba regularmente.

Windows/PowerShell (evita redirección binaria):

```powershell
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/platform.dump'
docker compose cp postgres:/tmp/platform.dump ./platform.dump
```

Restaurar reemplaza datos: primero otro backup y detener usuarios. En Linux:

```sh
sh scripts/restore-db.sh backups/ARCHIVO.dump --confirm-replace
```

El script detiene solo app de este Compose, restaura transaccionalmente y vuelve a
levantarla si tuvo éxito. Ante error deja app detenida. No borrar volúmenes ni intentar
recrear la DB sin investigar. Recargar TODOS los clientes después de restaurar, porque
las revisiones pueden retroceder. Procedimiento PowerShell detallado en
REPUESTOS_CENTRALIZADOS.md.

Una copia del código en GitHub NO incluye PostgreSQL, IndexedDB ni .env.

#!/usr/bin/env bash
# ซ้อมกู้ database จากไฟล์ backup — NFR-AVAIL-02 (GAP-08) · วัดเวลาที่ใช้จริงเป็น RTO
#
# ใช้:
#   BACKUP_PASSPHRASE=... scripts/restore-drill.sh paireval-YYYYMMDDTHHMMZ.dump.gpg
#   scripts/restore-drill.sh paireval.dump            # ไฟล์ที่ยังไม่เข้ารหัส (เช่นซ้อมจาก DB บนเครื่อง)
#
# กู้ลง Postgres 18 ตัวใหม่ใน docker ที่ลบทิ้งเมื่อจบ — ไม่แตะ database จริงใด ๆ
# ผลลัพธ์: เวลาแต่ละขั้น + จำนวนแถวของตารางหลัก ให้เทียบกับระบบจริงได้
set -euo pipefail

# Git Bash บน Windows: ห้ามแปลง path ของฝั่ง container และส่ง path ของเครื่องแบบ Windows ให้ docker
export MSYS_NO_PATHCONV=1
host_path() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf %s "$1"; fi; }

file="${1:?ระบุไฟล์ backup (.dump หรือ .dump.gpg)}"
container="paireval-restore-drill-$$"
workdir="$(mktemp -d)"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true; rm -rf "$workdir"' EXIT

t0=$(date +%s)
if [[ "$file" == *.gpg ]]; then
  : "${BACKUP_PASSPHRASE:?ตั้ง BACKUP_PASSPHRASE ก่อน}"
  printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 \
    --decrypt --output "$workdir/paireval.dump" "$file"
else
  cp "$file" "$workdir/paireval.dump"
fi
t1=$(date +%s)

docker run -d --name "$container" -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=paireval postgres:18 >/dev/null
until docker exec "$container" pg_isready -U postgres -d paireval >/dev/null 2>&1; do sleep 1; done
t2=$(date +%s)

docker cp "$(host_path "$workdir/paireval.dump")" "$container:/tmp/paireval.dump"
docker exec "$container" pg_restore --no-owner --no-privileges -U postgres -d paireval /tmp/paireval.dump
t3=$(date +%s)

echo "== จำนวนแถวหลังกู้ =="
docker exec "$container" psql -U postgres -d paireval -At -c "
  SELECT 'app_user', count(*) FROM app_user UNION ALL
  SELECT 'classroom', count(*) FROM classroom UNION ALL
  SELECT 'assignment', count(*) FROM assignment UNION ALL
  SELECT 'comparison', count(*) FROM comparison UNION ALL
  SELECT 'audit_log', count(*) FROM audit_log"

echo "== เวลา (วินาที) =="
echo "ถอดรหัส/เตรียมไฟล์: $((t1 - t0))"
echo "ยก Postgres ใหม่:    $((t2 - t1))"
echo "pg_restore:          $((t3 - t2))"
echo "รวม (RTO ส่วนข้อมูล): $((t3 - t0))"

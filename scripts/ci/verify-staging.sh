#!/usr/bin/env bash
# ยืนยันว่า staging ของกลุ่มรัน commit ล่าสุดแล้วจริง (WS-06) — ไม่สั่ง deploy เอง
#
# staging (paireval-web / paireval-api บน Render) deploy อัตโนมัติทุก push เข้า develop
# ตาม render.yaml ของกลุ่ม · job นี้ไม่แตะการตั้งค่านั้น แต่รอจนของใหม่ขึ้นจริง
# แล้วรายงานเวลา commit → live (lead time) ลง step summary
#
#   API_URL  base URL ของ API (ไม่ใช่ secret)
#   WEB_URL  URL ของหน้าเว็บ (ไม่ใช่ secret)
#
# Render ข้าม build ของ service ที่ไม่มีไฟล์ใน rootDir เปลี่ยน (เช่น push ที่แก้แค่ docs/)
# ถ้า commit ที่ API รันอยู่กับ commit นี้ไม่มีอะไรต่างกันในไฟล์ที่ runtime ใช้จริง ถือว่า API เป็นปัจจุบันแล้ว
# (เทียบเฉพาะ RUNTIME_PATHS — Dockerfile ไม่ได้ใช้บน Render ที่รันแบบ python runtime
#  เคยเจอจริง: push ที่แก้แค่ backend/Dockerfile แล้ว API บน Render ไม่ถูก deploy ใหม่)
set -euo pipefail

RUNTIME_PATHS=(backend/app backend/migrations backend/requirements.txt)
# ตัวแรกที่รันได้จริง (บน Windows `python3` อาจเป็น stub ของ Microsoft Store ที่ไม่ทำงาน)
PY=""
for candidate in python3 python; do
  if "$candidate" -c "import sys" >/dev/null 2>&1; then PY="$candidate"; break; fi
done
: "${PY:?ไม่พบ python}"

: "${API_URL:?ต้องตั้ง API_URL}"
: "${WEB_URL:?ต้องตั้ง WEB_URL}"
SHA="${GITHUB_SHA:?}"
SHORT_SHA="${SHA:0:7}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-600}"

start=$(date +%s)
echo "รอ ${API_URL}/api/health ให้รัน backend ของ ${SHORT_SHA} (สูงสุด ${TIMEOUT_SECONDS} วินาที)"
while true; do
  live=$(curl -fsS --max-time 15 "${API_URL}/api/health" | "$PY" -c 'import json,sys; print(json.load(sys.stdin).get("version",""))' 2>/dev/null || true)
  elapsed=$(( $(date +%s) - start ))

  if [[ -n "$live" ]]; then
    if [[ "$live" == "$SHORT_SHA" ]]; then
      verdict="API deploy commit นี้แล้ว"
    elif git cat-file -e "${live}^{commit}" 2>/dev/null && git diff --quiet "$live" "$SHA" -- "${RUNTIME_PATHS[@]}"; then
      verdict="API รัน ${live} ซึ่ง code ที่ runtime ใช้เหมือน ${SHORT_SHA} ทุกไฟล์ (ไม่มีอะไรต้อง deploy ใหม่)"
    else
      verdict=""
    fi
    if [[ -n "$verdict" ]]; then
      curl -fsS --max-time 15 -o /dev/null "$WEB_URL"
      echo "✅ ${verdict} · หน้าเว็บตอบ 200 · รอ ${elapsed} วินาที"
      {
        echo "### Staging live: ${SHORT_SHA}"
        echo "- ${verdict}"
        echo "- รอ ${elapsed} วินาทีหลัง job เริ่ม"
      } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
      exit 0
    fi
  fi

  if (( elapsed > TIMEOUT_SECONDS )); then
    echo "::error::หมดเวลา ${TIMEOUT_SECONDS} วินาที — API ยังรัน '${live:-ไม่ตอบ}' ไม่ใช่ ${SHORT_SHA} · ดู deploy log บน Render"
    exit 1
  fi
  sleep 10
done

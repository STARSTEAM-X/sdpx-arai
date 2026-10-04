#!/usr/bin/env bash
# สั่ง Render deploy ผ่าน deploy hook แล้วรอจน API รายงานว่ารัน commit นี้อยู่จริง (WS-06)
#
# ใช้ใน job deploy-staging / deploy-production ของ .github/workflows/ci.yml
#
#   API_HOOK  deploy hook URL ของ service API  (GitHub Secret — URL มี key ฝังอยู่ ห้าม echo)
#   WEB_HOOK  deploy hook URL ของ static site  (GitHub Secret)
#   API_URL   base URL ของ API เช่น https://paireval-api.onrender.com  (GitHub Variable)
#
# "สั่ง deploy สำเร็จ" ≠ "ของใหม่ขึ้นแล้ว" — hook ตอบ 200 ทันทีที่รับคิว
# build อาจพังทีหลังก็ได้ จึงต้องยืนยันจาก /api/health ที่คืน commit SHA ที่รันอยู่จริง
# (Render ใส่ RENDER_GIT_COMMIT ให้ · config.py ตัดเหลือ 7 ตัว)
set -euo pipefail

: "${API_HOOK:?ยังไม่ได้ตั้ง secret RENDER_DEPLOY_HOOK_API ใน environment นี้ — ดู docs/cicd.md}"
: "${WEB_HOOK:?ยังไม่ได้ตั้ง secret RENDER_DEPLOY_HOOK_WEB ใน environment นี้ — ดู docs/cicd.md}"
: "${API_URL:?ยังไม่ได้ตั้ง variable ของ API URL ใน environment นี้ — ดู docs/cicd.md}"

SHA="${GITHUB_SHA:?}"
SHORT_SHA="${SHA:0:7}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-600}"

# ?ref=<sha> บอก Render ให้ deploy commit นี้เป๊ะ ๆ ไม่ใช่ HEAD ของ branch ณ ตอนที่มันหยิบคิว
# -f ให้ curl fail เมื่อได้ 4xx/5xx · -sS เงียบแต่ยังแสดง error · ไม่พิมพ์ URL ออก log
trigger() {
  local name="$1" hook="$2"
  echo "สั่ง deploy ${name} @ ${SHORT_SHA}"
  curl -fsS -X POST -o /dev/null "${hook}&ref=${SHA}"
}

trigger "web" "$WEB_HOOK"
trigger "api" "$API_HOOK"

start=$(date +%s)
echo "รอ ${API_URL}/api/health รายงาน version=${SHORT_SHA} (สูงสุด ${TIMEOUT_SECONDS} วินาที)"
while true; do
  live=$(curl -fsS --max-time 10 "${API_URL}/api/health" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("version",""))' 2>/dev/null || true)
  elapsed=$(( $(date +%s) - start ))
  if [[ "$live" == "$SHORT_SHA" ]]; then
    echo "✅ live แล้ว: ${SHORT_SHA} ใช้เวลา ${elapsed} วินาทีหลังสั่ง deploy"
    echo "deploy_seconds=${elapsed}" >> "${GITHUB_OUTPUT:-/dev/null}"
    echo "### Deploy ${SHORT_SHA} → live ใน ${elapsed} วินาที" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
    exit 0
  fi
  if (( elapsed > TIMEOUT_SECONDS )); then
    echo "::error::หมดเวลา ${TIMEOUT_SECONDS} วินาที — API ยังรัน '${live:-ไม่ตอบ}' ไม่ใช่ ${SHORT_SHA} · ดู deploy log บน Render"
    exit 1
  fi
  sleep 10
done

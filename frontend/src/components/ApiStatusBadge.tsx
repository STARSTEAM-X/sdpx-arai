import { useApiHealth } from '../lib/api'

/** ป้ายเล็ก ๆ ที่พิสูจน์ว่า frontend คุยกับ backend ได้จริง
 *  เป็นด่าน Verify ด้วยตาเปล่าของ Deploy Loop ตั้งแต่ WS-01 */
export function ApiStatusBadge() {
  const health = useApiHealth()

  const tone = {
    loading: 'border-line bg-cream text-muted',
    ok: 'border-ok-50 bg-ok-50 text-ok-600',
    error: 'border-red-200 bg-red-50 text-red-700',
  }[health.status]

  const dot = {
    loading: 'bg-muted',
    ok: 'bg-ok-500',
    error: 'bg-red-500',
  }[health.status]

  const label =
    health.status === 'ok'
      ? `ระบบพร้อมใช้งาน · ${health.version}`
      : health.status === 'error'
        ? `เชื่อมต่อระบบไม่ได้ — ${health.message}`
        : 'กำลังตรวจสอบสถานะระบบ…'

  return (
    <span
      data-testid="api-status"
      data-status={health.status}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${tone}`}
    >
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  )
}

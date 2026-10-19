/** เก็บ session token ไว้ที่เดียว
 *
 *  ใช้ localStorage เพราะ E2E ต้อง inject token เข้ามาก่อนเปิดหน้าได้
 *  (Playwright login ผ่าน Google จริงไม่ได้ — Google บล็อก automated login)
 *
 *  ข้อแลกเปลี่ยนที่รู้ตัว: localStorage เข้าถึงได้จาก JS จึงเสี่ยงต่อ XSS
 *  ทางที่ปลอดภัยกว่าคือ httpOnly cookie — จะทบทวนเรื่องนี้ใน WS-08 (security)
 *  และบันทึกเป็น ADR ถ้าตัดสินใจเปลี่ยน
 */

const KEY = 'paireval.session'
const SESSION_CHANGED = 'paireval:session-changed'
const DRAFT_SCOPE = 'paireval.draft-scope'

export function draftScope(): string {
  let scope = localStorage.getItem(DRAFT_SCOPE)
  if (!scope) {
    scope = crypto.randomUUID()
    localStorage.setItem(DRAFT_SCOPE, scope)
  }
  return scope
}

function clearDrafts() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('paireval.answers.')) localStorage.removeItem(key)
  }
  localStorage.removeItem(DRAFT_SCOPE)
}

export function getToken(): string | null {
  return localStorage.getItem(KEY)
}

export function setToken(token: string): void {
  if (token !== getToken()) clearDrafts()
  localStorage.setItem(KEY, token)
  window.dispatchEvent(new Event(SESSION_CHANGED))
}

/** FR-AUTH-04 — ต่ออายุ token ของผู้ใช้คนเดิม: ไม่ล้างคำตอบที่ยังไม่ส่ง และไม่แจ้งว่า session เปลี่ยน */
export function renewToken(token: string): void {
  localStorage.setItem(KEY, token)
}

export function clearToken(): void {
  clearDrafts()
  localStorage.removeItem(KEY)
  window.dispatchEvent(new Event(SESSION_CHANGED))
}

/** ให้ route guard ทราบเมื่อ login/logout หรือ session ถูกเพิกถอน รวมถึงจากแท็บอื่น */
export function subscribeToSession(listener: () => void): () => void {
  window.addEventListener('storage', listener)
  window.addEventListener(SESSION_CHANGED, listener)
  return () => {
    window.removeEventListener('storage', listener)
    window.removeEventListener(SESSION_CHANGED, listener)
  }
}

export function isSignedIn(): boolean {
  return getToken() !== null
}

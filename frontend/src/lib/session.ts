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

export function getToken(): string | null {
  return localStorage.getItem(KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(KEY)
}

export function isSignedIn(): boolean {
  return getToken() !== null
}

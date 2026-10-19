/* เข้าสู่ระบบด้วย Google แบบพาไปหน้าของ Google เอง (OpenID Connect implicit flow, response_type=id_token)
 *
 * เดิมใช้ปุ่มของ Google Identity Services ซ่อนแบบ opacity-0 ไว้ใต้ปุ่มสีส้ม แต่ GIS ตรวจว่าปุ่มมองเห็นจริง
 * ก่อนเปิด popup (กัน clickjacking) จึงเมินคลิกเงียบ ๆ — ทางนี้ให้ปุ่มของเราเองพาไป Google ได้ตรง ๆ
 * แล้ว Google ส่ง id_token กลับมาที่ GOOGLE_CALLBACK_PATH ให้ backend ตรวจลายเซ็นและ aud เหมือนเดิม
 *
 * ต้องลงทะเบียน `<origin>/auth/google/callback` ไว้ใน Authorized redirect URIs ของ OAuth client ทุก origin
 */

export const GOOGLE_CALLBACK_PATH = '/auth/google/callback'
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const PENDING_KEY = 'paireval.google-signin'
const DEFAULT_RETURN_TO = '/classrooms'

/** สิ่งที่จำไว้ก่อนออกไปหน้า Google เพื่อตรวจคำตอบที่กลับมา — เก็บใน sessionStorage ของแท็บนี้เท่านั้น */
export type PendingSignIn = { state: string; nonce: string; returnTo: string }

export type CallbackResult =
  | { ok: true; idToken: string; returnTo: string }
  | { ok: false; message: string }

export function buildGoogleAuthUrl({ clientId, redirectUri, state, nonce }: {
  clientId: string
  redirectUri: string
  state: string
  nonce: string
}): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    scope: 'openid email profile',
    state,
    nonce,
    // ให้เลือกบัญชีทุกครั้ง — หลังถูกปฏิเสธเพราะโดเมนจะได้เปลี่ยนบัญชีได้ ไม่ถูกพากลับบัญชีเดิมอัตโนมัติ
    prompt: 'select_account',
    hl: 'th',
  })
  return `${AUTH_ENDPOINT}?${params}`
}

/** รับเฉพาะ path ภายในเว็บ — ค่าอย่าง `//evil.example` หรือ URL เต็มจะพาออกนอกเว็บได้ (open redirect) */
export function safeReturnTo(value: string): string {
  return /^\/(?![/\\])/.test(value) ? value : DEFAULT_RETURN_TO
}

function nonceOf(idToken: string): string | null {
  try {
    const payload = (idToken.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/')
    const nonce = (JSON.parse(atob(payload)) as { nonce?: unknown }).nonce
    return typeof nonce === 'string' ? nonce : null
  } catch {
    return null
  }
}

const RETRY = 'กรุณากดเข้าสู่ระบบอีกครั้ง'

/** ตรวจ fragment ที่ Google ส่งกลับมา — ลายเซ็นของ token ยังเป็นหน้าที่ของ backend เสมอ */
export function readGoogleCallback(hash: string, pending: PendingSignIn | null): CallbackResult {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  if (params.get('error') === 'access_denied') return { ok: false, message: 'ยกเลิกการเข้าสู่ระบบด้วย Google แล้ว' }
  if (params.get('error')) return { ok: false, message: `Google ไม่อนุญาตให้เข้าสู่ระบบ (${params.get('error')}) — ${RETRY}` }
  // ไม่มีคำขอที่เริ่มจากแท็บนี้ หรือ state ไม่ตรง = มีคนส่งลิงก์ callback พร้อม token ของคนอื่นมาให้กด (CSRF)
  if (!pending || params.get('state') !== pending.state) {
    return { ok: false, message: `คำขอเข้าสู่ระบบไม่ตรงกับที่เริ่มจากหน้านี้ — ${RETRY}` }
  }
  const idToken = params.get('id_token')
  if (!idToken) return { ok: false, message: `Google ไม่ได้ส่งข้อมูลยืนยันตัวตนกลับมา — ${RETRY}` }
  // nonce ต้องตรงกับที่สุ่มไว้ก่อนออกไป — กัน id_token เก่าที่หลุดไปถูกนำมาใช้ซ้ำ
  if (nonceOf(idToken) !== pending.nonce) {
    return { ok: false, message: `คำขอเข้าสู่ระบบไม่ตรงกับที่เริ่มจากหน้านี้ — ${RETRY}` }
  }
  return { ok: true, idToken, returnTo: safeReturnTo(pending.returnTo) }
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** จำ state/nonce ไว้แล้วพาทั้งหน้าไป Google — ไม่ใช้ popup จึงไม่ติด popup blocker หรือ COOP */
export function startGoogleSignIn({ clientId, returnTo }: { clientId: string; returnTo: string }): void {
  const pending: PendingSignIn = { state: randomToken(), nonce: randomToken(), returnTo: safeReturnTo(returnTo) }
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending))
  window.location.assign(buildGoogleAuthUrl({
    clientId,
    redirectUri: `${window.location.origin}${GOOGLE_CALLBACK_PATH}`,
    state: pending.state,
    nonce: pending.nonce,
  }))
}

/** อ่านแล้วลบทิ้งทันที — state/nonce ใช้ได้ครั้งเดียว */
export function takePendingSignIn(): PendingSignIn | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    sessionStorage.removeItem(PENDING_KEY)
    const value = raw ? (JSON.parse(raw) as Partial<PendingSignIn>) : null
    return value && typeof value.state === 'string' && typeof value.nonce === 'string'
      ? { state: value.state, nonce: value.nonce, returnTo: typeof value.returnTo === 'string' ? value.returnTo : DEFAULT_RETURN_TO }
      : null
  } catch {
    return null
  }
}

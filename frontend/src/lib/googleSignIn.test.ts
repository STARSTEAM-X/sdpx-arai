import { describe, expect, it } from 'vitest'

import { buildGoogleAuthUrl, readGoogleCallback, safeReturnTo, type PendingSignIn } from './googleSignIn'

/* ปุ่มสีส้มพาไปหน้า login ของ Google เอง (OpenID Connect implicit flow) แทนการซ้อนปุ่ม GIS แบบโปร่งใส
   ที่ Google เมินคลิก — test ชุดนี้ล็อกสิ่งที่ทำให้ flow นี้ปลอดภัย: state กัน CSRF, nonce กัน token replay
   และ returnTo ต้องเป็น path ภายในเว็บเท่านั้น (กัน open redirect) */

function fakeIdToken(claims: Record<string, unknown>): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'RS256' })}.${encode(claims)}.signature`
}

const pending: PendingSignIn = { state: 'state-123', nonce: 'nonce-456', returnTo: '/classrooms' }

describe('URL ไปหน้า login ของ Google', () => {
  const url = new URL(buildGoogleAuthUrl({
    clientId: 'client.apps.googleusercontent.com',
    redirectUri: 'https://paireval.example/auth/google/callback',
    state: pending.state,
    nonce: pending.nonce,
  }))

  it('ชี้ไป authorization endpoint ของ Google', () => {
    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth')
  })

  it('ขอ id_token พร้อม state และ nonce ที่สุ่มไว้', () => {
    expect(url.searchParams.get('response_type')).toBe('id_token')
    expect(url.searchParams.get('client_id')).toBe('client.apps.googleusercontent.com')
    expect(url.searchParams.get('redirect_uri')).toBe('https://paireval.example/auth/google/callback')
    expect(url.searchParams.get('state')).toBe('state-123')
    expect(url.searchParams.get('nonce')).toBe('nonce-456')
    expect(url.searchParams.get('scope')?.split(' ')).toEqual(['openid', 'email', 'profile'])
  })

  it('ให้เลือกบัญชีทุกครั้ง — เปลี่ยนบัญชีหลังถูกปฏิเสธโดเมนได้', () => {
    expect(url.searchParams.get('prompt')).toBe('select_account')
  })
})

describe('อ่านผลที่ Google ส่งกลับมา', () => {
  it('state และ nonce ตรง ได้ id_token และหน้าที่จะไปต่อ', () => {
    const idToken = fakeIdToken({ nonce: 'nonce-456', email: 'a@uni.ac.th' })
    expect(readGoogleCallback(`#id_token=${idToken}&state=state-123`, pending)).toEqual({
      ok: true, idToken, returnTo: '/classrooms',
    })
  })

  it('state ไม่ตรงกับที่เริ่มไว้ ปฏิเสธ — กันการยัด token ของคนอื่นเข้ามา (CSRF)', () => {
    const idToken = fakeIdToken({ nonce: 'nonce-456' })
    expect(readGoogleCallback(`#id_token=${idToken}&state=other`, pending)).toMatchObject({ ok: false })
  })

  it('nonce ใน token ไม่ตรง ปฏิเสธ — กัน token เก่าถูกนำมาใช้ซ้ำ', () => {
    const idToken = fakeIdToken({ nonce: 'stale' })
    expect(readGoogleCallback(`#id_token=${idToken}&state=state-123`, pending)).toMatchObject({ ok: false })
  })

  it('token อ่านไม่ออกถือว่า nonce ไม่ตรง ไม่ throw', () => {
    expect(readGoogleCallback('#id_token=not-a-jwt&state=state-123', pending)).toMatchObject({ ok: false })
  })

  it('ไม่มีคำขอที่เริ่มจากเบราว์เซอร์นี้ ปฏิเสธแม้ข้อมูลครบ', () => {
    const idToken = fakeIdToken({ nonce: 'nonce-456' })
    expect(readGoogleCallback(`#id_token=${idToken}&state=state-123`, null)).toMatchObject({ ok: false })
  })

  it('ผู้ใช้กดยกเลิกที่หน้า Google แจ้งว่ายกเลิก ไม่ใช่ข้อผิดพลาดของระบบ', () => {
    expect(readGoogleCallback('#error=access_denied&state=state-123', pending)).toEqual({
      ok: false, message: 'ยกเลิกการเข้าสู่ระบบด้วย Google แล้ว',
    })
  })

  it('Google ไม่ส่ง id_token กลับมา ปฏิเสธ', () => {
    expect(readGoogleCallback('#state=state-123', pending)).toMatchObject({ ok: false })
  })
})

describe('หน้าที่จะไปต่อหลังเข้าสู่ระบบ', () => {
  it('รับเฉพาะ path ภายในเว็บ', () => {
    expect(safeReturnTo('/classrooms/abc?tab=1')).toBe('/classrooms/abc?tab=1')
  })

  it.each(['https://evil.example', '//evil.example', '/\\evil.example', 'classrooms', ''])(
    'ค่าที่พาออกนอกเว็บได้ (%s) กลับไปหน้าห้องเรียน — กัน open redirect',
    (value) => {
      expect(safeReturnTo(value)).toBe('/classrooms')
    },
  )
})

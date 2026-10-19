import type { Page } from '@playwright/test'

import { expect, issueToken, test } from '../fixtures'
import { testUsers } from '../seed/test-data'

const SESSION_KEY = 'paireval.session'
const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client?hl=th'
const CHOOSER_PATH = '/__test-google-account-chooser'

/** ตรวจสัญญาระหว่าง UI กับ GIS เท่านั้น ไม่ได้ยืนยันตัวตนกับ Google จริง
 *  backend unit tests ตรวจ boundary ของ Google ID-token validator แยกต่างหาก */
async function mockGoogleButton(page: Page) {
  await page.context().route(`**${CHOOSER_PATH}`, (route) => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><meta charset="utf-8"><title>Google chooser test double</title><h1>เลือกบัญชี Google</h1>',
  }))
  await page.route(GOOGLE_SCRIPT, (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `
      window.google = { accounts: { id: {
        initialize(config) {
          window.__testGoogleCredential = config.callback;
        },
        renderButton(parent, options) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'เข้าสู่ระบบด้วย Google';
          button.addEventListener('click', () => {
            options.click_listener?.();
            window.open('${CHOOSER_PATH}', '_blank', 'popup,width=500,height=600');
          });
          parent.appendChild(button);
        }
      } } };
    `,
  }))
}

async function returnGoogleCredential(page: Page) {
  await page.evaluate(() => {
    const callback = (window as unknown as {
      __testGoogleCredential?: (response: { credential: string }) => void
    }).__testGoogleCredential
    if (!callback) throw new Error('GIS test double ยังไม่ได้ initialize')
    callback({ credential: 'synthetic-google-id-token' })
  })
}

async function mockApiResponse(page: Page, path: string, status: number, body: object) {
  await page.route(`**${path}`, (route) => {
    const headers = {
      'access-control-allow-origin': route.request().headers().origin ?? new URL(route.request().url()).origin,
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
    }
    return route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers })
      : route.fulfill({ status, headers, json: body })
  })
}

test.describe('การเข้าสู่ระบบและการป้องกันหน้าภายใน', () => {
  test('หน้าภายในทุกหน้ากลับหน้าแรกเมื่อยังไม่ได้เข้าสู่ระบบ', async ({ page }) => {
    const protectedRequests: string[] = []
    page.on('request', (request) => {
      if (/\/api\/(classrooms|assignments|comparisons)(?:\/|\?|$)/.test(request.url())) {
        protectedRequests.push(new URL(request.url()).pathname)
      }
    })

    for (const path of [
      '/classrooms',
      '/classrooms/room',
      '/classrooms/room/assignments/task/evaluate',
      '/classrooms/room/assignments/task/score',
    ]) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/$/)
      await expect(page.getByRole('heading', { level: 1 })).toContainText('ทุกความคิดเห็น')
      await expect(page.getByTestId('classroom-list')).toHaveCount(0)
      await expect(page.getByTestId('score-card')).toHaveCount(0)
      await expect(page.getByRole('radio')).toHaveCount(0)
    }
    expect(protectedRequests).toEqual([])
  })

  test('session ที่ API ปฏิเสธถูกล้างและกลับหน้าแรก', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'synthetic-invalid-session')
    }, SESSION_KEY)
    const rejectedSession = page.waitForResponse((response) => (
      new URL(response.url()).pathname === '/api/me' && response.status() === 401
    ))

    await page.goto('/classrooms')

    await rejectedSession
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('ทุกความคิดเห็น')
    await expect(page.getByTestId('classroom-list')).toHaveCount(0)
    expect(await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY)).toBeNull()
  })

  test('ตรวจสอบ session ไม่ได้ต้องซ่อนหน้าภายในและลองตรวจสอบใหม่ได้', async ({ signedInPage }) => {
    const classroomRequests: string[] = []
    signedInPage.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/classrooms') {
        classroomRequests.push(request.method())
      }
    })
    await signedInPage.route('**/api/me', (route) => route.abort('failed'))
    await signedInPage.goto('/classrooms')

    await expect(signedInPage.getByRole('alert')).toHaveText('ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง')
    await expect(signedInPage.getByRole('heading', { name: 'ห้องเรียนของฉัน', exact: true })).toHaveCount(0)
    await expect(signedInPage.getByTestId('classroom-list')).toHaveCount(0)
    expect(classroomRequests).toEqual([])
    expect(await signedInPage.evaluate((key) => localStorage.getItem(key) !== null, SESSION_KEY)).toBe(true)

    await signedInPage.unroute('**/api/me')
    const verified = signedInPage.waitForResponse((response) => (
      new URL(response.url()).pathname === '/api/me' && response.status() === 200
    ))
    await signedInPage.getByRole('button', { name: 'ลองใหม่', exact: true }).click()
    await verified
    await expect(signedInPage.getByRole('heading', { name: 'ห้องเรียนของฉัน', exact: true })).toBeVisible()
    await expect(signedInPage.getByTestId('current-user')).toHaveAttribute('aria-label', /^บัญชีของ /)
  })

  test('API ปฏิเสธ session ระหว่างโหลดห้องเรียนต้องล้าง session และกลับหน้าแรก', async ({ signedInPage }) => {
    await mockApiResponse(signedInPage, '/api/classrooms', 401, {
      error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบใหม่', requestId: 'login-test' },
    })
    const verified = signedInPage.waitForResponse((response) => (
      new URL(response.url()).pathname === '/api/me' && response.status() === 200
    ))
    const rejectedList = signedInPage.waitForResponse((response) => (
      new URL(response.url()).pathname === '/api/classrooms' && response.status() === 401
    ))
    await signedInPage.goto('/classrooms')

    await verified
    await rejectedList
    await expect(signedInPage).toHaveURL(/\/$/)
    await expect(signedInPage.getByRole('heading', { level: 1 })).toContainText('ทุกความคิดเห็น')
    await expect(signedInPage.getByTestId('classroom-list')).toHaveCount(0)
    expect(await signedInPage.evaluate((key) => localStorage.getItem(key), SESSION_KEY)).toBeNull()
  })

  test('response 401 ของบัญชีเก่าต้องไม่ล้าง session ที่เพิ่งเปลี่ยนบัญชี', async ({ page: signedInPage, api, instructorToken }) => {
    const nextToken = await issueToken(api, testUsers.otherInstructor.email)
    // ใช้ page เปล่าแทน fixture signedInPage ที่ inject token เดิมซ้ำทุกครั้งที่ reload
    await signedInPage.goto('/')
    await signedInPage.evaluate(([key, token]) => localStorage.setItem(key, token), [SESSION_KEY, instructorToken] as const)
    let releaseOld401!: () => void
    let markOldRequestHeld!: () => void
    const oldResponseGate = new Promise<void>((resolve) => { releaseOld401 = resolve })
    const oldRequestHeld = new Promise<void>((resolve) => { markOldRequestHeld = resolve })
    await signedInPage.route('**/api/classrooms', async (route) => {
      if (route.request().method() !== 'GET'
        || route.request().headers().authorization !== `Bearer ${instructorToken}`) {
        return route.continue()
      }
      markOldRequestHeld()
      await oldResponseGate
      return route.fulfill({
        status: 401,
        headers: {
          'access-control-allow-origin': route.request().headers().origin ?? new URL(route.request().url()).origin,
        },
        json: { error: { code: 'UNAUTHORIZED', message: 'session เดิมหมดอายุ', requestId: 'login-race-test' } },
      })
    })
    await signedInPage.goto('/classrooms')
    await oldRequestHeld

    const nextProfile = signedInPage.waitForResponse((response) => (
      new URL(response.url()).pathname === '/api/me'
      && response.status() === 200
      && response.request().headers().authorization === `Bearer ${nextToken}`
    ))
    // จำลอง storage event ที่แท็บปัจจุบันได้รับเมื่ออีกแท็บเข้าสู่ระบบด้วยบัญชีใหม่
    await signedInPage.evaluate(([key, token]) => {
      const oldValue = localStorage.getItem(key)
      localStorage.setItem(key, token)
      window.dispatchEvent(new StorageEvent('storage', {
        key, oldValue, newValue: token, storageArea: localStorage,
      }))
    }, [SESSION_KEY, nextToken] as const)
    await nextProfile
    const nextAccount = signedInPage.getByTestId('current-user')
    const nextLabel = `บัญชีของ ${testUsers.otherInstructor.displayName}`
    await expect(nextAccount).toHaveAttribute('aria-label', nextLabel)

    const oldRejection = signedInPage.waitForResponse((response) => (
      new URL(response.url()).pathname === '/api/classrooms'
      && response.status() === 401
      && response.request().headers().authorization === `Bearer ${instructorToken}`
    ))
    releaseOld401()
    await (await oldRejection).finished()
    await expect(nextAccount).toHaveAttribute('aria-label', nextLabel)
    expect(await signedInPage.evaluate(([key, token]) => (
      localStorage.getItem(key) === token
    ), [SESSION_KEY, nextToken] as const)).toBe(true)
    // โหลดใหม่พิสูจน์ว่า session บัญชีใหม่ยังผ่าน API จริงและเข้าใช้งานได้
    await signedInPage.reload()
    await expect(signedInPage).toHaveURL(/\/classrooms$/)
    await expect(nextAccount).toHaveAttribute('aria-label', nextLabel)
  })

  test('ปุ่มเข้าสู่ระบบเปิด Google ทันทีและเปลี่ยนหน้าหลังยืนยัน session สำเร็จ', async ({ page, api, instructorToken }, testInfo) => {
    await mockGoogleButton(page)
    const me = await api.get('/api/me', { headers: { authorization: `Bearer ${instructorToken}` } })
    expect(me.ok()).toBeTruthy()
    const profile = await me.json()
    await mockApiResponse(page, '/api/auth/session', 200, { accessToken: instructorToken, user: profile })
    await page.goto('/')
    const googleButton = page.getByRole('navigation', { name: 'เมนูหลัก' }).getByRole('button', { name: 'เข้าสู่ระบบด้วย Google', exact: true })
    await expect(googleButton).toBeVisible()
    // toBeVisible นับ opacity 0 ว่ามองเห็น แต่ GIS จริงจะเมินคลิกบนปุ่มที่ถูกซ่อน
    // จึงตรวจเองว่าไม่มี ancestor ใดทำให้ปุ่มโปร่งใส
    expect(await googleButton.evaluate((el) => {
      for (let node: Element | null = el; node; node = node.parentElement) {
        if (Number(getComputedStyle(node).opacity) < 1) return false
      }
      return true
    })).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('login-home.png') })

    const popupPromise = page.waitForEvent('popup')
    await page.getByRole('navigation', { name: 'เมนูหลัก' })
      .getByRole('button', { name: 'เข้าสู่ระบบด้วย Google', exact: true }).click()
    const popup = await popupPromise
    await expect(popup.getByRole('heading', { name: 'เลือกบัญชี Google' })).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
    expect(await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY)).toBeNull()

    const exchange = page.waitForRequest((request) => (
      new URL(request.url()).pathname === '/api/auth/session' && request.method() === 'POST'
    ))
    await returnGoogleCredential(page)
    expect((await exchange).postDataJSON()).toEqual({ idToken: 'synthetic-google-id-token' })
    await expect(page).toHaveURL(/\/classrooms$/)
    // RequireSession และหน้าห้องเรียนต้องอ่าน profile จาก API จริงด้วย token ที่ได้
    await expect(page.getByRole('heading', { name: 'ห้องเรียนของฉัน', exact: true })).toBeVisible()
    await expect(page.getByTestId('current-user')).toHaveAttribute('aria-label', /^บัญชีของ /)
    await popup.close()
  })

  test('ยืนยัน Google session ไม่สำเร็จยังอยู่หน้าแรกและแจ้งข้อผิดพลาด', async ({ page }) => {
    await mockGoogleButton(page)
    await mockApiResponse(page, '/api/auth/session', 401, {
      error: {
        code: 'INVALID_GOOGLE_TOKEN',
        message: 'ไม่สามารถยืนยันบัญชี Google ได้',
        requestId: 'login-test',
      },
    })
    await page.goto('/')
    // Figma Home Guest มีปุ่มเข้าสู่ระบบเพียงจุดเดียวบนแถบเมนู
    await expect(page.getByRole('button', { name: 'เข้าสู่ระบบด้วย Google', exact: true })).toHaveCount(1)

    const popupPromise = page.waitForEvent('popup')
    await page.getByRole('navigation', { name: 'เมนูหลัก' })
      .getByRole('button', { name: 'เข้าสู่ระบบด้วย Google', exact: true }).click()
    const popup = await popupPromise
    await returnGoogleCredential(page)

    await expect(page.getByRole('navigation', { name: 'เมนูหลัก' }).getByRole('alert')).toHaveText('ไม่สามารถยืนยันบัญชี Google ได้')
    // แจ้งครั้งเดียวที่จุดที่กด ไม่ซ้ำที่อื่นบนหน้า
    await expect(page.getByRole('alert')).toHaveCount(1)
    await expect(page).toHaveURL(/\/$/)
    expect(await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY)).toBeNull()
    await expect(page.getByTestId('classroom-list')).toHaveCount(0)
    await popup.close()
  })
})

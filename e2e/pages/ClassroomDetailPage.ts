import type { Locator, Page } from '@playwright/test'

/** Page Object ของหน้ารายชื่อในห้องเรียน — US-03
 *
 *  กฎเดียวกับ ClassroomsPage: **ไม่มี expect() ข้างใน**
 *  ที่นี่มีหน้าที่แค่ "รู้ว่าปุ่มอยู่ตรงไหน" และ "ทำท่าที่ผู้ใช้ทำ"
 *  ส่วนการตัดสินว่าผลถูกหรือผิดเป็นของ test
 */
export class ClassroomDetailPage {
  readonly heading: Locator
  readonly errorMessage: Locator
  readonly rowErrors: Locator
  readonly importResult: Locator
  readonly importWarnings: Locator
  readonly importForm: Locator
  readonly fileInput: Locator
  readonly submitButton: Locator
  readonly rosterList: Locator
  readonly rosterEmpty: Locator
  readonly studentCount: Locator

  constructor(private readonly page: Page) {
    // ชื่อหน้าเปลี่ยนตอน redesign เป็น dashboard — หน้านี้ทำมากกว่าแค่ "แสดงรายชื่อ" แล้ว
    this.heading = page.getByRole('heading', { level: 1 })
    this.errorMessage = page.getByTestId('error-msg')
    this.rowErrors = page.getByTestId('row-errors')
    this.importResult = page.getByTestId('import-result')
    this.importWarnings = page.getByTestId('import-warnings')
    this.importForm = page.getByTestId('roster-import')
    this.fileInput = page.getByLabel('ไฟล์รายชื่อ CSV')
    this.submitButton = page.getByRole('button', { name: 'นำเข้ารายชื่อ', exact: true })
    this.rosterList = page.getByTestId('roster-list')
    this.rosterEmpty = page.getByTestId('roster-empty')
    this.studentCount = page.getByTestId('student-count')
  }

  async goto(classroomId: string): Promise<void> {
    await this.page.goto(`/classrooms/${classroomId}#members`)
  }

  /** อัปโหลดไฟล์จากเนื้อหาในหน่วยความจำ ไม่ต้องมีไฟล์จริงบน disk
   *
   *  ทำแบบนี้เพราะ CSV ของแต่ละ test ต่างกันเล็กน้อย การเก็บเป็นไฟล์ 6 ไฟล์
   *  จะทำให้ต้องเปิดอีกไฟล์เพื่อรู้ว่า test กำลังทดสอบอะไร
   */
  async importCsv(filename: string, content: string): Promise<void> {
    await this.fileInput.setInputFiles({
      name: filename,
      mimeType: 'text/csv',
      buffer: Buffer.from(content, 'utf-8'),
    })
    const preview = this.page.waitForResponse((response) => response.url().endsWith('/roster:preview'))
    await this.submitButton.click()
    if ((await preview).ok()) {
      await this.page.getByRole('button', { name: 'ยืนยันนำเข้ารายชื่อ', exact: true }).click()
    }
  }

  /** แถวของสมาชิกคนหนึ่ง อ้างด้วยอีเมล
   *
   *  Figma J09 เปลี่ยนรายชื่อกลับเป็นรายการ (avatar · ชื่อ · ป้ายบทบาท · ป้ายสถานะ) — role คือ 'listitem'
   */
  memberRow(email: string): Locator {
    return this.rosterList.getByRole('listitem').filter({ hasText: email })
  }
}

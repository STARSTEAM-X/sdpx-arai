import type { Locator, Page } from '@playwright/test'

/** Page Object ของหน้าห้องเรียน
 *
 *  กฎที่ยึด:
 *  - **ไม่มี expect() ข้างใน** — การตัดสินว่าถูกหรือผิดเป็นหน้าที่ของ test ไม่ใช่ของ page object
 *    ถ้าใส่ assertion ไว้ในนี้ พอ test แดงจะไม่รู้ว่าแดงเพราะอะไร และ reuse ไม่ได้
 *  - locator เป็น readonly property ไม่ใช่ string กระจายในแต่ละ method
 *  - ตั้งชื่อ method ด้วยภาษาของ domain (createClassroom) ไม่ใช่ภาษาของ UI (clickButton3)
 */
export class ClassroomsPage {
  readonly heading: Locator
  readonly nameInput: Locator
  readonly timezoneSelect: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator
  readonly classroomList: Locator
  readonly emptyState: Locator
  readonly signInRequired: Locator

  constructor(private readonly page: Page) {
    // เรียงตามลำดับที่แนะนำ: getByRole → getByLabel → getByTestId
    this.heading = page.getByRole('heading', { level: 1, name: 'ห้องเรียนของฉัน' })
    this.nameInput = page.getByLabel('ชื่อห้องเรียน')
    this.timezoneSelect = page.getByLabel('เขตเวลา')
    this.submitButton = page.getByRole('button', { name: 'สร้างห้องเรียน' })
    // role="alert" ทำให้ screen reader อ่านข้อความผิดพลาดให้เอง — ได้ a11y ติดมาด้วย
    this.errorMessage = page.getByRole('alert')
    this.classroomList = page.getByTestId('classroom-list')
    this.emptyState = page.getByTestId('empty-state')
    this.signInRequired = page.getByTestId('signin-required')
  }

  async goto(): Promise<void> {
    await this.page.goto('/classrooms')
  }

  /** กรอกฟอร์มแล้วกดสร้าง — ครอบทั้งชุดเพราะ test แทบทุกตัวทำสามขั้นนี้ติดกัน */
  async createClassroom(name: string, timezone = 'Asia/Bangkok'): Promise<void> {
    await this.nameInput.fill(name)
    await this.timezoneSelect.selectOption(timezone)
    await this.submitButton.click()
  }

  /** รายการห้องเรียนที่แสดงอยู่ ใช้ชื่อเป็นตัวอ้าง */
  classroomNamed(name: string): Locator {
    return this.classroomList.getByRole('listitem').filter({ hasText: name })
  }
}

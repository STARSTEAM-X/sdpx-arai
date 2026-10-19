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
  readonly openCreateButton: Locator

  constructor(private readonly page: Page) {
    // เรียงตามลำดับที่แนะนำ: getByRole → getByLabel → getByTestId
    this.heading = page.getByRole('heading', { level: 1, name: 'ห้องเรียนของฉัน' })
    this.nameInput = page.getByLabel('ชื่อห้องเรียน')
    this.timezoneSelect = page.getByLabel('เขตเวลาของห้อง')
    this.submitButton = page.getByRole('button', { name: 'สร้างห้องเรียน', exact: true })
    // role="alert" ทำให้ screen reader อ่านข้อความผิดพลาดให้เอง — ได้ a11y ติดมาด้วย
    this.errorMessage = page.getByRole('alert')
    this.classroomList = page.getByTestId('classroom-list')
    this.emptyState = page.getByTestId('empty-state')
    this.openCreateButton = page.getByRole('button', { name: '+ สร้างห้องเรียน', exact: true }).first()
  }

  async goto(): Promise<void> {
    await this.page.goto('/classrooms')
  }

  /** กรอกฟอร์มแล้วกดสร้าง — ครอบทั้งชุดเพราะ test แทบทุกตัวทำสามขั้นนี้ติดกัน */
  async createClassroom(name: string, timezone = 'Asia/Bangkok'): Promise<void> {
    // Figma J03 เปลี่ยนฟอร์มเป็น dialog; เปิดก่อนกรอก โดยคง assertions ที่ spec เดิมทั้งหมด
    if (!(await this.submitButton.isVisible())) await this.openCreateButton.click()
    await this.nameInput.fill(name)
    await this.page.getByLabel('รหัสวิชา').fill('CE-SDPX')
    await this.page.getByLabel('ภาคเรียน', { exact: true }).fill('1/2569')
    // Figma J03 — เขตเวลาเป็นช่องพิมพ์พร้อมรายการแนะนำ (datalist)
    await this.timezoneSelect.fill(timezone)
    await this.submitButton.click()
  }

  /** รายการห้องเรียนที่แสดงอยู่ ใช้ชื่อเป็นตัวอ้าง */
  classroomNamed(name: string): Locator {
    return this.classroomList.getByRole('listitem').filter({ hasText: name })
  }
}

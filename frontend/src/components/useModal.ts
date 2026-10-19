import { useEffect, useRef } from 'react'

/** เปิด <dialog> แบบ modal ทันทีที่ component mount
 *
 *  ใช้กับ dialog ที่ render ตามเงื่อนไข (`{open && <XDialog />}`) — ปิดด้วย `ref.current.close()`
 *  แล้วให้ `onClose` ของ dialog เป็นคนถอด component ออก จะได้ไม่มีสองทางปิดที่ขัดกัน
 */
export function useModal() {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal()
  }, [])
  return ref
}

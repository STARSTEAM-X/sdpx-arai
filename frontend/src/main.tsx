import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  // ถ้าไม่มี #root แปลว่า index.html ถูกแก้ผิด — ล้มให้เห็นทันที ดีกว่าเงียบแล้วหน้าขาว
  throw new Error('ไม่พบ element #root ใน index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

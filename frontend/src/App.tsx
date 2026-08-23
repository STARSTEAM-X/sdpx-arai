import { Route, Routes } from 'react-router-dom'

import ClassroomDetailPage from './pages/ClassroomDetailPage'
import ClassroomsPage from './pages/ClassroomsPage'
import HomePage from './pages/HomePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/classrooms" element={<ClassroomsPage />} />
      <Route path="/classrooms/:classroomId" element={<ClassroomDetailPage />} />
      {/* ทุก path ที่ไม่รู้จักให้กลับหน้าแรก แทนที่จะเห็นหน้าขาว */}
      <Route path="*" element={<HomePage />} />
    </Routes>
  )
}

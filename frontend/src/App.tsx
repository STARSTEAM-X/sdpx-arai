import { Route, Routes } from 'react-router-dom'

import ClassroomDetailPage from './pages/ClassroomDetailPage'
import ClassroomsPage from './pages/ClassroomsPage'
import EvaluatePage from './pages/EvaluatePage'
import HomePage from './pages/HomePage'
import ScorePage from './pages/ScorePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/classrooms" element={<ClassroomsPage />} />
      <Route path="/classrooms/:classroomId" element={<ClassroomDetailPage />} />
      <Route
        path="/classrooms/:classroomId/assignments/:assignmentId/evaluate"
        element={<EvaluatePage />}
      />
      <Route
        path="/classrooms/:classroomId/assignments/:assignmentId/score"
        element={<ScorePage />}
      />
      {/* ทุก path ที่ไม่รู้จักให้กลับหน้าแรก แทนที่จะเห็นหน้าขาว */}
      <Route path="*" element={<HomePage />} />
    </Routes>
  )
}

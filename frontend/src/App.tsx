import { Navigate, Route, Routes } from 'react-router-dom'

import { RequireSession } from './components/RequireSession'

import ClassroomDetailPage from './pages/ClassroomDetailPage'
import ClassroomsPage from './pages/ClassroomsPage'
import EvaluatePage from './pages/EvaluatePage'
import HomePage from './pages/HomePage'
import ScorePage from './pages/ScorePage'
import NotificationsPage from './pages/NotificationsPage'
import AppealPage from './pages/AppealPage'
import AuditPage from './pages/AuditPage'
import QualityPage from './pages/QualityPage'
import ExportPage from './pages/ExportPage'
import GuidePage from './pages/GuidePage'
import GroupPage from './pages/GroupPage'
import AssignmentOverviewPage from './pages/AssignmentOverviewPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/guide" element={<GuidePage />} />
      <Route path="/guide/:tab" element={<GuidePage />} />
      <Route element={<RequireSession />}>
        <Route path="/classrooms" element={<ClassroomsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/classrooms/:classroomId/assignments/:assignmentId/appeal" element={<AppealPage />} />
        <Route path="/classrooms/:classroomId" element={<ClassroomDetailPage />} />
        <Route path="/classrooms/:classroomId/group" element={<GroupPage />} />
        <Route path="/classrooms/:classroomId/assignments/:assignmentId" element={<AssignmentOverviewPage />} />
        <Route path="/classrooms/:classroomId/audit" element={<AuditPage />} />
        <Route path="/classrooms/:classroomId/assignments/:assignmentId/quality" element={<QualityPage />} />
        <Route path="/classrooms/:classroomId/assignments/:assignmentId/export" element={<ExportPage />} />
        <Route
          path="/classrooms/:classroomId/assignments/:assignmentId/evaluate"
          element={<EvaluatePage />}
        />
        <Route
          path="/classrooms/:classroomId/assignments/:assignmentId/score"
          element={<ScorePage />}
        />
      </Route>
      {/* ทุก path ที่ไม่รู้จักให้กลับหน้าแรก แทนที่จะเห็นหน้าขาว */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

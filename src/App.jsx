import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import ClientSettings from './pages/client/Settings'
import TherapistDashboard from './pages/therapist/Dashboard'
import Clients from './pages/therapist/Clients'
import ExerciseLibrary from './pages/therapist/ExerciseLibrary'
import ExerciseDetail from './pages/therapist/ExerciseDetail'
import ExerciseUpload from './pages/therapist/ExerciseUpload'
import Prescribe from './pages/therapist/Prescribe'
import ClientDashboard from './pages/client/Dashboard'
import MyExercises from './pages/client/MyExercises'
import SessionWizard from './pages/client/SessionWizard'
import SessionEdit from './pages/therapist/SessionEdit'
import Templates from './pages/therapist/Templates'
import TemplateEdit from './pages/therapist/TemplateEdit'
import History from './pages/client/History'
import Join from './pages/Join'
import Onboarding from './pages/therapist/Onboarding'
import Settings from './pages/therapist/Settings'
import HomePage from './pages/HomePage'

function ProtectedRoute({ children, requiredRole }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Wait until profile loads (very brief gap between user and profile)
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading profile…
      </div>
    )
  }

  if (requiredRole && profile.role !== requiredRole) {
    // Logged in but wrong role — send to their own dashboard
    return <Navigate to={profile.role === 'therapist' ? '/therapist' : '/client'} replace />
  }

  return children
}

function PublicOnlyRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return null
  if (user && profile) {
    return <Navigate to={profile.role === 'therapist' ? '/therapist' : '/client'} replace />
  }
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/signup" element={<PublicOnlyRoute><Signup /></PublicOnlyRoute>} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/client/settings" element={<ProtectedRoute requiredRole="client"><ClientSettings /></ProtectedRoute>} />
          <Route path="/join/:code" element={<Join />} />

          {/* Therapist — protected */}
          <Route path="/onboarding" element={<ProtectedRoute requiredRole="therapist"><Onboarding /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute requiredRole="therapist"><Settings /></ProtectedRoute>} />
          <Route path="/therapist" element={<ProtectedRoute requiredRole="therapist"><TherapistDashboard /></ProtectedRoute>} />
          <Route path="/therapist/clients" element={<ProtectedRoute requiredRole="therapist"><Clients /></ProtectedRoute>} />
          <Route path="/therapist/exercises" element={<ProtectedRoute requiredRole="therapist"><ExerciseLibrary /></ProtectedRoute>} />
          <Route path="/therapist/exercises/new" element={<ProtectedRoute requiredRole="therapist"><ExerciseUpload /></ProtectedRoute>} />
          <Route path="/therapist/exercises/:id" element={<ProtectedRoute requiredRole="therapist"><ExerciseDetail /></ProtectedRoute>} />
          <Route path="/therapist/prescribe/:clientId" element={<ProtectedRoute requiredRole="therapist"><Prescribe /></ProtectedRoute>} />
          <Route path="/therapist/prescribe/:clientId/sessions/:sessionId" element={<ProtectedRoute requiredRole="therapist"><SessionEdit /></ProtectedRoute>} />
          <Route path="/therapist/templates" element={<ProtectedRoute requiredRole="therapist"><Templates /></ProtectedRoute>} />
          <Route path="/therapist/templates/:templateId" element={<ProtectedRoute requiredRole="therapist"><TemplateEdit /></ProtectedRoute>} />

          {/* Client — protected */}
          <Route path="/client" element={<ProtectedRoute requiredRole="client"><ClientDashboard /></ProtectedRoute>} />
          <Route path="/client/exercises" element={<ProtectedRoute requiredRole="client"><MyExercises /></ProtectedRoute>} />
          <Route path="/client/sessions/:sessionId" element={<ProtectedRoute requiredRole="client"><SessionWizard /></ProtectedRoute>} />
          <Route path="/client/history" element={<ProtectedRoute requiredRole="client"><History /></ProtectedRoute>} />

          {/* Anything else */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

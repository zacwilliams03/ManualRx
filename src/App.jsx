import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import TherapistDashboard from './pages/therapist/Dashboard'
import Clients from './pages/therapist/Clients'
import ExerciseLibrary from './pages/therapist/ExerciseLibrary'
import Prescribe from './pages/therapist/Prescribe'
import ClientDashboard from './pages/client/Dashboard'
import MyExercises from './pages/client/MyExercises'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Therapist */}
          <Route path="/therapist" element={<TherapistDashboard />} />
          <Route path="/therapist/clients" element={<Clients />} />
          <Route path="/therapist/exercises" element={<ExerciseLibrary />} />
          <Route path="/therapist/prescribe/:clientId" element={<Prescribe />} />

          {/* Client */}
          <Route path="/client" element={<ClientDashboard />} />
          <Route path="/client/exercises" element={<MyExercises />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

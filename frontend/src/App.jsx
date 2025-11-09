// import ThemeChange from "./components/ThemeChange"
// function App() {

//   return (
//     <>
//       <ThemeChange></ThemeChange>
      
//     </>
//   )
// }

// export default App
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Cookies from 'js-cookie'
import Home from './pages/home'
import LeadDetail from './pages/lead-detail'
import Login from './pages/login'
import Signup from './pages/signup'
import Layout from './components/layout'

// Protected Route Component
function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null)

  useEffect(() => {
    const token = Cookies.get('access_token')
    setIsAuthenticated(!!token)
  }, [])

  if (isAuthenticated === null) {
    // Loading state
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leads/:id"
          element={
            <ProtectedRoute>
              <LeadDetail />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  )
}
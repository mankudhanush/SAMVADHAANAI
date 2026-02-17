import { StrictMode, lazy, Suspense, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import './index.css'
import LoginPage from './pages/LoginPage.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

// Scroll to top on every route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}


// Lazy-load heavy pages for code splitting
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'))
const App = lazy(() => import('./App.jsx'))
const CaseStrategy = lazy(() => import('./pages/CaseStrategy.jsx'))
const ConstitutionalIntelligence = lazy(() => import('./pages/ConstitutionalIntelligence.jsx'))

const PageLoader = () => (
  <div className="min-h-screen bg-parchment-200 flex items-center justify-center">
    <div className="text-center">
      <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="font-accent text-[0.875rem] tracking-[0.2em] uppercase text-ink-200">Loading…</p>
    </div>
  </div>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><LandingPage /></ProtectedRoute>} />
          <Route path="/app" element={<ProtectedRoute><App /></ProtectedRoute>} />
          <Route path="/case-strategy" element={<ProtectedRoute><CaseStrategy /></ProtectedRoute>} />
          <Route path="/constitutional-intelligence" element={<ProtectedRoute><ConstitutionalIntelligence /></ProtectedRoute>} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)

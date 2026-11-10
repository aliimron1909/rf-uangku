import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import { LockProvider, useLock } from './contexts/LockContext'
import { AppShell } from './components/layout/AppShell'
import { InstallPrompt } from './components/pwa/InstallPrompt'
import { UpdatePrompt } from './components/pwa/UpdatePrompt'
import { LockPage } from './pages/LockPage'

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
)
const TransactionsPage = lazy(() =>
  import('./pages/TransactionsPage').then((module) => ({ default: module.TransactionsPage })),
)
const PlanningPage = lazy(() =>
  import('./pages/PlanningPage').then((module) => ({ default: module.PlanningPage })),
)
const ReportsPage = lazy(() =>
  import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })),
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
)
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
)

function AppContent() {
  const { locked, needsSetup } = useLock()
  const isLocked = locked || needsSetup

  const base = import.meta.env.BASE_URL
  const basename = base === '/' ? undefined : base.replace(/\/$/, '')

  return (
    <>
      {isLocked ? (
        <LockPage />
      ) : (
        <BrowserRouter basename={basename}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/planning" element={<PlanningPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      )}
      {/* Mounted while locked so the install event and service worker are not missed. */}
      <InstallPrompt enabled={!isLocked} />
      <UpdatePrompt enabled={!isLocked} />
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <LockProvider>
          <AppContent />
        </LockProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

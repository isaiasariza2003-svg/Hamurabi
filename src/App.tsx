import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell, RequireAdmin, RequireAuth } from './app/Layout'
import { AuthProvider } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { TabletsPage } from './features/tablets/TabletsPage'

// El editor (TipTap) solo se descarga al abrir una tablilla.
const EditorPage = lazy(() => import('./features/editor/EditorPage').then((m) => ({ default: m.EditorPage })))
const GeneratePage = lazy(() =>
  import('./features/generate/GeneratePage').then((m) => ({ default: m.GeneratePage })),
)
const ApiKeysPage = lazy(() => import('./features/apikeys/ApiKeysPage').then((m) => ({ default: m.ApiKeysPage })))
const AdminUsersPage = lazy(() =>
  import('./features/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
)
const AdminTabletsPage = lazy(() =>
  import('./features/admin/AdminTabletsPage').then((m) => ({ default: m.AdminTabletsPage })),
)

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<p className="center">Cargando…</p>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="/tablets" element={<TabletsPage />} />
              <Route path="/tablets/:id" element={<EditorPage />} />
              <Route path="/tablets/:id/generate" element={<GeneratePage />} />
              <Route path="/api-keys" element={<ApiKeysPage />} />
              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/tablets" element={<AdminTabletsPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/tablets" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}

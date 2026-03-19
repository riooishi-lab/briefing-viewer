import { AuthProvider, useAuth } from './contexts/AuthContext'
import { StudentViewer } from './pages/StudentViewer'
import { AdminDashboard } from './pages/AdminDashboard'
import { Login } from './pages/Login'
import { Toaster } from 'sonner'

function AdminApp() {
  const { adminUser, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    )
  }

  if (!adminUser) return <Login />

  return <AdminDashboard />
}

export default function App() {
  const pathname = window.location.pathname

  // /watch → 学生視聴ページ（認証不要・トークンベース）
  if (pathname === '/watch') {
    return (
      <>
        <StudentViewer />
        <Toaster richColors position="top-right" />
      </>
    )
  }

  // それ以外 → 企業管理画面
  return (
    <>
      <Toaster richColors position="top-right" />
      <AuthProvider>
        <AdminApp />
      </AuthProvider>
    </>
  )
}

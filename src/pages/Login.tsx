import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Loader2, Video } from 'lucide-react'

export function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) setError('メールアドレスまたはパスワードが正しくありません')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#1B2A4A] flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <div className="bg-[#1B2A4A] rounded-full p-3 inline-flex mb-3">
            <Video className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-[#1B2A4A]">説明会動画 管理画面</h1>
          <p className="text-xs text-gray-400 mt-1">企業管理者ログイン</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A] text-sm"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A] text-sm"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1B2A4A] text-white py-2.5 rounded-lg font-medium hover:bg-[#0F1D35] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            ログイン
          </button>
        </form>
      </div>
    </div>
  )
}

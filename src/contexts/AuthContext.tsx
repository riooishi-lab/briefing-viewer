import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'
import type { AdminUser } from '../lib/supabase'

interface AuthContextType {
  session: Session | null
  adminUser: AdminUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchIdRef = useRef(0)

  const fetchAdminUser = useCallback(async (email: string) => {
    const currentId = ++fetchIdRef.current
    setLoading(true)
    const { data, error } = await supabase
      .from('admin_users')
      .select('*, company:companies(*)')
      .eq('email', email)
    if (currentId !== fetchIdRef.current) return
    if (error) {
      setAdminUser(null)
      setLoading(false)
      return
    }
    setAdminUser(data?.[0] || null)
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user?.email) {
        fetchAdminUser(session.user.email)
      } else {
        setLoading(false)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'INITIAL_SESSION') return
      setSession(session)
      if (session?.user?.email) {
        fetchAdminUser(session.user.email)
      } else {
        setAdminUser(null)
        setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [fetchAdminUser])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? error.message : null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, adminUser, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

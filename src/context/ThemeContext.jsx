import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const ThemeContext = createContext(null)

function applyTheme(value) {
  if (value === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

export function ThemeProvider({ children }) {
  const { profile, user } = useAuth()
  const [theme, setThemeState] = useState(() => localStorage.getItem('theme') ?? 'dark')

  useEffect(() => {
    applyTheme(localStorage.getItem('theme') ?? 'dark')
  }, [])

  useEffect(() => {
    if (!profile) return
    const t = profile.theme ?? 'dark'
    applyTheme(t)
    setThemeState(t)
    localStorage.setItem('theme', t)
  }, [profile])

  async function setTheme(value) {
    applyTheme(value)
    localStorage.setItem('theme', value)
    setThemeState(value)
    if (!user) return
    await supabase.from('users').update({ theme: value }).eq('id', user.id)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}

import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const containerStyle = {
    display: 'flex',
    background: 'var(--color-elevated)',
    borderRadius: '8px',
    padding: '3px',
    gap: '2px',
  }

  const activeStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    minHeight: '38px',
    background: '#29B5CC',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  }

  const inactiveStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    minHeight: '38px',
    background: 'transparent',
    color: 'var(--color-muted)',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  }

  return (
    <div style={containerStyle}>
      <button
        type="button"
        onClick={() => setTheme('light')}
        style={theme === 'light' ? activeStyle : inactiveStyle}
        aria-label="Switch to light mode"
      >
        <Sun size={13} />
        Light
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        style={theme === 'dark' ? activeStyle : inactiveStyle}
        aria-label="Switch to dark mode"
      >
        <Moon size={13} />
        Dark
      </button>
    </div>
  )
}

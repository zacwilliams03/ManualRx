import { SHIMMER } from '../therapist/styles'
import { useTheme } from '../../context/ThemeContext'

export default function ShimmerLine() {
  const { theme } = useTheme()
  if (theme === 'light') return null
  return <div style={SHIMMER} />
}

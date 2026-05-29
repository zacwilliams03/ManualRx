import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ParticleBackground from '../ParticleBackground'
import useIsMobile from '../../hooks/useIsMobile'

export default function PageHero({ title, subtitle, back, actions }) {
  const isMobile = useIsMobile()

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: isMobile ? '20px 16px 16px' : '32px 32px 28px',
        borderBottom: '1px solid rgba(41,181,204,0.08)',
      }}
    >
      <ParticleBackground position="absolute" particleCount={isMobile ? 20 : 60} spawnFromTop />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 75% 60%, rgba(41,181,204,0.06) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {back && (
          <Link
            to={back.to}
            style={{ display: 'inline-block', fontSize: '12px', color: '#555', marginBottom: '10px' }}
            className="hover:text-dark-muted transition-colors duration-150"
          >
            ← {back.label}
          </Link>
        )}

        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: isMobile ? '12px' : '16px',
        }}>
          <div>
            <h1
              style={{
                fontSize: isMobile ? '22px' : '26px',
                fontWeight: 700,
                color: '#e8edf5',
                margin: '0 0 6px',
                letterSpacing: '-0.02em',
                fontFamily: '"DM Sans", system-ui, sans-serif',
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>{subtitle}</p>
            )}
          </div>

          {actions && (
            <div style={{
              display: 'flex',
              gap: isMobile ? '6px' : '8px',
              alignItems: 'center',
              flexShrink: 0,
              flexWrap: isMobile ? 'wrap' : 'nowrap',
              marginTop: isMobile ? 0 : '4px',
            }}>
              {actions}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

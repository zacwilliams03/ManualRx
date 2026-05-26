import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

function makeParticle(W, H) {
  const COLORS = [
    'rgb(255,255,255)', 'rgb(200,225,255)',
    'rgb(100,170,255)', 'rgb(41,181,204)', 'rgb(77,142,247)'
  ]
  return {
    x: Math.random() < 0.6 ? W * (0.1 + Math.random() * 0.7) : Math.random() * W,
    y: H * 0.6 + Math.random() * H * 0.4,
    vy: -(0.12 + Math.random() * 0.28),
    swayAmp: 0.15 + Math.random() * 0.30,
    swayFreq: 0.008 + Math.random() * 0.012,
    swayPhase: Math.random() * Math.PI * 2,
    size: 1.2 + Math.random() * 1.6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    life: Math.floor(Math.random() * 400), // varied ages on mount to avoid synchronised fade-in
    maxLife: 200 + Math.floor(Math.random() * 300),
  }
}

export default function ParticleBackground({ particleCount = 140, className, position = 'fixed' }) {
  const reduceMotion = useReducedMotion()
  const canvasRef = useRef(null)

  useEffect(() => {
    if (reduceMotion) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    const startAnimation = () => {
      if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) {
        rafId = requestAnimationFrame(startAnimation)
        return
      }
      resizeCanvas()
      window.addEventListener('resize', resizeCanvas)

      const W = canvas.width, H = canvas.height
      const particles = Array.from({ length: particleCount }, () => makeParticle(W, H))

      const loop = () => {
        const W = canvas.width, H = canvas.height
        ctx.clearRect(0, 0, W, H)

        for (const p of particles) {
          p.life++
          p.y += p.vy
          p.x += Math.sin(p.life * p.swayFreq + p.swayPhase) * p.swayAmp

          if (p.y < -10 || p.life > p.maxLife) {
            Object.assign(p, makeParticle(W, H))
            continue
          }

          // Vertical fade mask
          const fadeStart = H * 0.45, fadeEnd = H * 0.72
          const maskAlpha = p.y < fadeStart ? 1 : p.y > fadeEnd ? 0 : 1 - (p.y - fadeStart) / (fadeEnd - fadeStart)
          if (maskAlpha <= 0) continue

          // Lifetime alpha: fade in first 15%, full middle, fade out last 25%
          const t = p.life / p.maxLife
          const lifeAlpha = t < 0.15 ? t / 0.15 : t > 0.75 ? (1 - t) / 0.25 : 1
          const alpha = Math.min(lifeAlpha * maskAlpha * 0.50, 0.50)

          ctx.globalAlpha = alpha
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
        }

        // Connection lines between nearby particles
        ctx.lineWidth = 0.5
        ctx.strokeStyle = 'rgb(100,170,255)'
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x
            const dy = particles[i].y - particles[j].y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 85) {
              // compute per-particle mask alphas for connection line opacity
              const pi = particles[i], pj = particles[j]
              const fadeS = H * 0.45, fadeE = H * 0.72
              const maskI = pi.y < fadeS ? 1 : pi.y > fadeE ? 0 : 1 - (pi.y - fadeS) / (fadeE - fadeS)
              const maskJ = pj.y < fadeS ? 1 : pj.y > fadeE ? 0 : 1 - (pj.y - fadeS) / (fadeE - fadeS)
              ctx.globalAlpha = (1 - dist / 85) * Math.min(maskI, maskJ) * 0.07
              ctx.beginPath()
              ctx.moveTo(pi.x, pi.y)
              ctx.lineTo(pj.x, pj.y)
              ctx.stroke()
            }
          }
        }
        ctx.globalAlpha = 1
        rafId = requestAnimationFrame(loop)
      }
      rafId = requestAnimationFrame(loop)
    }

    let rafId = requestAnimationFrame(startAnimation)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [reduceMotion, particleCount])

  if (reduceMotion) return null
  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ position, inset: 0, pointerEvents: 'none', zIndex: 0, width: '100%', height: '100%' }}
    />
  )
}

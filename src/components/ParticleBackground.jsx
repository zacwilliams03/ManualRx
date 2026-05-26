import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

function makeParticle(W, H, spawnFromTop) {
  const COLORS = [
    'rgb(255,255,255)', 'rgb(200,225,255)',
    'rgb(100,170,255)', 'rgb(41,181,204)', 'rgb(77,142,247)'
  ]
  return {
    x: Math.random() < 0.6 ? W * (0.1 + Math.random() * 0.7) : Math.random() * W,
    y: spawnFromTop
      ? Math.random() * H * 0.25
      : H * 0.6 + Math.random() * H * 0.4,
    vy: spawnFromTop
      ? 0.08 + Math.random() * 0.18
      : -(0.12 + Math.random() * 0.28),
    swayAmp: 0.20 + Math.random() * 0.35,
    swayFreq: 0.008 + Math.random() * 0.012,
    swayPhase: Math.random() * Math.PI * 2,
    size: 1.2 + Math.random() * 1.6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    life: Math.floor(Math.random() * 400), // varied ages on mount to avoid synchronised fade-in
    maxLife: 200 + Math.floor(Math.random() * 300),
  }
}

export default function ParticleBackground({ particleCount = 140, className, position = 'fixed', spawnFromTop = false }) {
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
      const particles = Array.from({ length: particleCount }, () => makeParticle(W, H, spawnFromTop))

      const loop = () => {
        const W = canvas.width, H = canvas.height
        ctx.clearRect(0, 0, W, H)

        for (const p of particles) {
          p.life++
          p.y += p.vy
          p.x += Math.sin(p.life * p.swayFreq + p.swayPhase) * p.swayAmp

          // Reset: rising particles exit top, falling particles exit bottom
          const exitedTop = !spawnFromTop && p.y < -10
          const exitedBottom = spawnFromTop && p.y > H + 10
          if (exitedTop || exitedBottom || p.life > p.maxLife) {
            Object.assign(p, makeParticle(W, H, spawnFromTop))
            continue
          }

          // Vertical fade mask — inverted for spawnFromTop
          let maskAlpha
          if (spawnFromTop) {
            // Fully visible in top 60%, fade to 0 by 85%
            const fadeStart = H * 0.60, fadeEnd = H * 0.85
            maskAlpha = p.y < fadeStart ? 1 : p.y > fadeEnd ? 0 : 1 - (p.y - fadeStart) / (fadeEnd - fadeStart)
          } else {
            const fadeStart = H * 0.45, fadeEnd = H * 0.72
            maskAlpha = p.y < fadeStart ? 1 : p.y > fadeEnd ? 0 : 1 - (p.y - fadeStart) / (fadeEnd - fadeStart)
          }
          if (maskAlpha <= 0) continue

          // Lifetime alpha: fade in first 15%, full middle, fade out last 25%
          const t = p.life / p.maxLife
          const lifeAlpha = t < 0.15 ? t / 0.15 : t > 0.75 ? (1 - t) / 0.25 : 1
          const alpha = Math.min(lifeAlpha * maskAlpha * (spawnFromTop ? 0.45 : 0.70), spawnFromTop ? 0.45 : 0.70)

          ctx.globalAlpha = alpha
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
        }

        // Connection lines — increased threshold and opacity for more visible web
        ctx.lineWidth = 0.5
        ctx.strokeStyle = 'rgb(100,170,255)'
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x
            const dy = particles[i].y - particles[j].y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 120) {
              const pi = particles[i], pj = particles[j]
              let maskI, maskJ
              if (spawnFromTop) {
                const fadeS = H * 0.60, fadeE = H * 0.85
                maskI = pi.y < fadeS ? 1 : pi.y > fadeE ? 0 : 1 - (pi.y - fadeS) / (fadeE - fadeS)
                maskJ = pj.y < fadeS ? 1 : pj.y > fadeE ? 0 : 1 - (pj.y - fadeS) / (fadeE - fadeS)
              } else {
                const fadeS = H * 0.45, fadeE = H * 0.72
                maskI = pi.y < fadeS ? 1 : pi.y > fadeE ? 0 : 1 - (pi.y - fadeS) / (fadeE - fadeS)
                maskJ = pj.y < fadeS ? 1 : pj.y > fadeE ? 0 : 1 - (pj.y - fadeS) / (fadeE - fadeS)
              }
              ctx.globalAlpha = (1 - dist / 120) * Math.min(maskI, maskJ) * (spawnFromTop ? 0.08 : 0.14)
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
  }, [reduceMotion, particleCount, spawnFromTop])

  if (reduceMotion) return null
  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ position, inset: 0, pointerEvents: 'none', zIndex: 0, width: '100%', height: '100%' }}
    />
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import useIsMobile from '../hooks/useIsMobile'

export default function Contact() {
  const isMobile = useIsMobile()
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', subject: 'General', message: '' })
  const [sending, setSending] = useState(false)

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSending(true)
    // Wire this to your Resend edge function or a mailto fallback
    // For now, opens the user's mail client as a fallback
    const subject = encodeURIComponent(`[ManualRx] ${form.subject} — ${form.name}`)
    const body = encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`)
    window.location.href = `mailto:support@manualrx.com?subject=${subject}&body=${body}`
    setSending(false)
    setSubmitted(true)
  }

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#e8edf5',
    fontSize: '14px',
    fontFamily: '"Outfit", sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    color: '#888',
    marginBottom: '6px',
    fontWeight: 500,
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0d12',
      color: '#aaaaaa',
      fontFamily: '"Outfit", sans-serif',
    }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '16px 24px',
      }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '3px', height: '20px', background: '#29B5CC', borderRadius: '2px' }} />
          <span style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, fontSize: '17px', letterSpacing: '-0.02em', lineHeight: 1 }}>
            <span style={{ color: '#e8edf5' }}>Manual</span>
            <span style={{ color: '#29B5CC' }}>Rx</span>
          </span>
        </Link>
      </div>

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Title */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '11px', color: '#29B5CC', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '12px' }}>
            Support
          </div>
          <h1 style={{
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 700,
            fontSize: '28px',
            color: '#e8edf5',
            letterSpacing: '-0.02em',
            marginBottom: '8px',
          }}>
            Contact Us
          </h1>
          <p style={{ fontSize: '14px', lineHeight: '1.6' }}>
            We respond to all enquiries within 2 business days. For urgent billing issues, include your account email in the message.
          </p>
        </div>

        {submitted ? (
          <div style={{
            background: 'rgba(41,181,204,0.08)',
            border: '1px solid rgba(41,181,204,0.2)',
            borderRadius: '10px',
            padding: '24px',
            textAlign: 'center',
          }}>
            <div style={{ color: '#29B5CC', fontSize: '22px', marginBottom: '8px' }}>✓</div>
            <p style={{ color: '#e8edf5', fontWeight: 600, marginBottom: '4px' }}>Message opened in your mail app</p>
            <p style={{ fontSize: '13px' }}>Send it from there and we'll get back to you within 2 business days.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="Your name"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(41,181,204,0.4)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="you@example.com"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(41,181,204,0.4)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Subject</label>
              <select
                name="subject"
                value={form.subject}
                onChange={handleChange}
                style={{ ...inputStyle, cursor: 'pointer' }}
                onFocus={e => e.target.style.borderColor = 'rgba(41,181,204,0.4)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              >
                <option value="General">General enquiry</option>
                <option value="Billing">Billing or subscription</option>
                <option value="Privacy">Privacy or data request</option>
                <option value="Technical">Technical issue</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Message</label>
              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                required
                placeholder="Describe your question or issue..."
                rows={5}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
                onFocus={e => e.target.style.borderColor = 'rgba(41,181,204,0.4)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              style={{
                background: '#29B5CC',
                color: '#0a0d12',
                border: 'none',
                borderRadius: '8px',
                padding: '11px 24px',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: '"Outfit", sans-serif',
                cursor: sending ? 'not-allowed' : 'pointer',
                opacity: sending ? 0.7 : 1,
                transition: 'opacity 0.15s',
                alignSelf: 'flex-start',
              }}
            >
              {sending ? 'Opening mail app…' : 'Send Message'}
            </button>

            <p style={{ fontSize: '12px', color: '#555' }}>
              You can also email us directly at{' '}
              <a href="mailto:support@manualrx.com" style={{ color: '#29B5CC', textDecoration: 'none' }}>
                support@manualrx.com
              </a>
            </p>
          </form>
        )}

        {/* Footer nav */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '24px', marginTop: '48px', display: 'flex', gap: '24px', fontSize: '13px' }}>
          <Link to="/privacy" style={{ color: '#29B5CC', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link to="/terms" style={{ color: '#29B5CC', textDecoration: 'none' }}>Terms of Service</Link>
        </div>
      </div>
    </div>
  )
}

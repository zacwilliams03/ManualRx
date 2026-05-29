import { Link } from 'react-router-dom'

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: '40px' }}>
      <h2 style={{
        fontFamily: '"Outfit", sans-serif',
        fontWeight: 600,
        fontSize: '16px',
        color: '#e8edf5',
        marginBottom: '12px',
        letterSpacing: '-0.01em',
      }}>
        {title}
      </h2>
      <div style={{ color: '#aaaaaa', fontSize: '14px', lineHeight: '1.75' }}>
        {children}
      </div>
    </section>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────

function Table({ headers, rows }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: '12px', marginBottom: '4px' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '13px',
        color: '#aaaaaa',
      }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{
                textAlign: 'left',
                padding: '8px 12px',
                borderBottom: '1px solid rgba(41,181,204,0.15)',
                color: '#e8edf5',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '8px 12px', verticalAlign: 'top' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Privacy() {
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
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '3px', height: '20px', background: '#29B5CC', borderRadius: '2px' }} />
          <span style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, fontSize: '17px', letterSpacing: '-0.02em', lineHeight: 1 }}>
            <span style={{ color: '#e8edf5' }}>Manual</span>
            <span style={{ color: '#29B5CC' }}>Rx</span>
          </span>
        </Link>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Title */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '11px', color: '#29B5CC', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '12px' }}>
            Legal
          </div>
          <h1 style={{
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 700,
            fontSize: '28px',
            color: '#e8edf5',
            letterSpacing: '-0.02em',
            marginBottom: '8px',
          }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: '13px', color: '#666' }}>Last updated: 30 May 2025</p>
        </div>

        <Section title="1. Who We Are">
          <p>ManualRx is operated by Zachary Rigden Williams (ABN 84 940 411 925), a sole trader based in Australia. We provide a web-based exercise prescription platform for massage therapists and manual therapists.</p>
          <p style={{ marginTop: '8px' }}>Contact: <a href="mailto:support@manualrx.com" style={{ color: '#29B5CC', textDecoration: 'none' }}>support@manualrx.com</a></p>
        </Section>

        <Section title="2. What Information We Collect">
          <p style={{ marginBottom: '10px' }}><strong style={{ color: '#e8edf5' }}>From therapists (subscribers):</strong></p>
          <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
            <li>Name and email address</li>
            <li>Clinic name and branding preferences (if provided)</li>
            <li>Custom exercise videos uploaded to the platform</li>
            <li>Billing information — collected and processed directly by Stripe; ManualRx does not store card details</li>
          </ul>
          <p style={{ marginBottom: '10px' }}><strong style={{ color: '#e8edf5' }}>From clients (invited end users):</strong></p>
          <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
            <li>Name and email address</li>
            <li>Exercise prescription data (exercises assigned, sets, reps, weight)</li>
            <li>Session logs (date and time of completed sessions)</li>
            <li>Pain ratings (0–10 Numerical Pain Rating Scale)</li>
            <li>Perceived exertion ratings (0–10 Borg CR-10)</li>
            <li>Session notes and exercise notes entered by the client</li>
            <li>Optional feedback videos uploaded during session logging</li>
          </ul>
          <p style={{ marginBottom: '10px' }}><strong style={{ color: '#e8edf5' }}>Automatically collected:</strong></p>
          <ul style={{ paddingLeft: '20px' }}>
            <li>Session cookies required for authentication and to keep you logged in</li>
            <li>Anonymous infrastructure data collected by our hosting provider (Vercel) for performance and reliability purposes — this data is not linked to your identity</li>
          </ul>
        </Section>

        <Section title="3. Why We Collect This Information">
          <Table
            headers={['Data', 'Purpose']}
            rows={[
              ['Therapist account details', 'Account creation, authentication, subscription management'],
              ['Client name and email', 'Account creation, invite delivery, password reset'],
              ['Exercise and session data', 'Core platform functionality — delivering and tracking exercise prescriptions'],
              ['Pain ratings and RPE', 'Enabling therapists to monitor client progress and adherence'],
              ['Billing data', 'Processing subscription payments via Stripe'],
            ]}
          />
          <p style={{ marginTop: '12px' }}>We do not collect data for any purpose beyond operating the platform.</p>
        </Section>

        <Section title="4. Health Information">
          <p>Pain ratings, clinical exercise prescriptions, and session logs constitute <strong style={{ color: '#e8edf5' }}>health information</strong> under the Privacy Act 1988. We treat all such data with heightened care:</p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
            <li>Access is restricted to the individual client and their prescribing therapist only</li>
            <li>Health data is not used for marketing, analytics, or any secondary purpose</li>
            <li>Health data is not shared with any third party except as required to operate the platform (see Section 6)</li>
          </ul>
        </Section>

        <Section title="5. How We Store Your Data">
          <p>All database data is stored with Supabase, hosted in <strong style={{ color: '#e8edf5' }}>Sydney, Australia (AWS ap-southeast-2)</strong>. Exercise videos and uploaded files are stored in Supabase Storage, also in the Sydney region.</p>
          <p style={{ marginTop: '8px' }}>Access to your data is enforced at the database level using Row Level Security — therapists can only access their own clients' data; clients can only access their own records. Data is encrypted at rest using AES-256.</p>
        </Section>

        <Section title="6. Who We Share Your Data With">
          <p style={{ marginBottom: '12px' }}>ManualRx does not sell personal information. We share data only with the following third-party service providers as necessary to operate the platform:</p>
          <Table
            headers={['Provider', 'Purpose', 'Location']}
            rows={[
              ['Supabase', 'Database, authentication, file storage', 'Data stored Sydney, AU'],
              ['Vercel', 'Web hosting and deployment', 'USA'],
              ['Resend', 'Transactional email (invites, password resets)', 'USA'],
              ['Stripe', 'Subscription billing and payment processing', 'USA'],
            ]}
          />
          <p style={{ marginTop: '12px' }}>Several providers are US-based companies. By using ManualRx, you consent to your information being handled by these providers, who are contractually bound to protect it. We take reasonable steps to ensure overseas recipients handle data consistently with the Australian Privacy Principles (APP 8).</p>
        </Section>

        <Section title="7. How Long We Retain Your Data">
          <Table
            headers={['Data', 'Retention period']}
            rows={[
              ['Active account data', 'Retained while your account is active'],
              ['Client data after therapist cancels subscription', 'Retained for 30 days, then permanently deleted'],
              ['Data after account deletion', 'Deleted from live systems immediately; purged from encrypted backups within 90 days'],
              ['Billing records', 'Retained for 7 years as required by Australian tax law'],
            ]}
          />
        </Section>

        <Section title="8. Your Rights">
          <p>Under the Australian Privacy Act 1988, you have the right to:</p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px', marginBottom: '12px' }}>
            <li><strong style={{ color: '#e8edf5' }}>Access</strong> the personal information we hold about you</li>
            <li><strong style={{ color: '#e8edf5' }}>Correct</strong> inaccurate or out-of-date information</li>
            <li><strong style={{ color: '#e8edf5' }}>Request deletion</strong> of your account and associated data</li>
            <li><strong style={{ color: '#e8edf5' }}>Make a complaint</strong> about how we have handled your information</li>
          </ul>
          <p>To exercise these rights, email <a href="mailto:support@manualrx.com" style={{ color: '#29B5CC', textDecoration: 'none' }}>support@manualrx.com</a>. We will respond within 30 days.</p>
          <p style={{ marginTop: '8px' }}>If you are not satisfied with our response, you may lodge a complaint with the <strong style={{ color: '#e8edf5' }}>Office of the Australian Information Commissioner (OAIC)</strong> at oaic.gov.au or 1300 363 992.</p>
        </Section>

        <Section title="9. Cookies and Tracking">
          <p>ManualRx uses authentication cookies that are essential for you to stay logged in. These cannot be disabled as they are required for the service to function.</p>
          <p style={{ marginTop: '8px' }}>We do not use advertising cookies, third-party tracking pixels, or behavioural analytics. If this changes in future, this policy will be updated and you will be notified.</p>
        </Section>

        <Section title="10. Children's Privacy">
          <p>ManualRx is not directed at children under 18. We do not knowingly collect personal information from minors. If you believe a minor's information has been submitted, contact <a href="mailto:support@manualrx.com" style={{ color: '#29B5CC', textDecoration: 'none' }}>support@manualrx.com</a>.</p>
        </Section>

        <Section title="11. Changes to This Policy">
          <p>We may update this Privacy Policy from time to time. We will notify users of material changes by email or by displaying a notice on the platform. Continued use after notification constitutes acceptance of the updated policy.</p>
        </Section>

        <Section title="12. Contact">
          <p>For any privacy-related questions, access requests, or complaints:</p>
          <p style={{ marginTop: '8px' }}><strong style={{ color: '#e8edf5' }}>Email:</strong> <a href="mailto:support@manualrx.com" style={{ color: '#29B5CC', textDecoration: 'none' }}>support@manualrx.com</a></p>
        </Section>

        {/* Footer nav */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '24px', display: 'flex', gap: '24px', fontSize: '13px' }}>
          <Link to="/terms" style={{ color: '#29B5CC', textDecoration: 'none' }}>Terms of Service</Link>
          <Link to="/contact" style={{ color: '#29B5CC', textDecoration: 'none' }}>Contact</Link>
        </div>
      </div>
    </div>
  )
}

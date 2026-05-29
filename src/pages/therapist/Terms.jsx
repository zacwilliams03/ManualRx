import { Link } from 'react-router-dom'

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

export default function Terms() {
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
            Terms of Service
          </h1>
          <p style={{ fontSize: '13px', color: '#666' }}>Last updated: 30 May 2025</p>
        </div>

        <Section title="1. Agreement to Terms">
          <p>By creating an account on ManualRx (manualrx.com), you agree to these Terms of Service. If you do not agree, do not use the service.</p>
          <p style={{ marginTop: '8px' }}>These Terms form a binding contract between you and Zachary Rigden Williams (ABN 84 940 411 925), trading as ManualRx.</p>
        </Section>

        <Section title="2. Who Can Use ManualRx">
          <p><strong style={{ color: '#e8edf5' }}>Therapist accounts</strong> are available to qualified massage therapists, physiotherapists, and other manual therapy practitioners. By registering, you represent that you hold the qualifications and registrations required to practise in your jurisdiction.</p>
          <p style={{ marginTop: '8px' }}><strong style={{ color: '#e8edf5' }}>Client accounts</strong> are available by invitation only, to individuals invited by a registered therapist using the platform.</p>
          <p style={{ marginTop: '8px' }}>You must be 18 or older to create an account.</p>
        </Section>

        <Section title="3. What ManualRx Is (and Is Not)">
          <p>ManualRx is a software tool for exercise prescription and tracking. It is:</p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px', marginBottom: '14px' }}>
            <li>A platform for therapists to assign and monitor exercise programs</li>
            <li>A tool for clients to log exercise completion and track progress</li>
          </ul>
          <p>ManualRx is <strong style={{ color: '#e8edf5' }}>not</strong>:</p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px', marginBottom: '14px' }}>
            <li>A medical device</li>
            <li>A clinical records system</li>
            <li>A substitute for professional clinical judgment</li>
            <li>A provider of medical, therapeutic, or health advice</li>
          </ul>
          <p>Nothing on this platform constitutes medical advice. Therapists are solely responsible for the clinical appropriateness of any exercise prescribed through the platform. Clients should consult their therapist if they experience pain, injury, or uncertainty about any prescribed exercise.</p>
        </Section>

        <Section title="4. Accounts and Security">
          <p>You are responsible for:</p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px', marginBottom: '12px' }}>
            <li>Keeping your login credentials secure and confidential</li>
            <li>All activity that occurs under your account</li>
            <li>Notifying us immediately at <a href="mailto:support@manualrx.com" style={{ color: '#29B5CC', textDecoration: 'none' }}>support@manualrx.com</a> if you suspect unauthorised access</li>
          </ul>
          <p>We reserve the right to suspend or terminate accounts where we have reason to believe credentials have been compromised.</p>
        </Section>

        <Section title="5. Subscriptions and Billing">
          <p>Therapist subscriptions are billed in advance on a recurring monthly or annual basis. All prices are in Australian dollars (AUD) and are GST inclusive.</p>
          <p style={{ marginTop: '10px' }}>Current pricing is displayed on our website and within the platform. We reserve the right to update pricing with at least 30 days notice to existing subscribers.</p>
          <p style={{ marginTop: '10px' }}>Payments are processed by Stripe. By subscribing, you agree to Stripe's terms of service. ManualRx does not store your payment card details.</p>

          <p style={{ marginTop: '16px' }}><strong style={{ color: '#e8edf5' }}>Cancellation:</strong> You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period. Access to the platform continues until that date.</p>

          <p style={{ marginTop: '10px' }}><strong style={{ color: '#e8edf5' }}>Refunds:</strong> We do not issue refunds for partial billing periods. This does not affect any rights you may have under the Australian Consumer Law.</p>

          <p style={{ marginTop: '16px' }}><strong style={{ color: '#e8edf5' }}>Effect of cancellation on clients:</strong> When a therapist's subscription expires or is cancelled, all associated client accounts will lose access to the platform. Client data is retained for 30 days following subscription end, then permanently deleted. Therapists are responsible for informing their clients of this before cancelling.</p>
        </Section>

        <Section title="6. Client Relationships">
          <p>Clients access ManualRx solely through an invitation from their therapist. The therapist is responsible for:</p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px', marginBottom: '12px' }}>
            <li>Obtaining any consent required from clients to use this platform</li>
            <li>The clinical content of all exercise prescriptions</li>
            <li>Informing clients of the platform's scope and limitations</li>
          </ul>
          <p>ManualRx is not a party to the therapeutic relationship between therapist and client.</p>
        </Section>

        <Section title="7. Your Content">
          <p>You retain ownership of content you upload to ManualRx, including custom exercise videos and notes. By uploading, you grant ManualRx a limited licence to store and deliver that content to your clients on your behalf.</p>
          <p style={{ marginTop: '8px' }}>You are responsible for ensuring you have the right to upload any content and that it does not infringe third-party intellectual property rights.</p>
          <p style={{ marginTop: '8px' }}>You must not upload content that is illegal, defamatory, harmful, or infringes third-party rights. We reserve the right to remove such content and terminate accounts in breach of this clause.</p>
        </Section>

        <Section title="8. Acceptable Use">
          <p>You must not:</p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
            <li>Use ManualRx for any unlawful purpose</li>
            <li>Attempt to access another user's data</li>
            <li>Reverse engineer, decompile, or copy any part of the platform</li>
            <li>Resell or sublicense access to the platform without written permission</li>
            <li>Use the platform in any way that could damage, disable, or impair it</li>
            <li>Upload malicious code or attempt to compromise platform security</li>
          </ul>
        </Section>

        <Section title="9. Intellectual Property">
          <p>All code, design, branding, and built-in exercise content on ManualRx is owned by Zachary Rigden Williams and protected by copyright. Nothing in these Terms grants you any rights to ManualRx's intellectual property beyond what is necessary to use the service.</p>
        </Section>

        <Section title="10. Limitation of Liability">
          <p>To the maximum extent permitted by law:</p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px', marginBottom: '12px' }}>
            <li>ManualRx is provided "as is" without warranties of any kind</li>
            <li>We do not warrant that the service will be uninterrupted or error-free</li>
            <li>We are not liable for any indirect, incidental, or consequential loss arising from your use of the platform</li>
            <li>Our total liability to you in any 12-month period shall not exceed the total amount you paid to us in that period</li>
          </ul>
          <p>Nothing in these Terms excludes or limits any rights you have under the <strong style={{ color: '#e8edf5' }}>Australian Consumer Law</strong> that cannot lawfully be excluded.</p>
        </Section>

        <Section title="11. Indemnification">
          <p>You agree to indemnify and hold harmless Zachary Rigden Williams trading as ManualRx against any claims, losses, damages, or expenses (including reasonable legal fees) arising from:</p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
            <li>Your use of the platform in violation of these Terms</li>
            <li>Your exercise prescriptions or clinical decisions</li>
            <li>Content you upload to the platform</li>
          </ul>
        </Section>

        <Section title="12. Service Changes and Availability">
          <p>We reserve the right to modify, suspend, or discontinue the service with reasonable notice. We will endeavour to provide at least 30 days notice of any material changes that affect your use of the platform.</p>
        </Section>

        <Section title="13. Changes to These Terms">
          <p>We may update these Terms from time to time. We will notify you by email and by a notice on the platform at least 14 days before material changes take effect. Continued use of the service after the effective date constitutes acceptance of the updated Terms.</p>
        </Section>

        <Section title="14. Termination">
          <p>We may suspend or terminate your account immediately if you:</p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px', marginBottom: '12px' }}>
            <li>Breach these Terms</li>
            <li>Use the platform in a way that poses a risk of harm to others</li>
            <li>Fail to pay subscription fees when due</li>
          </ul>
          <p>You may terminate your account at any time by cancelling your subscription and contacting <a href="mailto:support@manualrx.com" style={{ color: '#29B5CC', textDecoration: 'none' }}>support@manualrx.com</a>.</p>
        </Section>

        <Section title="15. Governing Law">
          <p>These Terms are governed by the laws of New South Wales, Australia. Any disputes will be subject to the exclusive jurisdiction of the courts of New South Wales.</p>
        </Section>

        <Section title="16. Contact">
          <p><strong style={{ color: '#e8edf5' }}>Zachary Rigden Williams</strong> trading as ManualRx</p>
          <p style={{ marginTop: '4px' }}>ABN 84 940 411 925</p>
          <p style={{ marginTop: '4px' }}>Email: <a href="mailto:support@manualrx.com" style={{ color: '#29B5CC', textDecoration: 'none' }}>support@manualrx.com</a></p>
        </Section>

        {/* Footer nav */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '24px', display: 'flex', gap: '24px', fontSize: '13px' }}>
          <Link to="/privacy" style={{ color: '#29B5CC', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link to="/contact" style={{ color: '#29B5CC', textDecoration: 'none' }}>Contact</Link>
        </div>
      </div>
    </div>
  )
}

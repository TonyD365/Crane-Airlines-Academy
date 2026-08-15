import type { Metadata } from 'next'
import { LegalPageShell, LegalSection } from '@/components/legal-page-shell'

export const metadata: Metadata = {
  title: 'Terms of Service — Crane Airlines Academy',
  description: 'The terms that govern your use of Crane Airlines Academy.',
}

export default function TermsOfServicePage() {
  return (
    <LegalPageShell title="Terms of Service" lastUpdated="August 15, 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Crane Airlines Academy
        (the &ldquo;Platform&rdquo;). By signing in and using the Platform, you agree to these Terms. If you do
        not agree, do not use the Platform.
      </p>

      <LegalSection heading="1. Eligibility and accounts">
        <p>
          Accounts on the Platform are created by administrators. You sign in using your Roblox account through
          Roblox OAuth 2.0; you may only sign in with a Roblox account that an administrator has registered for
          you. You are responsible for keeping access to your Roblox account secure and for all activity that
          occurs under your account.
        </p>
      </LegalSection>

      <LegalSection heading="2. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Access accounts or content you are not authorized to access</li>
          <li>Attempt to disrupt, damage, or gain unauthorized access to the Platform</li>
          <li>Copy, distribute, or resell course content without permission</li>
          <li>Use the Platform for any unlawful purpose or in violation of these Terms</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Course content and intellectual property">
        <p>
          Course materials, lessons, tasks, and other content on the Platform are owned by us or our licensors
          and are provided for your personal, non-commercial learning use. You may not reproduce or redistribute
          the content except as expressly permitted.
        </p>
      </LegalSection>

      <LegalSection heading="4. Relationship to Roblox">
        <p>
          The Platform uses Roblox OAuth 2.0 for sign-in. We are an independent service and are{' '}
          <strong>not affiliated with, endorsed by, or sponsored by Roblox Corporation</strong>. Your use of
          Roblox is governed by Roblox&rsquo;s own terms and policies.
        </p>
      </LegalSection>

      <LegalSection heading="5. Availability and changes">
        <p>
          We may modify, suspend, or discontinue any part of the Platform at any time. We may also update
          features and content without notice. We are not liable for any unavailability of the Platform.
        </p>
      </LegalSection>

      <LegalSection heading="6. Disclaimers">
        <p>
          The Platform is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any
          kind, whether express or implied, including fitness for a particular purpose and non-infringement. We
          do not warrant that the Platform will be uninterrupted, error-free, or secure.
        </p>
      </LegalSection>

      <LegalSection heading="7. Limitation of liability">
        <p>
          To the maximum extent permitted by law, we will not be liable for any indirect, incidental, special,
          consequential, or punitive damages, or any loss of data, arising out of or related to your use of the
          Platform.
        </p>
      </LegalSection>

      <LegalSection heading="8. Termination">
        <p>
          We may suspend or terminate your access to the Platform at any time, including for violation of these
          Terms. Administrators may delete accounts they created.
        </p>
      </LegalSection>

      <LegalSection heading="9. Changes to these Terms">
        <p>
          We may update these Terms from time to time. When we do, we will revise the &ldquo;Last updated&rdquo;
          date at the top of this page. Your continued use of the Platform after changes take effect constitutes
          acceptance of the updated Terms.
        </p>
      </LegalSection>

      <LegalSection heading="10. Governing law">
        <p>
          These Terms are governed by the laws of the jurisdiction in which the Platform operator is
          established, without regard to conflict-of-law principles. (Replace with your governing jurisdiction.)
        </p>
      </LegalSection>

      <LegalSection heading="11. Contact us">
        <p>
          Questions about these Terms? Contact us at{' '}
          <a className="text-[#2b295c] underline dark:text-indigo-300" href="mailto:support@example.com">
            support@example.com
          </a>
          . (Replace this with your own contact address.)
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}

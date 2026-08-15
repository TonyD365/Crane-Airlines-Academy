import type { Metadata } from 'next'
import { LegalPageShell, LegalSection } from '@/components/legal-page-shell'

export const metadata: Metadata = {
  title: 'Privacy Policy — Crane Airlines Academy',
  description: 'How Crane Airlines Academy collects, uses, and protects your information.',
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell title="Privacy Policy" lastUpdated="August 15, 2026">
      <p>
        This Privacy Policy explains how Crane Airlines Academy (&ldquo;we&rdquo;, &ldquo;us&rdquo;, the
        &ldquo;Platform&rdquo;) collects, uses, and protects information when you use our online learning
        platform. By signing in and using the Platform, you agree to the practices described here.
      </p>

      <LegalSection heading="1. Who we are">
        <p>
          Crane Airlines Academy is a private online learning platform. Accounts are created by
          administrators, and you sign in using your Roblox account through Roblox OAuth 2.0.
        </p>
        <p>
          We are an independent platform. We are <strong>not affiliated with, endorsed by, or sponsored by
          Roblox Corporation</strong>. &ldquo;Roblox&rdquo; is a trademark of Roblox Corporation.
        </p>
      </LegalSection>

      <LegalSection heading="2. Information we collect">
        <p>When you sign in with Roblox, we receive the following from Roblox (via the “openid” and “profile” scopes):</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Your Roblox numeric user ID</li>
          <li>Your Roblox username and display name</li>
          <li>Your public Roblox profile information (such as your avatar image)</li>
        </ul>
        <p>
          We do <strong>not</strong> receive or store your Roblox password, and we do not collect your email
          address.
        </p>
        <p>As you use the Platform, we also store learning data you generate, such as:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Course, lesson, and task progress and completion</li>
          <li>Scores, points, and flashcard study history</li>
          <li>The group an administrator assigns you to</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. How we use your information">
        <ul className="list-disc space-y-1 pl-6">
          <li>To authenticate you and provide access to your account</li>
          <li>To deliver course content and track your learning progress</li>
          <li>To let instructors and administrators manage users, groups, and course access</li>
          <li>To maintain the security and integrity of the Platform</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Authentication through Roblox">
        <p>
          Sign-in is handled by Roblox OAuth 2.0. Your interaction with Roblox during sign-in is also governed
          by Roblox&rsquo;s own privacy policy and terms. We only request the minimum scopes needed to identify
          your account (“openid” and “profile”).
        </p>
      </LegalSection>

      <LegalSection heading="5. How we share information">
        <p>
          We do not sell your personal information. Your account details and learning progress are visible to
          the instructors and administrators of the Platform for the purpose of running courses. We may share
          information with service providers who host the Platform on our behalf, and where required by law.
        </p>
      </LegalSection>

      <LegalSection heading="6. Data retention and deletion">
        <p>
          We keep your account and learning data while your account is active. When an administrator deletes
          your account, the associated learning records are removed. You may request deletion of your account
          by contacting an administrator.
        </p>
      </LegalSection>

      <LegalSection heading="7. Security">
        <p>
          We use reasonable technical and organizational measures to protect your information. No method of
          transmission or storage is completely secure, so we cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection heading="8. Children and young users">
        <p>
          The Platform is used together with Roblox, whose community includes minors. If you are under the age
          of majority in your jurisdiction, you should use the Platform only with the involvement and consent
          of a parent, guardian, or your school. Administrators are responsible for ensuring appropriate
          consent for the accounts they create.
        </p>
      </LegalSection>

      <LegalSection heading="9. Your rights">
        <p>
          Depending on where you live, you may have rights to access, correct, or delete your personal
          information. To exercise these rights, contact an administrator using the details below.
        </p>
      </LegalSection>

      <LegalSection heading="10. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we will revise the &ldquo;Last
          updated&rdquo; date at the top of this page.
        </p>
      </LegalSection>

      <LegalSection heading="11. Contact us">
        <p>
          If you have questions about this Privacy Policy or your data, contact us at{' '}
          <a className="text-[#2b295c] underline dark:text-indigo-300" href="mailto:support@example.com">
            support@example.com
          </a>
          . (Replace this with your own contact address.)
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}

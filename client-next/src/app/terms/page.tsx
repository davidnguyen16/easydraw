import type { Metadata } from 'next';
import LegalLayout from '@/lib/components/legal/LegalLayout';
import LegalSection from '@/lib/components/legal/LegalSection';

export const metadata: Metadata = {
  title: 'Terms of Service | EasyDraw',
  description: 'The rules that apply when you create an account and use EasyDraw.',
};

const lastUpdated = '27 July 2026';

const sections = [
  { id: 'acceptance', title: 'Acceptance of these Terms' },
  { id: 'eligibility', title: 'Eligibility' },
  { id: 'service', title: 'The Service' },
  { id: 'free-service', title: 'Free Service' },
  { id: 'account', title: 'Your Account' },
  { id: 'your-content', title: 'Your Content' },
  { id: 'our-content', title: 'EasyDraw Software and Content' },
  { id: 'acceptable-use', title: 'Acceptable Use' },
  { id: 'third-parties', title: 'Third-party Services' },
  { id: 'availability', title: 'Availability and Changes' },
  { id: 'liability', title: 'Consumer Rights and Liability' },
  { id: 'termination', title: 'Suspension and Termination' },
  { id: 'changes', title: 'Changes to these Terms' },
  { id: 'governing-law', title: 'Governing Law' },
  { id: 'general', title: 'General' },
  { id: 'contact', title: 'Contact' },
];

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      description="The rules that apply when you create an account and use EasyDraw."
      lastUpdated={lastUpdated}
      sections={sections}
    >
      <LegalSection id="acceptance" number={1} title="Acceptance of these Terms">
        <p>
          These Terms of Service govern your access to and use of EasyDraw (the{' '}
          <strong>Service</strong>). In these Terms, “EasyDraw”, “we”, “us”, and “our” refer to the
          operator of the Service from New South Wales, Australia.
        </p>
        <p>
          By creating an account, signing in, or using the Service, you agree to these Terms and
          acknowledge our <a href="/privacy">Privacy Policy</a>. If you do not agree, do not use the
          Service.
        </p>
      </LegalSection>

      <LegalSection id="eligibility" number={2} title="Eligibility">
        <p>
          You must be at least 16 years old and legally capable of agreeing to these Terms. If you
          are under 18, you must have permission from a parent or legal guardian where required by
          law. You must not use the Service if doing so is prohibited by law.
        </p>
      </LegalSection>

      <LegalSection id="service" number={3} title="The Service">
        <p>
          EasyDraw is an online diagramming tool for creating, editing, storing, and exporting
          technical diagrams, including entity-relationship diagrams, UML diagrams, flowcharts, and
          data-flow diagrams.
        </p>
        <p>
          Features may evolve over time. Any examples, templates, or suggestions provided by the
          Service are general tools only; you remain responsible for reviewing the accuracy and
          suitability of your diagrams.
        </p>
      </LegalSection>

      <LegalSection id="free-service" number={4} title="Free Service">
        <p>
          EasyDraw is currently provided free of charge, and we do not request payment information.
          If paid features are introduced, we will clearly explain the applicable price and terms
          before you choose to purchase them. Your continued use of existing free features will not
          itself authorise a charge.
        </p>
      </LegalSection>

      <LegalSection id="account" number={5} title="Your Account">
        <ul>
          <li>You must provide accurate and current registration information.</li>
          <li>
            You are responsible for keeping your login credentials secure and for activity on your
            account.
          </li>
          <li>
            You must tell us promptly at{' '}
            <a href="mailto:support@easydraw.net">support@easydraw.net</a> if you suspect
            unauthorised use.
          </li>
          <li>You may delete your account from the Settings page at any time.</li>
        </ul>
      </LegalSection>

      <LegalSection id="your-content" number={6} title="Your Content">
        <p>
          As between you and EasyDraw, you retain the rights you hold in diagrams and other content
          you create or upload (<strong>Your Content</strong>).
        </p>
        <p>
          You grant EasyDraw a limited, worldwide, non-exclusive, royalty-free licence to host,
          process, reproduce, transmit, back up, and display Your Content only as reasonably
          necessary to operate, secure, and provide the Service to you. This licence ends when Your
          Content is deleted, subject to reasonable backup cycles and any retention required by law.
        </p>
        <p>
          You are responsible for Your Content and must have the rights needed to use it. Your
          Content must not violate applicable law, these Terms, or another person’s rights.
        </p>
      </LegalSection>

      <LegalSection id="our-content" number={7} title="EasyDraw Software and Content">
        <p>
          The EasyDraw software, interface, branding, templates, documentation, and materials
          provided by us remain owned by EasyDraw or its licensors. Subject to these Terms, we grant
          you a limited, personal, non-exclusive, non-transferable, revocable right to use the
          Service for its intended purpose.
        </p>
        <p>
          These Terms do not transfer ownership of the Service or permit you to use EasyDraw branding
          in a way that suggests endorsement or affiliation.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" number={8} title="Acceptable Use">
        <p>You must not:</p>
        <ul>
          <li>use the Service for an unlawful, fraudulent, or harmful purpose;</li>
          <li>upload content that infringes another person’s privacy or intellectual property;</li>
          <li>access or attempt to access another user’s account or private diagrams;</li>
          <li>introduce malware, malicious code, or content intended to damage the Service;</li>
          <li>
            send excessive automated requests, scrape the Service, or interfere with its
            availability;
          </li>
          <li>bypass authentication, security controls, or rate limits;</li>
          <li>
            reverse engineer or attempt to extract source code, except to the extent the law
            expressly permits it; or
          </li>
          <li>help another person do any of the above.</li>
        </ul>
      </LegalSection>

      <LegalSection id="third-parties" number={9} title="Third-party Services">
        <p>
          EasyDraw relies on third-party providers for functions such as cloud hosting,
          authentication, email delivery, domain services, and security. Their services may be
          subject to their own terms and privacy practices.
        </p>
        <p>
          We are not responsible for third-party services that you choose to access separately, but
          nothing in this section limits any right or remedy that cannot lawfully be limited. Our
          handling of providers that process personal information for EasyDraw is described in our{' '}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </LegalSection>

      <LegalSection id="availability" number={10} title="Availability and Changes">
        <p>
          We aim to keep EasyDraw reliable, but do not promise that it will always be uninterrupted,
          error-free, secure, or available. Maintenance, outages, internet failures, and events
          outside our reasonable control may affect the Service.
        </p>
        <p>
          We may improve, replace, suspend, or discontinue features where reasonably necessary. Where
          practicable, we will give reasonable notice of a significant reduction or discontinuation
          and an opportunity to export important diagrams.
        </p>
      </LegalSection>

      <LegalSection id="liability" number={11} title="Consumer Rights and Liability">
        <p>
          Nothing in these Terms excludes, restricts, or modifies any consumer guarantee, right,
          remedy, warranty, or liability that cannot lawfully be excluded, including rights that may
          apply under the Australian Consumer Law.
        </p>
        <p>
          Subject to those non-excludable rights, and to the maximum extent permitted by law,
          EasyDraw is not liable for indirect, incidental, special, or consequential loss arising
          from your use of, or inability to use, the Service. This limitation does not apply to
          fraud, wilful misconduct, gross negligence, or any liability that cannot lawfully be
          limited.
        </p>
        <p>
          Online storage can fail. You should regularly export copies of diagrams that are important
          to you.
        </p>
      </LegalSection>

      <LegalSection id="termination" number={12} title="Suspension and Termination">
        <p>
          We may restrict, suspend, or terminate access if you seriously or repeatedly breach these
          Terms, create a security risk, use the Service unlawfully, or if suspension is reasonably
          necessary to protect the Service or others. Where practicable and lawful, we will provide
          notice and a reasonable opportunity to address the issue or export Your Content.
        </p>
        <p>
          You may stop using EasyDraw or delete your account at any time. Following deletion, we
          handle account information, diagrams, browser data, and backups as described in the{' '}
          <a href="/privacy#retention">Privacy Policy</a>.
        </p>
      </LegalSection>

      <LegalSection id="changes" number={13} title="Changes to these Terms">
        <p>
          We may update these Terms to reflect changes to the Service, our practices, or applicable
          law. We will update the date at the top of this page and, where a change materially affects
          your rights, provide reasonable additional notice.
        </p>
        <p>
          If you do not agree to updated Terms, you should stop using the Service and may export your
          diagrams and delete your account.
        </p>
      </LegalSection>

      <LegalSection id="governing-law" number={14} title="Governing Law">
        <p>
          These Terms are governed by the laws of New South Wales, Australia. You and EasyDraw submit
          to the non-exclusive jurisdiction of the courts of New South Wales and courts entitled to
          hear appeals from them. This does not prevent you from relying on mandatory rights or
          protections available under the law that applies to you.
        </p>
      </LegalSection>

      <LegalSection id="general" number={15} title="General">
        <p>
          If a provision of these Terms is held invalid or unenforceable, the remaining provisions
          continue to apply. A delay in enforcing a right is not a waiver of that right. You may not
          transfer your rights under these Terms without our consent; we may transfer our rights as
          part of a genuine reorganisation, financing, or transfer of the Service, subject to
          applicable law.
        </p>
        <p>
          These Terms and the documents expressly referenced in them form the agreement between you
          and EasyDraw concerning the Service.
        </p>
      </LegalSection>

      <LegalSection id="contact" number={16} title="Contact">
        <p>
          Questions about these Terms can be sent to{' '}
          <a href="mailto:support@easydraw.net">support@easydraw.net</a>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

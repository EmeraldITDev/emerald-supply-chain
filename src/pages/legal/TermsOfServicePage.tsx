import { Link } from "react-router-dom";
import { LegalPageShell, LEGAL_CONTACT_PRIVACY, LEGAL_CONTACT_AP, LEGAL_EFFECTIVE, LEGAL_ENTITY, LEGAL_PLATFORM } from "./LegalPageShell";

/**
 * Public Terms of Service for the Emerald CFZE SCM Platform.
 * Drafted for operational use; have counsel review before relying on it as final legal advice.
 */
export default function TermsOfServicePage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      effectiveDate={LEGAL_EFFECTIVE}
      lastUpdated={LEGAL_EFFECTIVE}
    >
      <section className="space-y-3">
        <h2>1. Agreement to these Terms</h2>
        <p>
          These Terms of Service (&quot;Terms&quot;) govern access to and use of the {LEGAL_PLATFORM}{" "}
          (the &quot;Platform&quot;) operated by <strong className="text-foreground">{LEGAL_ENTITY}</strong>{" "}
          (&quot;Emerald&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;).
        </p>
        <p>
          By accessing or using the Platform — including as an internal user, vendor, or registration
          applicant — you agree to these Terms and our{" "}
          <Link to="/privacy">Privacy Policy</Link>. If you do not agree, do not use the Platform.
        </p>
      </section>

      <section className="space-y-3">
        <h2>2. The Platform</h2>
        <p>
          The Platform supports Emerald&apos;s supply-chain operations, which may include material and
          service requisitions, approvals, vendor registration, RFQs and quotations, purchase orders,
          logistics/trip management, warehouse and inventory, notifications, reporting, and related
          finance handoffs.
        </p>
        <p>
          Features available to you depend on your account type and assigned role. We may add, change,
          or discontinue features with reasonable notice where practicable.
        </p>
      </section>

      <section className="space-y-3">
        <h2>3. Eligibility and accounts</h2>
        <ul>
          <li>You must be authorised by your organisation (Emerald staff) or by your vendor business to use the Platform.</li>
          <li>You must provide accurate registration and profile information and keep it up to date.</li>
          <li>You are responsible for safeguarding login credentials and for activity under your account.</li>
          <li>Notify us promptly at <a href={`mailto:${LEGAL_CONTACT_PRIVACY}`}>{LEGAL_CONTACT_PRIVACY}</a> if you suspect unauthorised access.</li>
          <li>We may suspend or terminate access for security, misuse, inactivity, or organisational policy reasons.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>4. Internal (staff) users</h2>
        <p>If you are an Emerald employee or authorised contractor:</p>
        <ul>
          <li>Use the Platform only for legitimate business purposes and in line with Emerald policies.</li>
          <li>Do not share accounts, bypass approval workflows, or falsify requisitions, approvals, or documents.</li>
          <li>Treat vendor and colleague data as confidential except where disclosure is required for your role.</li>
          <li>Your use may be audited. Misuse may result in disciplinary action and loss of access.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>5. Vendors and registration applicants</h2>
        <p>If you register or use the Vendor Portal:</p>
        <ul>
          <li>
            You represent that you are authorised to bind the vendor company you register, and that
            information and documents you submit are true, complete, and not misleading.
          </li>
          <li>
            Registration does not guarantee approval, award of business, or invitation to every RFQ.
            Emerald evaluates applications and quotations at its discretion subject to applicable law
            and any separate written contract.
          </li>
          <li>
            Quotations, pricing, and commitments submitted through the Platform are offers to Emerald
            and may be accepted, rejected, or negotiated according to Emerald procurement processes.
          </li>
          <li>
            You must keep credentials secure, respond to RFQs and clarifications in good faith, and
            honour purchase orders and delivery obligations once accepted under applicable commercial terms.
          </li>
          <li>
            Bank and tax details you provide must be accurate; you are responsible for notifying Emerald
            of changes that affect payment.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>6. Acceptable use</h2>
        <p>You must not:</p>
        <ul>
          <li>Attempt to gain unauthorised access to systems, data, or other users&apos; accounts</li>
          <li>Upload malware, scrape the Platform abusively, or disrupt service</li>
          <li>Upload unlawful, infringing, or fraudulent content</li>
          <li>Use the Platform to compete unfairly, harvest contacts for spam, or violate export/sanctions rules</li>
          <li>Reverse engineer the Platform except to the limited extent permitted by mandatory law</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>7. Content and documents</h2>
        <p>
          You retain ownership of materials you submit (for example quotations and certificates), and
          grant Emerald a licence to use, store, reproduce, and share them as needed to operate
          procurement and related workflows. Platform software, design, and Emerald-owned content remain
          Emerald&apos;s (or its licensors&apos;) property.
        </p>
        <p>
          Generated documents such as purchase orders are Emerald business records. Unauthorised
          alteration or redistribution outside authorised channels is prohibited.
        </p>
      </section>

      <section className="space-y-3">
        <h2>8. Confidentiality</h2>
        <p>
          Non-public Platform information — including pricing, RFQ contents, internal approvals, and
          other users&apos; data — is confidential. You may use it only for the purpose for which it
          was provided and must not disclose it except to personnel with a need to know or as required by law.
        </p>
      </section>

      <section className="space-y-3">
        <h2>9. Third-party services</h2>
        <p>
          The Platform may rely on hosting, email, storage, or other third-party services. Emerald is
          not responsible for third-party outages outside its reasonable control, though we will take
          commercially reasonable steps to restore service.
        </p>
      </section>

      <section className="space-y-3">
        <h2>10. Disclaimers</h2>
        <p>
          The Platform is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the
          fullest extent permitted by Nigerian law, Emerald disclaims warranties of uninterrupted
          availability, error-free operation, or fitness for a particular purpose. Operational decisions
          (approvals, awards, payments) remain subject to Emerald&apos;s internal processes and any
          separate written agreements.
        </p>
      </section>

      <section className="space-y-3">
        <h2>11. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, Emerald and its officers, employees, and agents will
          not be liable for indirect, incidental, special, consequential, or punitive damages, or for
          loss of profits, data, or business opportunity arising from use of (or inability to use) the
          Platform. Emerald&apos;s aggregate liability arising out of these Terms or the Platform is
          limited to the fees (if any) you paid specifically for Platform access in the twelve (12)
          months before the claim — or, for vendors with no Platform access fee, to a maximum of one
          hundred thousand Naira (₦100,000), except where liability cannot be limited under mandatory law
          (for example proven fraud or death/personal injury caused by negligence where such limitation is prohibited).
        </p>
      </section>

      <section className="space-y-3">
        <h2>12. Indemnity</h2>
        <p>
          You agree to indemnify and hold harmless Emerald from claims, losses, and expenses (including
          reasonable legal fees) arising from your breach of these Terms, your unlawful use of the
          Platform, or inaccurate information or documents you submit, except to the extent caused by
          Emerald&apos;s wilful misconduct.
        </p>
      </section>

      <section className="space-y-3">
        <h2>13. Suspension and termination</h2>
        <p>
          We may suspend or terminate access immediately for material breach, security risk, inactivity,
          or organisational instruction. You may stop using the Platform at any time. Provisions that by
          nature should survive (confidentiality, IP, liability limits, indemnity, governing law) survive
          termination.
        </p>
      </section>

      <section className="space-y-3">
        <h2>14. Changes to these Terms</h2>
        <p>
          We may update these Terms periodically. We will revise the &quot;Last updated&quot; date and,
          where changes are material, may provide additional notice via the Platform or email. Continued
          use after the effective date constitutes acceptance, except where mandatory law requires otherwise.
        </p>
      </section>

      <section className="space-y-3">
        <h2>15. Governing law and disputes</h2>
        <p>
          These Terms are governed by the laws of the Federal Republic of Nigeria. Courts in Nigeria
          shall have exclusive jurisdiction over disputes arising from these Terms or the Platform,
          without prejudice to any mandatory consumer or data-protection rights that cannot be waived.
        </p>
      </section>

      <section className="space-y-3">
        <h2>16. Contact</h2>
        <p>
          <strong className="text-foreground">{LEGAL_ENTITY}</strong>
          <br />
          General / procurement:{" "}
          <a href={`mailto:${LEGAL_CONTACT_PRIVACY}`}>{LEGAL_CONTACT_PRIVACY}</a>
          <br />
          Accounts payable:{" "}
          <a href={`mailto:${LEGAL_CONTACT_AP}`}>{LEGAL_CONTACT_AP}</a>
        </p>
      </section>
    </LegalPageShell>
  );
}

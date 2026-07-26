import type { Metadata } from "next";
import Link from "next/link";
import { colors } from "@/lib/colors";
import { operator } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Use — Bech De",
  description: "The rules for buying and selling on Bech De.",
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 21, letterSpacing: "-.4px", color: colors.ink, margin: "34px 0 10px" }}>
      {children}
    </h2>
  );
}

export default function TermsPage() {
  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 34, letterSpacing: "-1px", color: colors.ink, margin: "0 0 8px" }}>
        Terms of Use
      </h1>
      <p style={{ marginTop: 0 }}>
        Bech De is run by <b>{operator.entity}</b>, {operator.address}. By using it you agree to what&apos;s below. If you
        don&apos;t, please don&apos;t use the service.
      </p>

      <H2>What Bech De is</H2>
      <p>
        Bech De is a <b>venue</b> where neighbours list second-hand things and arrange to meet. We are an intermediary
        under the Information Technology Act, 2000. We are not the seller, we never take possession of an item, and we
        are not party to the deal you strike. Payment happens directly between you and the other person, in whatever way
        you both agree.
      </p>

      <H2>Who can use it</H2>
      <p>
        You must be 18 or older and able to enter a contract under Indian law. One account per person. Keep access to
        your email secure — anyone with it can sign in as you.
      </p>

      <H2>Listing rules</H2>
      <ul>
        <li>List only things you actually own and can legally sell.</li>
        <li>Describe them honestly — real photos, real condition, real price.</li>
        <li>
          Nothing on the{" "}
          <Link href="/legal/prohibited" style={{ color: colors.clay, fontWeight: 700 }}>
            prohibited items
          </Link>{" "}
          list. That list is not exhaustive; if something is illegal offline, it&apos;s not allowed here.
        </li>
        <li>No spam, no duplicate listings, no listings for services, jobs, loans or investments.</li>
        <li>Don&apos;t post someone else&apos;s photos, or anyone&apos;s personal details.</li>
      </ul>

      <H2>Behaviour</H2>
      <p>
        Be decent. No harassment, threats, hate speech, or attempts to move people off the platform to defraud them.
        Anyone can report a listing, and anyone can block another user — a block hides that person&apos;s listings from
        you and stops them messaging you.
      </p>

      <H2>Meeting safely</H2>
      <p>
        Meet in a public, well-lit place. Inspect the item before you pay. Bring someone if a deal feels off. We suggest
        meeting points but we cannot vet them, or the people you meet.
      </p>

      <H2>What we can do</H2>
      <p>
        We may remove a listing, restrict, or close an account that breaks these terms or the law — usually with notice,
        immediately if there&apos;s risk of harm. You can withdraw your own listings at any time from the listing page.
      </p>

      <H2>Liability</H2>
      <p>
        The service is provided &ldquo;as is&rdquo;. We don&apos;t guarantee that an item is as described, that a buyer
        will show up, or that the service will be uninterrupted. To the extent the law allows, we are not liable for
        losses arising from a transaction between users. Nothing here limits liability that cannot legally be limited.
      </p>

      <H2>Content you post</H2>
      <p>
        Your photos and descriptions stay yours. You give us permission to display them within Bech De so your listing
        can be found. Withdraw the listing and we stop showing it.
      </p>

      <H2>Grievances</H2>
      <p>
        Contact <b>{operator.grievanceOfficer}</b> at <b>{operator.grievanceEmail}</b>. We acknowledge within 48 hours
        and aim to resolve within 30 days. For anything else, {operator.supportEmail}.
      </p>

      <H2>Governing law</H2>
      <p>
        These terms are governed by the laws of India, and the courts of {operator.jurisdiction} have exclusive
        jurisdiction. See also our{" "}
        <Link href="/legal/privacy" style={{ color: colors.clay, fontWeight: 700 }}>
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}

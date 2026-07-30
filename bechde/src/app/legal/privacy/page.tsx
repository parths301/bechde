import type { Metadata } from "next";
import Link from "next/link";
import { colors } from "@/lib/colors";
import { operator } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — Bech De",
  description: "What Bech De collects, why, how long we keep it, and how to get it removed.",
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 21, letterSpacing: "-.4px", color: colors.ink, margin: "34px 0 10px" }}>
      {children}
    </h2>
  );
}

export default function PrivacyPage() {
  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 34, letterSpacing: "-1px", color: colors.ink, margin: "0 0 8px" }}>
        Privacy Policy
      </h1>
      <p style={{ marginTop: 0 }}>
        Bech De is operated by <b>{operator.entity}</b>, {operator.address}. This policy explains what we collect, why we
        need it, and what you can ask us to do with it. It is written to meet India&apos;s Digital Personal Data
        Protection Act, 2023 (DPDP).
      </p>

      <H2>What we collect</H2>
      <ul>
        <li>
          <b>Your account</b> — the email address you sign in with, and the display name you choose. We use email
          magic-links, so we never store a password.
        </li>
        <li>
          <b>Your location</b> — only if you tap &ldquo;use my exact location&rdquo;. We store the coordinates and the
          neighbourhood name we derive from them, so we can show you what&apos;s nearby and put your listings on the map.
          You can browse without ever sharing it; we fall back to a default neighbourhood centre.
        </li>
        <li>
          <b>Your listings</b> — titles, prices, descriptions, photos, and the pickup neighbourhood you enter. These are
          public to other signed-in users by design.
        </li>
        <li>
          <b>Your conversations</b> — messages and offers you exchange with other users, so both sides can see the
          thread. Only the two participants can read a thread.
        </li>
        <li>
          <b>Your saved things</b> — items you heart and searches you save.
        </li>
      </ul>
      <p>
        We do not collect your contact list, your browsing history on other sites, or your precise location in the
        background. We do not run third-party advertising trackers.
      </p>

      <H2>Why we collect it</H2>
      <p>
        To run the marketplace: to show you things near you, let you list and sell, let buyers and sellers talk, and to
        investigate reports of prohibited or fraudulent listings. We do not sell your personal data, and we do not share
        it with advertisers.
      </p>

      <H2>Who can see what</H2>
      <p>
        Your name, listings and neighbourhood are visible to other signed-in users. Your <b>exact coordinates are never
        shown</b> — the map shows an approximate area, and the exact pickup point is something you share in chat, at your
        own discretion. Your email address is never shown to other users. Your chats are private to the two of you.
      </p>

      <H2>Where it lives</H2>
      <p>
        Data is stored with our infrastructure provider (Supabase, on Postgres) and served through Vercel. Access is
        restricted by row-level security rules, so one user&apos;s account cannot read another&apos;s private data even
        if the app is misused.
      </p>

      <H2>How long we keep it</H2>
      <ul>
        <li>Listings: until you withdraw them, or up to 12 months after they&apos;re marked sold.</li>
        <li>Chats and offers: for as long as your account exists, so you have a record of a deal.</li>
        <li>Reports: up to 24 months, so we can spot repeat offenders.</li>
        <li>Your account: until you ask us to delete it, at which point we erase it within 30 days.</li>
      </ul>

      <H2>Your rights</H2>
      <p>Under the DPDP Act you can ask us to:</p>
      <ul>
        <li>tell you what personal data of yours we hold and who we&apos;ve shared it with;</li>
        <li>correct anything that&apos;s wrong or out of date;</li>
        <li>erase your data and close your account;</li>
        <li>nominate someone to exercise these rights if you can&apos;t;</li>
        <li>withdraw a consent you gave us — for example, turning location back off.</li>
      </ul>
      <p>
        Three of those you can do yourself, right now, from{" "}
        <b>
          Your data
        </b>{" "}
        at the bottom of your profile: download everything we hold about you, make us forget your location, or
        close your account. No email, no waiting.
      </p>
      <p>
        For anything else — a correction, or nominating someone to act for you — email{" "}
        <b>{operator.grievanceEmail}</b> and we&apos;ll act within 30 days.
      </p>
      <p>
        Two things closing an account deliberately does <i>not</i> erase. Messages you sent stay in the other
        person&apos;s chat history, because a conversation is their record of a deal as much as yours — your name
        comes off them. And some data may be retained where the law requires it, for example records relating to a
        reported fraud.
      </p>

      <H2>Children</H2>
      <p>
        Bech De is not for anyone under 18. We do not knowingly process a child&apos;s data; if we learn an account
        belongs to a minor, we close it.
      </p>

      <H2>Grievance officer</H2>
      <p>
        As required by the DPDP Act and the IT Rules, our grievance officer is <b>{operator.grievanceOfficer}</b>,
        reachable at <b>{operator.grievanceEmail}</b>, {operator.address}. Complaints get an acknowledgement within 48
        hours and a resolution within 30 days. If you&apos;re unhappy with our response, you may escalate to the Data
        Protection Board of India.
      </p>

      <H2>Changes</H2>
      <p>
        If we change how we use your data we&apos;ll update this page and tell you in the app before the change takes
        effect. See also our{" "}
        <Link href="/legal/terms" style={{ color: colors.clay, fontWeight: 700 }}>
          Terms of Use
        </Link>
        .
      </p>
    </div>
  );
}

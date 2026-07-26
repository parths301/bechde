/**
 * ─────────────────────────────────────────────────────────────────────────────
 * FILL THIS IN BEFORE LAUNCH.
 *
 * India's DPDP Act 2023 requires a marketplace that collects email, location and
 * chat data to name the entity responsible for it and publish a reachable
 * grievance contact. Every legal page reads from this one object — replace the
 * placeholders here and the pages update themselves, and the "draft" banner
 * disappears automatically (see `legalIsDraft` below).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const operator = {
  /** Registered entity or proprietor name, e.g. "Bech De Technologies Pvt Ltd" */
  entity: "[ENTITY NAME]",
  /** Registered address, used on both the privacy policy and terms */
  address: "[REGISTERED ADDRESS]",
  /** Named person responsible for grievances (DPDP requires a real human) */
  grievanceOfficer: "[GRIEVANCE OFFICER NAME]",
  /** Monitored inbox — grievances must get a response within 30 days */
  grievanceEmail: "[GRIEVANCE EMAIL]",
  /** General support inbox */
  supportEmail: "[SUPPORT EMAIL]",
  /** Country of operation — the governing-law clause uses this */
  jurisdiction: "Bengaluru, Karnataka, India",
};

/** Last substantive review of the legal text. Bump when you edit the pages. */
export const legalUpdated = "27 July 2026";

/** True while any placeholder is still unfilled — drives the draft banner. */
export const legalIsDraft = Object.values(operator).some((v) => v.includes("["));

export const prohibitedItems: { title: string; examples: string }[] = [
  { title: "Weapons and ammunition", examples: "firearms, air guns, knives sold as weapons, explosives, fireworks" },
  { title: "Drugs and intoxicants", examples: "narcotics, prescription medicine, tobacco, vapes, alcohol" },
  { title: "Live animals and wildlife", examples: "pets, birds, ivory, skins, anything covered by the Wildlife Protection Act" },
  { title: "Counterfeits and pirated media", examples: "replica branded goods, copied discs, cracked software, fake certificates" },
  { title: "Stolen goods", examples: "anything you can't prove you own, phones with a blocked IMEI" },
  { title: "Adult content and services", examples: "pornography, escort or massage services" },
  { title: "Government documents and IDs", examples: "Aadhaar, PAN, passports, licences, ration cards, exam papers" },
  { title: "Financial instruments", examples: "cheques, cards, gift-card codes, cryptocurrency, lottery tickets" },
  { title: "Human remains and body parts", examples: "organs, blood, bodily fluids" },
  { title: "Hazardous materials", examples: "chemicals, asbestos, medical waste, used cosmetics or underwear" },
  { title: "Recalled or unsafe products", examples: "recalled electronics, unbranded helmets, child car seats past expiry" },
  { title: "Services and jobs", examples: "Bech De is for second-hand things, not gigs, loans or investments" },
];

// ── TechHive Labs constants ──

export const TIER_DETAILS = {
  starter: {
    name: 'Starter',
    price: 500,
    priceCents: 50000,
    upfront: '100% upfront',
    timeline: '3-5 business days',
    revisions: '1 revision round',
    outcomes: [
      'Professional website audit & redesign recommendations',
      'Core SEO setup (meta tags, schema, sitemap)',
      'Mobile-responsive optimization',
      'Performance baseline report',
    ],
  },
  pro: {
    name: 'Pro',
    price: 1500,
    priceCents: 150000,
    upfront: '50% deposit ($750)',
    timeline: '7-14 business days',
    revisions: '2 revision rounds',
    outcomes: [
      'Full website redesign or build',
      'Advanced SEO + local search optimization',
      'Contact form + lead capture setup',
      'Analytics dashboard integration',
      'Social media profile optimization',
    ],
  },
  business: {
    name: 'Business',
    price: 3000,
    priceCents: 300000,
    upfront: '50% deposit ($1,500)',
    timeline: '14-21 business days',
    revisions: '3 revision rounds + priority support',
    outcomes: [
      'Complete digital presence overhaul',
      'Custom website build with CMS',
      'Full SEO campaign (on-page + technical + local)',
      'Email marketing setup + automation',
      'Social media strategy + content calendar',
      'Monthly performance reporting (3 months)',
    ],
  },
} as const;

export type TierKey = keyof typeof TIER_DETAILS;

/** Rate limits */
export const RATE_LIMITS = {
  contactForm: { max: 5, windowMs: 60 * 60 * 1000 }, // 5/hour
  proposalSend: { max: 20, windowMs: 60 * 60 * 1000 }, // 20/hour
} as const;

/** Follow-up config */
export const FOLLOW_UP_CAP = 20;
export const FOLLOW_UP_AFTER_HOURS = 24;

/** Discord embed colors */
export const COLORS = {
  success: 0x2ecc71,
  warning: 0xf39c12,
  error: 0xe74c3c,
  info: 0x3498db,
} as const;

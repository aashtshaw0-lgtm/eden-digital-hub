const content = [
  {
    id: "site",
    title: "Site settings",
    description: "Brand colours, logo and every link you change here are woven into the site, the console and the email.",
    fields: [
      {
        key: "brand.name",
        label: "Brand name",
        default: "Eden",
      },
      {
        key: "brand.tagline",
        label: "Tagline",
        default: "A studio for digital design and management.",
      },
      {
        key: "brand.heroBadge",
        label: "Hero badge",
        default: "Design & management studio",
      },
      {
        key: "brand.footerNote",
        label: "Footer note",
        default: "Every hand-drawn piece is also a working deliverable you can hand over, revise and be done with.",
      },
      {
        key: "brand.madeBy",
        label: "Made by",
        default: "The studio",
      },
    ],
  },
  {
    id: "home",
    title: "Home / landing page",
    description:
      "Every string on the landing page: headlines, chips, stats, section titles and the copy above the hero.",
    fields: [
      {
        key: "home.eyebrow",
        label: "Eyebrow",
        default: "Design & management studio",
      },
      {
        key: "home.heroBadge",
        label: "Hero badge",
        default: "Design & management studio",
      },
      {
        key: "home.heroSubtitle",
        label: "Hero subtitle",
        type: "textarea",
        default: "One studio for logos, posters, thumbnails, banners and full event or social execution — every piece drawn by hand, with three honest tiers on each service and a real person one click away.",
      },
      {
        key: "home.heroTitle",
        label: "Hero headline",
        default: "We make the web feel human.",
      },
      {
        key: "home.heroLead",
        label: "Hero lead",
        default: "Made to move.",
      },
      {
        key: "home.heroMode",
        label: "Hero accent mode",
        default: "rotating",
      },
      {
        key: "home.heroAccent",
        label: "Hero accent",
        default: "by hand",
      },
      {
        key: "home.heroAccentWords",
        label: "Hero accent words",
        default: "by hand,that converts,with care",
      },
      {
        key: "home.hero.ctaServices",
        label: "Main button",
        default: "Explore services",
      },
      {
        key: "home.hero.ctaWork",
        label: "Second button",
        default: "See our work",
      },
      {
        key: "home.hero.ctaProducts",
        label: "Third button",
        default: "See handmade pieces",
      },
      {
        key: "home.chip.1",
        label: "Chip 1",
        default: "7 services",
      },
      {
        key: "home.chip.2",
        label: "Chip 2",
        default: "3 transparent tiers",
      },
      {
        key: "home.chip.3",
        label: "Chip 3",
        default: "UPI checkout",
      },
      {
        key: "home.chip.4",
        label: "Chip 4",
        default: "Live manager chat",
      },
      {
        key: "home.chip.5",
        label: "Chip 5",
        default: "Handmade shelf",
      },
      {
        key: "home.work.title",
        label: "Work section title",
        default: "Selected work",
      },
      {
        key: "home.work.subtitle",
        label: "Work section subtitle",
        type: "textarea",
        default: "A few pieces that left the studio recently — drawn by hand, one brief at a time.",
      },
      {
        key: "home.services.title",
        label: "Services section title",
        default: "Everything we make & manage",
      },
      {
        key: "home.services.subtitle",
        label: "Services section subtitle",
        type: "textarea",
        default: "Pick a service, pick a tier, brief us in one form.",
      },
      {
        key: "home.services.cta",
        label: "Services section link",
        default: "View all services",
      },
      {
        key: "home.stat.1",
        label: "Stat 1 label",
        default: "Services on the shelf",
      },
      {
        key: "home.stat.2",
        label: "Stat 2 label",
        default: "Pieces shipped",
      },
      {
        key: "home.stat.3",
        label: "Stat 3 label",
        default: "Tiers per service",
      },
      {
        key: "home.motionEyebrow",
        label: "Motion section eyebrow",
        default: "The feel of it",
      },
      {
        key: "home.motion.title",
        label: "Motion section title",
        default: "Made to move",
      },
      {
        key: "home.motion.subtitle",
        label: "Motion section subtitle",
        type: "textarea",
        default: "Words, cards and images behave the way the work does: precise, playful and never stock.",
      },
      {
        key: "home.motion.statement",
        label: "Motion statement (edit freely)",
        type: "textarea",
        default: "We draw the mark, set the type and check every edge by hand. Then we run the campaign that puts the piece in front of people. Templates and stock go in — work with your name on it comes out.",
      },
      {
        key: "home.motion.lensCaption",
        label: "Lens caption",
        type: "textarea",
        default: "Zoom into any piece. Craft is in the detail.",
      },
    ],
  },
];

const defaults: Record<string, string> = {};
const groups: Record<string, { id: string; label: string; fields: typeof content[number]["fields"] }> = {};

for (const group of content) {
  groups[group.id] = { id: group.id, label: group.title, fields: group.fields };
  for (const field of group.fields) {
    defaults[field.key] = field.default;
  }
}

export const CONTENT_FIELDS = content.flatMap((g) => g.fields);
export const CONTENT_GROUPS = Object.values(groups);
export const CONTENT_DEFAULTS = defaults;

function fillTokens(text: string, tokens?: Record<string, string>): string {
  if (!tokens) return text;
  return text.replace(/\{tooltip\}|\{\w+\}/g, (match) =>
    tokens[match.slice(1, -1)] ?? match,
  );
}

function contentDefault(key: string): string {
  const text = defaults[key];
  return text ?? "";
}

export { fillTokens, contentDefault };

export interface EdenContent {
  overrides: Record<string, string>;
  t: (key: string, tokens?: Record<string, string>) => string;
  isCustom: (key: string) => boolean;
  brandName: string;
}

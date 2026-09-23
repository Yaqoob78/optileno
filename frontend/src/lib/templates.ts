/* Starting scopes for the projects freelancers actually quote on a fixed price.
   Each one is what a careful freelancer would write in a proposal: the
   deliverables, how many revision rounds, and what is *not* included. */

export type TemplateId = 'website' | 'landing' | 'brand' | 'video' | 'dev' | 'writing' | 'custom';

export interface ScopeTemplate {
  id: TemplateId;
  label: string;
  blurb: string;
  deliverables: string[];
  excluded: string[];
  revisions: number;
  /** Rough hours for a typical addition, used for the first price suggestion. */
  extraHours: number;
}

export const TEMPLATES: ScopeTemplate[] = [
  {
    id: 'website',
    label: 'Website',
    blurb: 'Multi-page site, designed and built',
    deliverables: [
      'Design for 5 pages: Home, About, Services, Work, Contact',
      'Responsive layouts for mobile and tablet',
      'Build and launch on your platform',
      'Contact form connected to your inbox',
      'Basic on-page SEO setup',
    ],
    excluded: ['Copywriting', 'Additional pages', 'Stock photos and licenses', 'Hosting and domain', 'Online store or payments', 'Ongoing maintenance'],
    revisions: 2,
    extraHours: 4,
  },
  {
    id: 'landing',
    label: 'Landing page',
    blurb: 'One high-converting page',
    deliverables: ['One landing page design', 'Responsive build', 'Signup form connected to your tool', 'Launch-day support'],
    excluded: ['Copywriting', 'Extra sections beyond the agreed wireframe', 'A/B test variants', 'Ad creatives', 'Additional pages'],
    revisions: 2,
    extraHours: 3,
  },
  {
    id: 'brand',
    label: 'Logo & identity',
    blurb: 'Logo, palette, type, mini guide',
    deliverables: ['3 initial logo concepts', 'Final logo in color, mono and reversed', 'Color palette and typography', 'Mini brand guide (PDF)', 'Export files: SVG, PNG, PDF'],
    excluded: ['Additional logo concepts', 'Animated logo versions', 'Stationery and print design', 'Social media templates', 'Website design', 'Trademark search'],
    revisions: 2,
    extraHours: 3,
  },
  {
    id: 'video',
    label: 'Video edit',
    blurb: 'One edited video, ready to publish',
    deliverables: ['Edit of one video, up to 3 minutes', 'Color correction', 'One licensed music track', 'Burned-in captions', 'Export in 16:9'],
    excluded: ['Vertical or square versions', 'Motion graphics and animation', 'Scriptwriting', 'Voiceover', 'Stock footage', 'Extra cutdowns and teasers'],
    revisions: 2,
    extraHours: 2,
  },
  {
    id: 'dev',
    label: 'Feature build',
    blurb: 'A scoped piece of software',
    deliverables: ['Feature built to the agreed spec', 'Automated tests for the feature', 'Deploy to staging and production', 'Bug fixes for 14 days after launch'],
    excluded: ['New features beyond the spec', 'Third-party integrations not in the spec', 'Design work', 'Data migration', 'Ongoing maintenance'],
    revisions: 1,
    extraHours: 4,
  },
  {
    id: 'writing',
    label: 'Writing',
    blurb: 'Articles, pages or a content pack',
    deliverables: ['4 articles, about 1,200 words each', 'Keyword research per article', 'Headline options'],
    excluded: ['Additional articles', 'Images and graphics', 'Publishing and formatting in your CMS', 'Social media posts', 'Translation'],
    revisions: 1,
    extraHours: 2,
  },
  {
    id: 'custom',
    label: 'Something else',
    blurb: 'Start from a blank scope',
    deliverables: [],
    excluded: [],
    revisions: 2,
    extraHours: 2,
  },
];

export function templateById(id: string): ScopeTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[TEMPLATES.length - 1];
}

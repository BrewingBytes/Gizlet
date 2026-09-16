export const legalPageLastUpdated = 'September 15, 2026';

export interface PrivacyService {
  readonly category: 'Analytics' | 'Advertising' | 'Consent management';
  readonly name: string;
  readonly url: string;
  readonly description: string;
}

/**
 * Public provider disclosures live here so policy copy can follow the enabled
 * services without coupling a page to analytics or advertising implementation.
 */
export const privacyServices: readonly PrivacyService[] = [
  {
    category: 'Analytics',
    name: 'Cloudflare Web Analytics',
    url: 'https://www.cloudflare.com/privacypolicy/',
    description:
      'Enabled for gizlet.app at the Cloudflare edge, it measures aggregate page views and page performance. It uses no cookies or other client-side state and does not log URL query strings. Gizlet sends it no tool events, so entered or generated tool payloads cannot reach it.',
  },
  {
    category: 'Analytics',
    name: 'Google Analytics',
    url: 'https://policies.google.com/privacy',
    description:
      'Loaded only for a production build that configures it, and only after you allow analytics. It uses cookies. Gizlet sends it page views and a fixed list of events — a Gizlet opening, finishing, failing with a category, a download, and a step in a Flow — whose values are fixed names, whole numbers, or Gizlet identifiers. No field can carry your file, its name, its size, its format, a result, or the text of an error.',
  },
  {
    category: 'Advertising',
    name: 'Google AdSense',
    url: 'https://policies.google.com/technologies/ads',
    description:
      'When enabled for a production build, it serves and measures clearly labelled advertisements. Gizlet does not put tool inputs, files, results, or error messages into ad tags.',
  },
  {
    category: 'Consent management',
    name: 'Google Consent Management Platform',
    url: 'https://support.google.com/adsense/answer/10961068',
    description:
      'When advertising is enabled, it presents consent choices for visitors in the EEA, United Kingdom, and Switzerland before Google serves ads that require consent.',
  },
];

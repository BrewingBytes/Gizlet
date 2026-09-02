export const legalPageLastUpdated = 'September 2, 2026';

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
    name: 'Plausible Analytics',
    url: 'https://plausible.io/privacy',
    description:
      'When enabled for a production build, it measures aggregate page use and the static Gizlet slug for defined tool events. Gizlet does not send entered or generated tool payloads in these events.',
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

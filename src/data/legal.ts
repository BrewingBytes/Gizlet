export const legalPageLastUpdated = 'September 2, 2026';

export interface PrivacyService {
  readonly category: 'Analytics' | 'Advertising';
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
];

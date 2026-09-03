/**
 * The home page's own title and description.
 *
 * They live here rather than inline in the page because both carry properties a
 * test has to hold and Astro frontmatter cannot be tested. The description
 * makes a local-processing claim, which AGENTS.md forbids from drifting away
 * from the registry; and a description that merely repeats its own title is
 * discarded by search engines, which then write a worse snippet from whatever
 * text the page happens to show.
 */
export const homePageTitle = 'Gizlet | Useful internet things, without the nonsense.';

export const homePageDescription =
  'Compress an image, resize a photo, format JSON, or make a PDF. Each Gizlet does one job, runs in your browser, and needs no signup or upload.';

/**
 * The phrases in the description that promise the visitor's file never leaves
 * the device. Listed so a test can check each one is still in the description
 * and that the registry still earns it, rather than trusting the sentence.
 */
export const homePageLocalProcessingClaims = [
  'runs in your browser',
  'needs no signup or upload',
] as const;

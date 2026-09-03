/**
 * Example intents for the home-page search field, whose label is "I need to…".
 *
 * A visitor reads these as things Gizlet can do, so each one has to return a
 * Gizlet. `tests/unit/tool-search-examples.test.ts` asserts exactly that
 * against the live registry, which is what keeps the list from drifting as
 * Gizlets are added or renamed.
 */
export const toolSearchExamples = [
  'compress a photo',
  'resize an image',
  'format JSON',
] as const;

/** The placeholder as the field renders it. */
export const toolSearchPlaceholder = `${toolSearchExamples.join(', ')}…`;

/**
 * Carrying a chosen file from one page of this site to the next.
 *
 * A visitor who drops a photograph on the home page and picks a Gizlet should
 * arrive with the photograph, not with an empty file picker and the memory of
 * having already chosen it. A page load is a new document, so the file has to
 * be put somewhere the next page can reach — and the only somewhere that is
 * honest here is this browser: the handoff is a record in the browser's own
 * storage, on this device, read once and deleted.
 *
 * This module is the part that is arithmetic: what a handoff link looks like,
 * what an identifier may be, and how long a record is worth keeping. Putting
 * the file anywhere is `scripts/file-handoff`, because that needs a browser.
 */

/** The fragment key. A fragment never reaches a server, which is the point. */
export const handoffFragmentKey = 'handoff';

/**
 * How long a handed-over file is worth reading back.
 *
 * Long enough for a page load on a slow connection, short enough that a file
 * chosen an hour ago is not still sitting in storage waiting to surprise
 * somebody. The record is deleted when it is read; this is for the ones that
 * never were, because the visitor changed their mind mid-navigation.
 */
export const handoffLifetimeMs = 5 * 60 * 1000;

/** Identifiers are opaque and made here, so anything else is not one. */
export function isHandoffId(value: string): boolean {
  return /^[a-z0-9]{16,32}$/.test(value);
}

/** The link that opens a Gizlet with the chosen file already in hand. */
export function getHandoffPath(toolPath: string, id: string): string {
  return `${toolPath}#${handoffFragmentKey}=${id}`;
}

/**
 * The identifier in a page's fragment, if there is a real one.
 *
 * A fragment is visitor-supplied text like any other, so this reads only what
 * this site writes and treats everything else as no handoff at all.
 */
export function readHandoffId(hash: string): string | undefined {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;

  for (const pair of fragment.split('&')) {
    const separator = pair.indexOf('=');

    if (separator === -1) continue;
    if (pair.slice(0, separator) !== handoffFragmentKey) continue;

    const value = pair.slice(separator + 1);

    return isHandoffId(value) ? value : undefined;
  }

  return undefined;
}

/** Whether a stored record is still worth handing over. */
export function isFreshHandoff(storedAt: number, now: number): boolean {
  return Number.isFinite(storedAt) && now - storedAt >= 0 && now - storedAt <= handoffLifetimeMs;
}

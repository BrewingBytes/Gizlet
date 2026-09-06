import { describe, expect, it } from 'vitest';

import {
  getHandoffPath,
  handoffFragmentKey,
  handoffLifetimeMs,
  isFreshHandoff,
  isHandoffId,
  readHandoffId,
} from '../../src/data/file-handoff';

const id = 'a1b2c3d4e5f6g7h8';

describe('the link that carries a file to the next Gizlet', () => {
  it('puts the identifier in the fragment, which never reaches a server', () => {
    expect(getHandoffPath('/tools/compress-image/', id)).toBe(
      `/tools/compress-image/#${handoffFragmentKey}=${id}`,
    );
    // The reader is given a page's fragment, which is what a browser hands it.
    const path = getHandoffPath('/tools/compress-image/', id);

    expect(readHandoffId(path.slice(path.indexOf('#')))).toBe(id);
  });

  it('reads the identifier back out of a page fragment', () => {
    expect(readHandoffId(`#${handoffFragmentKey}=${id}`)).toBe(id);
    expect(readHandoffId(`${handoffFragmentKey}=${id}`)).toBe(id);
    expect(readHandoffId(`#other=1&${handoffFragmentKey}=${id}`)).toBe(id);
  });

  it('treats a fragment this site did not write as no handoff at all', () => {
    expect(readHandoffId('')).toBeUndefined();
    expect(readHandoffId('#tools')).toBeUndefined();
    expect(readHandoffId(`#${handoffFragmentKey}=`)).toBeUndefined();
    expect(readHandoffId(`#${handoffFragmentKey}=../../etc/passwd`)).toBeUndefined();
    expect(readHandoffId(`#${handoffFragmentKey}=short`)).toBeUndefined();
    expect(readHandoffId(`#${handoffFragmentKey}=${'x'.repeat(64)}`)).toBeUndefined();
  });

  it('accepts only identifiers of the shape it makes', () => {
    expect(isHandoffId(id)).toBe(true);
    expect(isHandoffId('A1B2C3D4E5F6G7H8')).toBe(false);
    expect(isHandoffId('a1b2-c3d4-e5f6-g7h8')).toBe(false);
    expect(isHandoffId('')).toBe(false);
  });

  it('keeps a record only as long as a page load could need it', () => {
    const now = 1_700_000_000_000;

    expect(isFreshHandoff(now, now)).toBe(true);
    expect(isFreshHandoff(now - handoffLifetimeMs, now)).toBe(true);
    expect(isFreshHandoff(now - handoffLifetimeMs - 1, now)).toBe(false);
    // A record stamped in the future is a clock that moved, not a fresh file.
    expect(isFreshHandoff(now + 1000, now)).toBe(false);
    expect(isFreshHandoff(Number.NaN, now)).toBe(false);
  });
});

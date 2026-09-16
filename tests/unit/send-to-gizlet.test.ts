import { describe, expect, it } from 'vitest';

import { getGizletsForDroppedFile } from '../../src/data/file-drop';
import {
  describeSendableResult,
  getSendDestinationLabel,
  getSendDestinations,
  getSendFailureMessage,
  getSendNote,
  getSendablePayloadKind,
  getSendableResultFiles,
  handoffPayloadKinds,
  type ResultFileCandidate,
} from '../../src/data/send-to-gizlet';
import { getAvailableTools } from '../../src/data/tools';

const candidate = (
  name: string,
  href = `blob:https://gizlet.app/${name}`,
  isHidden = false,
): ResultFileCandidate => ({ name, href, isHidden });

describe('what a result can hand on', () => {
  it('carries the two kinds a destination can be handed through its picker', () => {
    expect(handoffPayloadKinds).toEqual(['image-file', 'pdf-file']);
  });

  it('reads a produced file the way a dropped one is read', () => {
    expect(getSendablePayloadKind({ name: 'holiday-resized.png', type: '' })).toBe('image-file');
    expect(getSendablePayloadKind({ name: 'merged.pdf', type: 'application/pdf' })).toBe('pdf-file');
  });

  it('says nothing about the kinds nothing here could receive', () => {
    // A table and a JSON document are typed into a box rather than chosen from
    // a picker, so there is nowhere to put one on arrival.
    expect(getSendablePayloadKind({ name: 'orders.csv', type: 'text/csv' })).toBeUndefined();
    expect(getSendablePayloadKind({ name: 'people.json', type: 'application/json' })).toBeUndefined();
    expect(getSendablePayloadKind({ name: 'pages.zip', type: 'application/zip' })).toBeUndefined();
  });
});

describe('the files a result is offering', () => {
  it('keeps the ones another Gizlet reads, in the order the result offers them', () => {
    expect(
      getSendableResultFiles([candidate('page-1.jpg'), candidate('page-2.jpg')]).map(
        (file) => file.name,
      ),
    ).toEqual(['page-1.jpg', 'page-2.jpg']);
  });

  it('drops the archive a batch hands back and keeps the files inside it', () => {
    // The "download all" link of a batch is a ZIP, which no Gizlet here reads.
    // The per-file links beside it are the ones that can travel.
    const files = getSendableResultFiles([
      candidate('page-1.jpg'),
      candidate('page-2.jpg'),
      candidate('pages.zip'),
    ]);

    expect(files.map((file) => file.name)).toEqual(['page-1.jpg', 'page-2.jpg']);
    expect(files.every((file) => file.kind === 'image-file')).toBe(true);
  });

  it('ignores a link belonging to a result that is not on screen', () => {
    expect(getSendableResultFiles([candidate('old.png', 'blob:https://gizlet.app/old', true)])).toEqual([]);
  });

  it('ignores a link that does not point at something held in this browser', () => {
    expect(getSendableResultFiles([candidate('sample.png', '/samples/sample.png')])).toEqual([]);
  });
});

describe('where a result can go', () => {
  it('offers every published Gizlet that reads an image, except the one that made it', () => {
    const slugs = getSendDestinations('resize-image', 'image-file').map((tool) => tool.slug);

    expect(slugs).toContain('compress-image');
    expect(slugs).toContain('crop-image');
    expect(slugs).toContain('jpg-to-pdf');
    expect(slugs).toContain('image-dimensions');
    expect(slugs).not.toContain('resize-image');
    expect(slugs).not.toContain('merge-pdf');
  });

  it('offers the document Gizlets for a document', () => {
    const slugs = getSendDestinations('merge-pdf', 'pdf-file').map((tool) => tool.slug);

    expect(slugs).toContain('split-pdf');
    expect(slugs).toContain('watermark-pdf');
    expect(slugs).toContain('pdf-viewer');
    expect(slugs).not.toContain('merge-pdf');
    expect(slugs).not.toContain('compress-image');
  });

  it('is the dropped-file rule with the source removed, rather than a second list', () => {
    for (const kind of handoffPayloadKinds) {
      expect(getSendDestinations('resize-image', kind).map((tool) => tool.slug)).toEqual(
        getGizletsForDroppedFile(kind)
          .map((tool) => tool.slug)
          .filter((slug) => slug !== 'resize-image'),
      );
    }
  });

  it('offers published Gizlets only, in registry order', () => {
    const order: readonly string[] = getAvailableTools().map((tool) => tool.slug);

    for (const kind of handoffPayloadKinds) {
      const slugs = getSendDestinations('compress-image', kind).map((tool) => tool.slug);

      expect(slugs.every((slug) => order.includes(slug))).toBe(true);
      expect(slugs).toEqual([...slugs].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
    }
  });
});

describe('what the panel says', () => {
  it('names the one file a result produced', () => {
    expect(describeSendableResult(getSendableResultFiles([candidate('holiday.png')]))).toBe(
      'holiday.png can go straight into another Gizlet, without saving it first.',
    );
  });

  it('counts them when there are several', () => {
    expect(
      describeSendableResult(
        getSendableResultFiles([candidate('page-1.jpg'), candidate('page-2.jpg')]),
      ),
    ).toBe('2 files came out of this. Pick one to send on, without saving it first.');
  });

  it('says nothing at all when there is nothing to send', () => {
    expect(describeSendableResult([])).toBe('');
  });

  it('says where the file goes, and says so without claiming it was uploaded', () => {
    expect(getSendNote('holiday.png')).toContain('holiday.png');
    expect(getSendNote('holiday.png')).toContain('on this device');
  });

  it('explains the limitation rather than dropping the file quietly', () => {
    const message = getSendFailureMessage('holiday.png', 'Crop Image');

    expect(message).toContain('holiday.png');
    expect(message).toContain('Crop Image');
    expect(message).toContain('Download it');
  });

  it('names both ends for a reader who cannot see the list', () => {
    expect(getSendDestinationLabel('Crop Image', 'holiday.png')).toBe(
      'Send holiday.png to Crop Image',
    );
  });
});

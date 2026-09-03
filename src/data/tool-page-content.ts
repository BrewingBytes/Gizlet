import type { ToolRegistryEntry } from './tools';

/**
 * Supporting copy for a Gizlet page: what the Gizlet does, when to reach for
 * it, what its controls mean, and what stays on the device.
 *
 * The copy lives here so it is keyed by registry slug, cannot drift from the
 * registry, and can be checked by tests. The FAQ is the same data the page
 * renders and the `FAQPage` markup describes, so the two cannot disagree.
 *
 * Nothing here may claim more privacy than `processesLocally` allows.
 */
export interface ToolContentDetail {
  readonly term: string;
  readonly description: string;
}

export interface ToolContentSection {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  /** Control-by-control notes, rendered as a description list. */
  readonly details?: readonly ToolContentDetail[];
}

export interface ToolFaqEntry {
  readonly question: string;
  readonly answer: string;
}

export interface ToolPageContent {
  /** What the Gizlet does. */
  readonly what: ToolContentSection;
  /** When it is the right Gizlet for the job. */
  readonly when: ToolContentSection;
  /** What each control on the page changes. */
  readonly options: ToolContentSection;
  /** What happens to the visitor's data. */
  readonly privacy: ToolContentSection;
  readonly faq: readonly ToolFaqEntry[];
}

const toolPageContent: Record<string, ToolPageContent> = {
  'compress-image': {
    what: {
      heading: 'What Compress Image does',
      paragraphs: [
        'Compress Image re-encodes a picture so the file gets smaller while the picture still looks like the picture. Your browser decodes the image, redraws it at its original dimensions, and encodes it again as JPEG, PNG, or WebP at the quality you pick.',
        'The result arrives next to the original with a drag-to-compare slider and the size difference in plain numbers, so you can see what a quality setting actually cost before you download anything.',
      ],
    },
    when: {
      heading: 'When to compress, and when to resize instead',
      paragraphs: [
        'Compress when the dimensions are already right and the file size is the problem: a phone photograph too large to email, a hero image slowing a page down, an upload form that refuses anything over a couple of megabytes.',
        'If the image is also physically bigger than the space it is shown in, resize it first. Halving the width removes three quarters of the pixels, which usually saves more than any quality setting will, and Resize Image and Compress Image can run one after the other in Gizlet Flows.',
      ],
    },
    options: {
      heading: 'What the format and quality controls do',
      paragraphs: ['Two settings, and both matter more than they look.'],
      details: [
        {
          term: 'Output format',
          description:
            'JPEG is the safe default for photographs and opens anywhere. WebP is usually noticeably smaller than JPEG at a comparable quality and every current browser supports it. PNG keeps every pixel exactly, which suits screenshots and flat graphics but makes a poor photograph format.',
        },
        {
          term: 'Quality',
          description:
            'The slider runs from 40% to 100% and starts at 82%, a good default for photographs. Below roughly 60% the artefacts start to show around hard edges and in flat areas like skies. It has no effect on PNG, which is lossless and has no quality to trade away.',
        },
      ],
    },
    privacy: {
      heading: 'Nothing to upload',
      paragraphs: [
        'The image is read, decoded, redrawn, and re-encoded by this browser, and the compressed file is handed straight to your downloads. Gizlet is a static site with no upload endpoint, so there is nowhere for a picture to be sent and nothing kept after you close the tab.',
        'One side effect worth knowing: because the file is drawn onto a canvas and encoded fresh, the metadata the original carried does not come with it. Camera model, timestamps, and GPS coordinates are left behind in the source file.',
      ],
    },
    faq: [
      {
        question: 'Does compressing an image upload it anywhere?',
        answer:
          'No. The image is decoded and re-encoded by this browser and written straight to a download. Gizlet is a static site with no upload endpoint to send a file to.',
      },
      {
        question: 'Which output format should I choose?',
        answer:
          'WebP for anything going on a website, because it is usually the smallest at a given quality. JPEG when the file has to be opened by older software. PNG only for screenshots, logos, or images with hard edges or transparency.',
      },
      {
        question: 'Why does the quality slider do nothing for PNG?',
        answer:
          'PNG compression is lossless: it stores every pixel exactly, so there is no quality to trade away, and the slider is ignored for PNG output. If a PNG is too large, compress it as JPEG or WebP instead, or reduce its dimensions.',
      },
      {
        question: 'How much smaller will my file get?',
        answer:
          'It depends on the picture. A phone photograph at the default 82% typically loses most of its size, while an image that was already compressed may barely change or even come out slightly larger. The result panel shows the exact before and after, so you never have to guess.',
      },
      {
        question: 'Is there a file size limit?',
        answer:
          'There is no fixed limit and no quota. The work happens in this browser, so the practical ceiling is your device: a 40-megapixel photograph is fine on a current laptop, while a very large image on an old phone can run out of memory, and the Gizlet says so rather than failing quietly.',
      },
    ],
  },
  'resize-image': {
    what: {
      heading: 'What Resize Image does',
      paragraphs: [
        'Resize Image changes how many pixels a picture has. Your browser decodes the file, draws it at the dimensions you ask for, and encodes the result as JPEG, PNG, or WebP.',
        'You can set an exact width or height in pixels, with an aspect-ratio lock so the other side follows, or scale by percentage when you only want the image to be half or a quarter of what it was.',
      ],
    },
    when: {
      heading: 'When resizing is the right fix',
      paragraphs: [
        'Resize when the image is bigger than the place it is displayed: a 4000-pixel photograph in a 800-pixel column, an avatar that needs to be square, a marketplace listing with a maximum dimension in its rules.',
        'Fewer pixels is also the most effective way to make a file smaller, because it removes data rather than approximating it. Resize first and compress afterwards if the file still needs to shrink; the two can run back to back in Gizlet Flows.',
      ],
    },
    options: {
      heading: 'What each control changes',
      paragraphs: [],
      details: [
        {
          term: 'Exact dimensions',
          description:
            'Type a width or a height in whole pixels. With the aspect-ratio lock on, the other side is worked out for you and the picture is never stretched. Turn the lock off to set both sides and accept the distortion.',
        },
        {
          term: 'Percentage',
          description:
            'Scale relative to the original, from 0.1% to 1000%. 50% halves both sides, which is the quickest way to cut a screenshot from a high-density display down to size.',
        },
        {
          term: 'Output format',
          description:
            'JPEG for photographs, WebP for the web, PNG when you need lossless pixels or transparency. Resizing a photograph into PNG can easily produce a larger file than the original.',
        },
        {
          term: 'Limits',
          description:
            'Each side can be up to 16,384 pixels and the result up to 40 million pixels. Anything larger is refused with an explanation instead of a failed download, and results above roughly 16 megapixels are flagged as a big image before you commit to them.',
        },
      ],
    },
    privacy: {
      heading: 'No upload, no queue',
      paragraphs: [
        'The picture is decoded, redrawn, and encoded here in this browser, and the resized file goes straight to your downloads. Gizlet has no upload endpoint and keeps nothing once the tab is closed.',
        'Because the output is drawn fresh onto a canvas, it also arrives without the metadata the original carried, including camera details and any GPS coordinates.',
      ],
    },
    faq: [
      {
        question: 'Will resizing make my image blurry?',
        answer:
          'Making an image smaller is safe; the browser averages pixels away and the result stays sharp. Making one larger cannot invent detail that was never captured, so anything much above 100% will look soft.',
      },
      {
        question: 'How do I resize without stretching the picture?',
        answer:
          'Leave the aspect-ratio lock on, which it is by default, and set only one side. The other is calculated from the original proportions. Percentage mode always keeps the proportions.',
      },
      {
        question: 'What is the largest image I can resize?',
        answer:
          'Up to 16,384 pixels on a side and 40 million pixels in the result. Beyond that the Gizlet explains the limit instead of attempting it, and very large images may still be limited by your own device memory.',
      },
      {
        question: 'Why is my resized file larger than the original?',
        answer:
          'Almost always the output format. A photograph encoded as PNG stores every pixel exactly and can outweigh a much bigger JPEG. Choose JPEG or WebP for photographs, and use Compress Image if the size still needs work.',
      },
      {
        question: 'Does the image leave my device?',
        answer:
          'No. The file is read and rewritten by this browser only. There is no upload, no queue, and no copy kept anywhere.',
      },
    ],
  },
  'convert-image': {
    what: {
      heading: 'What Convert Image does',
      paragraphs: [
        'Convert Image reads a picture in one format and writes it out in another. It detects the source format from the file itself, then encodes a new JPEG, PNG, or WebP using your browser’s own image support.',
        'Dimensions are left exactly as they were. If a conversion would lose something, such as JPEG discarding transparency, the Gizlet says so before you convert rather than after you download.',
      ],
    },
    when: {
      heading: 'When a format change is what you need',
      paragraphs: [
        'Convert when something will not accept the file you have: a site that rejects WebP, a tool that cannot read AVIF, an old application that only understands JPEG or PNG.',
        'It is also the quickest way to modernise images for the web. Turning JPEG or PNG assets into WebP usually cuts their weight without touching their dimensions, and Gizlet Flows can run a conversion and a compression on the same file in one pass.',
      ],
    },
    options: {
      heading: 'What the formats mean',
      paragraphs: [
        'JPEG, PNG, WebP, AVIF, and BMP go in. JPEG, PNG, and WebP come out, because those are the formats browsers can reliably encode.',
      ],
      details: [
        {
          term: 'JPEG',
          description:
            'Lossy and understood by everything. It has no alpha channel, so transparent pixels are flattened when you convert into it.',
        },
        {
          term: 'PNG',
          description:
            'Lossless with full transparency. The right target for screenshots, logos, and line art, and the wrong one for photographs, where it produces very large files.',
        },
        {
          term: 'WebP',
          description:
            'Supports both transparency and strong compression, and every current browser reads it. The best default for images that live on a website.',
        },
      ],
    },
    privacy: {
      heading: 'The conversion happens on this device',
      paragraphs: [
        'The conversion runs on this device, using the decoders your browser already ships with. The file is never uploaded, there is no server-side converter behind this page, and nothing is stored once you leave.',
        'That also sets the boundary honestly: a format your browser cannot decode cannot be converted here, and the new file arrives without the metadata the original carried.',
      ],
    },
    faq: [
      {
        question: 'Which formats can it read and write?',
        answer:
          'It reads JPEG, PNG, WebP, AVIF, and BMP, and writes JPEG, PNG, or WebP. AVIF is not offered as an output because browsers cannot reliably encode it, only decode it.',
      },
      {
        question: 'Can it convert HEIC photos from an iPhone?',
        answer:
          'No. HEIC is not among the formats it accepts. Either set the camera to Most Compatible so it saves JPEG, or export a JPEG from Photos first and convert that.',
      },
      {
        question: 'What happens to transparency when I convert to JPEG?',
        answer:
          'JPEG has no alpha channel, so transparent areas are flattened. The Gizlet checks the source for transparent pixels and warns you before the conversion, so you can choose PNG or WebP instead.',
      },
      {
        question: 'Does converting lose quality?',
        answer:
          'Converting into JPEG or WebP re-encodes the picture, which loses a little detail. Converting into PNG does not, but it cannot restore detail an earlier JPEG already threw away, and the file will be much larger.',
      },
      {
        question: 'Will an animated WebP stay animated?',
        answer:
          'No. The conversion draws a single frame, so an animated source comes out as a still image in the format you chose.',
      },
    ],
  },
  'json-ld-generator': {
    what: {
      heading: 'What the JSON-LD Generator does',
      paragraphs: [
        'The JSON-LD Generator turns a short form into valid Schema.org JSON-LD. Pick a type, fill in what you know, and the markup is rebuilt as you type, with empty fields left out rather than published as blanks.',
        'Alongside the preview it lists what is missing: errors for fields Schema.org requires and for URLs that are not complete http or https addresses, and separate recommendations for the fields Google commonly wants before it will show a richer result. Copy the JSON on its own or the whole script block.',
      ],
    },
    when: {
      heading: 'When to add structured data',
      paragraphs: [
        'Add it when a page describes something specific that search engines can present in more detail: a product with a price, an article with an author, a business with an address and opening hours, an event with a date.',
        'Structured data describes a page; it does not improve it. It can make a page eligible for rich results, and that is all it does. Nothing here guarantees a ranking change, and marking up content the page does not actually show works against you.',
      ],
    },
    options: {
      heading: 'What the six types are for',
      paragraphs: [],
      details: [
        {
          term: 'Product',
          description:
            'A single item for sale. The name is required; a description, image, brand, and offer price are what turn it into a useful result.',
        },
        {
          term: 'Organization',
          description:
            'The company or project behind the site, usually on a home or about page. Add the website URL, a logo, and a social profile so the entity is easy to match.',
        },
        {
          term: 'Article',
          description:
            'A post or news story. The headline is required, and a publication date, author, publisher, and image are recommended.',
        },
        {
          term: 'Local business',
          description:
            'A place with a street address. Opening hours and a telephone number are what make it worth publishing.',
        },
        {
          term: 'Event',
          description:
            'Something happening at a time and place. The name, start date, and location name are all required.',
        },
        {
          term: 'Breadcrumb list',
          description:
            'The trail that leads to the page, up to three levels. Every item needs both a name and a URL, and at least two items are required.',
        },
      ],
    },
    privacy: {
      heading: 'Nothing you type here goes anywhere',
      paragraphs: [
        'The form runs entirely in this browser. What you type is used to build the markup on screen and nothing else: it is not sent anywhere, not saved between visits, and not validated against a remote service.',
        'That means you can draft markup for an unreleased product or an unannounced event here without publishing anything early.',
      ],
    },
    faq: [
      {
        question: 'Where do I put the generated markup?',
        answer:
          'Copy the script block and paste it into the HTML of the page it describes, in the head or the body. One block per page, describing what that page shows.',
      },
      {
        question: 'Will structured data improve my search ranking?',
        answer:
          'It can make a page eligible for rich results, such as a product price or an event date shown in the listing. It is not a ranking factor you can rely on, and no markup guarantees a change in position.',
      },
      {
        question: 'What is the difference between an error and a recommendation?',
        answer:
          'An error means the markup is incomplete or invalid: a field Schema.org requires for that type is missing, or a URL is not a complete http or https address. A recommendation is a field Google commonly asks for before showing a richer result, and the markup is still valid without it.',
      },
      {
        question: 'Does it check my markup against Google’s requirements?',
        answer:
          'It checks the required Schema.org fields for the type you chose and the shape of every URL, and it points out the fields Google documents as recommended. It cannot fetch your page, so run the finished markup through Google’s Rich Results Test before relying on it.',
      },
      {
        question: 'Can I edit the JSON afterwards?',
        answer:
          'Yes. The output is ordinary JSON-LD, so you can add properties the form does not cover. Paste it into the JSON Formatter to check it still parses after editing.',
      },
    ],
  },
  'json-formatter': {
    what: {
      heading: 'What the JSON Formatter does',
      paragraphs: [
        'Paste JSON and this Gizlet reads it with your browser’s own JSON parser. Format indents it two spaces per level so the structure is readable; minify strips every space and newline for somewhere that wants one line.',
        'If the document will not parse, it says what is wrong and where, with the line and column of the character that broke it. Your input is left exactly as you pasted it, so nothing is lost while you fix the problem.',
      ],
    },
    when: {
      heading: 'When to reach for it',
      paragraphs: [
        'Format when you have been handed JSON with no whitespace and need to actually read it: an API response copied out of a network panel, a log line, a webhook payload, a configuration file someone minified.',
        'Minify for the opposite problem, where a document has to fit somewhere that dislikes newlines, such as an environment variable, a CI setting, or a single-line database column.',
      ],
    },
    options: {
      heading: 'What the four actions do',
      paragraphs: [],
      details: [
        {
          term: 'Format JSON',
          description:
            'Validates the document and rewrites it with two-space indentation, one key per line, in the order the keys were parsed.',
        },
        {
          term: 'Minify JSON',
          description:
            'Validates the document and removes all optional whitespace, producing the shortest equivalent JSON.',
        },
        {
          term: 'Copy result',
          description:
            'Copies the output to the clipboard. It stays disabled until there is a valid result to copy.',
        },
        {
          term: 'Clear',
          description:
            'Empties the input and the result. Nothing is remembered afterwards, since nothing was stored in the first place.',
        },
      ],
    },
    privacy: {
      heading: 'Your JSON stays on this device',
      paragraphs: [
        'Parsing, formatting, and minifying all happen in this page, using the JSON support built into your browser. The text is never sent anywhere, never written to storage, and gone as soon as you close the tab.',
        'That is the point of doing it here: an access token, a customer record, or an internal API response can be tidied up without handing it to someone else’s server.',
      ],
    },
    faq: [
      {
        question: 'Is my JSON sent to a server?',
        answer:
          'No. The document is parsed and rewritten by this browser. Gizlet is a static site with no endpoint that could receive it, and nothing is stored between visits.',
      },
      {
        question: 'What indentation does Format use?',
        answer:
          'Two spaces per level, which is the common convention for JSON and what most linters expect. Minify produces the same document with no whitespace at all.',
      },
      {
        question: 'Does formatting change my data?',
        answer:
          'The values stay the same, but the document is rewritten from the parsed result, so a few things are normalised: 1.0 becomes 1, 1e3 becomes 1000, escape sequences are written in their shortest form, and duplicate keys collapse to the last one that appeared.',
      },
      {
        question: 'Why does it reject my JSON when it looks fine?',
        answer:
          'It follows the JSON specification exactly, so comments, trailing commas, single-quoted strings, and unquoted keys are all invalid, even though many editors tolerate them. The error message gives the line and column so you can find the character it stopped at.',
      },
      {
        question: 'How large a document can it handle?',
        answer:
          'There is no fixed limit. Documents of a few megabytes are comfortable; beyond that you are bound by this device’s memory rather than by a quota.',
      },
    ],
  },
  'jpg-to-pdf': {
    what: {
      heading: 'What JPG to PDF does',
      paragraphs: [
        'JPG to PDF takes the images you choose and writes them into a single PDF, one image per page, in the order you put them in. Your browser decodes each picture, works out where it sits on the page, and assembles the document here on this device.',
        'Drop in one photograph or a hundred, move the pages into the order you want, pick a paper size, and download one file. Nothing is added to the pages: no header, no page number, no watermark.',
      ],
    },
    when: {
      heading: 'When a PDF is the right container',
      paragraphs: [
        'Use it when something wants one document rather than a folder of pictures: a set of receipts for an expense claim, photographs of a signed contract, a scan taken with a phone camera, a portfolio sent as a single attachment.',
        'A PDF also fixes the order and the page size, which a zip of images does not. That is the whole reason a form asks for one — the reader sees the pages in the sequence you chose, at the size you chose, in a viewer everyone already has.',
      ],
    },
    options: {
      heading: 'What the page controls do',
      paragraphs: ['Two settings decide the shape of every page in the document.'],
      details: [
        {
          term: 'Page size',
          description:
            'A4, US Letter, and US Legal give every page the same fixed box, and each image is scaled to fit inside a small margin and centred. Fit each image instead makes the page exactly the size of the picture, with no border and no scaling, which suits a document meant to be looked at rather than printed.',
        },
        {
          term: 'Orientation',
          description:
            'Auto turns each page on its side when the image is wider than it is tall, so a landscape photograph fills the sheet instead of sitting in a letterbox. Portrait and landscape force every page the same way. It has nothing to do when the page is fitted to the image, so the control is switched off there.',
        },
        {
          term: 'Page order',
          description:
            'The list is the document. Move a page up or down, or remove it, until the order is the one you want; the numbers beside the thumbnails are the page numbers you will get.',
        },
        {
          term: 'Limits',
          description:
            'One document holds up to 100 pages, and each image is held to the same ceiling the Resize Image Gizlet uses: 16,384 pixels on a side and 40 million pixels in total. A fitted page also stops at 14,400 points a side, the largest page PDF readers will open, so a colossal image is drawn smaller on the page while keeping all of its pixels. Past 20 pages the Gizlet says it is building a big document rather than looking like it has stalled.',
        },
      ],
    },
    privacy: {
      heading: 'The PDF is written in this browser',
      paragraphs: [
        'Every page is assembled by this page, in this browser, and the finished PDF goes straight to your downloads. There is no upload endpoint behind this Gizlet and no server that ever sees the pictures, which matters more here than usual: the things people turn into PDFs are passports, bank statements, and signed contracts.',
        'A JPEG or a PNG is embedded exactly as it arrived, byte for byte, so those pages keep the original quality. A WebP, AVIF, or BMP has to be re-encoded as a JPEG first, because that is what a PDF can carry, and a re-encoded page arrives without the metadata its source file held.',
      ],
    },
    faq: [
      {
        question: 'Are my images uploaded to make the PDF?',
        answer:
          'No. The document is built by this browser using a PDF library that runs on this page, and the result is handed to your downloads. Gizlet is a static site with no endpoint that could receive a file.',
      },
      {
        question: 'Can I put more than one image in the PDF?',
        answer:
          'Yes, that is the point of it. Choose as many as you like, up to 100 pages, then move them up or down until the page order is right. Each image becomes one page.',
      },
      {
        question: 'Does it accept PNG and other formats, or only JPG?',
        answer:
          'It accepts JPEG, PNG, WebP, AVIF, and BMP. JPEG and PNG are embedded as they are; the others are re-encoded as JPEG on the way in, because a PDF cannot carry them directly.',
      },
      {
        question: 'Which page size should I choose?',
        answer:
          'A4 or US Letter if the document will be printed or submitted to a form, since both give every page a consistent printable box. Fit each image if the PDF is only going to be read on a screen and you want the pictures at their own proportions with no border.',
      },
      {
        question: 'Does making a PDF lose image quality?',
        answer:
          'A JPEG or PNG page does not: those bytes are copied into the document untouched. A WebP, AVIF, or BMP page is re-encoded as a high-quality JPEG, which loses a little detail. Scaling to a fixed page size changes how large the image is drawn, not the pixels stored.',
      },
      {
        question: 'Why is my PDF so large?',
        answer:
          'Because it contains the images at full resolution, and a PDF adds almost nothing on top of them. Ten phone photographs make a PDF about the size of ten phone photographs. Run them through Resize Image or Compress Image first if the file has to be smaller.',
      },
    ],
  },
};

/** The supporting content for a Gizlet page, if it has any yet. */
export function getToolPageContent(tool: ToolRegistryEntry): ToolPageContent | undefined {
  return toolPageContent[tool.slug];
}

/** The prose sections, in the order a page presents them. */
export function getToolContentSections(content: ToolPageContent): readonly ToolContentSection[] {
  return [content.what, content.when, content.options, content.privacy];
}

/** A stable element id for a section, so its heading can name its region. */
export function getContentSectionId(section: ToolContentSection): string {
  const slug = section.heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `about-${slug}`;
}

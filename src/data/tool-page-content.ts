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
  'crop-image': {
    what: {
      heading: 'What Crop Image does',
      paragraphs: [
        'Crop Image throws away the edges of a picture and keeps the rectangle you selected. Drag a selection over the preview, or type its position and size in the fields underneath, then choose JPEG, PNG, or WebP for the file that comes out.',
        'The rectangle is measured in the image’s own pixels rather than in the preview’s, so a selection means the same thing on a phone as it does on a desktop, and the numbers beside it are the dimensions the downloaded file will actually have.',
      ],
    },
    when: {
      heading: 'When to crop rather than resize',
      paragraphs: [
        'Crop when the problem is what is in the frame: a photograph with half a car in the corner, a screenshot that caught the whole desktop, a profile picture that has to be square before anything will accept it.',
        'Resize when the problem is how big the picture is. The two answer different questions and often run together — crop to the shape you need, then resize it to the dimensions something asks for — and both blocks can sit in the same Gizlet Flow.',
      ],
    },
    options: {
      heading: 'What the selection controls do',
      paragraphs: ['A crop is one rectangle, described three ways: dragged, typed, or nudged with the keyboard.'],
      details: [
        {
          term: 'Aspect ratio',
          description:
            'Free crop lets the selection be any shape. Choosing a ratio — square, one of the two photographic shapes, widescreen, or any of those turned upright — locks it, so every drag and every typed width keeps that shape. Switching back to free leaves the rectangle exactly where it is.',
        },
        {
          term: 'Left, top, width, and height',
          description:
            'The same rectangle in numbers, counted from the top-left corner of the image. Type into them when you know the exact pixels you want, which is more accurate than any drag and is the reason the fields exist rather than being a duplicate of the box.',
        },
        {
          term: 'Keyboard',
          description:
            'With the selection focused, the arrow keys move it ten pixels at a time and hold Alt for one. Shift with an arrow key resizes it from the bottom-right corner, keeping the aspect ratio if one is locked.',
        },
        {
          term: 'Output format',
          description:
            'JPEG for photographs, WebP for the web, PNG when the crop has to keep transparency or hard edges exactly. A crop is re-encoded, so a JPEG cropped into a JPEG is compressed a second time; PNG or WebP avoids that.',
        },
      ],
    },
    privacy: {
      heading: 'The picture never leaves the tab',
      paragraphs: [
        'The image is decoded, the selected rectangle is drawn onto a canvas, and the result is encoded, all by this browser. Gizlet is a static site with no upload endpoint, so there is nowhere for a photograph to be sent, and nothing is kept once the tab closes.',
        'Cropping is often the step that removes something private — a face at the edge of a frame, a name on a document, a window in the background — which is exactly the work that should not be done by uploading the uncropped original to somebody’s server first.',
        'Because the output is drawn fresh, it also arrives without the metadata the original carried, including the camera model and any GPS coordinates.',
      ],
    },
    faq: [
      {
        question: 'Is my photo uploaded to crop it?',
        answer:
          'No. The selection is drawn onto a canvas in this browser and the cropped file goes straight to your downloads. There is no upload endpoint behind this page, and the uncropped original never leaves the device.',
      },
      {
        question: 'Can I crop to an exact size in pixels?',
        answer:
          'Yes. Type the width and height into the fields under the preview, and the left and top values to say where the rectangle sits. Those are the dimensions the downloaded image will have, exactly.',
      },
      {
        question: 'How do I crop a square profile picture?',
        answer:
          'Choose the square ratio. The selection becomes the largest square that fits, centred, and you can drag it to the part of the picture you want; every later drag keeps it square.',
      },
      {
        question: 'Can I crop without a mouse?',
        answer:
          'Yes. Tab to the selection and use the arrow keys to move it, Alt with an arrow key for single pixels, and Shift with an arrow key to resize it. The four number fields are ordinary inputs and work the same way.',
      },
      {
        question: 'Does cropping lose quality?',
        answer:
          'The kept pixels are copied rather than rescaled, so nothing is softened. The file is encoded again, though, so cropping a JPEG and saving as JPEG applies lossy compression a second time; choose PNG or WebP if that matters.',
      },
      {
        question: 'Can I make the image bigger by cropping?',
        answer:
          'No. A crop can only keep part of what is already there, and the selection cannot leave the image. To make a picture larger, or to put it on a wider canvas, resize it instead.',
      },
    ],
  },
  'collage-maker': {
    what: {
      heading: 'What Collage Maker does',
      paragraphs: [
        'Collage Maker arranges several pictures into one. Choose up to twelve images, put them in the order you want, pick an arrangement, and the composition is drawn onto a canvas in this browser at the width you set.',
        'The preview is not a mock-up of the result: it is the result, drawn at full size and shown smaller. What you download is the same drawing encoded as JPEG, PNG, or WebP.',
      ],
    },
    when: {
      heading: 'When one picture beats several',
      paragraphs: [
        'Reach for it when the destination only takes one image: a listing that allows a single photograph, a message thread you do not want to send six pictures to, a before-and-after that only makes sense side by side.',
        'It is a composition Gizlet rather than a document one. If what you want is several pictures kept separate but sent together, put them in a PDF instead — that keeps each one whole, on its own page, at its own size.',
      ],
    },
    options: {
      heading: 'What each setting changes',
      paragraphs: ['Four settings decide the whole composition, and the order of the list decides the rest.'],
      details: [
        {
          term: 'Layout',
          description:
            'Grid puts them in as square a block as the count allows, so four images make two rows of two. Single row and single column are the strip arrangements. Feature gives the first image two thirds of the width and stacks the others beside it, which is the arrangement for one photograph with supporting ones.',
        },
        {
          term: 'Order',
          description:
            'Cells are filled in the order the list shows, so moving an image up moves it up in the collage. It matters most in the feature layout, where the first image is the large one.',
        },
        {
          term: 'Gap and background',
          description:
            'The gap is the space between cells and around the edge, in output pixels, and the background colour is what shows through it. A gap of zero makes the pictures touch, and the background then shows nowhere.',
        },
        {
          term: 'Width and format',
          description:
            'The width is the finished picture’s, and the layout works out the height from it, so a taller arrangement makes a taller file rather than a squashed one. JPEG suits photographs, WebP is the smallest for the web, and PNG keeps every pixel exactly.',
        },
      ],
    },
    privacy: {
      heading: 'Every picture stays in the tab',
      paragraphs: [
        'The images are decoded, arranged, and drawn onto one canvas by this browser, and the finished collage is handed straight to your downloads. Gizlet is a static site with no upload endpoint, so there is nowhere for a photograph to be sent, and nothing survives closing the tab.',
        'This is the Gizlet where that adds up fastest: a collage is a dozen pictures at once, usually of people, and every free collage site that takes them takes all twelve.',
        'Because the result is drawn fresh onto a canvas, it carries none of the metadata the originals did — no camera model, no timestamps, and no GPS coordinates from any of them.',
      ],
    },
    faq: [
      {
        question: 'How many pictures can go in one collage?',
        answer:
          'Up to twelve. Past that, every cell in an image small enough to share is a thumbnail, and a page of thumbnails is a contact sheet rather than a collage.',
      },
      {
        question: 'Are my photos uploaded to combine them?',
        answer:
          'No. Each one is decoded and drawn onto a canvas by this browser, and the finished picture goes straight to your downloads. There is no upload endpoint behind this page.',
      },
      {
        question: 'Why is part of a picture cut off?',
        answer:
          'Each cell is filled rather than fitted, so a picture is scaled until it covers its cell and the overflow is trimmed evenly from both sides. Fitting instead would leave every cell with two bars of background. Crop a picture first if you want to choose exactly what survives.',
      },
      {
        question: 'Can I choose the order the images appear in?',
        answer:
          'Yes. The list under the picker is the order, and the arrows move an image up or down it. Cells are filled in that order, so the first image is the one the feature layout makes large.',
      },
      {
        question: 'How do I make a collage with no gaps?',
        answer:
          'Set the gap to zero. The pictures then touch each other and the edge of the frame, and the background colour shows nowhere at all.',
      },
      {
        question: 'How big will the finished picture be?',
        answer:
          'You set the width, and the arrangement works out the height from the shapes of the images you chose. The line under the preview shows both before you commit, and the whole composition has to stay within the same pixel limits the other image Gizlets keep.',
      },
    ],
  },
  'rotate-flip-image': {
    what: {
      heading: 'What Rotate & Flip Image does',
      paragraphs: [
        'Rotate & Flip Image turns a picture in quarter turns and mirrors it. Press the buttons until the preview looks right, then save it as JPEG, PNG, or WebP.',
        'The preview is the transform itself, drawn on a canvas rather than tilted with a stylesheet, so what is on screen is what the download holds — including the sides swapping over after a quarter turn.',
      ],
    },
    when: {
      heading: 'When a picture arrives the wrong way up',
      paragraphs: [
        'Use it when a photograph comes off a phone sideways, when a scan is upside down, or when a screenshot from another device arrives rotated. Most of these are pictures whose orientation was only ever a tag in the file, and the tag did not survive the trip.',
        'Mirroring is a different job from turning: flip a photograph of a page you shot in a mirror, or a selfie that reads back to front. Rotating and mirroring can be combined, and a picture straightened here can be cropped or resized afterwards in the same Flow.',
      ],
    },
    options: {
      heading: 'What each button does',
      paragraphs: ['Four buttons, and the picture is only ever drawn once from the original pixels.'],
      details: [
        {
          term: 'Rotate left and rotate right',
          description:
            'A quarter turn each way. Four presses in the same direction bring the picture back to where it started rather than stacking four transforms, and after one or three of them the width and the height swap over.',
        },
        {
          term: 'Flip horizontally and flip vertically',
          description:
            'Mirrors what you are looking at, left to right or top to bottom. Pressing the same flip twice returns exactly to where you started, whatever rotation is already applied.',
        },
        {
          term: 'Put it back',
          description:
            'Returns to the picture as it arrived. It is available only once something has actually changed, so the button never claims to undo nothing.',
        },
        {
          term: 'Output format',
          description:
            'JPEG for photographs, WebP for the web, PNG for screenshots and anything with transparency. A turn is lossless in itself — no pixel is resampled — but the file is encoded again, so a JPEG saved as a JPEG is compressed a second time.',
        },
      ],
    },
    privacy: {
      heading: 'Turned here, not somewhere else',
      paragraphs: [
        'The image is decoded, drawn in its new orientation, and encoded by this browser, and the result goes straight to your downloads. Gizlet is a static site with no upload endpoint, so there is nowhere for a photograph to be sent, and nothing is kept once the tab closes.',
        'Every press redraws the preview from the original pixels rather than from the last preview, so pressing a button ten times costs the picture nothing. The file is written once, when you save it.',
        'Because the output is drawn fresh onto a canvas, it also arrives without the metadata the original carried, including the orientation tag that may have been the whole problem, the camera model, and any GPS coordinates.',
      ],
    },
    faq: [
      {
        question: 'Is the photo uploaded to rotate it?',
        answer:
          'No. It is decoded and redrawn by this browser, and the turned file is handed straight to your downloads. There is no upload endpoint behind this page.',
      },
      {
        question: 'Why did the width and height swap?',
        answer:
          'Because a quarter turn stands the picture on its side: a 4000 by 3000 photograph rotated left or right is 3000 by 4000. Turning it twice, or mirroring it, leaves both sides as they were.',
      },
      {
        question: 'Does rotating lose quality?',
        answer:
          'The turn itself does not: a quarter turn moves whole pixels and resamples nothing. The file is encoded again afterwards, so saving a JPEG as a JPEG applies lossy compression a second time; choose PNG or WebP if that matters.',
      },
      {
        question: 'Can I rotate by an arbitrary angle?',
        answer:
          'No. Quarter turns only, because any other angle has to invent pixels in the corners and decide what to do with the ones that fall outside the frame. Straightening a crooked horizon is a different job and is not this Gizlet.',
      },
      {
        question: 'My phone shows it upright but everything else shows it sideways. Why?',
        answer:
          'The orientation was stored as a tag rather than in the pixels, and software that ignores the tag shows the picture as it was actually recorded. Turning it here writes the orientation into the pixels themselves, so it looks the same everywhere.',
      },
      {
        question: 'What is the difference between flipping and rotating?',
        answer:
          'Rotating turns the picture; flipping mirrors it. A rotated photograph of text is still readable when you tilt your head, and a flipped one reads backwards, which is why mirroring is what fixes a picture taken in a mirror.',
      },
    ],
  },
  'remove-image-metadata': {
    what: {
      heading: 'What Remove Image Metadata does',
      paragraphs: [
        'Remove Image Metadata reads the fields a picture carries about itself and shows them to you: where it was taken, what took it, when, and who it says it belongs to. Then it strips them, by decoding the picture and encoding it again with nothing but pixels.',
        'The reading happens in this browser, by a parser that ships with the page — no upload, and no library fetched to inspect your file. After cleaning, the file that is about to be downloaded is read back with the same parser, and the page says what it found. The claim is checked rather than asserted.',
      ],
    },
    when: {
      heading: 'When to strip a file before it leaves',
      paragraphs: [
        'Before a photograph goes anywhere public. A picture taken on a phone can carry the coordinates of the place it was taken to five decimal places, which is a house rather than a neighbourhood, and the site you post it to may or may not remove them.',
        'Also before sending a picture as evidence of something, or as a listing, or on a forum: the camera serial number, the software, and the exact minute are all in there, and together they link one photograph to every other photograph from the same device.',
      ],
    },
    options: {
      heading: 'What the report is showing you',
      paragraphs: ['Everything found is grouped by what it is about, most sensitive first.'],
      details: [
        {
          term: 'Where it was taken',
          description:
            'GPS latitude and longitude, read out of the four tags a camera writes them in and shown as one coordinate. This is the field the Gizlet exists for, and it is the one marked in red.',
        },
        {
          term: 'When, what and who',
          description:
            'The timestamps, the camera make and model, the lens, the exposure settings, the software that last wrote the file, and any artist, copyright, owner or serial-number field it carries.',
        },
        {
          term: 'Everything else',
          description:
            'Entries this page does not have a name for are counted rather than listed, so the summary never suggests the file carries less than it does. They are removed with the rest.',
        },
        {
          term: 'Output format',
          description:
            'JPEG, PNG, or WebP. It defaults to the format the file already is. The picture is re-encoded, so a JPEG saved as a JPEG is compressed a second time; PNG and WebP avoid that at a larger file size.',
        },
      ],
    },
    privacy: {
      heading: 'The file is read here, not sent',
      paragraphs: [
        'The bytes are read by this browser and parsed by a module on this page. Gizlet is a static site with no upload endpoint, so a photograph carrying your address in its metadata is not sent anywhere to have that pointed out to you, which would rather defeat the exercise.',
        'The cleaned picture is drawn onto a canvas and encoded fresh, which is what leaves every field behind: canvas encoding writes pixels and nothing else. The picture is drawn exactly as the browser displays it, so a photograph that arrived upright stays upright even though the orientation tag is gone.',
        'Removing metadata cannot be undone, and Gizlet keeps no copy — nothing survives closing the tab. Keep the original if the timestamps matter to you.',
      ],
    },
    faq: [
      {
        question: 'Is my photo uploaded to read its metadata?',
        answer:
          'No. The file is read as bytes by this browser and parsed on this page, and the cleaned copy is written straight to your downloads. There is no upload endpoint behind this page.',
      },
      {
        question: 'Does a photo really contain my location?',
        answer:
          'Often, yes. A phone with location services on writes latitude and longitude into the file to five decimal places, which is close enough to identify a building. This page shows the coordinate if it is there.',
      },
      {
        question: 'Will the picture look different afterwards?',
        answer:
          'No. It is drawn exactly as your browser displays it, including any rotation the orientation tag was asking for, so a photograph that arrived upright stays upright. Only the fields go.',
      },
      {
        question: 'How do I know the metadata is actually gone?',
        answer:
          'The cleaned file is read back with the same parser that read the original, and the result panel says what that second read found. It is the same check you could run yourself on the downloaded file.',
      },
      {
        question: 'Does re-encoding lose quality?',
        answer:
          'A JPEG saved as a JPEG is compressed a second time, which loses a little. Choose PNG or WebP to avoid it, at a larger file size. There is no way to strip metadata by re-encoding without encoding.',
      },
      {
        question: 'Can I remove one field and keep the others?',
        answer:
          'No. This Gizlet removes everything or nothing, because a picture that keeps some of its fields is one somebody has to reason about, and the reason to be here is not wanting to.',
      },
    ],
  },
  'image-background': {
    what: {
      heading: 'What Image Background does',
      paragraphs: [
        'Image Background puts a picture onto a canvas you choose: a size, a colour behind it, how the picture is scaled into it, and where it sits. Your browser draws the two together and hands back one image.',
        'It is the Gizlet for a transparent PNG that needs something behind it, and for a photograph that has to be a particular shape before somewhere will accept it. The preview is the canvas itself, drawn at full size and shown smaller, so what is on screen is what the download holds.',
      ],
    },
    when: {
      heading: 'When the shape is the requirement',
      paragraphs: [
        'Reach for it when the destination dictates the frame: a marketplace that wants square photographs, a link preview that has to be 1200 by 630, a story that has to be tall. Fitting a landscape photograph into a square by cropping loses the edges; putting it on a square canvas keeps all of it.',
        'It is also what a logo with a transparent background needs before it goes somewhere that shows it on white, or on black, or on anything unpredictable. Choosing the colour here means the answer is in the file rather than left to whatever renders it.',
      ],
    },
    options: {
      heading: 'What the canvas controls do',
      paragraphs: ['A canvas, a rule for scaling the picture into it, and where it is held.'],
      details: [
        {
          term: 'Canvas size',
          description:
            'The finished image’s dimensions. The presets are the shapes the job usually asks for — the picture’s own size, a 1080 square, a 1200 by 630 link preview, a 1080 by 1920 story — and the two fields take anything else. Choosing a size in the fields updates the preset to match rather than leaving the two disagreeing.',
        },
        {
          term: 'Fit',
          description:
            'Fit inside scales the whole picture until it fits, leaving background around it. Fill the canvas scales until no background shows and trims whatever overflows. Original size leaves every pixel as it is, which is what you want when adding a border rather than resizing anything.',
        },
        {
          term: 'Position and nudges',
          description:
            'Nine anchors, from top left to bottom right, decide where the picture is held. The two nudge fields move it from there in canvas pixels, including negative values, for the cases where an anchor is nearly right.',
        },
        {
          term: 'Background and format',
          description:
            'Any colour, or none at all. PNG and WebP keep a transparent background; JPEG cannot hold transparency, so it is saved white and the page says so before you download rather than after.',
        },
      ],
    },
    privacy: {
      heading: 'The canvas is drawn here',
      paragraphs: [
        'The picture is decoded, drawn onto the canvas, and encoded by this browser, and the finished file goes straight to your downloads. Gizlet is a static site with no upload endpoint, so there is nowhere for an image to be sent, and nothing is kept once the tab closes.',
        'Product photographs and logos are the files this Gizlet is for, and they are usually somebody’s work before a launch. Preparing them should not mean handing them to a site that sees them first.',
        'Because the output is drawn fresh onto a canvas, it arrives without the metadata the original carried, including the camera model and any GPS coordinates.',
      ],
    },
    faq: [
      {
        question: 'How do I put a white background behind a transparent PNG?',
        answer:
          'Leave the canvas at the image’s own size, pick white as the background, and save. The transparent areas become white, and nothing else about the picture changes.',
      },
      {
        question: 'Why did my transparent background come out white?',
        answer:
          'Because the output format was JPEG, which has no transparency at all. Choose PNG or WebP to keep it clear; the page warns about this as soon as the two settings disagree.',
      },
      {
        question: 'What is the difference between fitting inside and filling the canvas?',
        answer:
          'Fitting scales the picture until all of it is visible, leaving background at two edges. Filling scales it until the canvas is covered, which means the parts that overflow are cut off. Fitting keeps everything; filling keeps the frame full.',
      },
      {
        question: 'How do I make a square image for a listing?',
        answer:
          'Choose the 1080 square canvas, leave the fit on Fit inside, and pick a background colour. A landscape photograph then keeps all of its content, with bands above and below in the colour you chose.',
      },
      {
        question: 'Can the picture be bigger than the canvas?',
        answer:
          'Yes, with Original size. Every pixel stays as it is and whatever falls outside the canvas is not saved, which is the honest way to add a border to a picture without touching it.',
      },
      {
        question: 'Is anything uploaded?',
        answer:
          'No. The canvas is drawn by this browser and written straight to a download. There is no upload endpoint behind this page.',
      },
    ],
  },
  'image-dimensions': {
    what: {
      heading: 'What Image Dimensions does',
      paragraphs: [
        'Image Dimensions reads a picture and tells you about it: how many pixels across and down, what aspect ratio that works out to, how many megapixels, whether it is landscape or portrait, what format the file is, and how big it is on disk.',
        'It changes nothing and writes nothing. The picture is decoded by this browser to be measured, the numbers appear, and the file on your device is exactly the file that was there before.',
      ],
    },
    when: {
      heading: 'When you just need the number',
      paragraphs: [
        'When a form says "maximum 2000 pixels wide" and you have no idea. When a print shop asks how many megapixels. When something needs a 16:9 image and you are holding one that might be. Opening a photo editor to read four numbers is a lot of application for the question.',
        'It is also the Gizlet to reach for before the others: read the dimensions here, then resize, crop, or put the picture on a background, knowing what you started with.',
      ],
    },
    options: {
      heading: 'What the numbers mean',
      paragraphs: ['Eight facts, and the first two have a copy button because they are the ones that get pasted into things.'],
      details: [
        {
          term: 'Dimensions, width and height',
          description:
            'The pixels the browser decoded, which is the size the picture actually is. A photograph whose orientation is stored as a tag is reported the way it is displayed, which is the number every other application will also show.',
        },
        {
          term: 'Aspect ratio',
          description:
            'The sides divided by everything they have in common: 1920 by 1080 is 16:9. A picture whose sides reduce to nothing anybody recognises is named after the shape it is within one percent of, marked with a ≈, and one that is not near any common shape is given as a decimal instead of a ratio nobody could use.',
        },
        {
          term: 'Megapixels and shape',
          description:
            'The pixel count as a camera would advertise it, and whether the picture is landscape, portrait, or square. Below a tenth of a megapixel it says so rather than rounding down to zero.',
        },
        {
          term: 'Format and file size',
          description:
            'What the file is, detected from the file itself rather than from its name, and how much space it takes. A large file with small dimensions usually means a lossless format; that is what Compress Image is for.',
        },
      ],
    },
    privacy: {
      heading: 'Read, not uploaded',
      paragraphs: [
        'The picture is decoded by this browser to be measured. Gizlet is a static site with no upload endpoint, so nothing is sent anywhere, and this Gizlet writes no file at all — there is not even a download, because nothing was made.',
        'It is the least invasive thing you can do to a photograph, and it still happens entirely on your device.',
      ],
    },
    faq: [
      {
        question: 'Does this change my image?',
        answer:
          'No. It decodes the picture to measure it and produces no file at all. The image on your device is untouched, and there is nothing to download.',
      },
      {
        question: 'Why is the aspect ratio shown with a ≈?',
        answer:
          'Because the sides do not divide into a ratio anybody would recognise, but the picture is within one percent of one that they would. 4001 by 2250 is not exactly 16:9, and saying ≈ 16:9 is more useful than the exact fraction.',
      },
      {
        question: 'Is anything uploaded to measure it?',
        answer:
          'No. The file is read by this browser and never leaves the tab. There is no upload endpoint behind this page.',
      },
      {
        question: 'My phone says a different size. Which is right?',
        answer:
          'Both, usually. A photograph can store its pixels one way round and carry a tag asking to be shown the other way; this reports it as it is displayed, which is what other software shows too. Remove Image Metadata shows that tag if you want to see it.',
      },
      {
        question: 'What counts as a megapixel?',
        answer:
          'A million pixels: width multiplied by height, divided by a million. A 4032 by 3024 photograph is about 12 MP, which is the number a phone camera advertises.',
      },
      {
        question: 'Why is the copy button only on some rows?',
        answer:
          'Because only some of them are values people paste somewhere: the dimensions, the ratio, and each side on its own. Nobody pastes the word "Landscape" into a form.',
      },
    ],
  },
  'image-color-picker': {
    what: {
      heading: 'What the Image Color Picker does',
      paragraphs: [
        'Pick a pixel out of a picture and read its colour as HEX, RGB and HSL, ready to copy. The image is drawn onto a canvas in this browser and each pick reads that one pixel back.',
        'Click or tap the picture, or focus it and move the pick with the arrow keys — one pixel a step, ten with Shift held. The colours picked during this visit stay in a row underneath until the tab closes.',
      ],
    },
    when: {
      heading: 'When the colour is in the picture',
      paragraphs: [
        'When something has to match: the exact blue in a logo you were sent as a PNG, the background of a screenshot you are extending, the accent colour of a photograph you are building a page around. The value is in the file; this reads it out.',
        'It is also the fastest way to check what a colour actually is rather than what it looks like. Two greys that look identical on screen are rarely the same grey, and the numbers settle it.',
      ],
    },
    options: {
      heading: 'How to pick, and what you get',
      paragraphs: ['One pixel, three notations, and a short memory.'],
      details: [
        {
          term: 'Pointer or touch',
          description:
            'Click or tap a pixel. Holding the button down and dragging keeps picking as you move, so a colour can be found by sweeping across an area rather than by aiming at it.',
        },
        {
          term: 'Keyboard',
          description:
            'Focus the picture and use the arrow keys: one pixel a step, ten with Shift. The picture starts on its middle pixel, so there is always a colour to move from rather than an empty panel to aim at.',
        },
        {
          term: 'HEX, RGB and HSL',
          description:
            'The same colour in the three notations CSS takes, each with a copy button. A grey is reported with a hue of zero, because every hue produces a grey and naming one would be inventing it.',
        },
        {
          term: 'The colours you picked',
          description:
            'The last eight, newest first, each copyable by clicking it. Picking the same colour twice moves it rather than duplicating it. They are held in the page and nothing is stored: closing the tab forgets them.',
        },
      ],
    },
    privacy: {
      heading: 'The pixels are read here',
      paragraphs: [
        'The picture is decoded and drawn onto a canvas by this browser, and each pick reads one pixel out of that canvas. Gizlet is a static site with no upload endpoint, so nothing is sent anywhere, and this Gizlet writes no file at all.',
        'The colour history lives in the page for as long as the tab does. It is not saved to the browser, not sent anywhere, and not recoverable afterwards — if a colour matters, copy it.',
      ],
    },
    faq: [
      {
        question: 'Is my image uploaded to pick a colour?',
        answer:
          'No. It is drawn onto a canvas in this browser and read one pixel at a time. There is no upload endpoint behind this page, and nothing is written.',
      },
      {
        question: 'Can I pick a colour without a mouse?',
        answer:
          'Yes. Tab to the picture and use the arrow keys, one pixel a step or ten with Shift held. The current pixel and its colour are announced as you move.',
      },
      {
        question: 'Why is the hue of my grey zero?',
        answer:
          'Because a grey has no hue: every hue produces it once the saturation is zero. Reporting zero is the convention browsers use too, and it is more honest than printing whatever the arithmetic left behind.',
      },
      {
        question: 'Are the colours I picked saved?',
        answer:
          'Only in the page, and only until you close the tab. Nothing is written to your browser storage and nothing is sent anywhere, so a colour you want to keep should be copied.',
      },
      {
        question: 'The colour is slightly different from the original. Why?',
        answer:
          'A lossy format changes pixels: a JPEG of a flat colour is a field of very slightly different colours. What you get is what is actually in the file, which is what any other picker on the same file would also report.',
      },
      {
        question: 'Can it pull a whole palette out of an image?',
        answer:
          'No. This picks the pixel you point at. Choosing a palette means deciding what a picture is mostly made of, which is a judgement rather than a reading, and it is not this Gizlet.',
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
      heading: 'What Image to PDF does',
      paragraphs: [
        'Image to PDF takes the images you choose and writes them into a single PDF, one image per page, in the order you put them in. Your browser decodes each picture, works out where it sits on the page, and assembles the document here on this device.',
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
        question: 'Which image formats does it accept?',
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
  'pdf-viewer': {
    what: {
      heading: 'What the PDF Viewer does',
      paragraphs: [
        'The PDF Viewer opens a PDF and draws it, one page at a time, using a PDF engine that runs inside this page. A strip of page thumbnails sits beside the page you are reading, so you can see the shape of the document and jump straight to the part you want.',
        'Every page is drawn onto a canvas by your own browser, which is why it works the same on a phone as on a laptop. Nothing is added, nothing is changed, and no file is written: this Gizlet reads.',
      ],
    },
    when: {
      heading: 'When to open a PDF here instead',
      paragraphs: [
        'On a phone, most browsers refuse to show a PDF inside the page and download it instead, which leaves you hunting through a downloads folder to read one document. This draws it in place.',
        'The other reason is the obvious one. The alternative to a local viewer is one of the many sites that ask you to upload a PDF first, and the documents people most need to open — a payslip, a tenancy agreement, a medical letter, a passport scan — are exactly the ones that should not be uploaded to read them.',
      ],
    },
    options: {
      heading: 'What the reading controls do',
      paragraphs: [],
      details: [
        {
          term: 'Page thumbnails',
          description:
            'Every page is drawn small down the side, or across the top on a narrow screen. Select one to jump to it. The page you are on is outlined.',
        },
        {
          term: 'Page navigation',
          description:
            'Arrows step one page at a time, and the page box takes a number to jump. A number that is not a page in this document is refused and the box goes back to where you were, rather than jumping somewhere you did not ask for.',
        },
        {
          term: 'Zoom',
          description:
            'A page opens fitted to the space available, then zooms from 50% to 300% in fixed steps. Each press redraws the page at the new size rather than scaling a picture of it, so text stays sharp at every level.',
        },
        {
          term: 'Limits',
          description:
            'Up to 500 pages. Past 25 the Gizlet says it is drawing a large document rather than looking like it has stalled. A password-protected PDF is refused with an explanation, because unlocking one needs the password it is protected with.',
        },
      ],
    },
    privacy: {
      heading: 'The document never leaves this device',
      paragraphs: [
        'The PDF is read and drawn entirely in this browser. Gizlet is a static site with no upload endpoint, so there is no server that could receive the file, and nothing is kept once you close the tab.',
        'The PDF engine runs in a Web Worker, which is a background thread inside this same page rather than anything remote. It is loaded from this site along with the rest of the page, so no part of reading your document involves another company.',
      ],
    },
    faq: [
      {
        question: 'Is my PDF uploaded to read it?',
        answer:
          'No. The document is parsed and drawn by this browser, on this device. There is no upload endpoint behind this page and no copy is kept after you leave.',
      },
      {
        question: 'Can it open a password-protected PDF?',
        answer:
          'No. A protected PDF cannot be decoded without its password, and this Gizlet does not ask for one. Open it in an application that can, then save an unlocked copy and read that here.',
      },
      {
        question: 'Can I select or search the text?',
        answer:
          'Not yet. Pages are drawn as pictures, so there is no text to select or search. That needs a text layer over the page, which is worth doing properly rather than partly.',
      },
      {
        question: 'How many pages can it open?',
        answer:
          'Up to 500. Beyond that the Gizlet explains the limit instead of attempting it. Very large documents are also bound by your own device memory, and a long one takes a moment to draw all of its thumbnails.',
      },
      {
        question: 'Why does one page fail to draw when the rest are fine?',
        answer:
          'Some PDFs contain a page the engine cannot render, often an unusual font or a broken image. That page says so instead of showing you a blank sheet, and the rest of the document stays readable.',
      },
      {
        question: 'Does it work on a phone?',
        answer:
          'Yes, and that is much of the point. Pages are drawn onto a canvas rather than handed to the browser’s own PDF support, which most mobile browsers do not have, so the document appears in the page instead of being downloaded.',
      },
    ],
  },
  'merge-pdf': {
    what: {
      heading: 'What Merge PDF does',
      paragraphs: [
        'Merge PDF joins several PDFs into one document. Every page of the first file comes first, then every page of the second, and so on down the list you arranged. The pages themselves are copied across as they are: nothing is redrawn, re-encoded, or resized on the way through.',
        'Each document is opened in your browser as you choose it, to check that it can be read and to count its pages, so the list tells you what you are about to join before you join it. The finished file is assembled on this device and handed straight to your downloads.',
      ],
    },
    when: {
      heading: 'When joining PDFs is the job',
      paragraphs: [
        'Whenever something has to arrive as one attachment: a scanned form and the photographs that support it, a month of receipts for an expense claim, a contract signed a page at a time, a portfolio an application asked for as a single file.',
        'It is also what finishes the other PDF Gizlets. Make a PDF of one batch of photographs with Image to PDF, do the same for another, join the two here, and read the result in the PDF Viewer before you send it anywhere.',
      ],
    },
    options: {
      heading: 'What the document list controls',
      paragraphs: ['There is nothing to configure here. The order is the setting.'],
      details: [
        {
          term: 'Document order',
          description:
            'Pages come out in the order the list shows, top to bottom. The arrows move a document up or down, and the merged file is built from the list each time you press the button, so changing your mind costs nothing but the press.',
        },
        {
          term: 'Removing a document',
          description:
            'Remove takes a document out of the merge and does nothing to the file on your device. You can add more at any point, and a file chosen twice is joined twice, which is occasionally exactly what you want.',
        },
        {
          term: 'Limits',
          description:
            'Up to 20 documents, and 500 pages in the finished file — the same 500 pages the PDF Viewer will open, so a document made here can always be read here. Past 50 pages the Gizlet says it is joining a large document rather than looking like it has stalled.',
        },
        {
          term: 'What it refuses',
          description:
            'A password-protected PDF is refused by name, because its pages cannot be copied without the password that protects them. So is a file that cannot be read as a PDF at all, which is usually a download that never finished or another format renamed .pdf.',
        },
      ],
    },
    privacy: {
      heading: 'Several documents in, none of them uploaded',
      paragraphs: [
        'Every document is parsed and joined by this browser, on this device. Gizlet is a static site with no upload endpoint, so there is nowhere for a file to be sent, and nothing is kept once you close the tab.',
        'This is the Gizlet where that matters most. The documents people join tend to be the private ones — an identity paper with a proof of address, a payslip with a bank statement, a medical letter with a claim form — and every one of them stays in your own browser’s memory until the merged file is saved.',
      ],
    },
    faq: [
      {
        question: 'Are my PDFs uploaded to merge them?',
        answer:
          'No. Each document is read and copied by this browser, and the merged file is written straight to a download. There is no upload endpoint behind this page, so there is nothing for a file to be sent to.',
      },
      {
        question: 'Does merging change the pages?',
        answer:
          'No. Pages are copied from each document into the new one, so text stays text, a scan keeps its resolution, and page sizes stay as they were. A merged document can therefore hold pages of different sizes, which is normal and opens fine everywhere.',
      },
      {
        question: 'Can it merge a password-protected PDF?',
        answer:
          'No. The pages of a protected document are encrypted, and copying them without its password would produce nonsense rather than a page. Open it in an application that can ask for the password, save an unlocked copy, and merge that instead.',
      },
      {
        question: 'How many PDFs can I merge at once?',
        answer:
          'Up to 20 documents, as long as they come to no more than 500 pages between them. Both limits exist because the work happens in this browser, where every document and the merged one are in memory at the same time.',
      },
      {
        question: 'Can I reorder or delete the pages inside a document?',
        answer:
          'Not here. This Gizlet arranges whole documents, not the pages within them. Splitting a PDF into parts you can rearrange is a different job, and it is worth its own Gizlet rather than a second set of controls bolted onto this one.',
      },
      {
        question: 'Why does one of my files say it could not be read?',
        answer:
          'Because nothing in it parses as a PDF. Most often the file is a download that stopped part way, or an image or document renamed to end in .pdf. The file is named in the message so you can replace that one and keep the rest of the list.',
      },
    ],
  },
  'pdf-to-jpg': {
    what: {
      heading: 'What PDF to Image does',
      paragraphs: [
        'PDF to Image draws the pages of a PDF and hands each one back as a picture. The same engine that powers the PDF Viewer renders a page onto a canvas inside this tab, and the same encoder the image Gizlets use writes it out as JPEG, PNG, or WebP.',
        'Take the whole document or name the pages you want. Each page arrives as its own file with its own download, and a set arrives as one archive as well, so twelve pages need not be twelve clicks.',
      ],
    },
    when: {
      heading: 'When a page is more useful as a picture',
      paragraphs: [
        'Whenever something will only take an image: a marketplace listing that wants photographs, a form that accepts a JPEG and refuses a PDF, a slide that needs one page of a report dropped into it, a chat that would rather show a page than attach a document.',
        'It is also the way back into the rest of Gizlet. A page that has become an image can be compressed, resized, or converted like any other, and Gizlet Flows can run those one after another without a file ever being written in between.',
      ],
    },
    options: {
      heading: 'What the page, format, and resolution controls do',
      paragraphs: [],
      details: [
        {
          term: 'Pages',
          description:
            'Numbers and ranges, like 1-3, 5. Leaving the field empty converts the whole document. A page that is not in this PDF is refused rather than skipped quietly, and the preview beside the field is there to find the numbers with.',
        },
        {
          term: 'Image format',
          description:
            'JPEG suits scans and pages with photographs on them, and is what most upload forms expect. PNG keeps text and line art exactly, at a larger file size. WebP is usually the smallest of the three and every current browser reads it.',
        },
        {
          term: 'Resolution',
          description:
            'A PDF page is measured in points, so 72 dpi is the page at exactly its own size. 144 dpi doubles it, which is the right default for reading text on a screen, and 216 dpi is for printing or cropping into. A page too large to draw at the chosen setting is drawn at the largest size the device can hold instead of failing.',
        },
        {
          term: 'Limits',
          description:
            'Up to 100 pages in one pass, and past 20 the Gizlet says it is working through a long document rather than looking stalled. A password-protected PDF is refused with an explanation, because its pages cannot be read without the password.',
        },
      ],
    },
    privacy: {
      heading: 'The pages are drawn here, not sent away',
      paragraphs: [
        'Reading the PDF, drawing each page, encoding the images, and packing the archive all happen in this browser. Gizlet is a static site with no upload endpoint, so there is no server that could receive the document, and nothing survives closing the tab.',
        'The archive is assembled on this device too, by code that ships with the page, which is the part most conversion sites use as their reason to take the file. Scanned contracts, medical letters, and identity documents are exactly the PDFs that should not be handed to one.',
      ],
    },
    faq: [
      {
        question: 'Is the PDF uploaded to convert it?',
        answer:
          'No. The document is parsed, drawn, and encoded by this browser, and the images are written straight to your downloads. There is no upload endpoint behind this page.',
      },
      {
        question: 'Can I convert only some of the pages?',
        answer:
          'Yes. Put numbers and ranges in the Pages field, like 1-3, 5, and only those pages are converted. Leave it empty and you get the whole document.',
      },
      {
        question: 'Which resolution should I choose?',
        answer:
          '144 dpi for anything that will be looked at on a screen, which is why it is the default. 72 dpi when the file size matters more than the detail, and 216 dpi when the image will be printed or cropped into.',
      },
      {
        question: 'How do I download every page at once?',
        answer:
          'A set of pages comes with a single archive holding all of them, alongside the individual links. The archive is built in this browser from the same images, so it costs no second conversion.',
      },
      {
        question: 'Will the text still be selectable in the image?',
        answer:
          'No, and that is what converting to an image means: a picture of the page has no text layer. Keep the PDF if the words have to stay searchable, and use the images where a picture is what is wanted.',
      },
      {
        question: 'Can it convert a password-protected PDF?',
        answer:
          'No. A protected document cannot be decoded without its password, and this Gizlet does not ask for one. Open it in an application that can, save an unlocked copy, and convert that instead.',
      },
    ],
  },
  'split-pdf': {
    what: {
      heading: 'What Split PDF does',
      paragraphs: [
        'Split PDF takes one document apart into several. Name the ranges you want — 1-3, 5, 8-10 — and each one is copied into a PDF of its own, or ask for every page separately and get one document per page.',
        'The pages are copied rather than redrawn, so what comes out is the same PDF content it went in as: the text stays selectable, the fonts stay embedded, and nothing is re-encoded. Each part arrives with its own download, and a set arrives as one archive as well.',
      ],
    },
    when: {
      heading: 'When to split a document up',
      paragraphs: [
        'Whenever only part of a document is the part anyone needs: one chapter out of a report, the signature page of a contract, a single invoice out of a month of them, the two pages of a scan that are actually the form. Sending the whole file when three pages were asked for is how documents end up somewhere they should not be.',
        'Splitting is also how a long document becomes a workable one. It is the pair to Merge PDF — take a document apart, keep what matters, join it back to something else — and it feeds PDF to Image, which is easier to point at a handful of pages than at a hundred.',
      ],
    },
    options: {
      heading: 'What the split controls do',
      paragraphs: [],
      details: [
        {
          term: 'Split into',
          description:
            'Page ranges you name gives you one PDF per range, in the order you write them. Every page separately gives you one PDF per page, which is the quicker way to ask for the whole document broken up and needs nothing typed.',
        },
        {
          term: 'Pages',
          description:
            'Ranges and single pages, like 1-3, 5. Order matters here, because each range becomes its own document: 1-3, 5 is two PDFs, and writing them the other way round names the files differently. A range that runs backwards, a page past the end of the document, or the same range written twice is refused rather than guessed at, and the preview beside the field is there to find the numbers with.',
        },
        {
          term: 'Limits',
          description:
            'Documents of up to 500 pages, which is what the PDF Viewer will open, so anything this Gizlet produces can be read in the one next to it. Past 20 output documents the Gizlet says it is working through a long split rather than looking stalled. A one-page PDF is refused, because there is nothing to split it into, and a password-protected PDF is refused with an explanation.',
        },
      ],
    },
    privacy: {
      heading: 'The document is taken apart here',
      paragraphs: [
        'Reading the PDF, copying the pages, writing each new document, and packing the archive all happen in this browser. Gizlet is a static site with no upload endpoint, so there is no server that could receive the file, and nothing survives closing the tab.',
        'This is the Gizlet where that matters most. Splitting a document is usually the step before sending part of it on, which means the file on your device at that moment is a contract, a payslip, a medical letter, or a bank statement — exactly the documents that should not be handed to a site that takes the upload first and splits it afterwards.',
      ],
    },
    faq: [
      {
        question: 'Is the PDF uploaded to split it?',
        answer:
          'No. The document is parsed and the new ones are written by this browser, and they are handed straight to your downloads. There is no upload endpoint behind this page.',
      },
      {
        question: 'How do I write the page ranges?',
        answer:
          'Numbers and ranges separated by commas, like 1-3, 5, 8-10. Each entry becomes one PDF, so that example gives you three documents: pages 1 to 3, page 5 on its own, and pages 8 to 10.',
      },
      {
        question: 'Can I pull a single page out?',
        answer:
          'Yes. Write just that page number, like 7, and you get a one-page PDF holding it. The file is named for the page, so several single pages do not become a folder of files you cannot tell apart.',
      },
      {
        question: 'How do I split every page into its own file?',
        answer:
          'Choose Every page separately in Split into. The Pages field is not needed then, and you get one PDF per page, numbered so they sort into reading order.',
      },
      {
        question: 'Does splitting reduce the quality or lose the text?',
        answer:
          'No. The pages are copied, not redrawn, so the text stays selectable and the images stay exactly as they were. That is the difference between splitting a PDF and converting its pages to pictures.',
      },
      {
        question: 'How do I delete pages instead of extracting them?',
        answer:
          'Name the ranges you want to keep and leave out the ones you do not. Splitting a ten-page document as 1-4, 6-10 gives you the document without page 5, in two parts; joining those back into one is what Merge PDF is for.',
      },
      {
        question: 'Can it split a password-protected PDF?',
        answer:
          'No. A protected document cannot be read without its password, and this Gizlet does not ask for one. Open it in an application that can, save an unlocked copy, and split that instead.',
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

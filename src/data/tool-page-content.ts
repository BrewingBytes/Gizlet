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
        'You can also work the other way round and name the file size instead of the quality. Pick a limit — 100 KB, 200 KB, 500 KB, 1 MB, or a number of your own — and your browser tries descending qualities until the file comes in under it, then tells you exactly how many bytes it landed on.',
        'It also takes a batch. Choose or drop a folder of photographs, set the format and the quality once, and every one of them is compressed here in turn — each with its own download, and all of them as one ZIP.',
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
      heading: 'What the format, quality, and target controls do',
      paragraphs: ['A format, and then one of two ways to say how hard to squeeze.'],
      details: [
        {
          term: 'Output format',
          description:
            'JPEG is the safe default for photographs and opens anywhere. WebP is usually noticeably smaller than JPEG at a comparable quality and every current browser supports it. PNG keeps every pixel exactly, which suits screenshots and flat graphics but makes a poor photograph format.',
        },
        {
          term: 'Quality',
          description:
            'The default. The slider runs from 40% to 100% and starts at 82%, a good default for photographs. Below roughly 60% the artefacts start to show around hard edges and in flat areas like skies. It has no effect on PNG, which is lossless and has no quality to trade away.',
        },
        {
          term: 'Target file size',
          description:
            'The other way round: name the limit and let the quality fall out of it. Your browser encodes the picture at descending qualities and keeps the first result at or under the limit, so the answer is a real measured file rather than an estimate. In this control KB means 1,000 bytes and MB means 1,000,000, because that is what an upload form asking for "under 500 KB" means. It is offered for JPEG and WebP; PNG has no quality to spend, so it stays on the slider and says so.',
        },
        {
          term: 'When the limit cannot be met',
          description:
            'Some pictures will not come down that far at their current dimensions. Rather than switching format or shrinking the image behind your back, the Gizlet stops at the smallest attempt it made, says how many bytes over the limit that is, and offers it as a best attempt beside a link to Resize Image — because taking pixels out is the thing that works when quality has run out.',
        },
        {
          term: 'Several images at once',
          description:
            'Up to 25 in one batch, all with the same settings. They are worked through one at a time rather than all at once, which is what keeps a tab responsive on a set of large photographs, and one file the browser cannot decode costs that one row rather than the batch. The comparison slider belongs to a single picture, so a batch shows a list of results instead.',
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
        question: 'How do I get an image under a specific file size?',
        answer:
          'Switch the mode to Target file size, pick 100 KB, 200 KB, 500 KB, 1 MB, or type a whole number of KB, and compress. The result panel prints the exact byte count and whether it came in under the limit, and a batch reports that for each picture separately.',
      },
      {
        question: 'Does 500 KB here mean 500,000 bytes or 512,000?',
        answer:
          '500,000. The target control is decimal: KB is 1,000 bytes and MB is 1,000,000, which is what an upload form printing a limit almost always means. The result is reported as an exact byte count as well, so you never have to work out which unit was intended.',
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
        'It also takes a batch. Choose a folder of pictures, set the size once, and every one of them is resized here in turn — each with its own download, and all of them as one ZIP.',
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
          term: 'Several images at once',
          description:
            'Up to 25 in one batch. A percentage means the same thing to every picture already; an exact size does not, so with the lock on the width is the instruction and each picture works out its own height, and with the lock off every picture is forced to the same box — which is what a set of thumbnails wants. The note under the fields says which of those is about to happen.',
        },
        {
          term: 'Limits',
          description:
            'Each side can be up to 16,384 pixels and the result up to 40 million pixels. Anything larger is refused with an explanation instead of a failed download, and results above roughly 16 megapixels are flagged as a big image before you commit to them. A batch is held to 320 million pixels in total, because the work is sequential rather than simultaneous.',
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
        'It also takes a batch. Choose a folder of pictures, pick the output format once, and every one of them is converted here in turn — each with its own download, and all of them as one ZIP.',
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
  'favicon-generator': {
    what: {
      heading: 'What Favicon Generator does',
      paragraphs: [
        'Favicon Generator turns one picture into the set of icons a website needs: a favicon.ico for browsers that still ask for one, PNGs at 16 and 32 pixels for the tab, a 180 pixel Apple touch icon for a phone home screen, and 192 and 512 pixel icons for a web app manifest. They arrive as one ZIP, with the HTML that points at them.',
        'Every icon is drawn from the same square of your picture, in this browser, at the size it will really be — and the previews are those drawings rather than one big icon scaled down, because a 16 pixel icon is only honestly judged at 16 pixels.',
      ],
    },
    when: {
      heading: 'When a site needs its icon',
      paragraphs: [
        'When you have a logo and a site that is still showing the browser’s blank page symbol in its tab. It is a five-minute job that most people put off for months, largely because the advice about it is a page of conflicting file names.',
        'It is also worth redoing when a logo changes. The file names here are the conventional ones, so a new set drops over the old one and the markup does not change.',
      ],
    },
    options: {
      heading: 'What you get, and what to do with it',
      paragraphs: [
        'Six files and two snippets. The snippets are generated from the same list the archive is written from, so a file mentioned in one is a file in the other.',
      ],
      details: [
        {
          term: 'favicon.ico',
          description:
            'The old container, holding 16, 32 and 48 pixel versions. It is written with PNGs inside it rather than bitmaps, which every browser and operating system in use has read since Windows Vista and which keeps it a few kilobytes instead of tens. Put it at the root of the site; some browsers ask for /favicon.ico without being told to.',
        },
        {
          term: 'The PNGs',
          description:
            '16 and 32 for the tab, 180 for an iPhone home screen, and 192 and 512 for a web app manifest and the splash screens built from it. Five files, all conventional names, no set of thirty for devices that stopped existing.',
        },
        {
          term: 'A picture that is not square',
          description:
            'You choose: fill the square and crop the edges, or fit the whole picture and put a background behind it. There is no third option where the picture is squashed, because a squashed logo is never what anybody wanted.',
        },
        {
          term: 'The snippets',
          description:
            'Four link tags for the head of the page, and the icons fragment for a web app manifest. The paths are root-relative because that is where these files nearly always go.',
        },
      ],
    },
    privacy: {
      heading: 'The picture never leaves this device',
      paragraphs: [
        'Your logo is decoded, drawn six times and packed into an archive in this browser. It is not uploaded, and there is no server behind this page to upload it to.',
        'Most favicon generators are upload forms. A logo is usually not secret — but it is also not something that needs to be sent to a stranger’s server to be resized six times by code that could just as easily run here.',
      ],
    },
    faq: [
      {
        question: 'Where do the files go?',
        answer:
          'At the root of your site, next to index.html, and the snippet in the head of every page. Some browsers request /favicon.ico directly without being told to, which is why the ICO belongs at the root rather than in an assets folder.',
      },
      {
        question: 'How big should my source picture be?',
        answer:
          'At least 512 pixels square, so the largest icon is drawn from real pixels rather than invented ones. Anything smaller still works and the Gizlet says so before you make the set, because a 512 pixel icon drawn from a 64 pixel logo looks exactly like that.',
      },
      {
        question: 'What if my logo is not square?',
        answer:
          'Choose whether to fill the square and crop the edges, or fit the whole picture on a background colour. Both are shown in the previews before you commit, at the sizes the icons will really be.',
      },
      {
        question: 'Do I still need a .ico file?',
        answer:
          'For most sites, yes but barely. Current browsers all use the PNGs when the markup points at them; the ICO is for the ones that ask for /favicon.ico regardless, and for the times something requests it without reading your HTML at all. It is a few kilobytes.',
      },
      {
        question: 'Is my logo uploaded?',
        answer:
          'No. It is read from your device, drawn here, and packed into an archive that goes straight to your downloads. There is no upload endpoint behind this page.',
      },
      {
        question: 'Why not more sizes?',
        answer:
          'Because every extra file is weight in somebody’s repository forever, and most of the sizes the older generators produce are for devices and browsers nobody runs any more. These six cover current browsers, iPhones, Android home screens and web app manifests.',
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
  'pdf-page-numbers': {
    what: {
      heading: 'What PDF Page Numbers does',
      paragraphs: [
        'PDF Page Numbers writes numbers onto the pages of a document that arrived without them. Choose the format, where on the page they sit, how big they are and how far in from the edge, then which pages get one and what the first number is.',
        'The pages are drawn onto rather than rebuilt, so everything already on them is untouched and nothing is re-encoded. The preview shows the number over the page it will be written onto, placed by the same function that writes it, so what you are looking at is where it lands.',
      ],
    },
    when: {
      heading: 'When a document needs numbering',
      paragraphs: [
        'When it is going to be printed and read on paper, where a dropped page is otherwise unrecoverable; when it is going to be discussed by page — a contract, a submission, a report someone will cite; or when it was assembled from several documents and the numbering it had no longer means anything.',
        'It is the step after Merge PDF and Organize PDF, which is why it exists as its own Gizlet: the numbering has to happen once the pages are in their final order, not before.',
      ],
    },
    options: {
      heading: 'What each numbering control does',
      paragraphs: ['Seven settings, and the three about counting are the ones with rules worth knowing.'],
      details: [
        {
          term: 'Format',
          description:
            'A bare number, "Page 3", "3 of 12", or "Page 3 of 12". The two that name a total work it out rather than taking one from you, because a typed total is a total that can be wrong.',
        },
        {
          term: 'Position, size and margin',
          description:
            'Six places, all of them edges — a page number in the middle of the page is not a page number. The margin is the gap from the edge in points, which is what a printer means by a margin; 36 points is half an inch. A page carrying its own rotation is corrected for, so a sideways page gets its number where you can read it.',
        },
        {
          term: 'Start at',
          description:
            'The number printed on the first numbered page. Everything after it counts up by one. Useful when a document is one part of something longer and its first page is really page 47.',
        },
        {
          term: 'Skip the first',
          description:
            'Pages at the front that get no number at all: a cover, a title page, a contents page. They are left exactly as they were, and the numbering starts after them.',
        },
        {
          term: 'Pages',
          description:
            'A range, such as 2-9, narrowing which pages are numbered. Skipping and the range compose: the skipped pages go first, the range narrows what is left, and the numbering then counts across whatever survived.',
        },
      ],
    },
    privacy: {
      heading: 'Written here, on your device',
      paragraphs: [
        'The document is read, the numbers are drawn onto its pages, and the new file is written entirely by this browser. Gizlet is a static site with no upload endpoint, so there is nowhere for a document to be sent, and nothing is kept once the tab closes.',
        'The documents that need numbering are the ones being submitted, signed or filed, which is exactly the category that should not be uploaded to a stranger to have a number put in the corner.',
        'Your original file is not modified: the numbered document is a new file handed to your downloads, and the one on your device is the one that was there before.',
      ],
    },
    faq: [
      {
        question: 'Is my PDF uploaded to number it?',
        answer:
          'No. It is read and written by this browser, and the numbered copy goes straight to your downloads. There is no upload endpoint behind this page.',
      },
      {
        question: 'How do I leave the cover page unnumbered?',
        answer:
          'Set "Skip the first" to 1. The cover is left exactly as it was and the numbering starts on the next page — which, with "Start at" on 1, is page 1.',
      },
      {
        question: 'What does the total in "3 of 12" count?',
        answer:
          'The numbers actually printed, not the document’s page count. If two pages at the front are unnumbered, the last printed number is 10, and the numbers say "of 10" — a reader counting the numbered pages gets the same answer.',
      },
      {
        question: 'Can I start numbering at something other than 1?',
        answer:
          'Yes. "Start at" is the number on the first numbered page, and everything after it counts up. A chapter that begins at 47 numbers 47, 48, 49 and so on.',
      },
      {
        question: 'Does numbering change the rest of the document?',
        answer:
          'No. The numbers are drawn onto the existing pages, so text stays selectable, images are not re-encoded, and nothing is rebuilt. Only the numbers are added.',
      },
      {
        question: 'Can it number a password-protected PDF?',
        answer:
          'No. A protected document cannot be read without its password, and this Gizlet does not ask for one. Open it in an application that can, save an unlocked copy, and number that.',
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
  'uuid-generator': {
    what: {
      heading: 'What UUID Generator does',
      paragraphs: [
        'It makes UUIDs, in every version a browser can honestly produce, and reads one back to tell you what it is. Pick a version, pick how it should be written, say how many you want, and they are generated here — from your browser’s cryptographic randomness, never from Math.random.',
        'A GUID is not a different thing from a UUID; it is the same 128 bits with Microsoft’s punctuation. So the braces and the capital letters are a choice about how the value is written, alongside canonical form, no hyphens at all, and a URN.',
      ],
    },
    when: {
      heading: 'When you need a name nothing else has',
      paragraphs: [
        'When a row needs a primary key before the database has seen it. When two systems have to agree on an identifier without asking each other. When a file, a request or an upload needs a name that will not collide with the last one. Version 4 covers nearly all of it, and version 7 is the one to reach for when the identifier is going into an index.',
        'The other half is reading. A UUID in a log, a filename or a database is a small artefact with facts inside it: which version it is, when it was made if it carries a time, and — for a version 1 — whether the machine that made it signed its own network address into it. Paste one in and it will say.',
      ],
    },
    options: {
      heading: 'Which version, and what each one tells the world',
      paragraphs: [
        'The versions are not variations on a theme. They differ in what goes into the 128 bits, which means they differ in what someone holding one can work out.',
      ],
      details: [
        {
          term: 'Version 4 — random',
          description:
            'One hundred and twenty-two bits of randomness and six bits saying which version it is. It reveals nothing, because there is nothing in it but randomness. Unless you have a reason to want something else, this is the one.',
        },
        {
          term: 'Version 7 — time-ordered',
          description:
            'Milliseconds since 1970 in the first six bytes, then a counter, then randomness. Two of them sort into the order they were made, which is why it has become the recommended choice for a database key: the index grows at one end instead of taking a random write every insert. The cost is that the creation time is in plain sight, by design.',
        },
        {
          term: 'Why a batch of version 7s still sorts',
          description:
            'A millisecond is a long time, and forty of these generated at once would share every ordered bit and differ only in randomness — so a batch would come out shuffled, which is the case that actually happens when something inserts a lot of rows. The twelve bits after the timestamp are therefore the monotonic counter RFC 9562 provides for it, advancing within a millisecond and reseeded when the millisecond turns. Ask for a thousand here and they are in order, not merely near it.',
        },
        {
          term: 'Versions 1 and 6 — a clock and a node',
          description:
            'The 1997 design: a timestamp counting hundred-nanosecond intervals since 1582, a clock sequence, and a node. Version 6 is the same fields rearranged so the value sorts by time. Generate these when something old expects them.',
        },
        {
          term: 'Why a version 1 from here cannot identify your machine',
          description:
            'A version 1 was meant to carry the network card’s MAC address, which is why one found in a document can point at the computer that made it. A browser cannot read a MAC address at all, so the node here is random with its multicast bit set — the flag that means "not a real address". Read one of these back and it will tell you so. It is also how you can tell, of a version 1 you were given, whether somebody’s machine is written into it.',
        },
        {
          term: 'Versions 3 and 5 — derived from a name',
          description:
            'Not random at all: the digest of a namespace and a name, so the same name always produces the same UUID, on any implementation. Version 5 uses SHA-1 and is the one to use; version 3 uses MD5 and exists so you can reproduce identifiers a system already made that way. Ask for ten and you get ten copies of one value, because that is what these versions are.',
        },
        {
          term: 'Nil and Max',
          description:
            'All zeroes and all ones. The Nil is a defined way of saying "no UUID"; the Max was added by RFC 9562 as its opposite. Both are mostly useful for finding out whether something checks its input.',
        },
        {
          term: 'How many at once',
          description:
            'Up to 1,000 in one run, copied together or downloaded one per line. It is text, so the limit is about the size of a sensible page rather than about memory.',
        },
      ],
    },
    privacy: {
      heading: 'Nothing is uploaded, and nothing about your machine goes in',
      paragraphs: [
        'The identifiers are made in this browser and nothing is sent anywhere — there is nowhere to send it, because this page has no endpoint behind it. The name you type for a version 3 or 5 is never uploaded either.',
        'It is worth being precise about the second half of that, because one UUID version was designed to embed hardware identity. There is no MAC address in anything this page produces: a browser cannot read one, so the node field is random and flagged as random. Nothing here is stored between visits, including the clock sequence, which is generated fresh each time rather than remembered.',
      ],
    },
    faq: [
      {
        question: 'Which version should I use?',
        answer:
          'Version 4 unless you have a reason. Version 7 if the identifier is going into a database index, because it sorts by creation time and keeps the index tidy. Version 5 if you want the same input to always give the same UUID.',
      },
      {
        question: 'Is a GUID the same as a UUID?',
        answer:
          'Yes. It is the same 128 bits; GUID is Microsoft’s name for it. What differs is how it tends to be written — in braces and capitals — and that is offered here as a style. There is a genuine difference in how the bytes are ordered in Microsoft’s binary format, but it never shows in the text form.',
      },
      {
        question: 'Why can’t it make a version 2?',
        answer:
          'Because it cannot make one honestly. Version 2, DCE Security, replaces part of the timestamp with a POSIX user or group id and part of the clock sequence with a local domain — and a browser has no POSIX identity. Producing one would mean inventing the very field that gives it meaning. It is also absent from RFC 9562, and survives only in the DCE 1.1 specification.',
      },
      {
        question: 'What about version 8?',
        answer:
          'Version 8 is deliberately free-form: whatever bits its creator wants, with the version and variant marked. There is nothing for a generator to decide, so there is nothing here to generate.',
      },
      {
        question: 'Are these random enough to use as secrets?',
        answer:
          'The randomness is your browser’s cryptographic generator, so a version 4 is unguessable in practice. But an identifier is not a secret: it usually ends up in URLs, logs and error reports. Use one to name a thing, and use a real token to authorise access to it.',
      },
      {
        question: 'Does the same UUID ever come out twice?',
        answer:
          'For a version 4, not in any practical sense — 122 random bits is enough that collisions are a theoretical exercise. For versions 3 and 5, the same namespace and name always give the same answer, which is the whole purpose rather than a fault.',
      },
      {
        question: 'Can it tell me when a UUID was made?',
        answer:
          'For versions 1, 6 and 7, yes — the time is in the value, and pasting it into the reader will show it. Versions 3, 4 and 5 contain no time at all, so nothing can be said about when they were created.',
      },
    ],
  },
  'base64-encode-decode': {
    what: {
      heading: 'What Base64 Encode & Decode does',
      paragraphs: [
        'It turns text or a small file into Base64, and turns Base64 back into whatever it was. Both alphabets are here — the standard one with + and /, and the URL-safe one with - and _ — along with the choices that usually go unmentioned: whether to write the = padding, whether to break lines at 76 characters as email does, and whether to wrap the result as a data: URI.',
        'Decoding needs no settings at all. It works out which alphabet it is looking at, ignores whitespace and line breaks, understands a data: URI prefix, and copes with missing padding. If the bytes turn out not to be text — a picture, an archive — it says so and offers them as a file, because that is what they are.',
      ],
    },
    when: {
      heading: 'When bytes have to travel as text',
      paragraphs: [
        'When an image has to go inline in a stylesheet or an email as a data: URI. When an API wants a file in a JSON field. When a config file, a certificate or a key has arrived as a wall of letters and you need to see what is in it. When a JWT needs its middle section read — that is URL-safe Base64 without padding, which is exactly the combination most tools get wrong.',
        'It is also the quickest way to find out why something will not decode elsewhere. Paste it here and the page names the character that is wrong and where it is, rather than telling you the input is invalid and leaving you to find it.',
      ],
    },
    options: {
      heading: 'The choices, and the one thing this is not',
      paragraphs: [
        'Base64 is a way of writing bytes down using 64 characters that survive being emailed. What follows is the small set of decisions that make two Base64 strings of the same bytes look different.',
      ],
      details: [
        {
          term: 'It is not encryption',
          description:
            'This is the important one. Base64 hides nothing: anyone can read it back, and this page reads it back. If something arrived Base64-encoded and looked scrambled, it was not protected — it was just written in a different alphabet. Never use it to keep a secret.',
        },
        {
          term: 'Standard or URL-safe',
          description:
            'The two alphabets differ in their last two characters: + and / in the standard one, - and _ in the URL-safe one. The standard alphabet breaks when put in a URL or a filename, because / is a path separator and + often means a space. Everything else about the two is identical, and the same bytes come back either way.',
        },
        {
          term: 'Padding',
          description:
            'The = characters at the end bring the length to a multiple of four. They carry no data — a decoder can work out the length without them — so URL-safe Base64 is usually written without any. This page reads both and lets you write either.',
        },
        {
          term: 'Line breaks',
          description:
            'Email wraps Base64 at 76 characters, which is why a certificate or a key looks like a paragraph. Wrapping changes nothing about the bytes and decoding ignores it, so it is an option here rather than a fact.',
        },
        {
          term: 'A data: URI',
          description:
            'A data: URI is Base64 with its media type written on the front, which is how an image goes inline in a stylesheet or an email. Encoding a file can produce one, using the type your browser reported; decoding one reads the type back and names the download after it.',
        },
        {
          term: 'When decoding goes wrong',
          description:
            'The page names the character and its position: a character outside the alphabet, an = with something after it, padding on data that has been truncated, or a length no encoder could have produced. It also notices a last character whose unused bits are not zero — QQ== and QR== decode to the same single byte, but only the first is the canonical spelling — and mentions it rather than refusing, because the bytes are not in doubt.',
        },
        {
          term: 'Size',
          description:
            'Up to 512 KB in for a file, which comes out as about 700,000 characters. Base64 is a third larger than the bytes it describes, and the result has to be held in the page and made selectable, so the limit is about what a browser can lay out rather than about the format.',
        },
      ],
    },
    privacy: {
      heading: 'The file is read here, not uploaded',
      paragraphs: [
        'The text and the file are converted in this browser. Nothing is sent anywhere, because there is nowhere to send it: this page has no endpoint behind it, and no request is made when you type or choose a file.',
        'That is worth stating plainly for this one, because the things people Base64-encode are keys, certificates, tokens and attachments — and a site that offered to encode them while quietly keeping a copy would be an excellent way to collect exactly the wrong sort of file. Your file is never uploaded, and nothing is stored between visits.',
      ],
    },
    faq: [
      {
        question: 'Is Base64 a way of encrypting something?',
        answer:
          'No, and this is the most common misunderstanding about it. It is a way of writing bytes down in 64 characters so they survive systems that only handle text. Anyone can decode it — this page decodes it in one paste — so it protects nothing at all.',
      },
      {
        question: 'Is my file uploaded?',
        answer:
          'No. It is read from your device and encoded here. Nothing is sent anywhere, including the filename.',
      },
      {
        question: 'Why does my Base64 have no = at the end?',
        answer:
          'Because whoever produced it left the padding off, which is normal for URL-safe Base64 and for JWTs. The padding carries no information, so this page reads it either way and lets you write it either way.',
      },
      {
        question: 'Which alphabet should I use?',
        answer:
          'Standard unless the result is going into a URL, a filename or a JWT, in which case URL-safe. The difference is only the last two characters of the alphabet, and the bytes are identical.',
      },
      {
        question: 'It decoded but the result is gibberish. What happened?',
        answer:
          'The bytes are probably not text — a PNG or a zip decoded as text looks like nonsense. When the bytes are not valid UTF-8 the page says so and offers them as a file instead, which is the honest answer rather than a screenful of replacement characters.',
      },
      {
        question: 'Can it handle emoji and other languages?',
        answer:
          'Yes. Text is encoded as its UTF-8 bytes, which is why this does not use the browser’s own btoa — that function refuses any character above 255, so an é or an emoji would fail outright.',
      },
      {
        question: 'How large a file can it take?',
        answer:
          '512 KB, which becomes roughly 700,000 characters of Base64. Past that the page would be trying to lay out several megabytes of text, which is slow rather than useful; an oversized file is refused with an explanation.',
      },
    ],
  },
  'jwt-decoder': {
    what: {
      heading: 'What JWT Decoder does',
      paragraphs: [
        'It splits a JSON Web Token into its three parts, reads the header and the payload back out of Base64URL, and shows you the JSON that was in them. Every registered claim gets a line saying what it is for — iss, aud, nbf and azp are not guessable, and looking each one up in the specification is the work this page is meant to save.',
        'Dates are the reason most people open a token inspector, so they are given twice: the raw number of seconds the token wrote, and the same moment in UTC with how far away it is. The token’s own expiry window is read against your clock and reported as it stands.',
        'What it does not do is check anything. Decoding a token and verifying one are different jobs, and this page only does the first — it says so at the top, where it cannot be missed.',
      ],
    },
    when: {
      heading: 'When a token has to be looked at',
      paragraphs: [
        'When a request is being refused and you need to know whether the token expired, who it was issued to, or which audience it names. When a login is behaving oddly and the claims are the only evidence. When you are writing the thing that issues tokens and want to see what you actually produced.',
        'It is also the quickest way to find out why a token will not decode elsewhere: the error names which of the three segments is at fault rather than calling the whole token invalid, and a header that reads is still shown when the payload is the broken part.',
      ],
    },
    options: {
      heading: 'What is shown, and what is deliberately not',
      paragraphs: [
        'There are no settings. A token is one input with one reading, so the page has controls for pasting and clearing and nothing else. What is worth explaining is the parts, and the one thing this page will not tell you.',
      ],
      details: [
        {
          term: 'It does not verify',
          description:
            'This is the important one. The signature proves who wrote the header and the payload, and testing that proof needs the issuer’s key: a shared secret you would have to type in, or a public key this page would have to fetch from the issuer. Neither belongs on a page that sends nothing anywhere. So the signature is shown and measured, never checked — and a token that decodes cleanly here can still be forged, expired, revoked, or meant for somebody else entirely.',
        },
        {
          term: 'The header',
          description:
            'The small print about the token itself: alg says what signed it, kid says which of the issuer’s keys, typ says what kind of token it is. Treat alg as a claim rather than a fact — an attacker can write whatever they like there, which is why a receiver decides the algorithm instead of believing the token.',
        },
        {
          term: 'The payload',
          description:
            'The claims. Registered ones — from RFC 7519 and OpenID Connect — get a line each explaining what they are for. Everything else in a token belongs to whoever issued it, so those fields are shown in the JSON and left unexplained rather than given an invented meaning.',
        },
        {
          term: 'The dates',
          description:
            'exp, nbf, iat and auth_time are counted in seconds since 1970, and each is shown both as that number and as a UTC moment with the gap to now. A date written in milliseconds — the commonest mistake in a hand-rolled token, because that is what Date.now() gives — is called out rather than displayed as the year 57000.',
        },
        {
          term: 'The signature',
          description:
            'Shown as it arrived, with its length in bytes. An empty one means the token says it is unsigned, which is worth knowing: anyone can write one of those and change anything in it.',
        },
        {
          term: 'What it says about a broken token',
          description:
            'The failure names the segment. An encrypted token — a JWE, which has five parts rather than three — is identified as one rather than being blamed on its Base64. A token with two parts is reported as truncated or unsigned. A segment that is not Base64URL, or is not JSON, or is JSON but a list rather than an object, each say so. Padding and the wrong alphabet are mentioned without refusing the token, because the answer matters more than the complaint.',
        },
        {
          term: 'What it accepts',
          description:
            'Paste the token with whatever it was copied out of still attached: an Authorization header name, a Bearer prefix, quotes from a line of JSON, line breaks from a log. All of that is ignored, and the page says what it ignored rather than silently rewriting your input.',
        },
      ],
    },
    privacy: {
      heading: 'A token is a credential, so it stays in this browser',
      paragraphs: [
        'The token is decoded in this page, by this browser. Nothing is sent anywhere, because there is nowhere to send it: this page has no endpoint behind it, no request is made while you type, and no issuer is contacted even when the header says where its keys are published.',
        'That matters more here than on most pages. A JWT is usually a live credential — whoever holds it can act as you until it expires — so a token inspector that quietly kept a copy would be an extremely efficient way to collect other people’s sessions. Your token is never uploaded, nothing is stored between visits, and the only way it leaves this device is if you copy it out yourself.',
      ],
    },
    faq: [
      {
        question: 'Does this check whether the token is genuine?',
        answer:
          'No. It reads what the token says about itself and nothing more. Verifying a token means checking the signature against the issuer’s key, and then checking the issuer, the audience and the expiry — this page does none of that, and a token that decodes here perfectly may still be forged.',
      },
      {
        question: 'Is my token uploaded anywhere?',
        answer:
          'No. It is decoded in your browser and never sent anywhere, which is the only responsible way to handle something that is usually a live credential.',
      },
      {
        question: 'Is a JWT encrypted?',
        answer:
          'A normal one is not. The header and the payload are Base64URL, which anyone can read — this page reads them in one paste. The signature stops them being changed without detection; it does not stop them being read, so never put anything secret in a token. Encrypted tokens do exist, as JWE, and they have five parts rather than three; there is nothing to read in one without the key.',
      },
      {
        question: 'What is the difference between HS256 and RS256?',
        answer:
          'HS256 signs with a secret both sides share, so anyone who can check the token can also make one. RS256 signs with the issuer’s private key and is checked with the matching public key, so only the issuer could have produced it. The names look interchangeable and the difference decides who can forge a token.',
      },
      {
        question: 'Why does it say my token expired when it still works?',
        answer:
          'Because the page reads the exp claim against your device’s clock, and nothing else. Whether a token is accepted is up to whoever receives it: some allow a little clock skew, some ignore expiry on a token they have already cached, and a wrong clock on your machine will make a current token look expired here.',
      },
      {
        question: 'Why is the expiry in the year 57000?',
        answer:
          'Because the token wrote milliseconds where the specification says seconds — Date.now() rather than Date.now() / 1000. The page spots numbers far too large to be seconds, says so, and shows what the date would be if divided by a thousand rather than pretending the token is good for fifty thousand years.',
      },
      {
        question: 'My token will not decode. How do I find out why?',
        answer:
          'Paste it and read the error: it names which of the three segments is at fault and what is wrong with it, down to the character where the Base64URL stopped making sense. A token that has been through something that re-encoded it — picking up = padding, or + and / from the standard Base64 alphabet — is decoded anyway, with a note saying a strict library will refuse it.',
      },
    ],
  },
  'file-hash-generator': {
    what: {
      heading: 'What File Hash Generator does',
      paragraphs: [
        'It reads a file on this device and gives you its digest five ways at once: SHA-256, SHA-512, SHA-384, SHA-1 and MD5. Every one is copyable, and you do not have to know in advance which one the person on the other end is going to ask for.',
        'It also does the other half of the job, which is the half people actually have. Paste the checksum you were given into the expected-hash box and the answer comes back as a word — match, or no match — rather than as two rows of hexadecimal for you to compare with your finger on the screen.',
        'There is no algorithm to choose. A published checksum is a run of hexadecimal, and its length says which digest wrote it: 32 characters is MD5, 40 is SHA-1, 64 is SHA-256, 96 is SHA-384, 128 is SHA-512. Paste a whole sha256sum line with the file name still attached and that is read too.',
      ],
    },
    when: {
      heading: 'When a checksum answers something and when it does not',
      paragraphs: [
        'Reach for it when a download came with a checksum and you want to know whether the file arrived intact: an installer, a disc image, a release archive, a database dump somebody sent you. A mismatch on a large download is usually a truncated or corrupted transfer, and finding that out now is cheaper than finding it out halfway through an install.',
        'It also answers a duller question well: whether two files are the same file. Hash one, hash the other, compare the SHA-256 by eye — the same digest means the same bytes, whatever the two files are called or where they came from.',
        'What a checksum cannot settle is trust. If the hash and the file came from the same page, they were replaced by the same person, and a match tells you only that they are consistent with each other. A checksum is worth something when the hash reached you by a route the file did not: a signed release note, a package manifest, a message from whoever built it.',
      ],
    },
    options: {
      heading: 'The two inputs, and the five answers',
      paragraphs: [
        'One file, one optional hash, and nothing to configure. What is worth explaining is what the digests are for and which of them still mean anything.',
      ],
      details: [
        {
          term: 'The file',
          description:
            'Any file at all, up to 512 MB, chosen or dropped. The ceiling is about the browser rather than about hashing: the digest the browser provides takes the whole file at once rather than a piece at a time, so a file has to fit in this tab to be hashed in it. A disc image larger than that wants a command line, and shasum or certutil is the right tool for it.',
        },
        {
          term: 'The expected hash',
          description:
            'Optional, and the reason this is one page rather than two. Paste it however you copied it — bare, as a sha256sum line with the file name after it, or in the tagged form BSD tools and certutil write — and it is read out of that. Capitals are the same hash. A whole SHA256SUMS file is refused with a note to paste the single line you want, because guessing which of forty lines you meant would be worse than asking.',
        },
        {
          term: 'The verdict',
          description:
            'One word, against the digest your pasted hash names, with both hex strings underneath it as the evidence. A no match does not guess at the cause: a damaged download, a different version, a different build and a file somebody swapped all look identical to a hash, and the page says which four it could be rather than picking one.',
        },
        {
          term: 'SHA-256, SHA-512 and SHA-384',
          description:
            'The three worth relying on, and the browser computes all of them. SHA-256 is what nearly every project publishes; SHA-512 is the same family with a longer digest and is no weaker; SHA-384 is SHA-512 cut short and is here mostly so a 96-character hash somebody hands you can be checked rather than only named.',
        },
        {
          term: 'SHA-1 and MD5, labelled broken',
          description:
            'Both are broken for authenticity — a second file with the same digest can be produced deliberately, which is exactly the attack a checksum is supposed to catch — and both are computed anyway, because a great many release pages still publish one of them and refusing to read yours would not make it more secure. They are marked on the page rather than quietly offered. Use them to notice a damaged transfer, never to prove nobody meddled.',
        },
        {
          term: 'Why MD5 stops at 128 MB',
          description:
            'Because the browser refuses to provide it. crypto.subtle rejects MD5 outright, which is the correct decision for a browser API, so the MD5 here is written out in this project — the same one the UUID versions need — and it runs in JavaScript on the page’s own thread with a padded copy of the file beside it. Above 128 MB the four SHA digests still appear and the MD5 row says why it is empty, which is better than a tab that stops responding.',
        },
      ],
    },
    privacy: {
      heading: 'A hash is computed here, so the file has nowhere to go',
      paragraphs: [
        'The file is read and hashed by this browser, on this device, and never uploaded. This is one of the pages where that is the whole point rather than a nicety: the files people check are installers, disc images, backups and dumps, and a checksum service that wanted the file would be asking for a copy of everything you were about to install.',
        'Nothing is stored between visits, and no request is made while the page works. The hash you paste stays here too — it is compared in the page, against a digest computed in the page.',
      ],
    },
    faq: [
      {
        question: 'Which hash should I use?',
        answer:
          'SHA-256, unless you are checking against a hash somebody already published in another form. It is what nearly every project publishes and there is no practical reason to prefer anything else. If the checksum you were given is MD5 or SHA-1, use that one to compare — the page computes it — and treat the answer as a check on the transfer rather than as proof of authenticity.',
      },
      {
        question: 'The hash matches. Is the file safe?',
        answer:
          'It means the file is the file that hash was made from, and nothing more. It says nothing about whether the file is safe, and nothing about where the hash came from: if you copied the hash off the same page as the download, whoever could replace the file could replace the hash beside it, and a match is exactly what they would want you to see. A checksum is worth something when it reached you by a different route than the file did.',
      },
      {
        question: 'The hash does not match. What went wrong?',
        answer:
          'One of four things, and the hash cannot tell you which. The download was damaged or cut short, which is the usual answer for a large file. You have a different version or a different build than the one the checksum was published for, which is the next most common. You are checking the wrong file. Or the file was replaced. Download it again first: if the second copy matches, it was the transfer.',
      },
      {
        question: 'Do I have to say which algorithm my hash is?',
        answer:
          'No, and there is no dropdown to do it with. The length of a hash says which digest wrote it, so pasting it is enough — 32 characters is MD5, 40 is SHA-1, 64 is SHA-256, 96 is SHA-384 and 128 is SHA-512. A hash that is a character or two short of one of those lengths was truncated in the copying, and the page says so rather than comparing it against nothing.',
      },
      {
        question: 'Is my file uploaded to check it?',
        answer:
          'No. It is read and hashed in your browser, on this device, and never sent anywhere. That matters here more than on most pages, because the files worth checking are the large ones you were about to run.',
      },
      {
        question: 'Why is MD5 still here if it is broken?',
        answer:
          'Because release pages still publish it, and a page that refused to compute the digest you were handed would be no safer — you would simply do it elsewhere. So it is computed, labelled as broken where you cannot miss it, and explained: MD5 collisions take seconds on a laptop, so a match proves the bytes were not damaged and proves nothing about whether they were tampered with.',
      },
      {
        question: 'Can it hash a 4 GB disc image?',
        answer:
          'Not here. The browser’s digest takes the whole file in one piece rather than streaming it, so the file has to fit in this tab, and the ceiling on this page is 512 MB. For anything bigger use shasum -a 256 on macOS or Linux, sha256sum where that is installed, or certutil -hashfile on Windows.',
      },
    ],
  },
  'json-csv-converter': {
    what: {
      heading: 'What JSON and CSV Converter does',
      paragraphs: [
        'It turns an array of flat JSON objects into a table, and a table back into an array of flat JSON objects. Both boxes are live: paste into either one and the other format appears underneath as you type, with the number of rows and columns, ready to copy or download as a file.',
        'The keys become the columns. Their order is the order they first appear reading the JSON top to bottom, so the same records always write the same file — and a key only some records carry still gets a column, with an empty cell where it was absent.',
        'The quoting is the part that is easy to get wrong and expensive to get wrong. A value holding a comma, a quote or a line break is quoted on the way out and read back as one value on the way in, which is the whole of RFC 4180 and the whole reason a spreadsheet opens the result as a table rather than as confetti.',
      ],
    },
    when: {
      heading: 'When records have to move between a program and a spreadsheet',
      paragraphs: [
        'When an API gave you a list of objects and the person who asked for it wanted something they could open in Excel. When somebody sent you a spreadsheet export and the thing you are writing takes JSON. When you are seeding test data and it is quicker to type rows than braces.',
        'It is also a quick way to see the shape of a response: a table makes a missing field obvious in a way a wall of JSON does not, because the gap is a blank cell in a column with a name at the top.',
      ],
    },
    options: {
      heading: 'The separator, the cell reading, and the things it will not guess',
      paragraphs: [
        'Two controls, and a short list of refusals. Both controls exist because the file does not say, and every refusal is a place where doing something helpful would quietly change your data.',
      ],
      details: [
        {
          term: 'The column separator',
          description:
            'Comma, semicolon, tab or pipe, chosen rather than sniffed. A semicolon is what a spreadsheet writes in a locale where the comma is already the decimal point, which is most of Europe, and it is the usual reason a file opens in Excel as one tall column. Tab is TSV, and what you get pasting a range out of a spreadsheet. If a table comes out one column wide and the header contains one of the others, the page says which one to try.',
        },
        {
          term: 'What a cell becomes',
          description:
            'A CSV carries no types at all, so every cell is text until somebody decides otherwise. Text is the default and loses nothing: 00713 stays 00713. Read as values instead and a cell that is exactly a JSON number, or true, false or null, becomes one — which is what a round trip needs, and what turns a product code into a smaller number if you are not paying attention.',
        },
        {
          term: 'A number it will not shorten',
          description:
            'Even when cells are read as values, a number is only taken when writing it back gives the same characters. A twenty-digit identifier and 1e3 are both legal JSON numbers and neither survives a trip through a browser number unchanged, so both stay text. A converter that silently rounds an account number is worse than one that hands it back as a string.',
        },
        {
          term: 'Nested JSON, refused by name',
          description:
            'An object or an array inside a record is refused, and the message names the record and the key. Flattening means inventing names for the columns it becomes — dot paths, bracket indexes, something — and every convention is somebody else’s wrong one. Flatten it the way your system expects, or take the part that is already a table.',
        },
        {
          term: 'A row that does not match the header',
          description:
            'A row with fewer fields than the header is filled in with empty text and the line is named, because nothing was lost. A row with more is refused and nothing is converted, because something would be: there is no column for the extra values, and dropping them is how a converter loses a field without anybody noticing. It usually means a separator inside a value that was never quoted.',
        },
        {
          term: 'What an empty cell means',
          description:
            'A null is written as an empty cell, which is what a spreadsheet has instead of one, and an empty cell reads back as an empty string. That is the one value a round trip does not return, and the page says so rather than letting you discover it later. A missing key is an empty cell too, so every row comes out the same width.',
        },
      ],
    },
    privacy: {
      heading: 'The records never leave the tab',
      paragraphs: [
        'The conversion is done by this page, in this browser. Gizlet is a static site with no upload endpoint, so what you paste is not sent anywhere and there is nothing to keep after you close the tab. The downloaded file is written here too, out of the text already on screen.',
        'That is worth more here than on most pages. Records moving between JSON and CSV are usually somebody’s customers, orders or exports, and the ordinary way to convert them is to paste them into a website that receives them.',
      ],
    },
    faq: [
      {
        question: 'Why is my whole CSV coming out as one column?',
        answer:
          'The separator above is not the one your file uses. A spreadsheet saved in most of Europe writes semicolons, because the comma is already the decimal point there. Pick the separator the file actually uses and the columns appear — and when the header contains one of the others, the page names it for you.',
      },
      {
        question: 'Will it flatten nested JSON into columns?',
        answer:
          'No, deliberately. A cell holds one value, so nesting has to become several columns, and naming them means picking a convention — address.city, address[0], something else — that your system may not read back. It refuses instead, and names the record and the key, so you can flatten it the way the thing at the other end expects.',
      },
      {
        question: 'Do numbers stay numbers when I convert a CSV to JSON?',
        answer:
          'Only if you ask. The default makes every cell a string, because a CSV has no types and interpreting them is how a leading zero disappears. Switch the reading to values and a cell that is exactly a JSON number, or true, false or null, becomes one — while anything a browser cannot hold exactly, like a twenty-digit identifier, still stays text.',
      },
      {
        question: 'Does a value with a comma or a line break in it survive?',
        answer:
          'Yes, in both directions. Writing a table quotes any value holding the separator, a double quote, or a line break, and doubles the quotes inside it; reading one takes all of that back apart. That is RFC 4180, and it is why the result opens in a spreadsheet as the table you meant.',
      },
      {
        question: 'Can I convert a table and get exactly the same table back?',
        answer:
          'Yes, with one exception the page warns about. Text records survive JSON to CSV and back unchanged, and numbers and booleans do too when the cells are read as values. The exception is null: a spreadsheet has no null, so it is written as an empty cell, and an empty cell comes back as an empty string.',
      },
      {
        question: 'Are my records uploaded anywhere?',
        answer:
          'No. The conversion happens in this page on your own device, nothing is sent while you type, and the file you download is written by the browser out of what is already on screen. There is no upload endpoint on this site to send it to.',
      },
    ],
  },
  'csv-viewer': {
    what: {
      heading: 'What CSV Viewer does',
      paragraphs: [
        'It opens a delimited file and shows you what is in it: a table with the header row along the top, one row per record, and the line of the file each row starts on down the side. Drop the file in or paste the text — either way it is read here, by this browser, and drawn as a table underneath.',
        'It works out which separator the document uses rather than asking you first, and then says which one it chose and why. That is a control, not a verdict: pick another and the table is redrawn with it, which is the answer for the file where the guess is wrong.',
        'Underneath the table is the same document written back out tidily — every value quoted on one rule, every row the same width, every line ending the way the standard says. That is the copy you hand to whatever refused the original.',
      ],
    },
    when: {
      heading: 'When a spreadsheet is the wrong way to look at a file',
      paragraphs: [
        'When something rejected a CSV and you need to see what is actually in it. When an export looks fine in a spreadsheet because the spreadsheet quietly fixed it, and the program reading it next will not. When a file is too big to open comfortably, or you only want to know its shape.',
        'It is also the quickest way to settle an argument about a delimiter. A file that opens in Excel as one tall column is almost always a semicolon export, and seeing it as four columns here says so in a second.',
        'What it will not do is edit cells. This shows you a document and hands it back tidied; changing what a value says is a spreadsheet’s job, and the Gizlet next door turns the same records into JSON and back.',
      ],
    },
    options: {
      heading: 'The separator, the header row, and how much is drawn',
      paragraphs: [
        'Two controls, one bound, and a description of what tidying actually changes. Both controls are things the file itself does not record, which is why they are questions rather than assumptions.',
      ],
      details: [
        {
          term: 'The separator, detected and reversible',
          description:
            'Comma, semicolon, tab and pipe are each tried against the document, and the reading that the most rows agree about wins. The page then says which one it read the file with and how many columns that gave, because a guess you cannot see is a guess you cannot correct. Choosing one yourself replaces the detection until another file arrives.',
        },
        {
          term: 'Whether the first row is a header',
          description:
            'A CSV has no way of saying whether its first line names the columns or is simply the first record, so it is a switch. On, the first row becomes the headings. Off, every row is data and the columns are numbered — which is what an export from a database dump usually needs, and it means no row is quietly swallowed by the heading.',
        },
        {
          term: 'A row that does not fit its header',
          description:
            'Both kinds are shown rather than refused, and both are marked in the table and named by line. A row that stops short has empty cells at the end. A row with a field too many makes the table wider than its headings, and the extra values sit in columns with no name — usually because a separator inside a value was never quoted.',
        },
        {
          term: 'What tidying changes',
          description:
            'A value is quoted when, and only when, it holds the separator, a double quote or a line break, with its own quotes doubled. Every row is written to the same width. Every line ends CRLF, which is what RFC 4180 names and what a spreadsheet on Windows still expects. Nothing else is touched: no value is trimmed, renamed, reordered or reinterpreted.',
        },
        {
          term: 'How much of a big document is drawn',
          description:
            'The file is read whole and the table stops at 200 rows and 50 columns, saying how much of the document that is. Drawing a hundred thousand rows of cells is how a tab stops responding, and the tidied CSV underneath is the whole file either way. A document over 8 MB is refused rather than half-read.',
        },
      ],
    },
    privacy: {
      heading: 'The file is opened by the page, not by a server',
      paragraphs: [
        'Your document stays on this device. It is read, parsed and drawn by this browser, and the tidied copy you download is written by this page out of the text already on screen. Gizlet is a static site with no upload endpoint, so there is nowhere for a spreadsheet to be sent and nothing kept once the tab closes.',
        'A CSV is usually the most sensitive file somebody owns without thinking of it that way: a customer list, an order export, a payroll run, a download of somebody’s own account data. The ordinary way to look at one online is to hand it to a site that receives it, which is the habit this page exists to make unnecessary.',
      ],
    },
    faq: [
      {
        question: 'Why does my file open as a single tall column?',
        answer:
          'Because it was read with the wrong separator, and the page will usually tell you which one to try. A spreadsheet saved in most of Europe writes semicolons, since the comma is already the decimal point there. Choose that separator and the columns appear.',
      },
      {
        question: 'Can I open an .xlsx spreadsheet with this?',
        answer:
          'No, and it says so rather than showing you nonsense. An .xlsx file is a ZIP archive of XML rather than a delimited document, so nothing here can read it: in Excel, use Save As and choose CSV, then open that.',
      },
      {
        question: 'What does the tidied CSV actually change?',
        answer:
          'Quoting, width and line endings, and nothing else. Values that need quotes get them and values that do not lose them, short rows are padded so every row has the same number of fields, and every line ends CRLF. No value is edited, reordered or reinterpreted on the way through.',
      },
      {
        question: 'Why does the table stop before the end of my file?',
        answer:
          'Because a table of a hundred thousand rows is how a browser tab becomes unusable. The whole document is read and the table draws the first 200 rows and 50 columns of it, saying how much that is — and the tidied CSV below the table is still the entire file, to copy or download.',
      },
      {
        question: 'Does a row with one field too many get thrown away?',
        answer:
          'Nothing is thrown away here. The table simply becomes wider than its headings, the extra value sits in a column with no name, and the row is marked and named by its line number so you can go and look at it. That is the difference between a viewer and a converter, which has no column to put it in.',
      },
      {
        question: 'Is the file uploaded so it can be read?',
        answer:
          'No. Choosing or dropping a file hands it to this page, which reads it in the tab and draws the table there; nothing is sent anywhere, and no copy is kept after you close it. There is no upload endpoint on this site for a document to go to.',
      },
    ],
  },
  'timestamp-converter': {
    what: {
      heading: 'What Timestamp Converter does',
      paragraphs: [
        'It turns a Unix timestamp into a date you can read, and a date you can read back into a Unix timestamp. Both boxes are live: type in either one and its answers appear underneath as you go, in UTC and on your own clock, with the weekday and how long ago it was.',
        'Every form of the answer is there to be copied — ISO 8601, seconds, milliseconds — because the reason for looking one up is almost always that it has to go somewhere else.',
        'The one thing it will not do is decide what your number counts. Seconds and milliseconds look identical, so the unit is a control you set, and if the size of the number disagrees with it you are told what the other unit would say instead of having your input quietly reinterpreted.',
      ],
    },
    when: {
      heading: 'When a number in a log needs a meaning',
      paragraphs: [
        'When a log line, a database row, a JSON field or an API response has a bare number in it and you need to know when that was. When you are writing the thing that produces the number and want to check you produced the moment you meant. When a token or a cache entry expired and the expiry is written as an integer.',
        'It is also the quickest way to settle the seconds-or-milliseconds argument: paste the number, look at both readings, and the one that lands in this century is the unit the system was using.',
      ],
    },
    options: {
      heading: 'The two controls, and why neither is optional',
      paragraphs: [
        'Both exist because the input is genuinely ambiguous without them, and a converter that picks for you is confidently wrong for somebody.',
      ],
      details: [
        {
          term: 'What the number counts',
          description:
            'Seconds is Unix time proper and what almost everything meaning “timestamp” means — 10 digits for a moment in this century, from date +%s or a database integer. Milliseconds is what JavaScript and the JVM count in — 13 digits — from Date.now() or System.currentTimeMillis(). The same ten digits are a moment in 2026 read as seconds and a moment three weeks into 1970 read as milliseconds, and nothing in the digits themselves settles which was meant.',
        },
        {
          term: 'When the size disagrees with the unit',
          description:
            'You are told, and nothing changes. A 13-digit number read as seconds lands past the year 57000, so the page says so, says what it would be as milliseconds, and leaves your setting alone for you to switch if that is what you meant. The reading shown is always the reading you asked for, however unlikely it looks — a converter that overrules you is a converter you cannot use to check a suspicion.',
        },
        {
          term: 'Which clock a date was read off',
          description:
            'A written date is not a moment until somebody says which clock it came from: 2026-09-07 14:30 is two different instants in London and in Bucharest. So the second box asks — UTC, or this device, whose offset is shown on the control itself. It only matters when the text is silent.',
        },
        {
          term: 'An offset in the text wins',
          description:
            'Write a Z or a +02:00 or a -0500 on the end and that is used instead of the control, and the page says which offset it used. Somebody who typed an offset has already answered the question, and a setting cannot know better than the text.',
        },
        {
          term: 'What counts as a date here',
          description:
            'A date on its own, a date and a time separated by a space or a T, with optional seconds and an optional decimal fraction, and an optional offset. Nothing is handed to the browser’s own date parser, because what that accepts differs between browsers — 2026-9-7 is local time in one engine and rejected in another — and an answer that changes with the browser is worse than a refusal.',
        },
        {
          term: 'What it refuses, and by name',
          description:
            'An impossible date is named rather than nudged into a real one. There is no month 13; February 2026 has 28 days, so there is no 30th; a day runs 00 to 23; and 23:59:60 is a leap second, which is real and which no calendar here can hold. A date that rolls silently into the next month is how a bug gets past a test.',
        },
      ],
    },
    privacy: {
      heading: 'Your device’s clock, and no other',
      paragraphs: [
        'The conversion happens in this page, in this browser, and what you type is never sent anywhere. No time server is contacted either — the local readings come from your own device’s clock and offset, which is also why a wrong clock here will produce a wrong “how long ago”.',
        'Nothing is stored between visits. The number you paste is not logged, which matters more than it sounds: timestamps usually arrive attached to a log line from a system you would rather not describe to a stranger.',
      ],
    },
    faq: [
      {
        question: 'Is my timestamp in seconds or milliseconds?',
        answer:
          'Count the digits. A moment in this century is 10 digits in seconds and 13 in milliseconds. If you are unsure, paste it and switch the unit: the reading that lands in a plausible year is the one the system meant, and the page will tell you when the size looks wrong for the unit you chose.',
      },
      {
        question: 'Why does it not just work out the unit for me?',
        answer:
          'Because it cannot, and pretending otherwise breaks the case you most need it for. A number can be a valid moment in both units — 1749900000 is June 2025 in seconds and January 1970 in milliseconds — so any automatic choice is a guess. Guessing is fine until you are trying to confirm that some other system used the wrong unit, which is exactly when a helpful converter would hide the bug.',
      },
      {
        question: 'What timezone are the answers in?',
        answer:
          'Both. Every moment is shown in UTC and as your own device shows it, with the device’s offset named on the row, so you never have to work out which one you are looking at. UTC is the one to paste into anything that will be read elsewhere.',
      },
      {
        question: 'Can it convert a date before 1970?',
        answer:
          'Yes. A negative timestamp counts backwards from the epoch, and it is read the same way in both directions — the moon landing is -14182940 seconds. The limit at either end is the year 275760, which is as far as a date reaches in a browser.',
      },
      {
        question: 'What about a specific timezone like America/New_York?',
        answer:
          'Not here. This page offers UTC and your device’s own clock, and accepts a fixed offset written into the text. A named zone brings daylight-saving rules and their history with it, which is a different and much larger job than converting a number, and getting it half right would be worse than not offering it.',
      },
      {
        question: 'Is my timestamp sent anywhere?',
        answer:
          'No. The conversion is arithmetic your browser does on this device, and it is never sent anywhere — no request is made while you type, and no time server is asked what the time is.',
      },
    ],
  },
  'url-encode-decode': {
    what: {
      heading: 'What URL Encode & Decode does',
      paragraphs: [
        'It turns text into the percent-encoded form a URL can carry, and turns that form back into text. Type in one box and the answer appears in the other as you go; swap them round to check that a round trip gives you back what you started with.',
        'There is no such thing as one URL encoding, so this asks which one you want: a value going inside a URL, a whole address that is already assembled, or a form field. They disagree about characters people actually type, and picking one silently is how an ampersand ends up splitting a query string in half.',
      ],
    },
    when: {
      heading: 'When a character means something it should not',
      paragraphs: [
        'When a link works for you and not for anyone else. When a search term with a space or a slash in it breaks the URL it was put into. When something arrived as %E2%80%99 and you need to know what it says. When an API wants a value escaped and you would rather see the result than trust it.',
        'It is also the quickest way to find out which of the three encodings a system is using: encode the same string three ways and compare it with what that system produced.',
      ],
    },
    options: {
      heading: 'The three encodings, and what they disagree about',
      paragraphs: [
        'All three escape a character by writing a per-cent sign and the hexadecimal of its bytes in UTF-8. What separates them is the list of characters they consider safe to leave alone.',
      ],
      details: [
        {
          term: 'One piece of a URL',
          description:
            'For a value going inside a URL: a query parameter, a path segment, a fragment. Everything with a structural job — & = / ? # : and the rest — is escaped, so an ampersand in your text stays part of your text rather than starting the next parameter. This is what you want most of the time.',
        },
        {
          term: 'A whole URL',
          description:
            'For an address that is already assembled. The characters that hold a URL together are left alone, because here they are doing their job, and only what would break the address — a space, an angle bracket, a curly brace — is escaped. Use it on a complete link, never on a value going into one.',
        },
        {
          term: 'A form field',
          description:
            'What a browser sends when a form is submitted, and what a query string usually holds in practice. A space becomes a plus rather than %20, and a few more characters are escaped than strictly need to be. Decoding this way is the only case where a plus is read back as a space.',
        },
        {
          term: 'Why the plus matters',
          description:
            'A plus means a space in a form field and means a plus everywhere else. A tool that turned every plus into a space would quietly corrupt every base64 string it was given, so this one only does it where a plus really is a space.',
        },
        {
          term: 'When decoding goes wrong',
          description:
            'The browser’s own decoder throws the same error for every kind of broken input and never says where. This one walks the text and tells you the character position and what is wrong: an escape cut off by the end of the text, a per-cent sign followed by something that is not hexadecimal, or bytes that are perfectly legal escapes and still not a character in UTF-8.',
        },
      ],
    },
    privacy: {
      heading: 'The text does not go anywhere',
      paragraphs: [
        'The conversion is a function running in this browser, on the text in the box. Nothing is sent anywhere, because there is nowhere to send it: this page has no endpoint behind it, no request is made when you type, and what you paste is never uploaded.',
        'That is worth saying for this one. The things people percent-encode are query strings, tokens, callback URLs and identifiers — the contents of a URL that was already sensitive enough to be worth checking twice.',
      ],
    },
    faq: [
      {
        question: 'Is my text sent anywhere?',
        answer:
          'No. It is converted in this browser as you type. Nothing leaves the page, and nothing is stored.',
      },
      {
        question: 'Which of the three should I pick?',
        answer:
          'If you are putting a value into a URL, pick one piece of a URL. If you already have a complete address and want to make it safe to use, pick a whole URL. If you are matching what an HTML form sends, or reading a query string somebody else produced, pick a form field.',
      },
      {
        question: 'Why did my plus sign become a space?',
        answer:
          'Because the form field mode was selected, and in that encoding a plus is how a space is written. Switch to one piece of a URL and a plus stays a plus. An escaped plus, %2B, is read back as a plus in every mode.',
      },
      {
        question: 'What does “not a character in UTF-8” mean?',
        answer:
          'The escapes were well formed but the bytes behind them do not spell a character. Usually the text was encoded twice, or it was encoded from a different character set — a Latin-1 é, for instance, is a single byte that UTF-8 does not accept on its own.',
      },
      {
        question: 'Does it handle emoji and other languages?',
        answer:
          'Yes. A character outside ASCII is written as the bytes of its UTF-8, which is several escapes for one character, and read back the same way. The count under the result says characters rather than escapes, because that is what you are looking at.',
      },
      {
        question: 'Can I check that encoding and decoding agree?',
        answer:
          'That is what Swap is for. It puts the result into the input box and turns the direction round, so what comes back should be exactly what you started with.',
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
  'watermark-pdf': {
    what: {
      heading: 'What Watermark PDF does',
      paragraphs: [
        'Watermark PDF draws a mark onto the pages of a document: a word like DRAFT or CONFIDENTIAL, or a picture from your device such as a logo. You place it on the page you are looking at — position, size, turn and strength — and the preview shows it exactly where it will land before anything is written.',
        'The mark is drawn onto the pages rather than the pages being rebuilt, so everything already on them is untouched: the text stays selectable, the fonts stay embedded, and nothing is re-encoded. Name the pages you want it on, or leave the field empty and it goes on all of them.',
      ],
    },
    when: {
      heading: 'When a mark on the page is the point',
      paragraphs: [
        'When a document is going somewhere before it is final, and everyone who opens it should know that without being told: a draft contract, a quote that has not been approved, a sample of a report, a copy of something whose original lives elsewhere. A word across the page says it on every screen it is opened on and every desk it is printed onto.',
        'A picture mark is the other half of this: a logo in a corner, on every page, on a document assembled from pieces that did not have one. Build the document with Merge PDF or Image to PDF first, and stamp the result.',
      ],
    },
    options: {
      heading: 'What the watermark controls do',
      paragraphs: [
        'The preview over the page is drawn from the same placement the document is written with, so what you see is where it goes.',
      ],
      details: [
        {
          term: 'Mark',
          description:
            'Text, or a picture from your device. Text is drawn in the document itself, so it stays crisp at any zoom and on any printer. A picture is embedded as the file you chose — a PNG with transparency stays transparent, which is usually what a logo wants.',
        },
        {
          term: 'Size and width',
          description:
            'Text is sized in points, the same unit the document itself uses, so 64pt here is 64pt there. A picture is sized as a share of the page width instead, because a percentage of the page is the thing anyone actually means when they place a logo, and it lands the same way on a portrait page and a landscape one.',
        },
        {
          term: 'Position and turn',
          description:
            'Nine places rather than a pair of coordinates: a mark goes onto every page at once, and only a named position means the same thing on pages of different shapes and orientations. The turn runs anticlockwise in whole degrees, and a page carrying its own rotation is corrected for — a mark placed in the corner of a sideways page lands in that corner, not off the edge.',
        },
        {
          term: 'Strength',
          description:
            'How solid the mark is, from 5% to 100%. A watermark meant to be read through wants to be faint; one meant to be read wants not to be. It applies to a picture as much as to text.',
        },
        {
          term: 'Pages',
          description:
            'Empty means every page. Otherwise name them the way you would say them: 1-3, 5. A page past the end of the document, or a range that runs backwards, is refused rather than guessed at, and the page you are looking at says whether it is in the selection.',
        },
      ],
    },
    privacy: {
      heading: 'The mark is drawn here',
      paragraphs: [
        'Reading the PDF, drawing the pages, and writing the marked document all happen in this browser. The picture you stamp is read from your device and embedded here; it is never uploaded, and there is no library of watermark images on a server somewhere, because there is no server.',
        'The documents that get watermarked are drafts, quotes and contracts — things that are marked precisely because they are not finished and not public. Handing one to a website to have a word drawn on it is the opposite of what the word is for.',
      ],
    },
    faq: [
      {
        question: 'Is the PDF uploaded to watermark it?',
        answer:
          'No. The document and the picture are both read on this device, the mark is drawn here, and the result is handed straight to your downloads. There is no upload endpoint behind this page.',
      },
      {
        question: 'Does a watermark stop anyone copying the document?',
        answer:
          'No, and nothing here will claim it does. A visible watermark marks a document — it says what the document is to anyone who opens it. It is not protection: it can be cropped, covered, or removed by software made for that, and the text under it is still ordinary selectable text. If a document must not be reusable, a watermark is the wrong tool.',
      },
      {
        question: 'Can I put my logo on every page?',
        answer:
          'Yes. Choose A picture, pick a PNG or JPEG from your device, set its width as a share of the page and put it where you want it. A transparent PNG keeps its transparency.',
      },
      {
        question: 'Can I watermark only some of the pages?',
        answer:
          'Yes. Name them in Pages, like 1-3, 5. Leaving the field empty marks every page, and the note under the preview tells you whether the page on screen is one of the ones being marked.',
      },
      {
        question: 'Will the text under the watermark still be selectable?',
        answer:
          'Yes. The mark is drawn on top of the page rather than the page being flattened into a picture, so everything that was selectable before still is. That is also why the file barely grows.',
      },
      {
        question: 'Why can a shared flow only stamp certain words?',
        answer:
          'A Gizlet Flow can be shared as a link, and a link never carries anything you typed — every setting in that format is a whole number or one of a closed list of names. So a flow block stamps DRAFT, CONFIDENTIAL, COPY, SAMPLE or VOID, and this page takes any text you like.',
      },
      {
        question: 'Can it watermark a password-protected PDF?',
        answer:
          'No. A protected document cannot be read without its password, and this Gizlet does not ask for one. Open it in an application that can, save an unlocked copy, and watermark that instead.',
      },
    ],
  },
  'sign-pdf': {
    what: {
      heading: 'What Sign PDF does',
      paragraphs: [
        'Sign PDF puts a signature onto a page of a document. Draw it with a mouse, a trackpad or a finger, type your name, or choose a picture of a signature you already have. Then drag it to the line it belongs on, size it against the page, and save a new PDF with it drawn there.',
        'The signature is drawn onto the page rather than the page being rebuilt, so everything already on the document is untouched: the text stays selectable, the fonts stay embedded, and nothing is re-encoded. What lands in the document is what the page on screen showed, because both come from the same placement.',
      ],
    },
    when: {
      heading: 'When a signature on the page is all that is needed',
      paragraphs: [
        'Most documents that need signing need exactly this: a delivery note, a school form, a rental inventory, a letter that has to look signed rather than prove who signed it. The page comes as a PDF, it goes back as a PDF, and printing it, signing it and scanning it again is three steps and a worse copy of the same page.',
        'This is not the tool for a contract whose signature has to be verifiable. A visible signature is a picture on a page: anyone can copy it off one document and put it onto another. If what you need is proof of who signed and that nothing changed afterwards, that is certificate-based signing, and it needs a certificate and software that holds one.',
      ],
    },
    options: {
      heading: 'What the signature controls do',
      paragraphs: [
        'The signature over the page is placed by the same function the document is written with, so where it sits on screen is where it lands.',
      ],
      details: [
        {
          term: 'Draw it',
          description:
            'A box to sign in with whatever you are pointing with. A trackpad gives a rougher line than a finger on a phone, and both are usually enough. The drawing is cropped to the ink before it is placed, so the signature is your signature rather than your signature in the middle of an empty box.',
        },
        {
          term: 'Type it',
          description:
            'Your name in an italic serif face, drawn into the document as text rather than as a picture, so it stays crisp at any zoom and on any printer. It looks like a typed name, because that is what it is.',
        },
        {
          term: 'Use a picture',
          description:
            'A PNG, JPEG or WebP from your device — a signature you signed on paper and photographed, usually. A transparent PNG stays transparent, which is what you want over a printed line.',
        },
        {
          term: 'Placement and size',
          description:
            'Drag the signature where it belongs, or move it with the arrow keys and resize it with plus and minus. It is placed as a share of the page rather than in points, so the same placement means the same thing on A4 and on US Letter, and a page that carries its own rotation is corrected for.',
        },
        {
          term: 'Pages',
          description:
            'Empty signs the page you are looking at, which is the usual case. Otherwise name them the way you would say them: 1-3, 5. The note under the page tells you whether the page on screen is one of the ones being signed.',
        },
      ],
    },
    privacy: {
      heading: 'Your signature never leaves this device',
      paragraphs: [
        'Reading the PDF, drawing the pages, and writing the signed document all happen in this browser. The signature you draw is a drawing in this page and nothing else: it is not saved, not stored between visits, and not sent anywhere, because there is nowhere to send it.',
        'A signature is worth stealing in a way a holiday photo is not. A site that keeps a library of your signatures for next time keeps a library of them for everyone else too, which is why this one does not offer that and could not do it if it wanted to.',
      ],
    },
    faq: [
      {
        question: 'Is this a legally binding signature?',
        answer:
          'This places a visible signature onto a page. It is not certificate-based or cryptographic signing, and nothing here verifies who drew it. Whether a picture of a signature is enough is a question about the document and where you are, not about this Gizlet, and it is not one this page can answer for you.',
      },
      {
        question: 'Does it use a digital certificate?',
        answer:
          'No. There is no certificate, no key, no timestamp and no identity check. A document signed here carries a drawing, not a cryptographic signature, and a reader that checks signatures will report that it has none.',
      },
      {
        question: 'Is my signature uploaded or stored?',
        answer:
          'No. The drawing, the typed name and any picture you choose are all read and used in this browser, and they are gone when you leave the page. There is no account, no signature library and no upload endpoint behind this page.',
      },
      {
        question: 'Can I sign more than one page?',
        answer:
          'Yes. Name the pages, like 1-3, 5, and the same signature is drawn in the same place on each of them. Leaving the field empty signs the page you are looking at.',
      },
      {
        question: 'Will the text under the signature still be selectable?',
        answer:
          'Yes. The signature is drawn on top of the page rather than the page being flattened into a picture, so everything that was selectable before still is. That is also why the file barely grows.',
      },
      {
        question: 'Can it sign a password-protected PDF?',
        answer:
          'No. A protected document cannot be read without its password, and this Gizlet does not ask for one. Open it in an application that can, save an unlocked copy, and sign that instead.',
      },
    ],
  },
  'clean-pdf-metadata': {
    what: {
      heading: 'What Clean PDF Metadata does',
      paragraphs: [
        'Every PDF carries a set of fields about itself: a title, an author, a subject, keywords, the program it was written in, the program that turned it into a PDF, and when both of those happened. Most of it is filled in without anybody being asked. This Gizlet lists what your document is carrying, in plain words, and then writes a copy with those fields cleared.',
        'The pages are not touched. Clearing the fields is a change to the document’s own record of itself, not to what is printed on it, so the page count, the text, the fonts and the layout come out exactly as they went in — and the copy is read back with the same reader that read the original, so what the result panel says about it is measured rather than claimed.',
      ],
    },
    when: {
      heading: 'When the fields say more than the document does',
      paragraphs: [
        'A CV keeps the name of whoever’s template it started from. A quote exported from a work laptop keeps the software licensed to the company. A scan keeps the model of the scanner and the hour it was fed through it. A document written on a Sunday says so. None of it is on the page, and all of it travels with the file to everyone you send it to.',
        'It is worth doing before a document goes somewhere it cannot be taken back from: a job application, a tender, a landlord, a forum, a public filing. It is also worth doing after a document has been through other tools, this site’s included — a PDF that has been merged or stamped usually carries the name of the library that did it.',
      ],
    },
    options: {
      heading: 'What is listed, and what is cleared',
      paragraphs: [
        'There is nothing to configure: the fields are the document’s own, and clearing them takes no settings. What there is to do is look at the list first.',
      ],
      details: [
        {
          term: 'Who it belongs to',
          description:
            'The Author field. This is the one worth looking at first, because it is the one that carries a person’s name out of an office and into a file somebody else opens.',
        },
        {
          term: 'What it says it is',
          description:
            'Title, Subject and Keywords. A title is often the filename of the draft it began as, which is how a document called "Offer — final v3 (do not send)" ends up in a reader’s window title.',
        },
        {
          term: 'When it was made',
          description:
            'Created and Modified, shown as the document recorded them — with the time zone it recorded them in, rather than shifted into yours. When a document was written, and where in the world the clock was, is a fact about the document.',
        },
        {
          term: 'What made it',
          description:
            'The program the document was written in and the one that turned it into a PDF, often with version numbers. It says what you run, and sometimes what your employer licenses.',
        },
        {
          term: 'Everything else',
          description:
            'A writer may put anything it likes in there — a company name, a licence string, an internal document number. Those are counted rather than named, because inventing a label for a field this Gizlet does not recognise would be guessing. They are cleared with the rest.',
        },
        {
          term: 'The XMP packet',
          description:
            'Most documents record the same information a second time in an XMP packet, and a cleaner that clears one and leaves the other has not cleaned anything. If the document carries one, it is dropped.',
        },
      ],
    },
    privacy: {
      heading: 'It never leaves this device to be read',
      paragraphs: [
        'The document is read, listed and rewritten in this browser. That matters more here than almost anywhere else on this site: the fields being cleaned are the ones that identify a person, and uploading a file to have its author’s name removed hands that name to whoever is running the upload.',
        'It is also why the list is shown before anything is cleared, rather than a button that promises a clean file. You can see what your document was carrying, and decide.',
      ],
    },
    faq: [
      {
        question: 'Does this remove text hidden on the page?',
        answer:
          'No, and this is the important limit. It clears the document’s own fields. Text under a black rectangle, an attachment, a comment, or a name written in the document itself are all still there — a rectangle drawn over a paragraph hides it from your eyes and from nobody else. Redaction is a different job and this Gizlet does not claim to do it.',
      },
      {
        question: 'Are the pages changed at all?',
        answer:
          'No. The pages are left exactly as they are: the same count, the same text, the same fonts, the same layout. Only the document’s information dictionary and its XMP packet are cleared, and the result panel reads the copy back to say what it carries.',
      },
      {
        question: 'What if my PDF has no metadata to clear?',
        answer:
          'It says so, and offers you nothing to press. A document with an empty information dictionary and no XMP packet is already clean, and a button that produced an identical file would only be theatre.',
      },
      {
        question: 'Is the PDF uploaded to read its fields?',
        answer:
          'No. Reading the fields, drawing the pages and writing the cleaned copy all happen on this device. There is no upload endpoint behind this page.',
      },
      {
        question: 'Will the cleaned copy say it was made by Gizlet?',
        answer:
          'No. Most PDF libraries stamp their own name into the Producer field as they write, and one that did that here would be undoing its own work. The document is loaded and saved with that behaviour switched off, and you can see the result in the read-back line under the download.',
      },
      {
        question: 'Can it clean a password-protected PDF?',
        answer:
          'No. A protected document cannot be read without its password, and this Gizlet does not ask for one. Open it in an application that can, save an unlocked copy, and clean that instead.',
      },
    ],
  },
  'create-zip': {
    what: {
      heading: 'What Create ZIP does',
      paragraphs: [
        'Create ZIP puts a pile of files into one archive. Choose them, drop them, or pick a whole folder; reorder them or take any of them out; then build a standard .zip that any operating system opens by double-clicking it.',
        'The whole thing happens in this browser. The archive is assembled here from the bytes of your files, and it is handed straight to your downloads — which is the difference between this and the sites that ask you to upload the files you were trying to bundle up in the first place.',
      ],
    },
    when: {
      heading: 'When one file is easier than forty',
      paragraphs: [
        'When something will only take one attachment and you have a folder. When a form wants a single upload. When you are sending somebody a set of photographs and forty separate downloads is unkind. When you want to put something away as one thing rather than as a directory that will be half-deleted in a year.',
        'It is also the natural end of a job that made a lot of files: pages pulled out of a document with Split PDF, a batch of compressed photographs, an export that came out as pieces. Make them, then bundle them.',
      ],
    },
    options: {
      heading: 'What happens to your files',
      paragraphs: [
        'There is nothing to configure. What there is to know is what the archive does with names, folders and sizes.',
      ],
      details: [
        {
          term: 'Folders',
          description:
            'Choosing a folder keeps its structure: the archive holds the same folders, and unpacking it gives you the same tree back. Files chosen individually or dropped sit at the top of the archive, because that is where the browser says they are.',
        },
        {
          term: 'Two files with one name',
          description:
            'They both go in. The second is numbered — notes.txt and notes-2.txt — rather than one silently overwriting the other, which is what an archive with the same entry twice actually does when it is unpacked. The list says when it has had to do this.',
        },
        {
          term: 'Order',
          description:
            'Move a file up or down, or take it out. Order is not something most archive readers care about, but it is what the list you are looking at reads like, and a Gizlet that showed you one order and wrote another would be lying about something small for no reason.',
        },
        {
          term: 'Compression',
          description:
            'Each file is deflated using the browser’s own compressor, which is the standard method every ZIP reader understands. A file that comes out larger compressed — a JPEG, a PNG, an MP4, anything already compressed — is stored as it is instead, because a bigger archive is not a better one. On a browser with no compressor everything is stored, and the archive still opens everywhere.',
        },
        {
          term: 'Limits',
          description:
            'Up to 500 files and 512 MB in one archive. The archive is built in memory before it is handed to you, so this is a limit on what one tab can hold at once rather than on what the format can address — and it is refused with an explanation rather than by freezing.',
        },
      ],
    },
    privacy: {
      heading: 'Nothing is uploaded to be bundled',
      paragraphs: [
        'The files are read, compressed and assembled in this browser. Not one byte and not one filename is sent anywhere, because there is nowhere to send it: this page has no upload endpoint behind it.',
        'That matters for this Gizlet more than for most. A pile of files being bundled to send somewhere is usually a pile of files that belongs to somebody — tax documents, a client’s photographs, a folder off a work laptop — and handing all of it to a website to be zipped is a strange way to protect it.',
      ],
    },
    faq: [
      {
        question: 'Are my files uploaded?',
        answer:
          'No. They are read from your device, packed here, and the archive goes straight to your downloads. Nothing is sent anywhere, including the filenames.',
      },
      {
        question: 'Can I zip a whole folder?',
        answer:
          'Yes. Choose a folder and the archive keeps its structure, so unpacking it gives you the same tree back. Some browsers do not offer folder selection at all; in those, choose the files and they go in at the top level.',
      },
      {
        question: 'Will the archive be smaller than the files?',
        answer:
          'It depends entirely on what is in it. Text, documents and code compress well. Photographs, videos, PDFs and anything else already compressed do not, and those are stored as they are rather than made slightly larger. The result panel says which of the two happened.',
      },
      {
        question: 'What if two files have the same name?',
        answer:
          'Both are kept and the second is numbered. An archive holding the same path twice is one that loses a file when it is unpacked, so the Gizlet renames rather than dropping, and tells you it did.',
      },
      {
        question: 'Will the ZIP open on Windows and macOS?',
        answer:
          'Yes. It is an ordinary ZIP with standard stored and deflated entries — the two methods every archive tool has understood for thirty years — so Explorer, Finder, unzip and everything else open it normally.',
      },
      {
        question: 'Can I password-protect the archive?',
        answer:
          'No. Encrypted ZIPs are deliberately not built here: the format’s own encryption is weak enough to be worth nothing, and doing it properly would need a design that is not this Gizlet. If a file needs protecting, protect the file.',
      },
    ],
  },
  'extract-archive': {
    what: {
      heading: 'What Extract Archive does',
      paragraphs: [
        'Extract Archive opens a ZIP and shows you what is in it: every file, in its folders, with its size and how it was packed. Tick the ones you want and take them out — one file comes back as itself, several come back as an archive of just those.',
        'It reads the archive in this browser, using the decompressor the browser already has. Nothing about the archive leaves the device: not the files, not the folder structure, and not the list of names, which is often the part that says the most.',
      ],
    },
    when: {
      heading: 'When you only wanted one file out of it',
      paragraphs: [
        'When somebody sent forty photographs and you need the third. When a download came as an archive and you want to see what is inside before you trust it with your file system. When you are on a device whose archive tool is missing, awkward, or somebody else’s — a locked-down work laptop, a borrowed machine, a phone.',
        'It is the reading half of Create ZIP, and the two are deliberately the same machinery pointed in opposite directions: what this one takes apart, that one puts together, and neither of them uploads anything to do it.',
      ],
    },
    options: {
      heading: 'What the list shows you',
      paragraphs: [
        'There is nothing to configure. What there is to read is what the archive says about itself, which this page shows rather than summarises.',
      ],
      details: [
        {
          term: 'The tree',
          description:
            'Folders come from the paths of the files rather than from the archive’s own folder entries, so an archive written without them still shows its shape. Ticking a folder ticks everything under it at any depth, and a folder holding something that cannot come out shows as partly ticked rather than pretending otherwise.',
        },
        {
          term: 'What cannot come out',
          description:
            'An encrypted entry, or one packed with a method no browser has a decompressor for, is listed with the reason on its row and cannot be ticked. That is deliberate: an archive tool that quietly skipped a file would leave you believing you had it.',
        },
        {
          term: 'Paths that escape',
          description:
            'An entry called ../../etc/passwd is the oldest trick in archives, and an unpacker that trusted it would write outside the folder you unpacked into. Nothing here writes to your file system, so it cannot happen — but the path is corrected anyway, and the row shows both, because an archive carrying one is telling you something about itself.',
        },
        {
          term: 'Two files with one name',
          description:
            'Once paths are corrected, two entries can end up wanting the same one. Both are kept and the second is numbered, by the same rule Create ZIP uses, rather than one silently replacing the other inside the download.',
        },
        {
          term: 'Checked on the way out',
          description:
            'Every file is checked against the checksum the archive recorded for it before it is handed over. A file that does not match means a damaged archive, and it is reported as one instead of arriving as something that will not open.',
        },
        {
          term: 'Limits',
          description:
            'Up to 5,000 files and 512 MB, and an entry claiming to unpack to a thousand times its packed size is refused rather than attempted. Archives designed to fill a machine’s memory are a real thing, and the limit is what stops one from doing it to your tab.',
        },
      ],
    },
    privacy: {
      heading: 'The archive is opened here, not somewhere else',
      paragraphs: [
        'The file is read in this browser and unpacked by the browser’s own decompressor. Not one byte is sent anywhere, because there is nowhere to send it: this page has no upload endpoint behind it.',
        'An archive is a particularly bad thing to hand to a website. It is usually somebody’s whole folder — a project, a set of documents, an export — and even the list of names inside it can describe a person’s work, their clients, or their affairs quite completely. That list is read here and stays here.',
      ],
    },
    faq: [
      {
        question: 'Is my archive uploaded?',
        answer:
          'No. It is read from your device, opened here, and what you take out goes straight to your downloads. Nothing is sent anywhere, including the names of the files inside.',
      },
      {
        question: 'Can it open a RAR or a 7z?',
        answer:
          'Not yet. Both need a decoder that is not part of this site, and adding one is a decision about a dependency rather than a small change, so it has not been made quietly. A RAR or a 7z is recognised and named rather than failing vaguely, and the tool that made it will open it.',
      },
      {
        question: 'What about a password-protected archive?',
        answer:
          'Encrypted entries are shown with everything else and marked as encrypted, and that is as far as it goes. This Gizlet does not ask for passwords and does not try to get around them.',
      },
      {
        question: 'Why does it give me a ZIP back when I asked for several files?',
        answer:
          'A browser download is one file, and there is no way to hand a folder to your downloads. One ticked file comes back as itself; several come back as one archive holding exactly those, named after the archive they came out of so it does not overwrite it.',
      },
      {
        question: 'Can I extract just one folder?',
        answer:
          'Yes. Tick the folder and everything under it is ticked, at any depth. Untick anything you do not want, then extract.',
      },
      {
        question: 'It says a file cannot be unpacked. Is the archive broken?',
        answer:
          'Usually not. ZIP allows compression methods beyond the two that every reader supports, and a browser has a decompressor for only the standard one. The row says which method it is, and an archive tool on your device will have it.',
      },
    ],
  },
  'organize-pdf': {
    what: {
      heading: 'What Organize PDF does',
      paragraphs: [
        'Organize PDF lays a document out as its pages and lets you rebuild it. Drag a page somewhere else, turn it a quarter at a time, copy it, drop it, and save the result as a new PDF. Every page is drawn from the document itself, so you are moving the page you can see rather than a number in a list.',
        'The pages are copied rather than redrawn, so what comes out is the same PDF content it went in as: the text stays selectable, the fonts stay embedded, and nothing is re-encoded. Tick a few pages instead and they come out as a document of their own, which is the quick way to pull a form or a signature page out of something longer.',
      ],
    },
    when: {
      heading: 'When to rearrange a document',
      paragraphs: [
        'When a scan came out in the wrong order, when a page came out sideways because the feeder took it that way, when a report needs its appendix moved to the front, or when a document has three pages in it that nobody outside the room should see. All four are the same job — the document is nearly right — and all four are the reason a page has to be visible before it can be moved.',
        'It is the pair to Merge PDF and Split PDF. Merging joins documents end to end and splitting takes runs of pages out; this is the one that changes the order inside a document, and the three of them together are most of what anyone ever does to a PDF that is not writing on it.',
      ],
    },
    options: {
      heading: 'What the page cards do',
      paragraphs: [
        'Every control has a button as well as a drag, because a drag is unavailable to a keyboard and awkward on a phone.',
      ],
      details: [
        {
          term: 'Moving a page',
          description:
            'Drag a page card onto the position you want it in, or use the arrow buttons on the card to move it one place at a time. The number on each card is where that page will be in the new document, and the p.4 beside it is which page of the original it came from — so a document you have rearranged still says what it was made of.',
        },
        {
          term: 'Turning a page',
          description:
            'Quarter turns, left or right, and pressing twice puts a page upside down. A turn is added to the way the page already sat rather than replacing it, so a page that arrived sideways ends up upright after one press instead of going back where it started. The thumbnail turns with it, which is how you know before you save.',
        },
        {
          term: 'Copying and dropping',
          description:
            'A copy lands directly after the page it copies and is a page in its own right from then on: it can be moved and turned without touching the original. Dropping removes a page from the new document only — the file on your device is never changed. The last page cannot be dropped, because a PDF with no pages is not a PDF.',
        },
        {
          term: 'Ticking pages',
          description:
            'A tick puts a page in the set the bulk buttons act on: turn them all, copy them all, drop them all. Extract the ticked pages writes a second document holding only those pages, in the order and orientation you left them in, and leaves the one you are building alone.',
        },
        {
          term: 'Limits',
          description:
            'Documents of up to 500 pages, which is what the PDF Viewer will open, so anything this Gizlet produces can be read in the one next to it. Copying stops at the same ceiling. Past 50 pages the Gizlet says it is working through a long document rather than looking stalled, and a password-protected PDF is refused with an explanation.',
        },
      ],
    },
    privacy: {
      heading: 'The pages are rearranged here',
      paragraphs: [
        'Reading the PDF, drawing every page, copying the pages into their new order and writing the document all happen in this browser. Gizlet is a static site with no upload endpoint, so there is no server that could receive the file, and nothing survives closing the tab.',
        'Dropping a page is the case that matters most. Removing pages from a document is usually what someone does immediately before sending the rest of it on, which means the pages being removed are the ones that should never have left the device — and on a site that uploads first and edits afterwards, they already have.',
      ],
    },
    faq: [
      {
        question: 'Is the PDF uploaded to rearrange it?',
        answer:
          'No. The document is read and the new one is written by this browser, and it is handed straight to your downloads. There is no upload endpoint behind this page.',
      },
      {
        question: 'Does rearranging the pages change the original file?',
        answer:
          'No. The file on your device is never written to. Every page you move, turn or drop changes a plan for a new document, and the new document is created only when you save it.',
      },
      {
        question: 'Can I move a page without dragging it?',
        answer:
          'Yes. Each page card has arrow buttons that move it one place earlier or later, and they work from the keyboard, so the whole document can be reordered without a pointer.',
      },
      {
        question: 'What happens when I copy a page?',
        answer:
          'The copy lands directly after the page it came from and is independent from that moment: turning or moving one does not touch the other. Both hold the same content, copied from the same source page.',
      },
      {
        question: 'How do I pull a few pages out into their own file?',
        answer:
          'Tick them and press Extract the ticked pages. You get a second PDF holding only those pages, in the order they sit in above, and the document you are organizing is left as it was. Naming runs of pages instead is what Split PDF is for.',
      },
      {
        question: 'Does turning a page rotate the text as well?',
        answer:
          'Yes. A turn is recorded on the page itself, the way a PDF records orientation, so every reader shows it the way you left it and the text stays selectable rather than becoming a picture.',
      },
      {
        question: 'Can it organize a password-protected PDF?',
        answer:
          'No. A protected document cannot be read without its password, and this Gizlet does not ask for one. Open it in an application that can, save an unlocked copy, and organize that instead.',
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

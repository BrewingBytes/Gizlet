import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Documents to test the PDF Gizlets against.
 *
 * The readable one is built with the library Image to PDF already ships, so the
 * Gizlets meet a real document rather than a fixture blob. Each page carries a
 * differently sized block of colour, which is what lets a test tell one page
 * from another by looking at the pixels.
 *
 * The broken ones are written by hand, because no library will produce them:
 * pdf-lib cannot encrypt, and its empty document still reports a page. Both are
 * minimal but structurally valid, so pdf.js reaches the failure being tested
 * rather than giving up on the file for some other reason.
 */
export async function samplePdf(pageCount: number): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);

  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([595.28, 841.89]);

    page.drawText(`Page ${index + 1}`, {
      x: 60,
      y: 720,
      size: 36,
      font,
      color: rgb(0.06, 0.09, 0.16),
    });
    page.drawRectangle({
      x: 60,
      y: 560,
      width: 80 + index * 90,
      height: 80,
      color: rgb(0.96, 0.65, 0),
    });
  }

  return Buffer.from(await document.save());
}

/** A PDF assembled around a body, with a cross-reference table that matches. */
function buildPdf(objects: readonly string[], trailerEntries: string): Buffer {
  const offsets: number[] = [];
  let body = "%PDF-1.4\n";

  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (const offset of offsets) {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  body += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R${trailerEntries}>>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(body, "latin1");
}

/**
 * A PDF locked with the standard security handler. The owner and user password
 * hashes are arbitrary bytes, so no password can validate against them and
 * pdf.js reports the file as needing one.
 */
export function encryptedPdf(): Buffer {
  return buildPdf(
    [
      "<</Type/Catalog/Pages 2 0 R>>",
      "<</Type/Pages/Kids[3 0 R]/Count 1>>",
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>",
      `<</Filter/Standard/V 2/R 3/Length 128/P -1/O <${"a1".repeat(32)}>/U <${"b2".repeat(32)}>>>`,
    ],
    `/Encrypt 4 0 R/ID[<${"0".repeat(32)}><${"0".repeat(32)}>]`,
  );
}

/** A readable PDF whose page tree is empty, so it opens and holds nothing. */
export function zeroPagePdf(): Buffer {
  return buildPdf(["<</Type/Catalog/Pages 2 0 R>>", "<</Type/Pages/Kids[]/Count 0>>"], "");
}

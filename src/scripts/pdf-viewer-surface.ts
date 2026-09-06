import {
  describePdfFullscreenState,
  describePdfPagePosition,
  getPdfFullscreenLabel,
  getPdfFullscreenMode,
  isPdfFullscreenExitKey,
  pdfThumbnailWidth,
} from '../data/pdf-viewer';
import { createPdfPageView, type PdfPageView } from './pdf-page-view';
import type { LocalPdfDocument } from './pdf-rendering';

/**
 * Drives one `PdfViewerSurface`: the page view, the thumbnail strip, and
 * fullscreen.
 *
 * The surface is the whole document-reading capability of this site, so this is
 * the only module that knows how a PDF is presented. A Gizlet hands it an open
 * document and gets navigation, zoom and fullscreen; what the document is for
 * stays outside.
 *
 * pdf.js is not imported here, only its type. A Gizlet can therefore build its
 * surface, wire its controls and never load the library until a document is
 * actually opened — which is what keeps a PDF-producing Gizlet's first page
 * load free of a megabyte nobody has asked for yet.
 */

export interface PdfViewerSurfaceOptions {
  /** Runs whenever the shown page changes, for anything outside the surface. */
  readonly onPageChange?: (pageNumber: number, pageCount: number) => void;
}

export interface PdfViewerSurface {
  readonly pageCount: number;
  readonly currentPage: number;
  /** Whether this surface is currently filling the screen, either way. */
  readonly isFullscreen: boolean;
  /**
   * Shows a document from its first page, with an optional line describing it.
   * The surface owns the document from here and closes it on the next `show`
   * or `reset`.
   */
  show(document: LocalPdfDocument, description?: string): Promise<void>;
  goToPage(pageNumber: number): void;
  /** Leaves fullscreen, closes the document and empties the surface. */
  reset(): void;
}

function isFullscreenElement(element: HTMLElement): boolean {
  return document.fullscreenElement === element;
}

export function createPdfViewerSurface(
  root: HTMLElement,
  options: PdfViewerSurfaceOptions = {},
): PdfViewerSurface {
  const pageArea = root.querySelector<HTMLElement>('[data-page-area]');
  const canvas = root.querySelector<HTMLCanvasElement>('[data-page-canvas]');
  const pageError = root.querySelector<HTMLElement>('[data-page-error]');
  const previousButton = root.querySelector<HTMLButtonElement>('[data-previous]');
  const nextButton = root.querySelector<HTMLButtonElement>('[data-next]');
  const pageInput = root.querySelector<HTMLInputElement>('[data-page-input]');
  const pageTotal = root.querySelector<HTMLElement>('[data-page-total]');
  const documentLine = root.querySelector<HTMLElement>('[data-document-name]');
  const fullscreenButton = root.querySelector<HTMLButtonElement>('[data-surface-fullscreen]');
  const announce = root.querySelector<HTMLElement>('[data-surface-announce]');
  const thumbnails = root.querySelector<HTMLElement>('[data-thumbnails]');
  const thumbnailTemplate = root.querySelector<HTMLTemplateElement>('[data-thumbnail-template]');
  const zoomOutButton = root.querySelector<HTMLButtonElement>('[data-zoom-out]');
  const zoomInButton = root.querySelector<HTMLButtonElement>('[data-zoom-in]');
  const zoomLevel = root.querySelector<HTMLOutputElement>('[data-zoom-level]');

  if (!pageArea || !canvas || !pageError || !previousButton || !nextButton || !pageInput || !pageTotal || !documentLine || !fullscreenButton || !announce) {
    throw new Error('A PDF viewer surface is missing its controls.');
  }

  let openDocument: LocalPdfDocument | undefined;
  let pageCount = 0;
  // Thumbnails are drawn one at a time and must survive a visitor turning pages
  // while they arrive, so they are cancelled by the document changing rather
  // than by the page view's own redraws.
  let documentToken = 0;
  let inPageFullscreen = false;

  const pageView: PdfPageView = createPdfPageView({
    pageArea,
    canvas,
    pageError,
    previousButton,
    nextButton,
    pageInput,
    pageTotal,
    zoomOutButton,
    zoomInButton,
    zoomLevel,
    onPageChange: (pageNumber, count) => {
      if (thumbnails) {
        for (const button of thumbnails.querySelectorAll<HTMLButtonElement>('[data-thumbnail]')) {
          button.setAttribute('aria-current', String(Number(button.dataset.page) === pageNumber));
        }
      }

      options.onPageChange?.(pageNumber, count);
    },
  });

  const isFullscreen = () => inPageFullscreen || isFullscreenElement(root);

  /**
   * The page is drawn to fit the space it has, and fullscreen changes that
   * space, so the same page at the same zoom is drawn again at the new size.
   */
  const settle = () => {
    const active = isFullscreen();

    root.dataset.fullscreen = String(inPageFullscreen);
    fullscreenButton.textContent = getPdfFullscreenLabel(active);
    fullscreenButton.setAttribute('aria-pressed', String(active));
    announce.textContent = describePdfFullscreenState(active);
    pageView.redraw();
  };

  const enterFullscreen = async () => {
    if (isFullscreen()) return;

    if (getPdfFullscreenMode(typeof root.requestFullscreen === 'function') === 'native') {
      try {
        await root.requestFullscreen();
        // `fullscreenchange` settles it: the browser may refuse, and the state
        // then has to be what actually happened rather than what was asked for.
        return;
      } catch {
        // A refused request is not a dead control: the fallback still fills the
        // screen, which is what the visitor pressed the button for.
      }
    }

    inPageFullscreen = true;
    settle();
  };

  const leaveFullscreen = async () => {
    if (isFullscreenElement(root)) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }

    if (!inPageFullscreen) return;

    inPageFullscreen = false;
    settle();
    // The control that opened fullscreen is where the visitor left off, and a
    // fixed layer disappearing without moving focus leaves it on nothing.
    fullscreenButton.focus();
  };

  /** Thumbnails are drawn after the first page, so reading starts sooner. */
  const renderThumbnails = async (token: number) => {
    if (!thumbnails || !thumbnailTemplate || !openDocument) return;

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      if (token !== documentToken) return;

      const item = thumbnailTemplate.content.firstElementChild?.cloneNode(true);
      if (!(item instanceof HTMLButtonElement)) return;

      const thumbnailCanvas = item.querySelector<HTMLCanvasElement>('[data-thumbnail-canvas]');
      const number = item.querySelector<HTMLElement>('[data-thumbnail-number]');
      if (!thumbnailCanvas || !number) return;

      item.dataset.page = String(pageNumber);
      item.setAttribute('aria-label', describePdfPagePosition(pageNumber, pageCount));
      item.setAttribute('aria-current', String(pageNumber === pageView.currentPage));
      number.textContent = String(pageNumber);
      thumbnails.append(item);

      try {
        await openDocument.renderPageToWidth(pageNumber, thumbnailCanvas, pdfThumbnailWidth);
      } catch {
        // A thumbnail that will not draw is not worth an error of its own; the
        // page itself reports the problem when the visitor opens it.
        number.textContent = `${pageNumber} ⚠`;
      }
    }
  };

  fullscreenButton.addEventListener('click', () => {
    void (isFullscreen() ? leaveFullscreen() : enterFullscreen());
  });

  // The platform's own exit — Escape, a gesture, the browser's chrome — arrives
  // here rather than through the button, so the state follows the browser.
  document.addEventListener('fullscreenchange', () => {
    if (inPageFullscreen) return;

    settle();
    if (!isFullscreenElement(root) && root.contains(document.activeElement)) fullscreenButton.focus();
  });

  root.addEventListener('keydown', (event) => {
    if (!inPageFullscreen || !isPdfFullscreenExitKey(event.key)) return;

    event.preventDefault();
    void leaveFullscreen();
  });

  thumbnails?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-thumbnail]');

    if (button?.dataset.page) pageView.goToPage(Number(button.dataset.page));
  });

  return {
    get pageCount() {
      return pageView.pageCount;
    },
    get currentPage() {
      return pageView.currentPage;
    },
    get isFullscreen() {
      return isFullscreen();
    },
    async show(pdfDocument, description) {
      documentToken += 1;
      openDocument = pdfDocument;
      pageCount = pdfDocument.pageCount;
      thumbnails?.replaceChildren(...(thumbnailTemplate ? [thumbnailTemplate] : []));
      documentLine.textContent = description ?? '';

      await pageView.show(pdfDocument);
      await renderThumbnails(documentToken);
    },
    goToPage(pageNumber) {
      pageView.goToPage(pageNumber);
    },
    reset() {
      documentToken += 1;
      openDocument = undefined;
      pageCount = 0;
      void leaveFullscreen();
      pageView.reset();
      thumbnails?.replaceChildren(...(thumbnailTemplate ? [thumbnailTemplate] : []));
      documentLine.textContent = '';
    },
  };
}

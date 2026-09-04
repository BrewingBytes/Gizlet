import {
  canZoomPdf,
  clampPdfPage,
  defaultPdfZoom,
  describePdfPagePosition,
  describePdfZoom,
  getNextPdfZoom,
  getPdfPageErrorMessage,
  getPdfRenderScale,
  parsePdfPageInput,
  type PdfZoom,
} from '../data/pdf-viewer';
import type { LocalPdfDocument } from './pdf-rendering';

/**
 * The page-turning half of a PDF workspace: which page is showing, how large it
 * is drawn, and the controls that move between pages.
 *
 * Two Gizlets need exactly this — the PDF Viewer, which opens a document the
 * visitor chose, and Image to PDF, which shows the one it has just built — so
 * the wiring lives here instead of being written twice. Every decision it makes
 * still comes from `data/pdf-viewer`; this module only owns the DOM.
 *
 * pdf.js is not imported here, only its type, which the compiler erases. That
 * is what lets a page reach this module without shipping the library, and load
 * `scripts/pdf-rendering` on its own terms.
 */

export interface PdfPageViewElements {
  /** The box the page is drawn into, whose width decides the render scale. */
  readonly pageArea: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly pageError: HTMLElement;
  readonly previousButton: HTMLButtonElement;
  readonly nextButton: HTMLButtonElement;
  readonly pageInput: HTMLInputElement;
  readonly pageTotal: HTMLElement;
  /**
   * Zoom, for a workspace that offers it. A workspace where the page size was
   * just chosen by the visitor can fit the page to its column and leave these
   * out, so they are optional rather than a set of controls nobody presses.
   */
  readonly zoomOutButton?: HTMLButtonElement | null;
  readonly zoomInButton?: HTMLButtonElement | null;
  readonly zoomLevel?: HTMLOutputElement | null;
}

export interface PdfPageViewOptions extends PdfPageViewElements {
  /** Runs whenever the shown page changes, for anything outside these controls. */
  readonly onPageChange?: (pageNumber: number, pageCount: number) => void;
}

export interface PdfPageView {
  readonly pageCount: number;
  readonly currentPage: number;
  /**
   * Shows a document from its first page. The view owns it from here and
   * closes it on the next `show` or `reset`.
   */
  show(document: LocalPdfDocument): Promise<void>;
  goToPage(pageNumber: number): void;
  /** Closes the document and empties the canvas. */
  reset(): void;
}

export function createPdfPageView(options: PdfPageViewOptions): PdfPageView {
  const {
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
    onPageChange,
  } = options;

  let openDocument: LocalPdfDocument | undefined;
  let pageCount = 0;
  let currentPage = 1;
  let zoom: PdfZoom = defaultPdfZoom;
  // Renders are asynchronous, so a later one must be able to discard an
  // earlier one's result rather than painting a page the visitor left.
  let renderToken = 0;

  const updateControls = () => {
    pageInput.value = String(currentPage);
    pageTotal.textContent = `of ${pageCount}`;
    canvas.setAttribute('aria-label', describePdfPagePosition(currentPage, pageCount));
    previousButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= pageCount;

    if (zoomLevel) zoomLevel.textContent = describePdfZoom(zoom);
    if (zoomOutButton) zoomOutButton.disabled = !canZoomPdf(zoom, 'out');
    if (zoomInButton) zoomInButton.disabled = !canZoomPdf(zoom, 'in');

    onPageChange?.(currentPage, pageCount);
  };

  /** The width a page has to fit into, so it opens readable. */
  const availableWidth = () => {
    const styles = window.getComputedStyle(pageArea);
    const padding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);

    return Math.max(1, pageArea.clientWidth - padding);
  };

  const renderCurrentPage = async () => {
    if (!openDocument) return;

    const token = ++renderToken;
    pageError.hidden = true;

    try {
      const { width } = await openDocument.getPageSize(currentPage);
      if (token !== renderToken) return;

      const scale = getPdfRenderScale(width, availableWidth(), zoom);
      await openDocument.renderPage(currentPage, canvas, scale);
    } catch {
      if (token !== renderToken) return;
      // One unreadable page must say so rather than leave a blank canvas.
      pageError.textContent = getPdfPageErrorMessage(currentPage);
      pageError.hidden = false;
    }
  };

  const goToPage = (pageNumber: number) => {
    const target = clampPdfPage(pageNumber, pageCount);
    if (target === currentPage) return;

    currentPage = target;
    updateControls();
    void renderCurrentPage();
  };

  const closeDocument = () => {
    renderToken += 1;
    void openDocument?.close().catch(() => undefined);
    openDocument = undefined;
  };

  previousButton.addEventListener('click', () => goToPage(currentPage - 1));
  nextButton.addEventListener('click', () => goToPage(currentPage + 1));
  pageInput.addEventListener('change', () => {
    const parsed = parsePdfPageInput(pageInput.value, pageCount);
    // A page that is not in this document restores the field rather than
    // jumping somewhere the visitor did not ask for.
    if (parsed === undefined) {
      pageInput.value = String(currentPage);
      return;
    }
    goToPage(parsed);
  });

  for (const [button, direction] of [[zoomOutButton, 'out'], [zoomInButton, 'in']] as const) {
    button?.addEventListener('click', () => {
      const next = getNextPdfZoom(zoom, direction);
      if (next === zoom) return;
      zoom = next;
      updateControls();
      void renderCurrentPage();
    });
  }

  return {
    get pageCount() {
      return pageCount;
    },
    get currentPage() {
      return currentPage;
    },
    async show(document) {
      closeDocument();
      openDocument = document;
      pageCount = document.pageCount;
      currentPage = 1;
      zoom = defaultPdfZoom;
      updateControls();
      await renderCurrentPage();
    },
    goToPage,
    reset() {
      closeDocument();
      pageCount = 0;
      currentPage = 1;
      zoom = defaultPdfZoom;
      canvas.removeAttribute('width');
      canvas.removeAttribute('height');
      pageError.hidden = true;
    },
  };
}

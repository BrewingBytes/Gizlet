import {
  getGizletRequestIssueUrl,
  validateGizletRequest,
  type GizletRequestValues,
} from '../data/gizlet-request';

function setFieldError(
  field: HTMLInputElement | HTMLTextAreaElement,
  messageElement: HTMLElement,
  message: string | undefined,
): void {
  const hasError = Boolean(message);
  field.setAttribute('aria-invalid', String(hasError));
  messageElement.hidden = !hasError;
  messageElement.textContent = message ?? '';
}

/** Adds browser-side validation and the GitHub handoff to the request page. */
export function initialiseGizletRequestForm(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>('[data-gizlet-request-form]');
  const toolIdea = root.querySelector<HTMLTextAreaElement>('[data-tool-idea]');
  const useCase = root.querySelector<HTMLTextAreaElement>('[data-use-case]');
  const contact = root.querySelector<HTMLInputElement>('[data-contact]');
  const toolIdeaError = root.querySelector<HTMLElement>('[data-tool-idea-error]');
  const errorSummary = root.querySelector<HTMLElement>('[data-request-error-summary]');
  const success = root.querySelector<HTMLElement>('[data-request-success]');
  const continueLink = root.querySelector<HTMLAnchorElement>('[data-request-continue]');

  if (!form || !toolIdea || !useCase || !contact || !toolIdeaError || !errorSummary || !success || !continueLink) {
    throw new Error('Gizlet request form could not initialise.');
  }

  const values = (): GizletRequestValues => ({
    toolIdea: toolIdea.value,
    useCase: useCase.value,
    contact: contact.value,
  });
  const clearToolIdeaError = () => {
    setFieldError(toolIdea, toolIdeaError, undefined);
    errorSummary.hidden = true;
    errorSummary.textContent = '';
    success.hidden = true;
  };

  const invalidatePreparedRequest = () => {
    success.hidden = true;
  };

  toolIdea.addEventListener('input', clearToolIdeaError);
  useCase.addEventListener('input', invalidatePreparedRequest);
  contact.addEventListener('input', invalidatePreparedRequest);
  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const requestValues = values();
    const errors = validateGizletRequest(requestValues);
    setFieldError(toolIdea, toolIdeaError, errors.toolIdea);

    if (errors.toolIdea) {
      success.hidden = true;
      errorSummary.hidden = false;
      errorSummary.textContent = `There is one thing to fix: ${errors.toolIdea}`;
      toolIdea.focus();
      return;
    }

    errorSummary.hidden = true;
    errorSummary.textContent = '';
    continueLink.href = getGizletRequestIssueUrl(requestValues);
    success.hidden = false;
    success.focus();
  });
}

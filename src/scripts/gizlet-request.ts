import {
  getGizletRequestIssueUrl,
  resolvePlannedGizletRequest,
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
  const plannedNote = root.querySelector<HTMLElement>('[data-planned-note]');
  const plannedNoteName = root.querySelector<HTMLElement>('[data-planned-note-name]');

  if (
    !form ||
    !toolIdea ||
    !useCase ||
    !contact ||
    !toolIdeaError ||
    !errorSummary ||
    !success ||
    !continueLink ||
    !plannedNote ||
    !plannedNoteName
  ) {
    throw new Error('Gizlet request form could not initialise.');
  }

  // A row in the not-built block passes its Gizlet through the query string,
  // because this page is one prerendered document and cannot know which row was
  // clicked at build time. The idea field is filled from the registry entry
  // rather than from the parameter: the form's minimum length would otherwise
  // reject a one-click vote, and nothing a link carries reaches the issue.
  const planned = resolvePlannedGizletRequest(window.location.search);

  if (planned) {
    toolIdea.value = planned.name;
    plannedNoteName.textContent = planned.name;
    plannedNote.hidden = false;
  }

  const values = (): GizletRequestValues => ({
    toolIdea: toolIdea.value,
    useCase: useCase.value,
    contact: contact.value,
    plannedGizlet: planned?.name,
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

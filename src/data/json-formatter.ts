export type JsonTransformAction = "format" | "minify";

export interface JsonParseError {
  readonly message: string;
  readonly position?: number;
  readonly line?: number;
  readonly column?: number;
}

export type JsonValidationResult =
  | { readonly valid: true; readonly value: unknown }
  | { readonly valid: false; readonly error: JsonParseError };

export type JsonTransformResult =
  | { readonly valid: true; readonly output: string }
  | { readonly valid: false; readonly error: JsonParseError };

function locationAt(input: string, position: number): Pick<JsonParseError, "position" | "line" | "column"> {
  const beforeError = input.slice(0, Math.max(0, Math.min(position, input.length)));
  const lines = beforeError.split(/\r\n|\r|\n/);

  return {
    position,
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}

function describeParseError(input: string, caughtError: unknown): JsonParseError {
  const nativeMessage = caughtError instanceof Error ? caughtError.message : "The JSON could not be read.";
  const positionMatch = /\bposition\s+(\d+)/i.exec(nativeMessage);
  const lineColumnMatch = /\bline\s+(\d+)\s*(?:,|\s)column\s+(\d+)/i.exec(nativeMessage);
  const position = positionMatch ? Number(positionMatch[1]) : undefined;
  const reason = nativeMessage
    .replace(/^JSON\.parse:\s*/i, "")
    .replace(/\s+at position\s+\d+(?:\s+\(line\s+\d+\s+column\s+\d+\))?\.?$/i, "")
    .replace(/\s+at line\s+\d+\s+column\s+\d+(?:\s+of the JSON data)?\.?$/i, "")
    .replace(/,\s*"[\s\S]*"\s+is not valid JSON\.?$/i, "")
    .trim();

  return {
    message: reason || "The JSON could not be read.",
    ...(position !== undefined
      ? locationAt(input, position)
      : lineColumnMatch
        ? { line: Number(lineColumnMatch[1]), column: Number(lineColumnMatch[2]) }
        : {}),
  };
}

/** Parses JSON and returns a display-ready error without changing the source text. */
/**
 * Whether a file holds JSON, by its name and reported type.
 *
 * Asked where a file has to be recognised rather than read: the flow that
 * starts from a JSON document, and the file dropped on the home page to find
 * out what reads it. Whether the text inside is really JSON is `validateJson`,
 * which is a question about content rather than about a name.
 */
export function isJsonTextFile(file: {
  readonly name: string;
  readonly type: string;
}): boolean {
  return file.type === "application/json" || /\.json$/i.test(file.name);
}

export function validateJson(input: string): JsonValidationResult {
  if (!input.trim()) {
    return {
      valid: false,
      error: { message: "Paste JSON to validate it." },
    };
  }

  try {
    return { valid: true, value: JSON.parse(input) };
  } catch (caughtError) {
    return { valid: false, error: describeParseError(input, caughtError) };
  }
}

/** Formats or minifies a valid JSON document using the browser's native JSON implementation. */
export function transformJson(input: string, action: JsonTransformAction): JsonTransformResult {
  const validation = validateJson(input);

  if (!validation.valid) {
    return validation;
  }

  return {
    valid: true,
    output: JSON.stringify(validation.value, null, action === "format" ? 2 : undefined),
  };
}

/** Provides a concise, accessible error message with a location when the browser exposes one. */
export function formatJsonParseError(error: JsonParseError): string {
  if (error.line !== undefined && error.column !== undefined) {
    return `Invalid JSON at line ${error.line}, column ${error.column}: ${error.message}`;
  }

  return `Invalid JSON: ${error.message}`;
}

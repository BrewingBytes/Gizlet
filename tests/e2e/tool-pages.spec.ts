import { expect, test } from "@playwright/test";

import {
  getAvailableTools,
  type AvailableToolSlug,
} from "../../src/data/tools";

/**
 * A control that only that Gizlet's own workspace renders. Keyed by the
 * registry's available slugs, so a new Gizlet cannot join without one.
 */
const workspaceSignatures = {
  "compress-image": "Select an image to compress",
  "resize-image": "Select an image to resize",
  "convert-image": "Select an image to convert",
  "json-ld-generator": "Schema type",
  "json-formatter": "JSON input",
  "jpg-to-pdf": "Select images to put in a PDF",
  "pdf-viewer": "Select a PDF to open",
} as const satisfies Record<AvailableToolSlug, string>;

for (const tool of getAvailableTools()) {
  test(`renders the ${tool.name} workspace on its own Gizlet page`, async ({
    page,
  }) => {
    await page.goto(tool.path);

    await expect(page.getByLabel(`${tool.name} workspace`)).toBeAttached();
    await expect(
      page.getByLabel(workspaceSignatures[tool.slug]),
    ).toBeAttached();
    await expect(
      page.getByRole("heading", { name: "This Gizlet is being prepared." }),
    ).toHaveCount(0);
    await expect(page.getByText("Results will appear here")).toHaveCount(0);
  });
}

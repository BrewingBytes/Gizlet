import { expect, test } from "@playwright/test";

import { getPlannedTools } from "../../src/data/tools";

const [planned] = getPlannedTools();

test("publishes the phases and the refusals without an ad beside them", async ({
  page,
}) => {
  await page.goto("/roadmap/");

  await expect(page).toHaveTitle("Roadmap | Gizlet");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://gizlet.app/roadmap/",
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "What we're building, and what would make us stop.",
    }),
  ).toBeVisible();

  // Every phase fills in the same form, in the same order, so two phases are
  // comparable by reading the same line twice.
  for (const label of [
    "When",
    "What",
    "Shared machinery",
    "Signal",
    "How we'll know to stop",
    "Where it stands",
  ]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }

  await expect(page.getByRole("heading", { name: "What we won't build." })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Use instead" })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(5);
  await expect(
    page.getByText("If it needs a server, it isn't a Gizlet."),
  ).toBeVisible();

  // A page whose argument is "here is how we would know to quit" carries no
  // advertisement in any placement (design.md §10).
  await expect(page.locator("[data-ad-slot]")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("reaches the roadmap from the footer and lands on the phase a link names", async ({
  page,
}) => {
  await page.goto("/");

  const footer = page.getByRole("navigation", { name: "Footer navigation" });
  await expect(footer.getByRole("link", { name: "Roadmap" })).toHaveAttribute(
    "href",
    "/roadmap/",
  );
  // The header is the site's task surface, so the roadmap is not in it.
  await expect(
    page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link", { name: "Roadmap" }),
  ).toHaveCount(0);

  await page.goto("/roadmap/#phase-2");
  await expect(page.locator("#phase-2")).toBeVisible();
});

test("shows the bench on the Gizlet index as rows that are not links", async ({
  page,
}) => {
  await page.goto("/tools/");

  await expect(page.getByRole("heading", { name: "Not built yet." })).toBeVisible();
  await expect(page.getByText("Coming soon")).toHaveCount(0);
  await expect(
    page.getByText("Your request opens a public GitHub issue in your name."),
  ).toBeVisible();

  const row = page.locator(`[data-planned-row="${planned.slug}"]`);
  await expect(row).toBeVisible();
  // No wrapping anchor: the row carries the phase link and the request link and
  // nothing else, so there is no whole-row pointer to a page that does nothing.
  await expect(row.locator("a")).toHaveCount(2);
  expect(
    await row.evaluate((element) => element.closest("a") !== null),
  ).toBe(false);
  await expect(row.getByRole("link", { name: /^PHASE \d+$/ })).toHaveAttribute(
    "href",
    /^\/roadmap\/#phase-\d+$/,
  );
  await expect(row.getByRole("link", { name: `Ask for ${planned.name}` })).toHaveAttribute(
    "href",
    `/request-a-gizlet/?gizlet=${planned.slug}`,
  );

  // The block is the last thing on the page: no ad inside it and none after it.
  await expect(page.locator("[data-ad-slot]")).toHaveCount(0);
});

test("keeps a planned Gizlet's page out of search, out of the ad inventory, and out of the machine-readable claims", async ({
  page,
}) => {
  await page.goto(planned.path);

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  await expect(
    page.getByRole("heading", { name: "This Gizlet is not built yet." }),
  ).toBeVisible();
  await expect(page.getByText("Coming soon")).toHaveCount(0);
  await expect(page.getByLabel("Local processing")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Related Gizlets" })).toHaveCount(0);
  await expect(page.locator("[data-ad-slot]")).toHaveCount(0);

  const markup = JSON.parse(
    (await page
      .locator('script[type="application/ld+json"]')
      .textContent()) as string,
  );
  expect(markup["@type"]).toBe("BreadcrumbList");
  expect(JSON.stringify(markup)).not.toContain("SoftwareApplication");
  expect(JSON.stringify(markup)).not.toContain("isAccessibleForFree");
});

test("prefills the request form from a bench row so a vote is one click", async ({
  page,
}) => {
  await page.goto(`/request-a-gizlet/?gizlet=${planned.slug}`);

  await expect(page.getByLabel("Tool idea *")).toHaveValue(planned.name);
  await expect(page.getByText(`This is a vote for ${planned.name}`)).toBeVisible();

  await page.getByRole("button", { name: "Prepare request" }).click();
  const issueUrl = new URL(
    (await page
      .getByRole("link", { name: "Continue to GitHub" })
      .getAttribute("href")) as string,
  );

  // The name lands in the title, which is what makes the demand countable: a
  // title search is a count, and parsing issue bodies is a chore nobody does.
  expect(issueUrl.searchParams.get("title")).toBe(`Planned Gizlet: ${planned.name}`);
  expect(issueUrl.searchParams.get("body")).toContain("### Planned Gizlet");
});

test("ignores a request parameter the registry does not carry", async ({
  page,
}) => {
  // The value lands in an issue filed in the visitor's own name, so an
  // unrecognised one is dropped rather than echoed back into the form.
  await page.goto("/request-a-gizlet/?gizlet=totally-made-up-gizlet");

  await expect(page.getByLabel("Tool idea *")).toHaveValue("");
  await expect(page.getByText("This is a vote for")).toBeHidden();
});

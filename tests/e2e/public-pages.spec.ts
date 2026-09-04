import { expect, test } from "@playwright/test";

test("links to and renders public information pages with page metadata", async ({ page }) => {
  await page.goto("/");

  const primaryNavigation = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(primaryNavigation.getByRole("link", { name: "Request a Gizlet" })).toHaveAttribute(
    "href",
    "/request-a-gizlet/",
  );

  const footer = page.getByRole("navigation", { name: "Footer navigation" });
  await expect(footer.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy/");
  await expect(footer.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms/");
  await expect(footer.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about/");
  await expect(footer.getByRole("link", { name: "Request a Gizlet" })).toHaveAttribute("href", "/request-a-gizlet/");

  await page.goto("/privacy/");
  await expect(page).toHaveTitle("Privacy | Gizlet");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://gizlet.app/privacy/");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "How Gizlet handles local tool processing, analytics, and advertising.",
  );
  await expect(page.getByRole("heading", { name: "Local Gizlets" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Advertising consent choices" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Cloudflare Web Analytics" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Google AdSense" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Google Consent Management Platform" })).toBeVisible();

  await page.goto("/terms/");
  await expect(page).toHaveTitle("Terms | Gizlet");
  await expect(page.getByRole("heading", { name: "Using Gizlet" })).toBeVisible();

  await page.goto("/about/");
  await expect(page).toHaveTitle("About | Gizlet");
  await expect(page.getByText("Gizlet is a BrewingBytes product")).toBeVisible();
});

test("validates and prepares a Gizlet request without posting it to Gizlet", async ({ page }) => {
  await page.goto("/request-a-gizlet/");

  await expect(page).toHaveTitle("Request a Gizlet | Gizlet");
  const idea = page.getByLabel("Tool idea *");
  await page.getByRole("button", { name: "Prepare request" }).click();
  await expect(page.getByText("There is one thing to fix:")).toContainText(
    "Tell us the Gizlet you would like us to make.",
  );
  await expect(idea).toHaveAttribute("aria-invalid", "true");
  await expect(idea).toBeFocused();

  await idea.fill("Remove blank PDF pages");
  await page.getByLabel("How would you use it? Optional").fill("To clean scans before sharing them.");
  await page.getByLabel("Contact Optional").fill("hello@example.com");
  await page.getByRole("button", { name: "Prepare request" }).click();

  const success = page.getByRole("status");
  await expect(success).toContainText("Your request is ready.");
  await expect(success).toContainText("Gizlet has not received it yet.");
  await expect(page.getByRole("link", { name: "Continue to GitHub" })).toHaveAttribute(
    "href",
    /https:\/\/github\.com\/BrewingBytes\/Gizlet\/issues\/new\?title=/,
  );
});

test("offers a way back from an unknown address", async ({ page }) => {
  await page.goto("/404.html");

  await expect(page).toHaveTitle("Page not found | Gizlet");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow",
  );
  await expect(
    page.getByRole("heading", { name: "That page is not here." }),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: /Compress Image/ }),
  ).toHaveAttribute("href", "/tools/compress-image/");
  await expect(
    page.getByRole("link", { name: "Back to the Gizlet home page" }),
  ).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
});

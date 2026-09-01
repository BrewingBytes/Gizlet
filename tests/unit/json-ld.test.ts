import { describe, expect, test } from "vitest";

import {
  formatJsonLd,
  generateJsonLd,
  getJsonLdMessages,
  getJsonLdScriptBlock,
} from "../../src/data/json-ld";

describe("JSON-LD generation", () => {
  test("generates a valid Product document with nested brand and offer data", () => {
    const document = generateJsonLd("Product", {
      name: "Trail Mug",
      description: "A sturdy mug for camp coffee.",
      image: "https://example.com/mug.jpg",
      brand: "Gizlet Outdoors",
      sku: "MUG-01",
      price: "24.00",
      currency: "USD",
      availability: "https://schema.org/InStock",
      offerUrl: "https://example.com/mug",
    });

    expect(JSON.parse(formatJsonLd(document))).toEqual({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Trail Mug",
      description: "A sturdy mug for camp coffee.",
      image: "https://example.com/mug.jpg",
      brand: { "@type": "Brand", name: "Gizlet Outdoors" },
      sku: "MUG-01",
      offers: {
        "@type": "Offer",
        price: "24.00",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: "https://example.com/mug",
      },
    });
    expect(getJsonLdScriptBlock(document)).toContain(
      '<script type="application/ld+json">',
    );
  });

  test("does not emit blank optional Organization fields", () => {
    const document = generateJsonLd("Organization", {
      name: "Gizlet",
      url: "  ",
      logo: "",
      telephone: "",
    });

    expect(document).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Gizlet",
    });
    expect(
      getJsonLdMessages("Organization", { name: "Gizlet" }).map(
        (message) => message.level,
      ),
    ).toEqual(["recommendation", "recommendation"]);

    expect(generateJsonLd("Product", { name: "Trail Mug" })).toEqual({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Trail Mug",
    });
  });
});

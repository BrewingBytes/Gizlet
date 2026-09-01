export const jsonLdSchemaTypes = [
  "Product",
  "Organization",
  "Article",
  "LocalBusiness",
  "Event",
  "BreadcrumbList",
] as const;

export type JsonLdSchemaType = (typeof jsonLdSchemaTypes)[number];
export type JsonLdFormValues = Readonly<Record<string, string>>;
export type JsonLdDocument = Record<string, unknown>;

export interface JsonLdMessage {
  readonly level: "error" | "recommendation";
  readonly text: string;
}

function value(values: JsonLdFormValues, key: string): string | undefined {
  const candidate = values[key]?.trim();
  return candidate || undefined;
}

function withContext(document: JsonLdDocument): JsonLdDocument {
  return { "@context": "https://schema.org", ...document };
}

function withoutEmptyValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withoutEmptyValues).filter((entry) => entry !== undefined);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, entry]) => [key, withoutEmptyValues(entry)] as const)
        .filter(
          ([, entry]) =>
            entry !== undefined &&
            !(
              typeof entry === "object" &&
              !Array.isArray(entry) &&
              Object.keys(entry as object).length === 0
            ),
        ),
    );
  }

  return value === "" || value === undefined || value === null
    ? undefined
    : value;
}

function breadcrumbItems(values: JsonLdFormValues) {
  return [1, 2, 3]
    .map((position) => ({
      "@type": "ListItem",
      position,
      name: value(values, `breadcrumb${position}Name`),
      item: value(values, `breadcrumb${position}Url`),
    }))
    .filter((item) => item.name || item.item);
}

/** Creates a compact Schema.org JSON-LD document from the selected tool form. */
export function generateJsonLd(
  type: JsonLdSchemaType,
  values: JsonLdFormValues,
): JsonLdDocument {
  const document: JsonLdDocument = (() => {
    switch (type) {
      case "Product": {
        const price = value(values, "price");
        const offerUrl = value(values, "offerUrl");
        const hasOffer = Boolean(price || offerUrl);
        return {
          "@type": "Product",
          name: value(values, "name"),
          description: value(values, "description"),
          image: value(values, "image"),
          brand: value(values, "brand")
            ? { "@type": "Brand", name: value(values, "brand") }
            : undefined,
          sku: value(values, "sku"),
          offers: hasOffer
            ? {
                "@type": "Offer",
                price,
                priceCurrency: value(values, "currency"),
                availability: value(values, "availability"),
                url: offerUrl,
              }
            : undefined,
        };
      }
      case "Organization":
        return {
          "@type": "Organization",
          name: value(values, "name"),
          url: value(values, "url"),
          logo: value(values, "logo"),
          email: value(values, "email"),
          telephone: value(values, "telephone"),
          sameAs: value(values, "sameAs"),
        };
      case "Article":
        return {
          "@type": "Article",
          headline: value(values, "headline"),
          description: value(values, "description"),
          image: value(values, "image"),
          datePublished: value(values, "datePublished"),
          dateModified: value(values, "dateModified"),
          author: value(values, "authorName")
            ? { "@type": "Person", name: value(values, "authorName") }
            : undefined,
          publisher: value(values, "publisherName")
            ? {
                "@type": "Organization",
                name: value(values, "publisherName"),
                logo: value(values, "publisherLogo")
                  ? {
                      "@type": "ImageObject",
                      url: value(values, "publisherLogo"),
                    }
                  : undefined,
              }
            : undefined,
        };
      case "LocalBusiness":
        return {
          "@type": "LocalBusiness",
          name: value(values, "name"),
          image: value(values, "image"),
          url: value(values, "url"),
          telephone: value(values, "telephone"),
          priceRange: value(values, "priceRange"),
          openingHours: value(values, "openingHours"),
          address:
            value(values, "streetAddress") ||
            value(values, "addressLocality") ||
            value(values, "postalCode") ||
            value(values, "addressCountry")
              ? {
                  "@type": "PostalAddress",
                  streetAddress: value(values, "streetAddress"),
                  addressLocality: value(values, "addressLocality"),
                  postalCode: value(values, "postalCode"),
                  addressCountry: value(values, "addressCountry"),
                }
              : undefined,
        };
      case "Event": {
        const price = value(values, "price");
        const offerUrl = value(values, "offerUrl");
        const hasOffer = Boolean(price || offerUrl);
        return {
          "@type": "Event",
          name: value(values, "name"),
          startDate: value(values, "startDate"),
          endDate: value(values, "endDate"),
          description: value(values, "description"),
          image: value(values, "image"),
          eventStatus: value(values, "eventStatus"),
          location: value(values, "locationName")
            ? {
                "@type": "Place",
                name: value(values, "locationName"),
                address: value(values, "locationAddress")
                  ? {
                      "@type": "PostalAddress",
                      streetAddress: value(values, "locationAddress"),
                    }
                  : undefined,
              }
            : undefined,
          offers: hasOffer
            ? {
                "@type": "Offer",
                price,
                priceCurrency: value(values, "currency"),
                url: offerUrl,
                availability: value(values, "availability"),
              }
            : undefined,
        };
      }
      case "BreadcrumbList":
        return {
          "@type": "BreadcrumbList",
          itemListElement: breadcrumbItems(values),
        };
    }
  })();

  return withoutEmptyValues(withContext(document)) as JsonLdDocument;
}

function isUrl(candidate: string | undefined): boolean {
  if (!candidate) return true;
  try {
    return ["http:", "https:"].includes(new URL(candidate).protocol);
  } catch {
    return false;
  }
}

function requireValue(
  values: JsonLdFormValues,
  key: string,
  label: string,
): JsonLdMessage | undefined {
  return value(values, key)
    ? undefined
    : {
        level: "error",
        text: `${label} is required for this Schema.org type.`,
      };
}

function recommendValue(
  values: JsonLdFormValues,
  key: string,
  label: string,
): JsonLdMessage | undefined {
  return value(values, key)
    ? undefined
    : {
        level: "recommendation",
        text: `Add ${label}; Google commonly recommends it for richer search presentations.`,
      };
}

/** Separates required Schema.org fields from non-guaranteed Google search guidance. */
export function getJsonLdMessages(
  type: JsonLdSchemaType,
  values: JsonLdFormValues,
): readonly JsonLdMessage[] {
  const messages: JsonLdMessage[] = [];
  const required: Record<JsonLdSchemaType, readonly [string, string][]> = {
    Product: [["name", "Product name"]],
    Organization: [["name", "Organization name"]],
    Article: [["headline", "Headline"]],
    LocalBusiness: [["name", "Business name"]],
    Event: [
      ["name", "Event name"],
      ["startDate", "Start date"],
      ["locationName", "Location name"],
    ],
    BreadcrumbList: [],
  };
  required[type].forEach(([key, label]) => {
    const message = requireValue(values, key, label);
    if (message) messages.push(message);
  });

  if (type === "BreadcrumbList" && breadcrumbItems(values).length < 2) {
    messages.push({
      level: "error",
      text: "Add at least two breadcrumb items.",
    });
  }
  if (type === "BreadcrumbList") {
    breadcrumbItems(values).forEach((item) => {
      if (!item.name || !item.item)
        messages.push({
          level: "error",
          text: "Each breadcrumb item needs both a name and URL.",
        });
    });
  }

  const urlFields = [
    "url",
    "logo",
    "image",
    "offerUrl",
    "publisherLogo",
    "sameAs",
  ];
  urlFields.forEach((key) => {
    if (!isUrl(value(values, key)))
      messages.push({
        level: "error",
        text: `${key === "offerUrl" ? "Offer URL" : key[0].toUpperCase() + key.slice(1)} must be a complete http(s) URL.`,
      });
  });

  const recommendations: Partial<
    Record<JsonLdSchemaType, readonly [string, string][]>
  > = {
    Product: [
      ["description", "a description"],
      ["image", "an image"],
      ["brand", "a brand"],
      ["price", "an offer price"],
    ],
    Organization: [
      ["url", "the organization URL"],
      ["logo", "a logo"],
    ],
    Article: [
      ["description", "a description"],
      ["image", "an image"],
      ["datePublished", "a publication date"],
      ["authorName", "an author"],
      ["publisherName", "a publisher"],
    ],
    LocalBusiness: [
      ["streetAddress", "a full address"],
      ["telephone", "a telephone number"],
      ["url", "a website URL"],
    ],
    Event: [
      ["description", "a description"],
      ["image", "an image"],
      ["offerUrl", "an offer URL"],
    ],
  };
  recommendations[type]?.forEach(([key, label]) => {
    const message = recommendValue(values, key, label);
    if (message) messages.push(message);
  });

  return messages;
}

export function formatJsonLd(document: JsonLdDocument): string {
  return JSON.stringify(document, null, 2);
}

export function getJsonLdScriptBlock(document: JsonLdDocument): string {
  return `<script type="application/ld+json">\n${formatJsonLd(document)}\n<\/script>`;
}

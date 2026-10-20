import { describe, expect, it } from "vitest";
import { dataSourceConfigSchema, portfolioItemSchema } from "../shared/schema";

describe("portfolio input validation", () => {
  const freeform = {
    id: "project-1",
    title: "Sample project",
    content: "Project description",
    description: null,
    selected: true,
    source: "freeform",
    createdAt: "2026-10-19T00:00:00Z",
  };

  it("supplies collection and content defaults for saved freeform input", () => {
    expect(portfolioItemSchema.parse(freeform)).toEqual({
      ...freeform,
      tags: [],
      contentType: "other",
    });
  });

  it.each([
    { ...freeform, source: "unsupported" },
    { ...freeform, selected: "true" },
    { ...freeform, title: undefined },
    { ...freeform, source: "github" },
  ])("rejects invalid source-specific input %#", (input) => {
    expect(portfolioItemSchema.safeParse(input).success).toBe(false);
  });

  it("preserves source settings while rejecting an unknown source type", () => {
    const input = {
      type: "blog_rss",
      enabled: true,
      config: { feedUrl: "https://example.test/feed.xml", limit: 10 },
    };
    expect(dataSourceConfigSchema.parse(input)).toEqual(input);
    expect(dataSourceConfigSchema.safeParse({ ...input, type: "unsupported" }).success).toBe(false);
  });
});

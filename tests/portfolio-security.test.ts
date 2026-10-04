import { expect, test } from "vitest";
import { generatePortfolioHtml } from "../server/lib/portfolio-generator";
import type { Repository } from "../shared/schema";

test("generatePortfolioHtml sanitizes javascript: URLs (Vulnerability Fix)", () => {
  const maliciousRepo: Repository = {
    id: 1,
    name: "malicious-repo",
    description: "A repo with a malicious URL",
    url: 'javascript:alert("XSS")',
    summary: null,
    selected: true,
    source: "github",
    owner: {
      login: "attacker",
      type: "User",
      avatarUrl: "https://example.com/avatar.jpg",
    },
    metadata: {
      id: 1,
      stars: 0,
      language: "JavaScript",
      topics: [],
      updatedAt: "2023-01-01",
      url: 'javascript:alert("XSS-in-metadata")',
    },
  };

  const html = generatePortfolioHtml({ login: "attacker", type: "User" }, [maliciousRepo]);

  // Check if the malicious URL is neutralized
  expect(html).not.toContain('href="javascript:alert("XSS")"');
  expect(html).not.toContain('href="javascript:alert("XSS-in-metadata")"');

  // Check if it is replaced with #
  // Since we have two malicious links, we expect at least one #
  expect(html).toContain('href="#"');
});

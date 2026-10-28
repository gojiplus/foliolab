import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { cleanReadmeContent, removeBadges } from "../server/lib/readme-cleaner.js";

describe("README Cleaner", () => {
  it("should remove badges from README content", () => {
    const readmeWithBadges = `# My Project

[![Build Status](https://travis-ci.org/user/repo.svg?branch=master)](https://travis-ci.org/user/repo)
[![npm version](https://badge.fury.io/js/package.svg)](https://badge.fury.io/js/package)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

This is a great project that does amazing things.

## Installation

\`\`\`bash
npm install my-project
\`\`\`

## Usage

Here's how to use it...`;

    const cleaned = cleanReadmeContent(readmeWithBadges);

    // Should remove badges but keep content
    expect(cleaned).not.toContain("[![Build Status]");
    expect(cleaned).not.toContain("[![npm version]");
    expect(cleaned).not.toContain("![License]");
    expect(cleaned).toContain("This is a great project");
    expect(cleaned).toContain("## Installation");
    expect(cleaned).toContain("## Usage");
  });

  it("should remove boilerplate sections", () => {
    const readmeWithBoilerplate = `# My Project

This is a great project.

## Contributing

Please read CONTRIBUTING.md for details on our code of conduct.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

* Hat tip to anyone whose code was used
* Inspiration
* etc`;

    const cleaned = cleanReadmeContent(readmeWithBoilerplate);

    // Should remove boilerplate sections
    expect(cleaned).not.toContain("## Contributing");
    expect(cleaned).not.toContain("## License");
    expect(cleaned).not.toContain("## Acknowledgments");
    expect(cleaned).toContain("This is a great project");
  });

  it("should preserve essential content", () => {
    const readmeWithEssentials = `# My Project

This project does amazing things.

## Features

- Feature 1
- Feature 2
- Feature 3

## Installation

\`\`\`bash
npm install
\`\`\`

## API Reference

### \`myFunction()\`

Does something important.

## Examples

Here are some examples...`;

    const cleaned = cleanReadmeContent(readmeWithEssentials);

    // Should preserve essential sections
    expect(cleaned).toContain("## Features");
    expect(cleaned).toContain("## Installation");
    expect(cleaned).toContain("## API Reference");
    expect(cleaned).toContain("## Examples");
    expect(cleaned).toContain("This project does amazing things");
  });

  it("should handle empty or minimal README", () => {
    const minimalReadme = `# My Project

A simple project.`;

    const cleaned = cleanReadmeContent(minimalReadme);

    expect(cleaned).toContain("# My Project");
    expect(cleaned).toContain("A simple project");
  });

  it("should remove table of contents", () => {
    const readmeWithToc = `# My Project

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)

## Installation

Install the package...

## Usage

Use it like this...`;

    const cleaned = cleanReadmeContent(readmeWithToc);

    expect(cleaned).not.toContain("## Table of Contents");
    expect(cleaned).not.toContain("- [Installation](#installation)");
    expect(cleaned).toContain("## Installation");
    expect(cleaned).toContain("## Usage");
  });
});

describe("Markdown structure", () => {
  it.each(["```", "~~~~"])("preserves Markdown-like text inside %s fences", (fence) => {
    const code = "## License\n\n![badge](https://img.shields.io/badge/example)\n\n\n---";
    const cleaned = cleanReadmeContent(
      `# Project\n\n## Usage\n\n${fence}md\n${code}\n${fence}\n\n## Features\n\nStill here.`,
    );
    expect(cleaned).toContain(code);
    expect(cleaned).toContain("Still here.");
  });

  it("preserves inline code and indented code", () => {
    const cleaned = cleanReadmeContent(
      "# Project\n\n`![badge](https://shields.io/badge/example)`\n\n    ## License\n    example()",
    );
    expect(cleaned).toContain("`![badge](https://shields.io/badge/example)`");
    expect(cleaned).toContain("## License\nexample()");
  });

  it("removes a boilerplate section and all its subsections", () => {
    const cleaned = cleanReadmeContent(
      "# Project\n\nDescription.\n\n## **Contributing**\n\nGuidelines.\n\n### Setup\n\nContributor setup.\n\n#### Tests\n\nContributor tests.\n\n## Usage\n\nUser instructions.",
    );
    expect(cleaned).not.toMatch(/Contribut|Guidelines|Setup|Tests/);
    expect(cleaned).toContain("User instructions.");
  });

  it("recognizes setext headings and resumes at a shallower heading", () => {
    const cleaned = cleanReadmeContent(
      "Project\n=======\n\nDescription.\n\nLicense\n-------\n\nBoilerplate.\n\n### Terms\n\nMore boilerplate.\n\nUsage\n=====\n\nRun it.",
    );
    expect(cleaned).not.toMatch(/License|Terms|[Bb]oilerplate/);
    expect(cleaned).toContain("Run it.");
  });

  it("retains nested API documentation and long examples intact", () => {
    const example = `const value = '${"x".repeat(700)}';`;
    const cleaned = cleanReadmeContent(
      `# Project\n\n## API\n\n### create()\n\nCreates a thing.\n\n\`\`\`js\n${example}\n\`\`\`\n\n### destroy()\n\nDestroys a thing.`,
    );
    expect(cleaned).toContain(example);
    expect(cleaned).toContain("### create()");
    expect(cleaned).toContain("### destroy()");
    expect(cleaned).toContain("Destroys a thing.");
  });

  it("removes reference badges without losing surrounding linked prose", () => {
    const cleaned = cleanReadmeContent(
      "# Project\n\n[![Build][badge] Useful **documentation**][docs]\n\n![badge]\n\n[badge]: https://img.shields.io/badge/build-passing\n[docs]: https://example.org/docs_(latest)",
    );
    expect(cleaned).not.toContain("shields.io");
    expect(cleaned).not.toContain("![");
    expect(cleaned).toContain("Useful **documentation**");
    const paragraph = unified().use(remarkParse).parse(cleaned).children[1];
    expect(paragraph).toMatchObject({
      type: "paragraph",
      children: [{ type: "link", url: "https://example.org/docs_(latest)" }],
    });
  });

  it("resolves case-insensitive reference links whose definitions are in removed sections", () => {
    const cleaned = cleanReadmeContent(
      "# Project\n\nRead [the guide][GUIDE] and see ![architecture][picture].\n\n## License\n\n[guide]: https://example.org/guide\n[picture]: images/architecture.png",
    );
    expect(cleaned).toContain("[the guide](https://example.org/guide)");
    expect(cleaned).toContain("![architecture](images/architecture.png)");
    expect(cleaned).not.toContain("## License");
  });

  it("removes linked badges with parentheses in their target URL", () => {
    const cleaned = cleanReadmeContent(
      "Before [![status](https://img.shields.io/badge/status-ok)](https://example.org/docs_(stable)) after.",
    );
    expect(cleaned).toBe("Before  after.");
  });

  it("does not classify ordinary images by their alt text or a badge hostname in the query", () => {
    const readme =
      "# Project\n\n[![Build architecture](images/build.png)](https://example.org)\n\n![License diagram](https://example.org/diagram?source=shields.io)\n\n![Version](https://shields.io.example.org/version.png)";
    const cleaned = cleanReadmeContent(readme);
    expect(cleaned).toContain("images/build.png");
    expect(cleaned).toContain("https://example.org/diagram?source=shields.io");
    expect(cleaned).toContain("https://shields.io.example.org/version.png");
  });

  it("removes GitHub workflow badges but keeps repository screenshots", () => {
    const cleaned = cleanReadmeContent(
      "![CI](https://github.com/acme/app/actions/workflows/ci.yml/badge.svg)\n\n![Old CI](https://github.com/acme/app/workflows/test/badge.svg)\n\n![Screenshot](https://github.com/acme/app/blob/main/docs/actions.png)",
    );
    expect(cleaned).not.toContain("badge.svg");
    expect(cleaned).toContain("docs/actions.png");
  });

  it("preserves raw HTML blocks without interpreting their contents as Markdown", () => {
    const html =
      "<div>\n## License\n![example](https://shields.io/badge/example)\n<pre>literal text</pre>\n</div>";
    const cleaned = cleanReadmeContent(`# Project\n\n${html}\n\n## Usage\n\nRun it.`);
    expect(cleaned).toContain(html);
    expect(cleaned).toContain("Run it.");
  });

  it("preserves GFM tables, task lists, strikethrough, and footnotes", () => {
    const cleaned = cleanReadmeContent(
      "# Project\n\n| Feature | Status |\n| --- | --- |\n| Parser | Ready |\n\n- [x] Done\n- [ ] Next\n\n~~Old~~ New[^note]\n\n[^note]: Details.",
    );
    expect(cleaned).toMatch(/\| Parser\s+\| Ready/);
    expect(cleaned).toContain("- [x] Done");
    expect(cleaned).toContain("- [ ] Next");
    expect(cleaned).toContain("~~Old~~ New[^note]");
    expect(cleaned).toContain("[^note]: Details.");
  });

  it("preserves anchor links outside an explicit table of contents", () => {
    expect(
      cleanReadmeContent(
        "# Project\n\n## Usage\n\n- [Example](#example)\n\n### Example\n\nRun it.",
      ),
    ).toContain("[Example](#example)");
  });

  it("does not remove headings merely beginning with a boilerplate name", () => {
    expect(
      cleanReadmeContent("# Project\n\n## Security architecture\n\nUses encryption."),
    ).toContain("Uses encryption.");
  });

  it("is idempotent when callers clean the same README twice", () => {
    const once = cleanReadmeContent(
      "# Project\n\n[![CI][badge]](https://example.org)\n\n## Usage\n\nSee [docs][docs].\n\n## License\n\nMIT\n\n[badge]: https://shields.io/badge/ci-ok\n[docs]: https://example.org/docs",
    );
    expect(cleanReadmeContent(once)).toBe(once);
  });

  it.each([null, undefined, "", " \n\t "])("handles empty input %s", (input) => {
    expect(cleanReadmeContent(input)).toBe("");
  });
});

describe("README cleaning boundaries", () => {
  it("keeps referenced footnotes from removed sections and discards unused ones", () => {
    const cleaned = cleanReadmeContent(
      "# Project\n\nUses a parser[^details].\n\n## License\n\nMIT[^license]\n\n[^details]: Supports Markdown[^nested].\n[^nested]: And tables.\n[^license]: Legal details.",
    );
    expect(cleaned).toContain("[^details]: Supports Markdown[^nested].");
    expect(cleaned).toContain("[^nested]: And tables.");
    expect(cleaned).not.toContain("Legal details");
    expect(cleaned).not.toContain("MIT");
    expect(cleanReadmeContent(cleaned)).toBe(cleaned);
  });

  it("removes badges from tables and nested lists without removing other cells or items", () => {
    const cleaned = cleanReadmeContent(
      "| Status | Purpose |\n| --- | --- |\n| ![badge](https://shields.io/badge/ok) | Useful |\n\n- Main\n  - ![badge](https://badgen.net/npm/v/demo)\n  - Keep this\n",
    );
    expect(cleaned).not.toMatch(/shields\.io|badgen\.net/);
    expect(cleaned).toContain("Useful");
    expect(cleaned).toContain("Keep this");
    expect(cleaned).toContain("Main");
  });

  it("leaves boilerplate intact when only badge removal is requested", () => {
    const cleaned = removeBadges(
      "# Project\n\n![badge](https://shields.io/badge/ok)\n\n## License\n\nMIT",
    );
    expect(cleaned).not.toContain("shields.io");
    expect(cleaned).toContain("## License\n\nMIT");
    expect(removeBadges("")).toBe("");
  });

  it("preserves unresolved references as literal text", () => {
    const cleaned = cleanReadmeContent(
      "# Project\n\nUnfinished [link][missing] and ![image][missing].",
    );
    expect(cleaned).toContain("Unfinished");
    expect(cleaned).toContain("missing");
    expect(cleanReadmeContent(cleaned)).toBe(cleaned);
  });
});

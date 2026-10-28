import type { Definition, Nodes, Root } from "mdast";
import { toString as nodeText } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

const markdown = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkStringify, { bullet: "-", fences: true });

const boilerplateHeadings = new Set([
  "license",
  "licensing",
  "code of conduct",
  "contributor code of conduct",
  "contributing guidelines",
  "security",
  "security policy",
  "reporting security issues",
  "changelog",
  "change log",
  "release notes",
  "version history",
  "support",
  "getting help",
  "help",
  "community",
  "acknowledgment",
  "acknowledgments",
  "acknowledgement",
  "acknowledgements",
  "credit",
  "credits",
  "thank",
  "thanks",
  "contributing",
  "how to contribute",
  "contribution guidelines",
  "faq",
  "frequently asked questions",
  "troubleshooting",
  "common issues",
  "known issues",
  "table of content",
  "table of contents",
  "content",
  "contents",
  "toc",
]);

const badgeHosts = [
  "shields.io",
  "badgen.net",
  "badge.fury.io",
  "travis-ci.org",
  "travis-ci.com",
  "circleci.com",
  "codecov.io",
  "coveralls.io",
];

function isBadge(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url, "https://readme.invalid");
  } catch {
    return false;
  }
  const host = parsed.hostname;
  if (badgeHosts.some((badgeHost) => host === badgeHost || host.endsWith(`.${badgeHost}`))) {
    return true;
  }
  if (host === "github.com") {
    return /\/(?:actions\/workflows|workflows)\/.*\/badge\.svg$/.test(parsed.pathname);
  }
  return host === "readthedocs.org" && /\/badge\/?$/.test(parsed.pathname);
}

function collectDefinitions(node: Nodes, definitions: Map<string, Definition>): void {
  if (node.type === "definition" && !definitions.has(node.identifier)) {
    definitions.set(node.identifier, node);
  }
  if ("children" in node) {
    for (const child of node.children) collectDefinitions(child, definitions);
  }
}

function cleanNode(node: Nodes, definitions: Map<string, Definition>): Nodes | undefined {
  if (node.type === "definition") return undefined;
  if (node.type === "image") return isBadge(node.url) ? undefined : node;
  if (node.type === "imageReference") {
    const definition = definitions.get(node.identifier);
    if (!definition) return node;
    return isBadge(definition.url)
      ? undefined
      : { type: "image", url: definition.url, title: definition.title, alt: node.alt };
  }
  if ("children" in node) {
    const hadChildren = node.children.length > 0;
    node.children = node.children
      .map((child) => cleanNode(child, definitions))
      .filter((child) => child !== undefined) as typeof node.children;
    // Table cells and headings retain their structural meaning even when empty.
    if (
      hadChildren &&
      [
        "paragraph",
        "link",
        "linkReference",
        "emphasis",
        "strong",
        "delete",
        "blockquote",
        "list",
        "listItem",
      ].includes(node.type) &&
      node.children.every((child) => child.type === "text" && !child.value.trim())
    ) {
      return undefined;
    }
  }
  if (node.type === "linkReference") {
    const definition = definitions.get(node.identifier);
    if (definition) {
      return {
        type: "link",
        url: definition.url,
        title: definition.title,
        children: node.children,
      };
    }
  }
  return node;
}

function withoutBoilerplate(tree: Root): void {
  const footnotes = new Map(
    tree.children
      .filter((node) => node.type === "footnoteDefinition")
      .map((node) => [node.identifier, node]),
  );
  let removedDepth: number | undefined;
  tree.children = tree.children.filter((node) => {
    if (node.type === "footnoteDefinition") return false;
    if (node.type === "heading") {
      if (removedDepth !== undefined && node.depth <= removedDepth) removedDepth = undefined;
      const title = nodeText(node).trim().replace(/\s+/g, " ").toLowerCase();
      if (removedDepth === undefined && boilerplateHeadings.has(title)) {
        removedDepth = node.depth;
      }
    }
    return removedDepth === undefined;
  });
  const referenced = new Set<string>();
  function findReferences(node: Nodes): void {
    if (node.type === "footnoteReference") referenced.add(node.identifier);
    if ("children" in node) node.children.forEach(findReferences);
  }
  findReferences(tree);
  // Definitions are document-wide, even when written beneath a removed heading.
  referenced.forEach((identifier) => {
    const definition = footnotes.get(identifier);
    if (definition) {
      tree.children.push(definition);
      findReferences(definition);
    }
  });
}

function clean(readme: string, removeBoilerplate: boolean): string {
  const tree = markdown.parse(readme);
  const definitions = new Map<string, Definition>();
  collectDefinitions(tree, definitions);
  // Resolve references before removing sections: definitions can live anywhere in a README.
  cleanNode(tree, definitions);
  if (removeBoilerplate) withoutBoilerplate(tree);
  return markdown.stringify(tree).trim();
}

/** Remove recognized Markdown badge images while preserving prose, code, and ordinary images. */
export function removeBadges(readme: string): string {
  return readme ? clean(readme, false) : readme;
}

/** Clean structural noise; the summarization callers own their prompt length limits. */
export function cleanReadmeContent(readme: string | null | undefined): string {
  return readme ? clean(readme, true) : "";
}

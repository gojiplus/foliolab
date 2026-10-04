import { z } from "zod";
import { repositorySchema } from "./schema.js";
import { themes } from "./themes.js";

const repoNames = z.array(
  z
    .string()
    .regex(/^[\w.-]+$/)
    .transform((s) => s.toLowerCase()),
);
export const organizationConfigSchema = z
  .object({
    organization: z.string().regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/),
    includeRepos: repoNames.default([]),
    excludeRepos: repoNames.default([]),
    includeForks: z.boolean().default(false),
    includeArchived: z.boolean().default(false),
    theme: z
      .string()
      .refine((id) => themes.some((theme) => theme.id === id), "Unknown theme")
      .default("modern"),
    title: z.string().trim().min(1).optional(),
    introduction: z.string().optional(),
    model: z.string().trim().min(1).optional(),
    endpoint: z
      .string()
      .url()
      .refine((value) => {
        const url = new URL(value);
        return (
          ["http:", "https:"].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash
        );
      }, "Use an HTTP(S) base URL without credentials, query, or fragment")
      .optional(),
  })
  .strict();

export const organizationProfileSchema = z
  .object({
    login: z.string().min(1),
    name: z.string().nullable(),
    description: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    url: z.string().url(),
  })
  .strict();

export const organizationDataSchema = z
  .object({
    version: z.literal(1),
    organization: organizationProfileSchema,
    repositories: z
      .array(
        repositorySchema
          .extend({
            summary: z.string().trim().min(1),
            fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict(),
      )
      .superRefine((repos, ctx) => {
        if (new Set(repos.map((repo) => repo.id)).size !== repos.length) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate repository IDs" });
        }
      }),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.repositories.some(
        (repo) =>
          repo.owner.type !== "Organization" ||
          repo.owner.login.toLowerCase() !== data.organization.login.toLowerCase(),
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Repository belongs to another organization",
      });
    }
  });

export type OrganizationConfig = z.infer<typeof organizationConfigSchema>;
export type OrganizationProfile = z.infer<typeof organizationProfileSchema>;
export type OrganizationData = z.infer<typeof organizationDataSchema>;

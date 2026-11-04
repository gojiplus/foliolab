# Visual Flow Diagrams

## GitHub Selection Flow (COMPLETE)

```
┌─────────────────────────────────────────────────────────────────┐
│  GitHub OAuth Authentication                                    │
│  POST /api/auth/github → GitHub API → Access Token             │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────────┐
│  /repos Page (repo-select.tsx)                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Available Repositories    │    Selected Repositories       │ │
│  │ ┌──────────────────────┐  │   ┌──────────────────────────┐│ │
│  │ │ [✓] my-awesome-repo │  │   │ [✓] my-awesome-repo      ││ │
│  │ │ [  ] another-project│  │   │ [✓] data-science-ml      ││ │
│  │ │ [✓] data-science-ml │  │   │                          ││ │
│  │ │                      │  │   │  Summary: 3 selected     ││ │
│  │ │ ┌────────────────────┐ │   │                          ││ │
│  │ │ │ Search filter...   │ │   │ [Generate Portfolio]      ││ │
│  │ │ └────────────────────┘ │   └──────────────────────────┘│ │
│  │ └──────────────────────┘  │                              │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────────┘
                       │ User clicks checkboxes
                       ↓
        ┌──────────────────────────────────┐
        │ toggleRepo() mutation fires       │
        │ (React Query)                     │
        └──────────────┬───────────────────┘
                       │
           ┌───────────┴───────────┐
           ↓                       ↓
    ┌──────────────┐      ┌───────────────────┐
    │ localStorage │      │ Query Cache       │
    │ Save updated │      │ Update with new   │
    │ selected:true│      │ selection state   │
    └──────────────┘      └───────────────────┘
                       
    Storage Key: "foliolab_repositories"
    [
      { id: 1, name: "repo1", selected: true, source: "github" },
      { id: 2, name: "repo2", selected: false, source: "github" }
    ]
                       ↓
         User clicks "Generate Portfolio"
                       ↓
        ┌──────────────────────────────────┐
        │ analyzeRepos() - For each         │
        │ selected repo:                   │
        │ POST /api/repositories/{id}/     │
        │       analyze                    │
        │ (AI generates summary)           │
        └──────────────┬───────────────────┘
                       ↓
        ┌──────────────────────────────────┐
        │ Navigate to /preview             │
        └──────────────────────────────────┘
```

## Blog/RSS Post Flow (INCOMPLETE - MISSING SELECTION UI)

```
┌──────────────────────────────────────────────────────────┐
│  /data-sources Page (data-sources.tsx)                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Select Data Source                               │  │
│  │  ┌──────────────────┐  ┌──────────────────────┐  │  │
│  │  │  Blog RSS Feed   │  │  Medium Posts        │  │  │
│  │  │  GitLab Projects │  │  Bitbucket Repos     │  │  │
│  │  │  Custom Content  │  │  ...                 │  │  │
│  │  └──────────────────┘  └──────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────┬─────────────────────────────────┘
                       │
       User selects "Blog RSS Feed"
                       │
                       ↓
    ┌──────────────────────────────────────┐
    │ Form: Enter RSS Feed URL             │
    │ [https://myblog.com/feed.xml     ]  │
    │ [Click: Import Blog Posts]          │
    └──────────────────┬───────────────────┘
                       │
                       ↓
        ┌──────────────────────────────────┐
        │ POST /api/sources/rss             │
        │ Server fetches feed using         │
        │ getBlogPostsFromRSS()             │
        └──────────────┬───────────────────┘
                       │
                       ↓
      Response: Array of BlogPost objects
      [
        { id: "post-1", title: "...", selected: false, source: "blog_rss" },
        { id: "post-2", title: "...", selected: false, source: "blog_rss" }
      ]
                       │
                       ↓
        ┌──────────────────────────────────┐
        │ addPortfolioItems(posts)          │
        │ → immediately stored              │
        │ → NO UI to see or select them!    │  ❌ GAP #1
        └──────────────────────────────────┘
                       │
                       ↓
    Storage Key: "foliolab_portfolio_items"
    [
      { id: "post-1", title: "...", selected: false, source: "blog_rss" },
      { id: "post-2", title: "...", selected: false, source: "blog_rss" }
    ]
                       │
        ❌ MISSING: Selection UI Page
        ❌ User cannot browse fetched posts
        ❌ User cannot select/deselect
        ❌ User cannot see what was imported
                       │
                       ↓
         User navigates to /preview
         (manually, no link)
                       │
                       ↓
    ❌ GAP #2: portfolio-preview.tsx only
       renders GitHub repos, not blog posts
       
       Portfolio is displayed but:
       - GitHub repos are shown (selected only)
       - Blog posts are MISSING from display
       - Blog posts are in storage but invisible
```

## Data Storage Architecture

```
┌─────────────────────────────────────────────────────────┐
│           Browser localStorage                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Key: "foliolab_repositories" (LEGACY)                 │
│  Value: [Repository] - GitHub repos only               │
│  Used by: Legacy code paths                            │
│  ┌─────────────────────────────────────────┐          │
│  │ { id, name, selected, source: "github" }│          │
│  └─────────────────────────────────────────┘          │
│                                                         │
│  Key: "foliolab_portfolio_items" (NEW - UNIFIED)      │
│  Value: [PortfolioItem] - All sources                  │
│  Used by: data-sources, storage functions              │
│  ┌──────────────────────────────────────────┐         │
│  │ GitHub:     { source: "github" }         │         │
│  │ Blog:       { source: "blog_rss" }       │         │
│  │ Medium:     { source: "medium" }         │         │
│  │ GitLab:     { source: "gitlab" }         │         │
│  │ Bitbucket:  { source: "bitbucket" }      │         │
│  │ Freeform:   { source: "freeform" }       │         │
│  └──────────────────────────────────────────┘         │
│                                                         │
│  Key: "foliolab_github_token"                          │
│  Value: "ghp_xxxx..."                                  │
│                                                         │
│  Key: "foliolab_gitlab_token"                          │
│  Value: "glpat_xxxx..."                                │
│                                                         │
│  Key: "foliolab_bitbucket_credentials"                 │
│  Value: { username, appPassword }                      │
│                                                         │
│  Key: "foliolab_data_sources"                          │
│  Value: [DataSourceConfig]                             │
│                                                         │
└─────────────────────────────────────────────────────────┘

Migration Logic (on app startup):
┌─────────────────────────────────────────┐
│ getPortfolioItems()                     │
├─────────────────────────────────────────┤
│ 1. Check: foliolab_portfolio_items?     │
│    YES → Return parsed JSON             │
│    NO  → Go to step 2                   │
│                                         │
│ 2. Check: foliolab_repositories?        │
│    YES → Migrate to new format:         │
│           add source: "github"          │
│           save to new key               │
│    NO  → Return []                      │
└─────────────────────────────────────────┘
```

## Portfolio Item Types & Their Schema

```
┌─────────────────────────────────────────────────────────────┐
│ All Portfolio Items Share:                                  │
│  • id: string | number                                      │
│  • title: string                                            │
│  • selected: boolean  ← SELECTION STATE                     │
│  • source: "github" | "blog_rss" | "medium" | ...          │
└─────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ GitHub Repository          │ BlogPost (RSS)                │
├────────────────────────────┼───────────────────────────────┤
│ id: number                 │ id: string                    │
│ name: string               │ title: string                 │
│ description: string        │ description: string           │
│ url: string                │ url: string                   │
│ selected: boolean          │ selected: boolean             │
│ owner: {...}               │ publishedAt: string           │
│ metadata: {                │ author: string                │
│   stars: number            │ tags: string[]                │
│   language: string         │ feedUrl: string               │
│   topics: string[]         │ source: "blog_rss"            │
│ }                          │                               │
│ source: "github"           │                               │
└────────────────────────────┴───────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Medium Post                │ Freeform Content              │
├────────────────────────────┼───────────────────────────────┤
│ id: string                 │ id: string                    │
│ title: string              │ title: string                 │
│ description: string        │ content: string               │
│ url: string                │ description: string           │
│ selected: boolean          │ url: string (optional)        │
│ author: string             │ selected: boolean             │
│ tags: string[]             │ createdAt: string             │
│ claps: number              │ contentType: enum             │
│ readTime: number           │ tags: string[]                │
│ source: "medium"           │ source: "freeform"            │
└────────────────────────────┴───────────────────────────────┘
```

## Current vs. Ideal Portfolio Display

```
CURRENT (GitHub Only):
┌──────────────────────────────────────────────┐
│  Portfolio Preview                           │
│  ├─ Profile Section                         │
│  │  ├─ Avatar                               │
│  │  ├─ Name                                 │
│  │  ├─ Skills                               │
│  │  └─ Interests                            │
│  └─ Projects Section (GITHUB ONLY)          │
│     ├─ [✓] Repo 1 (selected)               │
│     ├─ [✓] Repo 2 (selected)               │
│     └─ [✓] Repo 3 (selected)               │
│                                              │
│  ❌ Blog posts not shown                    │
│  ❌ Medium articles not shown                │
│  ❌ GitLab projects not shown               │
│  ❌ Other sources not shown                 │
└──────────────────────────────────────────────┘

IDEAL (Multi-Source):
┌──────────────────────────────────────────────┐
│  Portfolio Preview                           │
│  ├─ Profile Section                         │
│  │  ├─ Avatar                               │
│  │  ├─ Name                                 │
│  │  ├─ Skills                               │
│  │  └─ Interests                            │
│  ├─ Projects Section (GITHUB)               │
│  │  ├─ [✓] Repo 1 (selected)               │
│  │  └─ [✓] Repo 2 (selected)               │
│  ├─ Blog Posts Section (BLOG_RSS)           │
│  │  ├─ [✓] "My First Post" - Author (date) │
│  │  └─ [✓] "Advanced Topic" - Author (date)│
│  ├─ Medium Articles Section                 │
│  │  ├─ [✓] "Medium Article 1"              │
│  │  └─ [✓] "Medium Article 2"              │
│  └─ GitLab Projects Section                 │
│     └─ [✓] GitLab Project                  │
└──────────────────────────────────────────────┘
```

## Storage Functions Call Chain

```
User Action                Method              Storage Effect
───────────                ──────              ──────────────

Checks Repository     toggleRepositorySelection()   selected: true
      ↓                            ↓                      ↓
data-sources.tsx    saveRepositories()          localStorage
                                                foliolab_repositories

Fetches Blog Posts    addPortfolioItems()       selected: false
      ↓                            ↓             (default)
                  savePortfolioItems()                ↓
                                                localStorage
                                            foliolab_portfolio_items

Gets Stored Items     getPortfolioItems()       Read from storage
      ↓                            ↓            (with migration
                  Returns PortfolioItem[]       if needed)
                                                      ↓
                                                Array of items
                                                with all sources

Filters by Source  getPortfolioItemsBySource()  Filter items
      ↓                            ↓            by source type
                  Returns PortfolioItem[]              ↓
                   (filtered)                    Subset array
```

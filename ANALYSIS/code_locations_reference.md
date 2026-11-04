# Code Locations & Quick Reference

## File Structure Overview

```
foliolab/
├── client/src/
│   ├── pages/
│   │   ├── repo-select.tsx          ← GitHub selection UI
│   │   ├── data-sources.tsx         ← Multi-source fetch forms
│   │   └── portfolio-preview.tsx    ← Portfolio display (GitHub only)
│   └── lib/
│       ├── storage.ts              ← LocalStorage management
│       └── queryClient.ts           ← React Query setup
├── server/routes/
│   ├── sources.ts                  ← Data source endpoints
│   └── github.ts                   ← GitHub API integration
└── shared/
    └── schema.ts                   ← All type definitions
```

---

## Key Files & Their Responsibilities

### 1. Schema Definitions

**File:** `/home/user/foliolab/shared/schema.ts`

Defines all data structures. Key lines:
- Line 4-14: Source types enum
- Line 17-39: Repository schema (GitHub)
- Line 91-104: BlogPost schema
- Line 106-120: MediumPost schema
- Line 152-160: Unified PortfolioItem discriminated union

**Key Pattern:** Every portfolio item type has:
```typescript
selected: z.boolean()     // Line 24, 49, 74, 98, 113, 129, 144
source: z.literal(...)    // Line 25, 50, 75, 99, 114, 130, 145
```

### 2. Storage Layer

**File:** `/home/user/foliolab/client/src/lib/storage.ts`

All localStorage operations. Key functions:

| Function                         | Line    | Purpose                                   |
| -------------------------------- | ------- | ----------------------------------------- |
| `toggleRepositorySelection()`    | 131-145 | Toggle selected flag for GitHub repo      |
| `getPortfolioItems()`            | 157-178 | Get all items (with migration logic)      |
| `addPortfolioItems()`            | 186-190 | Add multiple items (used by data sources) |
| `togglePortfolioItemSelection()` | 221-241 | Toggle selected for any portfolio item    |
| `getPortfolioItemsBySource()`    | 243-245 | Filter items by source                    |

**Storage Keys:**
```typescript
// Line 3-10
STORAGE_KEYS = {
  REPOSITORIES: "foliolab_repositories", // Legacy
  PORTFOLIO_ITEMS: "foliolab_portfolio_items", // New unified
  GITHUB_TOKEN: "foliolab_github_token",
  GITLAB_TOKEN: "foliolab_gitlab_token",
  BITBUCKET_CREDENTIALS: "foliolab_bitbucket_credentials",
  DATA_SOURCES: "foliolab_data_sources",
};
```

### 3. GitHub Selection UI

**File:** `/home/user/foliolab/client/src/pages/repo-select.tsx`

Complete selection implementation:

| Section            | Lines   | Description                          |
| ------------------ | ------- | ------------------------------------ |
| Query setup        | 38-45   | Loads repos from `/api/repositories` |
| Toggle mutation    | 47-80   | Updates storage + cache              |
| Filtered repos     | 111-132 | Search & filter logic                |
| Pagination         | 134-139 | 10 repos per page                    |
| Two-column layout  | 304-484 | Left: available, Right: selected     |
| Select All         | 143-149 | Bulk selection                       |
| Generate Portfolio | 153-224 | Analyze each repo + navigate         |

**Key Components:**
- Checkboxes with search filter (lines 267-278)
- Owner filter dropdown (lines 245-264)
- Available repos list (lines 312-405)
- Selected repos panel (lines 408-484)

### 4. Data Sources Fetching

**File:** `/home/user/foliolab/client/src/pages/data-sources.tsx`

Fetch forms for all sources:

| Source    | Lines   | Handler Function                    |
| --------- | ------- | ----------------------------------- |
| RSS       | 323-368 | `handleRSSSubmit()` (53-86)         |
| Medium    | 370-406 | `handleMediumSubmit()` (88-120)     |
| GitLab    | 409-457 | `handleGitLabSubmit()` (122-154)    |
| Bitbucket | 460-508 | `handleBitbucketSubmit()` (156-188) |
| Freeform  | 511-609 | `handleFreeformSubmit()` (190-233)  |

**Critical Issue Pattern (Same on all):**
All handlers end with:
```typescript
addPortfolioItems(items); // Line 76, 111, 146, 180
// NO selection UI shown after this!
```

### 5. Portfolio Preview

**File:** `/home/user/foliolab/client/src/pages/portfolio-preview.tsx`

Display logic:

| Section         | Lines    | Issue                                          |
| --------------- | -------- | ---------------------------------------------- |
| Query data      | 72-75    | Only queries `/api/repositories` (GitHub only) |
| Filter selected | 344-360  | Only filters repositories, not other items     |
| Render repos    | 433-592  | Only renders Repository objects                |
| Elegant theme   | 933-1093 | Still only renders repos                       |

**The Gap:**
```typescript
// Line 72-75: Only GitHub repos loaded
const { data, isLoading, error } = useQuery<{ repositories: Repository[] }>({
  queryKey: ["/api/repositories"],
  // ❌ Should also load portfolio items with other sources
});
```

### 6. Server API Routes

**File:** `/home/user/foliolab/server/routes/sources.ts`

API endpoints for fetching:

| Endpoint                      | Lines   | Purpose                  |
| ----------------------------- | ------- | ------------------------ |
| POST `/api/sources/rss`       | 16-32   | Fetch RSS blog posts     |
| POST `/api/sources/medium`    | 39-55   | Fetch Medium posts       |
| POST `/api/sources/gitlab`    | 84-107  | Fetch GitLab projects    |
| POST `/api/sources/bitbucket` | 114-130 | Fetch Bitbucket repos    |
| POST `/api/sources/freeform`  | 160-190 | Create free-form content |

**Key Detail:** All return items with `selected: false` by default (from schema)

---

## Data Flow Code Examples

### How GitHub Selection Works

```typescript
// 1. User clicks checkbox
// repo-select.tsx line 324
onCheckedChange={(checked) => {
  toggleRepo({ id: repo.id, selected: !!checked });
}}

// 2. Mutation fires
// repo-select.tsx line 47-80
const { mutate: toggleRepo } = useMutation({
  mutationFn: async ({ id, selected }) => {
    const updatedRepos = repositories.map(repo =>
      repo.id === id ? { ...repo, selected } : repo
    );
    saveRepositories(updatedRepos);  // ← Saves to localStorage
    queryClient.setQueryData(["/api/repositories"], { 
      repositories: updatedRepos 
    });  // ← Updates cache
  }
})

// 3. Storage updated
// storage.ts line 111-118
export function saveRepositories(repositories: Repository[]) {
  localStorage.setItem(STORAGE_KEYS.REPOSITORIES, JSON.stringify(repositories));
}

// 4. Portfolio generated
// repo-select.tsx line 153-224
const analyzeRepos = async () => {
  for (let repo of selectedRepos) {
    await apiRequest("POST", `/api/repositories/${repo.id}/analyze`, {...});
  }
  setLocation("/preview");
}
```

### How Blog Posts Are Fetched (But Not Selected)

```typescript
// 1. User submits form
// data-sources.tsx line 359-365
<button onClick={handleRSSSubmit}>
  {loading ? 'Fetching...' : 'Import Blog Posts'}
</button>

// 2. Fetch posts
// data-sources.tsx line 53-86
const handleRSSSubmit = async () => {
  const response = await fetch('/api/sources/rss', {
    method: 'POST',
    body: JSON.stringify({ feedUrl, author })
  });
  const data = await response.json();
  const posts = data.posts as BlogPost[];  // Array of BlogPost
  
  // 3. PROBLEM: Immediately add to storage without selection UI
  addPortfolioItems(posts as PortfolioItem[]);
  // ❌ No way for user to see or select individual posts!
}

// 4. Server returns posts with selected: false
// server/routes/sources.ts line 24
const posts = await getBlogPostsFromRSS(feedUrl, author);
// Each post has: { selected: false, source: "blog_rss", ... }

// 5. Storage function saves them
// storage.ts line 147-155
export function savePortfolioItems(items: PortfolioItem[]) {
  localStorage.setItem(STORAGE_KEYS.PORTFOLIO_ITEMS, 
    JSON.stringify(items)
  );
}
```

### Portfolio Preview Only Shows GitHub

```typescript
// Current implementation - line 72-75
const { data } = useQuery<{ repositories: Repository[] }>({
  queryKey: ["/api/repositories"],  // ← Only GitHub!
  // Should be: ["/api/portfolio/items"] to get all sources
})

// Line 345-346: Filter only selected
const filtered = data.repositories.filter((repo) => repo.selected);

// Line 433-592: Render only repos
selectedRepos.map((repo, index) => (
  <Card key={repo.id}>
    {/* GitHub-specific rendering */}
    {repo.metadata.stars > 0 && ...}  // ← GitHub only
    {repo.metadata.topics.map(...)}   // ← GitHub only
  </Card>
))
```

---

## Storage Function Call Graph

```
React Component
      ↓
toggleRepositorySelection(id)
      ├─→ getRepositories()           [read from storage]
      ├─→ modify selected flag
      ├─→ saveRepositories()          [write to storage]
      └─→ return updated item

addPortfolioItems(items)
      ├─→ getPortfolioItems()         [read from storage]
      ├─→ items.push(...newItems)
      ├─→ savePortfolioItems()        [write to storage]
      └─→ (implicit, no return)

getPortfolioItems()
      ├─→ Check: localStorage.getItem("foliolab_portfolio_items")
      ├─→ If not found:
      │   ├─→ Check: localStorage.getItem("foliolab_repositories")
      │   ├─→ If found: migrate to new format
      │   └─→ savePortfolioItems() to new key
      └─→ return parsed array

togglePortfolioItemSelection(id)
      ├─→ getPortfolioItems()         [read all items]
      ├─→ Find item by ID (handles numeric and string)
      ├─→ Flip selected flag
      ├─→ savePortfolioItems()        [write back]
      └─→ return updated item

getPortfolioItemsBySource(source)
      ├─→ getPortfolioItems()
      └─→ filter(item => item.source === source)
```

---

## Critical Issue: The Missing Selection UI

### Where the Gap Is

1. **Fetching Point** - `data-sources.tsx`
   - RSS: Line 76 - `addPortfolioItems(posts)`
   - Medium: Line 111 - `addPortfolioItems(posts)`
   - GitLab: Line 146 - `addPortfolioItems(projects)`
   - Bitbucket: Line 180 - `addPortfolioItems(repositories)`
   - All add items directly without UI!

2. **Selection Point** - Should exist but doesn't
   - No component like `repo-select.tsx` for blog posts
   - No page to browse/select fetched items
   - User can't control what gets stored

3. **Display Point** - `portfolio-preview.tsx`
   - Line 72-75: Only queries GitHub repos
   - Line 345-346: Only filters Repository objects
   - Line 433-592: Only renders repos
   - Blog posts in storage but invisible!

### What's Stored But Never Shown

```javascript
// In localStorage["foliolab_portfolio_items"]
[
  // Blog posts with selected: false (user can't change this)
  {
    id: "rss-post-1",
    title: "Great Article",
    selected: false, // ← User can't see or toggle this
    source: "blog_rss",
  },

  // Medium posts with selected: false
  {
    id: "medium-123",
    title: "My Medium Post",
    selected: false, // ← User can't see or toggle this
    source: "medium",
  },

  // GitLab projects, Bitbucket repos, etc. - same issue
];
```

---

## To Fix This, You Need To:

1. **Create Selection Page** - `/portfolio-items-select.tsx`
   - Copy pattern from `repo-select.tsx`
   - Show all portfolio items grouped by source
   - Add checkboxes for selection
   - Use `togglePortfolioItemSelection()` to update storage

2. **Update Data-Sources Page** - `data-sources.tsx`
   - After fetching, navigate to `/portfolio-items` instead of storing directly
   - OR: Show selection UI on same page

3. **Update Portfolio Preview** - `portfolio-preview.tsx`
   - Query all portfolio items, not just repos
   - Render different components for each source type
   - Filter to show only `selected: true` items

4. **Add Navigation** - `App.tsx` or routing
   - Add route `/portfolio-items` for selection page
   - Update navigation links between pages

---

## Useful Commands

```bash
# Find all uses of togglePortfolioItemSelection
grep -r "togglePortfolioItemSelection" /home/user/foliolab/client/src

# Find all portfolio item types
grep -r "PortfolioItem" /home/user/foliolab/shared

# Find all storage operations
grep -r "getPortfolioItems\|savePortfolioItems" /home/user/foliolab

# Find all data source endpoints
grep -r "POST.*sources" /home/user/foliolab/server/routes/sources.ts

# Check schema discriminated union
grep -A 10 "discriminatedUnion" /home/user/foliolab/shared/schema.ts
```

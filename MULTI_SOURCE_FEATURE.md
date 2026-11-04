# Multi-Source Portfolio Data Feature

## Overview

This feature expands FolioLab to support multiple data sources beyond GitHub repositories, allowing users to create richer, more comprehensive portfolios while maintaining the privacy-first approach (no database, all data in browser localStorage).

## New Data Sources

### 1. Blog RSS Feed

- Import blog posts from any RSS/Atom feed
- Automatically extracts title, description, publication date, and tags
- Supports author name override

### 2. Medium Posts

- Fetch articles from Medium via RSS feed
- Supports username or profile URL input
- Extracts read time, tags, and publication date
- No Medium API key required (uses public RSS)

### 3. GitLab Projects

- Import repositories from GitLab
- Requires GitLab Personal Access Token (read_api scope)
- Fetches README for project descriptions
- Similar metadata to GitHub (stars, language, topics)

### 4. Bitbucket Repositories

- Support for Bitbucket Cloud repositories
- Uses App Password authentication
- Fetches repository metadata and README files

### 5. Free-form Content

- Add custom portfolio items
- Categories: Project, Achievement, Skill, Experience, Other
- Supports markdown content with optional URLs
- Fully customizable with tags

## Architecture

### Backend Changes

#### New Libraries (`server/lib/`)

- **rss.ts** - RSS feed parser with privacy-focused error handling
- **medium.ts** - Medium post fetcher using RSS
- **gitlab.ts** - GitLab API integration
- **bitbucket.ts** - Bitbucket API integration

#### New Routes (`server/routes/sources.ts`)

```
POST /api/sources/rss              - Fetch blog posts from RSS
POST /api/sources/medium           - Fetch Medium posts
POST /api/sources/medium/validate  - Validate Medium username
POST /api/sources/gitlab           - Fetch GitLab projects
POST /api/sources/bitbucket        - Fetch Bitbucket repos
POST /api/sources/bitbucket/validate - Validate Bitbucket credentials
POST /api/sources/freeform         - Create custom content
POST /api/sources/analyze/:id      - AI analysis for any content type
```

### Frontend Changes

#### New Components

- **data-sources.tsx** - Main UI for adding different data sources
  - Card-based interface for source selection
  - Form-based input for each source type
  - Real-time validation and error handling

#### Updated Components

- **storage.ts** - Extended to support multi-source data management
  - New storage keys for different credentials
  - Portfolio items API (replaces repository-only API)
  - Backward compatible migration from old format

#### New Routes

- `/data-sources` - Data source selection and configuration page

### Schema Updates (`shared/schema.ts`)

#### New Types

```typescript
type SourceType =
  | "github"
  | "gitlab"
  | "bitbucket"
  | "blog_rss"
  | "medium"
  | "linkedin"
  | "freeform";

// Unified portfolio item type (discriminated union)
type PortfolioItem =
  | Repository
  | GitLabRepository
  | BitbucketRepository
  | BlogPost
  | MediumPost
  | LinkedInPost
  | FreeformContent;
```

Each source type has its own schema with common fields:
- id, title/name, description, url
- summary (AI-generated)
- selected (for portfolio inclusion)
- source (discriminator)

## Privacy & Security

### Client-First Architecture

- All user data stored in browser localStorage
- No backend database or logging of user content
- Tokens and credentials never logged

### Storage Keys

```
foliolab_repositories       - GitHub repos (legacy)
foliolab_portfolio_items    - All portfolio items (new)
foliolab_github_token       - GitHub OAuth token
foliolab_gitlab_token       - GitLab personal access token
foliolab_bitbucket_credentials - Bitbucket app password (encrypted by browser)
foliolab_data_sources       - Source configurations
```

### Security Considerations

1. **API Tokens** - Stored in localStorage, never sent to our backend except for API calls
2. **Rate Limiting** - Built-in delays to respect API limits
3. **Error Handling** - Sanitized errors that don't expose user data
4. **CORS** - Proper origin validation for API requests

## Usage Flow

### Adding Content from Different Sources

1. **GitHub** (existing flow)
   - OAuth authentication
   - Select repositories
   - AI generates summaries

2. **Blog RSS Feed**
   - Enter RSS feed URL
   - Optional: Override author name
   - Posts imported automatically

3. **Medium**
   - Enter Medium username or URL
   - System validates and fetches via RSS
   - No authentication required

4. **GitLab**
   - Create Personal Access Token at GitLab
   - Enter token and optional username
   - Projects fetched with README parsing

5. **Bitbucket**
   - Create App Password at Bitbucket
   - Enter username and app password
   - Repositories imported with metadata

6. **Free-form**
   - Fill in title and content
   - Select content type
   - Add optional URL and tags
   - Instant addition to portfolio

## User Experience

### Navigation

- GitHub repos page includes link: "add content from other sources"
- Data sources page has cards for each source type
- Each source has dedicated form with validation
- Back/Continue buttons for smooth navigation

### Feedback

- Loading states during fetch operations
- Success messages showing item count
- Clear error messages with troubleshooting hints
- No data lost on errors (existing items preserved)

## API Integration Details

### RSS/Medium (No Auth)

- Public RSS feeds
- No API keys needed
- Rate limiting handled by feed providers

### GitLab (Personal Access Token)

```
Create at: Settings → Access Tokens
Required scopes: read_api
Token format: glpat-xxxxxxxxxxxxxxxxxxxx
```

### Bitbucket (App Password)

```
Create at: Settings → App passwords
Required permissions: repository:read
Auth: Basic authentication (username + app password)
```

## Migration Strategy

### Backward Compatibility

- Old `foliolab_repositories` storage key still supported
- Automatic migration to new `foliolab_portfolio_items` format
- Existing GitHub workflows unchanged
- New features optional, don't break existing users

### Data Migration

```typescript
// Automatic on first load
if (no portfolio items && has repositories) {
  migrate repositories to portfolio items
  mark all as source: 'github'
}
```

## Testing Recommendations

1. **GitHub Integration** - Ensure existing flow still works
2. **RSS Feeds** - Test with various blog platforms (WordPress, Ghost, etc.)
3. **Medium** - Verify with different username formats
4. **GitLab** - Test with personal and group projects
5. **Bitbucket** - Verify App Password authentication
6. **Free-form** - Test all content types and markdown
7. **Mixed Portfolio** - Combine multiple sources in one portfolio
8. **Error Handling** - Test with invalid URLs, expired tokens, etc.
9. **Storage** - Verify localStorage limits (usually ~5-10MB)

## Future Enhancements

### Potential Additional Sources

- LinkedIn (requires OAuth, API restrictions)
- Dev.to posts
- Hashnode articles
- YouTube videos
- Twitter/X threads
- StackOverflow profiles

### Planned Improvements

- Bulk import/export
- Source synchronization (auto-update)
- Custom RSS refresh intervals
- Portfolio item deduplication
- Search and filter by source
- Analytics on item engagement

## Dependencies Added

```json
{
  "dependencies": {
    "rss-parser": "^latest",  // RSS/Atom feed parsing
    "axios": "^latest"         // HTTP client for APIs
  }
}
```

## Files Modified/Created

### Created

- `server/lib/rss.ts`
- `server/lib/medium.ts`
- `server/lib/gitlab.ts`
- `server/lib/bitbucket.ts`
- `server/routes/sources.ts`
- `client/src/pages/data-sources.tsx`

### Modified

- `shared/schema.ts` - Added multi-source types
- `server/index.ts` - Registered new routes
- `client/src/lib/storage.ts` - Extended for multi-source
- `client/src/App.tsx` - Added data sources route
- `client/src/pages/repo-select.tsx` - Added navigation link
- `package.json` - Added dependencies

## Configuration

### Environment Variables

No new environment variables required. Existing variables still used:
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `OPENAI_API_KEY`

### User Credentials

Users provide their own:
- GitLab Personal Access Tokens
- Bitbucket App Passwords
- RSS feed URLs (public)

All stored client-side only.

## Support & Documentation

### User Documentation Needed

- How to create GitLab Personal Access Token
- How to create Bitbucket App Password
- RSS feed URL format examples
- Medium username extraction guide
- Privacy policy updates (if applicable)

### Developer Documentation

- API endpoint documentation
- Schema definitions
- Storage key conventions
- Error handling patterns

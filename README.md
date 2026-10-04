# FolioLab

![FolioLab](images/FolioLab-new.svg)

FolioLab is an AI-powered portfolio generation tool that transforms your GitHub repositories into beautiful, professional portfolios in minutes.

Create your portfolio using this link: https://foliolab.vercel.app/

## Organization websites

Use the [FolioLab GitHub Action](README-action.md) to build an organization website on GitHub Pages and refresh it on a schedule. The Action reuses saved summaries and runs without the hosted app. Start with the [configuration and deployment example](examples/organization-site).

## Demo
[![Watch the video](https://i.ytimg.com/vi/xvnSaZuMXu8/hqdefault.jpg)](https://youtu.be/xvnSaZuMXu8)


## Features

- Turn your GitHub repositories into a beautiful portfolio in minutes
- Choose which projects to showcase
- Generate AI-powered descriptions for your projects
- Auto deploy to Vercel/GitHub Pages with a single click
- Update your portfolio as many times as you want
- 100% free and open source, self-hosted or on Vercel
- Automatically skips forked and archived repositories

## Tech Stack

- **Frontend**: Vite + React + TypeScript
- **Backend**: Express.js + TypeScript
- **Styling**: Tailwind CSS + Shadcn UI
- **AI Integration**: OpenAI API (with Groq support)
- **GitHub Integration**: Octokit
- **Testing**: Vitest
- **Deployment**: Vercel, GitHub Pages

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Copy the example environment file and configure your values:
```bash
cp .env.example .env
```

Then edit `.env` with your actual values:
```env
# GitHub OAuth Configuration
VITE_GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# OpenAI API Configuration (for AI-powered descriptions)
OPENAI_API_KEY=your_openai_api_key

# Optional: Custom OpenAI API base URL (e.g., for proxy or alternative endpoints)
OPENAI_API_BASE_URL=https://api.openai.com/v1

# Optional: Custom OpenAI model (defaults to gpt-4o)
OPENAI_API_MODEL=gpt-4o
```

**⚠️ Security Note**: Never commit your `.env` file to version control. The `.env` file is already included in `.gitignore`.

To obtain GitHub OAuth credentials:
1. Go to GitHub Settings > Developer Settings > OAuth Apps
2. Create a new OAuth App
3. Set the Homepage URL to `http://localhost:5000`
4. Set the Authorization callback URL to `http://localhost:5000/auth/github`

4. Start the development server:
```bash
npm run dev
```

5. Visit `http://localhost:5000` in your browser

## OpenAI Configuration

FolioLab uses LLM to generate AI-powered descriptions for your repositories. You can customize the OpenAI configuration using the following environment variables:

### Required
- `OPENAI_API_KEY`: Your OpenAI API key

### Optional
- `OPENAI_API_BASE_URL`: Custom base URL for OpenAI API calls
  - Default: Uses OpenAI's default endpoint
  - Example: `https://your-proxy.com/` (for proxy servers or alternative endpoints)
  - Note: Should contain only the base URL, not the full endpoint path

- `OPENAI_API_MODEL`: The OpenAI model to use for generating descriptions
  - Default: `gpt-4o`
  - Examples: `gpt-4`, `gpt-3.5-turbo`, `gpt-4-turbo`

### Example Configuration
```env
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_API_MODEL=gpt-4o
```

### Option 2: Docker Deployment

1. Clone the repository:
```bash
git clone https://github.com/gojiplus/foliolab.git
cd foliolab
```

2. Create a `.env` file with your environment variables:
```env
GITHUB_CLIENT_ID=your_github_client_id
VITE_GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key
# Optional: Custom OpenAI API base URL (e.g., for proxy or alternative endpoints)
OPENAI_API_BASE_URL=https://api.openai.com/v1
# Optional: Custom OpenAI model (defaults to gpt-4o)
OPENAI_API_MODEL=gpt-4o
```

3. Build and run with Docker Compose:
```bash
docker-compose up -d
```

The application will be available at `http://localhost:5000`

To stop the container:
```bash
docker-compose down
```

## Testing

FolioLab includes a comprehensive test suite to ensure reliability and functionality. The tests are organized in a project-level `tests/` folder following TypeScript/Node.js best practices.

### Running Tests

```bash
# Run all tests once
npm run test:run

# Run tests in watch mode (automatically re-runs on file changes)
npm test

# Run tests with watch mode (alternative command)
npm run test:watch
```

### Test Structure

The test suite covers the core functionality of FolioLab:

- **`tests/readme-cleaner.test.ts`** - Tests for README content cleaning and badge removal
- **`tests/groq-response.test.ts`** - Tests for Groq API response handling and parsing
- **`tests/no-readme-handling.test.ts`** - Tests for project structure analysis when repositories lack README files
- **`tests/github-integration.test.ts`** - Tests for GitHub API integration and repository fetching
- **`tests/portfolio-generation.test.ts`** - Tests for portfolio HTML generation and theming
- **`tests/openai-integration.test.ts`** - Tests for OpenAI/LLM integration and summary generation
- **`tests/token-migration.test.ts`** - Tests for backward compatibility and token storage migration

### Test Framework

FolioLab uses [Vitest](https://vitest.dev/) as the testing framework, which provides:

- ✅ Fast execution with native TypeScript support
- ✅ Modern testing APIs (`describe`, `it`, `expect`)
- ✅ Excellent IDE integration and debugging
- ✅ Watch mode for development
- ✅ Coverage reporting capabilities

### Writing Tests

When contributing to FolioLab, please ensure:

1. **Add tests for new features** - All new functionality should include corresponding tests
2. **Follow the existing test structure** - Use `describe` blocks for grouping related tests
3. **Mock external dependencies** - Use mocks for GitHub API, OpenAI API, and other external services
4. **Test edge cases** - Include tests for error conditions and boundary cases
5. **Keep tests focused** - Each test should verify a single piece of functionality

### Test Coverage

The test suite covers:

- ✅ GitHub repository fetching and analysis
- ✅ README content processing and cleaning
- ✅ AI-powered summary generation
- ✅ Project structure analysis for repositories without README
- ✅ Portfolio HTML generation with different themes
- ✅ Error handling and edge cases
- ✅ API response parsing and validation

### Continuous Integration

Tests are automatically run in CI/CD pipelines to ensure code quality and prevent regressions.

## Security

FolioLab follows security best practices to protect your data and API keys:

### Environment Variables
- **Never commit `.env` files** - All sensitive configuration is stored in environment variables
- **Use `.env.example`** - Reference file showing required environment variables without exposing actual values
- **Secure API key storage** - All API keys (GitHub, OpenAI, Vercel) are stored as environment variables

### API Key Security
- **Server-side only** - API keys are only used on the server side, never exposed to the client
- **Environment variable validation** - The application validates that required API keys are present before starting
- **No hardcoded credentials** - All authentication credentials are externalized to environment variables

### GitHub OAuth
- **Secure OAuth flow** - Uses GitHub's official OAuth 2.0 flow for authentication
- **Limited scope** - Only requests necessary permissions for repository access
- **Token storage** - GitHub tokens are stored securely in browser localStorage (client-side only)

### Best Practices
- **Input validation** - All user inputs are validated and sanitized
- **Error handling** - Sensitive information is not exposed in error messages
- **CORS configuration** - Proper CORS settings for production deployments
- **Environment separation** - Clear separation between development and production configurations

### Reporting Security Issues
If you discover a security vulnerability, please report it responsibly by emailing the maintainers directly rather than opening a public issue.
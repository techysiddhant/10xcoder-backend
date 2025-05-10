# 10xCoder Backend

A robust backend system for the 10xCoder platform built with high-performance technologies for modern web applications.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftechysiddhant%2F10xcoder-backend)

## 🚀 Tech Stack

- **Runtime:** Node.js
- **Framework:** [Hono](https://hono.dev/) (lightweight, high-performance web framework)
- **Database:** PostgreSQL
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/) (TypeScript-first ORM)
- **Authentication:** [Better Auth](https://better-auth.com/)
- **Redis:** [Upstash Redis](https://upstash.com/) (serverless Redis)
- **Queue System:** [Upstash QStash](https://upstash.com/docs/qstash) (serverless message queue)
- **Email Provider:** [Resend](https://resend.com/)
- **Deployment:** [Vercel](https://vercel.com/) (serverless deployment)

## 📋 Prerequisites

- Node.js 18.x or higher
- PostgreSQL database
- Upstash account (for Redis and QStash)
- Resend account (for emails)
- Better Auth account

## 🛠️ Getting Started

### Clone the repository

```bash
git clone https://github.com/techysiddhant/10xcoder-backend.git
cd 10xcoder-backend
```

### Install dependencies

```bash
pnpm install
```

We only use pnpm as the package manager for this project.

### Environment Setup

Create a `.env` file in the root directory based on the provided `.env.example` file:

```bash
# Copy the example env file and update with your configurations
cp .env.example .env
```

Make sure to fill in all the required environment variables before running the application.

### Database Setup

Run the database migrations:

```bash
pnpm db:migrate
```

### Start Development Server

```bash
pnpm dev
```

This will start the development server on `http://localhost:8787` by default.

## 📦 Project Structure

```
├── src/
│   ├── routes/       # API routes
│   ├── db/           # Database models and migrations
│   ├── emails/       # Email templates and sending logic
│   ├── middlewares/  # Custom middleware
│   ├── lib/          # library functions 
│   └── index.ts      # Main entry point
├── .env.example      # Example environment variables
├── package.json
└── README.md
```

## 🔄 API Endpoints

### API Documentation

- **API Documentation:** `/reference`
- **Auth API Documentation:** `/api/auth/reference`

These endpoints provide interactive documentation for all available API endpoints in the system.


## 🤝 Contributing

We welcome contributions to the 10xCoder Backend! Please follow these steps:

1. **Fork the repository**
   - Click the "Fork" button at the top right of the repository page on GitHub

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR-USERNAME/10xcoder-backend.git
   cd 10xcoder-backend
   ```

3. **Create a branch for your feature**
   ```bash
   git checkout -b feature/amazing-feature
   ```

4. **Make your changes**
   - Implement your feature or bug fix
   - Add or update tests as necessary
   - Ensure your code follows the project's style guidelines

5. **Commit your changes**
   - Follow the commit message guidelines (see below)
   ```bash
   git commit -m "feat(component): add amazing feature"
   ```

6. **Push to your branch**
   ```bash
   git push origin feature/amazing-feature
   ```

7. **Open a Pull Request**
   - Go to the original repository on GitHub
   - Click "New Pull Request"
   - Select your fork and branch
   - Add a description of your changes
   - Submit the pull request for review

### Development Guidelines

- Follow the established code style and patterns
- Write tests for new features
- Update documentation as needed
- Keep pull requests focused on a single concern

### Commit Message Guidelines

We use [commitlint](https://commitlint.js.org/) to enforce consistent commit messages. All commit messages should follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

Format: `<type>(<scope>): <subject>`

#### Types
- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools and libraries

#### Examples

```
feat(auth): add email verification
fix(api): resolve CORS policy issue
docs(readme): update deployment instructions
refactor(db): optimize user queries
test(api): add tests for user endpoints
```

These commit conventions help in automatically generating changelogs and determining semantic version bumps.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📧 Contact

If you have any questions or suggestions, please open an issue on GitHub or contact the maintainers:

- Siddhant - [@techysiddhant](https://github.com/techysiddhant)
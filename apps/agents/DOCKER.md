# Docker Setup for Open Canvas Agents

This directory contains Docker configuration files for the Open Canvas Agents application.

## Files

- `Dockerfile` - Standard Dockerfile for building the agents application
- `Dockerfile.monorepo` - Dockerfile designed to be run from the project root
- `docker-compose.yml` - Docker Compose configuration for easy development
- `.dockerignore` - Files to ignore during Docker build

## Prerequisites

1. Docker and Docker Compose installed
2. Environment variables configured (copy `.env.example` to `.env` in the project root)

## Building and Running

### Option 1: Using Docker Compose (Recommended for Development)

From the `apps/agents` directory:

```bash
# Start in development mode
docker-compose up agents

# Start in production mode
docker-compose up agents-prod

# Build and start in detached mode
docker-compose up -d agents
```

### Option 2: Using Docker directly

From the `apps/agents` directory:

```bash
# Build the image
docker build -t opencanvas-agents .

# Run development container
docker run -p 54367:54367 --env-file ../../.env opencanvas-agents

# Run production container
docker run -p 54367:54367 --env-file ../../.env opencanvas-agents:production
```

### Option 3: Using the Monorepo Dockerfile

From the project root directory:

```bash
# Build from project root
docker build -f apps/agents/Dockerfile.monorepo -t opencanvas-agents .

# Run the container
docker run -p 54367:54367 --env-file .env opencanvas-agents
```

## Environment Variables

Make sure to set up your environment variables in the `.env` file at the project root. Required variables include:

- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` - For LLM providers
- `LANGSMITH_API_KEY` - For LangSmith tracing (optional)
- `SUPABASE_*` - Supabase configuration
- `FIRECRAWL_API_KEY` - For web scraping capabilities

## Port

The application runs on port `54367` by default, as configured in the LangGraph setup.

## Health Check

The Docker containers include health checks that verify the application is running properly.

## Security Notes

- The production containers run as a non-root user for better security
- Security updates are applied during the build process
- Sensitive files are excluded via `.dockerignore`

## Troubleshooting

1. **Build fails**: Ensure all dependencies are properly installed and the build context is correct
2. **Container won't start**: Check that all required environment variables are set
3. **Port conflicts**: Make sure port 54367 is not already in use
4. **Permission issues**: The container runs as user `opencanvas` (UID 1001)

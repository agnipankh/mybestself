# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

**MyBestSelf** is a full-stack agentic application that helps users create the best version of themselves through persona-driven goal setting and habit tracking.

### Tech Stack
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **Authentication**: Magic link authentication via email
- **AI Integration**: OpenAI API for conversational agents
- **Database**: PostgreSQL with Docker setup
- **Email**: Mailpit for development email testing

### Architecture Overview
- **Backend**: RESTful API with database models for users, personas, conversations, and magic links
- **Frontend**: React-based Next.js app with agent-driven conversation system
- **Agent System**: Multiple specialized agents (Educational, Discovery, Refinement, Management) handle different conversation types
- **Authentication Flow**: Email-based magic link system without traditional passwords

## Development Commands

### Backend (FastAPI)
```bash
cd backend
uvicorn mvp_step1_onboarding:app --reload  # Start development server
make test                                   # Run all tests with coverage
make test-fast                             # Run tests without coverage
make test-unit                             # Run unit tests only
make test-functional                       # Run API functional tests
make test-auth                             # Run authentication tests
make lint                                  # Run code linting
make format                                # Format code with black/isort
python run_tests.py                       # Alternative test runner
```

### Frontend (Next.js)
```bash
cd frontend
npm run dev                                # Start development server
npm run build                             # Build for production
npm run lint                              # Run ESLint
```

### Infrastructure
```bash
docker-compose up -d                      # Start PostgreSQL + Mailpit
docker ps                                 # Check running containers
```

## Key Components

### Backend Models
- **User**: Core user entity with email-based authentication
- **Persona**: User's different life aspects/roles they want to develop
- **Conversation**: Stores full conversation history and insights as JSONB
- **MagicLink**: Handles passwordless authentication tokens

### Frontend Agent System
Located in `frontend/services/conversation/`:
- **ConversationManager**: Orchestrates agent selection and conversation flow
- **BaseAgent**: Abstract base class for all conversation agents
- **EducationalAgent**: Helps users understand concepts and personas
- **DiscoveryAgent**: Assists in self-discovery and persona identification  
- **RefinementAgent**: Helps refine and improve existing personas
- **ManagementAgent**: Handles practical goal and habit management

### API Endpoints
- Authentication: Magic link generation and validation
- User management: CRUD operations for users
- Persona management: Create and manage user personas
- Conversation: Store and retrieve conversation history
- OpenAI integration: `/api/openai-chat` for AI conversations

## Testing

### Backend Testing
- Comprehensive test suite with pytest
- Uses SQLAlchemy fixtures for clean test isolation
- Test categories: unit, functional, authentication, integration
- Coverage reporting with HTML output
- CI/CD ready with GitHub Actions support

### Test Database
- Development: PostgreSQL via Docker
- Testing: SQLite in-memory (default) or PostgreSQL for integration tests
- Mailpit available at `http://localhost:8025` for email testing

## Development Workflow

1. **Backend Changes**: 
   - Start with unit tests in `backend/tests/`
   - Use `make test` to ensure all tests pass
   - Models are in `backend/models.py`
   - Main application logic in `backend/mvp_step1_onboarding.py`

2. **Frontend Changes**:
   - Agent logic goes in `frontend/services/conversation/agents/`
   - UI components in `frontend/components/`
   - API integration via `frontend/services/apiClient.ts`

3. **Database Changes**:
   - Modify models in `backend/models.py`
   - Consider migration impact on existing data
   - Update tests accordingly

## Important Notes

- The conversation system stores full message history as JSONB for flexibility
- Magic link authentication expires and can only be used once
- Agent system is designed to be extensible - new agent types can be easily added
- Frontend uses TypeScript with strict typing
- Backend follows FastAPI patterns with dependency injection
- All tests should maintain >80% coverage
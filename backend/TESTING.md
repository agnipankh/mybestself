# Backend Testing Guide

This document explains how to set up and run tests for the FastAPI backend application.

## 📋 Test Overview

Our test suite includes:

- **Unit Tests** (`test_models.py`) - Test SQLAlchemy models and database functionality
- **API Functional Tests** (`test_api_endpoints.py`) - Test FastAPI endpoints end-to-end
- **Authentication Tests** (`test_auth_endpoints.py`) - Test magic link authentication flow
- **Integration Tests** - Test complete workflows across components

## 🔧 Setup

### 1. Install Dependencies

```bash
# Install main dependencies
pip install -r requirements.txt

# Install test dependencies
pip install -r test-requirements.txt
```

### 2. Start Required Services

```bash
# Start PostgreSQL and Mailpit using Docker
docker-compose up -d

# Verify services are running
docker ps
```

### 3. Environment Variables

The tests will automatically use appropriate test configurations, but you can override:

```bash
export TEST_DATABASE_URL="sqlite:///./test.db"  # Default: SQLite for speed
export SMTP_HOST="localhost"
export SMTP_PORT="1025"
```

## 🚀 Running Tests

### Quick Start

```bash
# Run all tests
make test

# Or use the Python runner
python run_tests.py

# Or use pytest directly
pytest
```

### Specific Test Types

```bash
# Unit tests only
make test-unit
python run_tests.py unit
pytest tests/test_models.py

# API functional tests
make test-functional
python run_tests.py api
pytest tests/test_api_endpoints.py

# Authentication tests
make test-auth
python run_tests.py auth
pytest tests/test_auth_endpoints.py

# Fast tests (no coverage)
make test-fast
python run_tests.py fast
pytest --no-cov
```

### Advanced Options

```bash
# Run with coverage report
pytest --cov=. --cov-report=html

# Run specific test
pytest tests/test_models.py::TestUserModel::test_user_creation

# Run tests matching pattern
pytest -k "test_user"

# Run tests with specific marker
pytest -m "unit"

# Run tests in parallel
pytest -n auto

# Generate HTML report
pytest --html=reports/test-report.html
```

## 📊 Coverage

The test suite aims for 80%+ code coverage. After running tests with coverage:

```bash
# View coverage in terminal
pytest --cov=. --cov-report=term-missing

# Generate HTML report
pytest --cov=. --cov-report=html
open htmlcov/index.html
```

## 🏗️ Test Structure

```
project-root/
├── backend/
│   ├── test-requirements.txt
│   ├── pytest.ini  
│   ├── Makefile
│   ├── run_tests.py
│   ├── TESTING.md
│   └── tests/
│       ├── conftest.py
│       ├── test_models.py
│       ├── test_api_endpoints.py
│       ├── test_auth_endpoints.py
│       └── __init__.py
├── frontend/
│   └── ... (Next.js stuff)
└── .github/
    └── workflows/
        └── test.yml
```

### Key Fixtures

- `test_db` - Fresh database session for each test
- `client` - FastAPI test client with database override
- `created_user` - Pre-created user for testing
- `created_persona` - Pre-created persona for testing
- `valid_magic_link` - Valid magic link for auth testing
- `mock_smtp` - Mock SMTP server for email testing

## 🔒 Test Database

Tests use an isolated test database to avoid affecting your development data:

- **Default**: SQLite in-memory database (fastest)
- **Optional**: PostgreSQL test database for full integration

### PostgreSQL Test Database

```bash
# Create test database
createdb test_mvp_app

# Set environment variable
export TEST_DATABASE_URL="postgresql+psycopg2://postgres:secret@localhost:5432/test_mvp_app"
```

## 🤖 CI/CD Pipeline

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests

### GitHub Actions Workflow

The workflow (`.github/workflows/test.yml`) includes:

1. **Matrix Testing** - Python 3.9, 3.10, 3.11
2. **Service Dependencies** - PostgreSQL and Mailpit
3. **Linting** - Code quality checks
4. **Test Execution** - All test suites
5. **Coverage Reporting** - Codecov integration
6. **Security Scanning** - Bandit and Safety
7. **Performance Testing** - Benchmark tests

### Local CI Simulation

```bash
# Run tests as they would in CI
make test-ci

# With exact CI environment
pytest --cov=. --cov-report=xml --tb=short
```

## 📝 Writing Tests

### Test Organization

- **Unit Tests**: Test individual functions/methods in isolation
- **Functional Tests**: Test API endpoints end-to-end
- **Integration Tests**: Test workflows across multiple components

### Best Practices

1. **Use Fixtures**: Leverage conftest.py fixtures for common setup
2. **Descriptive Names**: Test names should describe what they test
3. **Single Responsibility**: Each test should test one specific behavior
4. **Independent Tests**: Tests should not depend on each other
5. **Clean State**: Use fresh database sessions for each test

### Example Test

```python
def test_create_user_success(client, sample_user_data):
    """Test successful user creation via API"""
    response = client.post("/users/", json=sample_user_data)
    
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == sample_user_data["email"]
    assert "id" in data
```

## 🐛 Debugging Tests

### Running Individual Tests

```bash
# Run specific test with verbose output
pytest tests/test_models.py::TestUserModel::test_user_creation -v -s

# Run with debugger
pytest --pdb tests/test_models.py::TestUserModel::test_user_creation

# Run with print statements visible
pytest -s tests/test_models.py
```

### Common Issues

1. **Database Connection Errors**
   - Ensure PostgreSQL is running: `docker-compose up -d`
   - Check connection string in environment variables

2. **Import Errors**
   - Ensure all dependencies are installed: `pip install -r test-requirements.txt`
   - Check Python path includes your project directory

3. **Test Isolation Issues**
   - Tests should use `test_db` fixture for clean state
   - Avoid sharing state between tests

### Logging

```python
# Add logging to tests
import logging
logging.basicConfig(level=logging.DEBUG)

def test_something(client):
    logging.debug("Starting test")
    # test code
```

## 📈 Performance

### Test Performance Tips

- Use SQLite for unit tests (faster)
- Use PostgreSQL for integration tests (more realistic)
- Run tests in parallel: `pytest -n auto`
- Use test markers to run subsets: `pytest -m "not slow"`

### Benchmarking

```bash
# Install benchmark plugin
pip install pytest-benchmark

# Run performance tests
pytest --benchmark-only
```

## 🔍 Code Quality

### Linting

```bash
# Run linting checks
make lint

# Fix automatically fixable issues
black .
isort .
```

### Security

```bash
# Security scanning
bandit -r .
safety check
```

## 📚 Additional Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [SQLAlchemy Testing](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html#joining-a-session-into-an-external-transaction-such-as-for-test-suites)

## 🆘 Getting Help

If you encounter issues:

1. Check this documentation
2. Run `python run_tests.py --help` for options
3. Look at test output and error messages
4. Check CI logs for examples
5. Review existing tests for patterns

## 📋 Checklist for New Features

When adding new features, ensure:

- [ ] Unit tests for new models/functions
- [ ] Functional tests for new API endpoints
- [ ] Integration tests for complete workflows
- [ ] Error handling tests
- [ ] Authentication tests if applicable
- [ ] Documentation updates
- [ ] Coverage maintained above 80%

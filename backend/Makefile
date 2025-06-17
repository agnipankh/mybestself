# Makefile - Test automation commands for CI/CD

.PHONY: help install test test-unit test-functional test-auth test-ci test-coverage clean lint format setup-test-db

# Default target
help:
    @echo "Available targets:"
    @echo "  install       - Install all dependencies"
    @echo "  test          - Run all tests"
    @echo "  test-unit     - Run unit tests only"
    @echo "  test-functional - Run functional tests only"
    @echo "  test-auth     - Run authentication tests only"
    @echo "  test-ci       - Run tests in CI mode (no coverage HTML)"
    @echo "  test-coverage - Generate coverage report"
    @echo "  test-fast     - Run tests without coverage"
    @echo "  lint          - Run code linting"
    @echo "  format        - Format code"
    @echo "  setup-test-db - Set up test database"
    @echo "  clean         - Clean test artifacts"

# Install dependencies
install:
    pip install -r requirements.txt
    pip install -r test-requirements.txt

# Run all tests with coverage
test:
    pytest --cov=. --cov-report=html --cov-report=term-missing

# Run unit tests only
test-unit:
    pytest tests/test_models.py -m "unit or not functional"

# Run functional tests only
test-functional:
    pytest tests/test_api_endpoints.py -m "functional"

# Run authentication tests only
test-auth:
    pytest tests/test_auth_endpoints.py -m "auth"

# Run tests for CI (no HTML coverage, XML output)
test-ci:
    pytest --cov=. --cov-report=xml --cov-report=term --tb=short

# Generate coverage report
test-coverage:
    pytest --cov=. --cov-report=html
    @echo "Coverage report generated in htmlcov/"

# Run tests without coverage (faster)
test-fast:
    pytest --no-cov

# Run specific test file
test-file:
    @read -p "Enter test file name: " file; \
    pytest tests/$$file

# Run tests with specific marker
test-marker:
    @read -p "Enter marker name: " marker; \
    pytest -m $$marker

# Run tests in parallel
test-parallel:
    pytest -n auto

# Setup test database (PostgreSQL)
setup-test-db:
    docker-compose up -d db
    sleep 5
    @echo "Test database is ready"

# Code linting
lint:
    flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
    flake8 . --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics

# Code formatting
format:
    black .
    isort .

# Clean test artifacts
clean:
    rm -rf .pytest_cache/
    rm -rf htmlcov/
    rm -rf .coverage
    rm -rf coverage.xml
    find . -type d -name __pycache__ -exec rm -rf {} +
    find . -type f -name "*.pyc" -delete
    find . -type f -name "test.db" -delete

# Watch mode for development
test-watch:
    pytest-watch -- --tb=short

# Test with specific Python version
test-py39:
    python3.9 -m pytest

test-py310:
    python3.10 -m pytest

test-py311:
    python3.11 -m pytest

# Performance profiling of tests
test-profile:
    pytest --profile

# Generate test report
test-report:
    pytest --html=reports/report.html --self-contained-html

# Security tests
test-security:
    bandit -r . -f json -o security-report.json || true
    safety check --json --output security-deps.json || true

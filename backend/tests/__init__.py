# tests/__init__.py - Tests package initialization

"""
Backend Tests Package

This package contains all tests for the FastAPI backend application.

Test Structure:
- test_models.py: Unit tests for SQLAlchemy models
- test_api_endpoints.py: Functional tests for API endpoints
- test_auth_endpoints.py: Authentication flow tests
- conftest.py: Test configuration and fixtures

Usage:
    pytest                    # Run all tests
    pytest tests/test_models.py  # Run specific test file
    python run_tests.py       # Use test runner script
"""

__version__ = "1.0.0"

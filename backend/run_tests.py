#!/usr/bin/env python3
# run_tests.py - Local test runner script

import os
import sys
import subprocess
import argparse
from pathlib import Path

def run_command(command, description=""):
    """Run a command and handle errors"""
    print(f"\n{'='*50}")
    print(f"Running: {description or command}")
    print(f"{'='*50}")
    
    result = subprocess.run(command, shell=True, capture_output=False)
    if result.returncode != 0:
        print(f"❌ Command failed: {command}")
        return False
    else:
        print(f"✅ Command succeeded: {command}")
        return True

def check_dependencies():
    """Check if required dependencies are installed"""
    print("🔍 Checking dependencies...")
    
    try:
        import pytest
        import fastapi
        import sqlalchemy
        print("✅ All required dependencies found")
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Run: pip install -r test-requirements.txt")
        return False

def setup_environment():
    """Set up test environment variables"""
    print("🔧 Setting up test environment...")
    
    # Set test database URL if not already set
    if not os.getenv('TEST_DATABASE_URL'):
        os.environ['TEST_DATABASE_URL'] = 'sqlite:///./test.db'
    
    # Set other test environment variables
    os.environ['SMTP_HOST'] = 'localhost'
    os.environ['SMTP_PORT'] = '1025'
    os.environ['APP_URL'] = 'http://localhost:3000'
    
    print("✅ Environment variables set")

def run_tests(test_type="all", coverage=True, verbose=True):
    """Run the specified tests"""
    base_cmd = "pytest"
    
    # Add verbosity
    if verbose:
        base_cmd += " -v"
    
    # Add coverage
    if coverage:
        base_cmd += " --cov=. --cov-report=html --cov-report=term-missing"
    
    # Determine which tests to run
    if test_type == "unit":
        cmd = f"{base_cmd} tests/test_models.py"
        description = "Unit Tests (Models)"
    elif test_type == "api":
        cmd = f"{base_cmd} tests/test_api_endpoints.py"
        description = "API Functional Tests"
    elif test_type == "auth":
        cmd = f"{base_cmd} tests/test_auth_endpoints.py"
        description = "Authentication Tests"
    elif test_type == "fast":
        cmd = f"{base_cmd} --no-cov tests/"
        description = "All Tests (No Coverage)"
    else:  # all
        cmd = f"{base_cmd} tests/"
        description = "All Tests"
    
    return run_command(cmd, description)

def run_linting():
    """Run code linting"""
    print("🔍 Running code linting...")
    
    commands = [
        ("flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics", "Critical linting errors"),
        ("flake8 . --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics", "All linting checks")
    ]
    
    all_passed = True
    for cmd, desc in commands:
        if not run_command(cmd, desc):
            all_passed = False
    
    return all_passed

def check_docker_services():
    """Check if Docker services are running"""
    print("🐳 Checking Docker services...")
    
    try:
        # Check if PostgreSQL is running
        result = subprocess.run(
            "docker ps --filter name=mvp-db --format '{{.Names}}'", 
            shell=True, 
            capture_output=True, 
            text=True
        )
        
        if "mvp-db" in result.stdout:
            print("✅ PostgreSQL container is running")
            return True
        else:
            print("⚠️  PostgreSQL container not running. Starting services...")
            if run_command("docker-compose up -d", "Starting Docker services"):
                print("✅ Docker services started")
                return True
            else:
                print("❌ Failed to start Docker services")
                return False
                
    except subprocess.SubprocessError:
        print("⚠️  Docker not available, using SQLite for tests")
        return False

def main():
    parser = argparse.ArgumentParser(description="Run backend tests")
    parser.add_argument(
        "test_type", 
        nargs="?", 
        default="all",
        choices=["all", "unit", "api", "auth", "fast"],
        help="Type of tests to run"
    )
    parser.add_argument("--no-coverage", action="store_true", help="Skip coverage reporting")
    parser.add_argument("--no-lint", action="store_true", help="Skip linting")
    parser.add_argument("--quiet", action="store_true", help="Reduce output verbosity")
    parser.add_argument("--setup-only", action="store_true", help="Only setup environment, don't run tests")
    
    args = parser.parse_args()
    
    print("🚀 Backend Test Runner")
    print("=" * 50)
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Setup environment
    setup_environment()
    
    # Check Docker services (optional)
    check_docker_services()
    
    if args.setup_only:
        print("✅ Environment setup complete")
        sys.exit(0)
    
    success = True
    
    # Run linting if requested
    if not args.no_lint:
        if not run_linting():
            print("⚠️  Linting issues found, but continuing with tests...")
    
    # Run tests
    if not run_tests(
        test_type=args.test_type,
        coverage=not args.no_coverage,
        verbose=not args.quiet
    ):
        success = False
    
    # Final summary
    print("\n" + "=" * 50)
    if success:
        print("🎉 All tests completed successfully!")
        if not args.no_coverage:
            print("📊 Coverage report available in htmlcov/index.html")
    else:
        print("❌ Some tests failed. Check the output above.")
    print("=" * 50)
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()

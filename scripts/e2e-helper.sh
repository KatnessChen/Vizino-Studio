#!/bin/bash

# AI E2E Test Workflow Helper Script
# This script helps you work with the AI-powered E2E test automation

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🤖 AI E2E Test Workflow Helper${NC}"
echo ""

# Function to check if dependencies are installed
check_dependencies() {
    echo "Checking dependencies..."
    
    if ! command -v pnpm &> /dev/null; then
        echo -e "${YELLOW}⚠️  pnpm is not installed. Installing...${NC}"
        npm install -g pnpm@8.0.0
    else
        echo -e "${GREEN}✅ pnpm is installed${NC}"
    fi
    
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}⚠️  Dependencies not installed. Running pnpm install...${NC}"
        pnpm install --no-frozen-lockfile
    else
        echo -e "${GREEN}✅ Dependencies are installed${NC}"
    fi
}

# Function to install Playwright browsers
install_browsers() {
    echo -e "${BLUE}Installing Playwright browsers...${NC}"
    pnpm exec playwright install --with-deps
    echo -e "${GREEN}✅ Playwright browsers installed${NC}"
}

# Function to run tests
run_tests() {
    echo -e "${BLUE}Running E2E tests...${NC}"
    pnpm run test:e2e
}

# Function to run tests in UI mode
run_tests_ui() {
    echo -e "${BLUE}Running E2E tests in UI mode...${NC}"
    pnpm run test:e2e:ui
}

# Function to show help
show_help() {
    echo "Usage: ./scripts/e2e-helper.sh [command]"
    echo ""
    echo "Commands:"
    echo "  setup           - Check and install all dependencies"
    echo "  install-browsers - Install Playwright browsers"
    echo "  test            - Run E2E tests"
    echo "  test-ui         - Run E2E tests in UI mode"
    echo "  help            - Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/e2e-helper.sh setup"
    echo "  ./scripts/e2e-helper.sh test"
    echo ""
}

# Main script logic
case "${1:-help}" in
    setup)
        check_dependencies
        install_browsers
        echo ""
        echo -e "${GREEN}✅ Setup complete! You can now run tests with:${NC}"
        echo -e "   ${BLUE}pnpm run test:e2e${NC}"
        ;;
    install-browsers)
        install_browsers
        ;;
    test)
        run_tests
        ;;
    test-ui)
        run_tests_ui
        ;;
    help)
        show_help
        ;;
    *)
        echo -e "${YELLOW}Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac

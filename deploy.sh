#!/bin/bash
# Deployment script for Travel Tracker
# This script handles deployment to local or remote hosts

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VERSION=${VERSION:-latest}
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.prod.yml}
ENV_FILE=${ENV_FILE:-.env.production}
REMOTE_HOST=${REMOTE_HOST:-}
REMOTE_USER=${REMOTE_USER:-}
REMOTE_PATH=${REMOTE_PATH:-/opt/travel-tracker}

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          Travel Tracker - Deployment Script                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Function to print section headers
print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to check if command succeeded
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1${NC}"
        return 0
    else
        echo -e "${RED}✗ $1${NC}"
        return 1
    fi
}

# Parse command line arguments
DEPLOY_MODE="local"
while [[ $# -gt 0 ]]; do
    case $1 in
        --remote)
            DEPLOY_MODE="remote"
            REMOTE_HOST="$2"
            shift 2
            ;;
        --user)
            REMOTE_USER="$2"
            shift 2
            ;;
        --path)
            REMOTE_PATH="$2"
            shift 2
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        --env-file)
            ENV_FILE="$2"
            shift 2
            ;;
        --help)
            echo "Usage: ./deploy.sh [OPTIONS]"
            echo ""
            echo "Deployment Modes:"
            echo "  Local deployment (default):"
            echo "    ./deploy.sh"
            echo ""
            echo "  Remote deployment:"
            echo "    ./deploy.sh --remote <host> --user <username> [--path <remote-path>]"
            echo ""
            echo "Options:"
            echo "  --remote <host>        Deploy to remote host (SSH)"
            echo "  --user <username>      SSH username for remote deployment"
            echo "  --path <path>          Remote deployment path (default: /opt/travel-tracker)"
            echo "  --version <version>    Deployment version (default: latest)"
            echo "  --env-file <file>      Environment file (default: .env.production)"
            echo "  --help                 Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./deploy.sh                                           # Local deployment"
            echo "  ./deploy.sh --version 1.0.0                          # Deploy version 1.0.0 locally"
            echo "  ./deploy.sh --remote myserver.com --user ubuntu     # Deploy to remote server"
            echo "  ./deploy.sh --remote 192.168.1.100 --user admin --path /home/admin/app"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Run './deploy.sh --help' for usage information"
            exit 1
            ;;
    esac
done

# Validate remote deployment requirements
if [ "$DEPLOY_MODE" = "remote" ]; then
    if [ -z "$REMOTE_HOST" ]; then
        echo -e "${RED}✗ Remote host not specified${NC}"
        echo "Use: ./deploy.sh --remote <host> --user <username>"
        exit 1
    fi
    if [ -z "$REMOTE_USER" ]; then
        echo -e "${RED}✗ Remote user not specified${NC}"
        echo "Use: ./deploy.sh --remote <host> --user <username>"
        exit 1
    fi
fi

print_header "Deployment Configuration"
echo "Mode:            ${DEPLOY_MODE}"
echo "Version:         ${VERSION}"
echo "Compose File:    ${COMPOSE_FILE}"
echo "Environment:     ${ENV_FILE}"
if [ "$DEPLOY_MODE" = "remote" ]; then
    echo "Remote Host:     ${REMOTE_USER}@${REMOTE_HOST}"
    echo "Remote Path:     ${REMOTE_PATH}"
fi

# Check prerequisites
print_header "Checking Prerequisites"

if [ ! -f "${COMPOSE_FILE}" ]; then
    echo -e "${RED}✗ ${COMPOSE_FILE} not found${NC}"
    exit 1
fi
check_status "Compose file exists"

if [ ! -f "${ENV_FILE}" ]; then
    echo -e "${YELLOW}⚠ ${ENV_FILE} not found${NC}"
    echo "Creating from example..."
    if [ -f ".env.production.example" ]; then
        cp .env.production.example ${ENV_FILE}
        echo -e "${YELLOW}⚠ Please edit ${ENV_FILE} with your production credentials${NC}"
        echo "Press Enter when ready to continue, or Ctrl+C to cancel"
        read
    else
        echo -e "${RED}✗ .env.production.example not found${NC}"
        exit 1
    fi
fi
check_status "Environment file exists"

# Local deployment
if [ "$DEPLOY_MODE" = "local" ]; then
    print_header "Local Deployment"
    
    # Check Docker
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}✗ Docker is not running${NC}"
        exit 1
    fi
    check_status "Docker is running"
    
    # Pull images if using a registry
    print_header "Pulling Images"
    export VERSION=${VERSION}
    docker-compose -f ${COMPOSE_FILE} pull || echo -e "${YELLOW}⚠ Could not pull images (using local builds)${NC}"
    
    # Stop existing containers
    print_header "Stopping Existing Containers"
    docker-compose -f ${COMPOSE_FILE} down || true
    check_status "Containers stopped"
    
    # Start services
    print_header "Starting Services"
    docker-compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} up -d --remove-orphans
    check_status "Services started"
    
    # Wait for services to be healthy
    print_header "Waiting for Services"
    echo "This may take up to 60 seconds..."
    sleep 10
    
    # Check service health
    print_header "Service Health Check"
    docker-compose -f ${COMPOSE_FILE} ps
    
    # Show logs
    echo ""
    echo "To view logs:"
    echo "  docker-compose -f ${COMPOSE_FILE} logs -f"
    echo ""
    echo "To check status:"
    echo "  docker-compose -f ${COMPOSE_FILE} ps"
    echo ""
    echo "Application should be available at:"
    echo "  http://localhost:80"
    
# Remote deployment
else
    print_header "Remote Deployment"
    
    # Test SSH connection
    echo "Testing SSH connection..."
    if ! ssh -o ConnectTimeout=10 ${REMOTE_USER}@${REMOTE_HOST} "echo 'Connection successful'" > /dev/null 2>&1; then
        echo -e "${RED}✗ Cannot connect to ${REMOTE_USER}@${REMOTE_HOST}${NC}"
        echo "Please check:"
        echo "  1. SSH keys are set up"
        echo "  2. Host is reachable"
        echo "  3. Username is correct"
        exit 1
    fi
    check_status "SSH connection successful"
    
    # Create remote directory
    echo "Creating remote directory..."
    ssh ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${REMOTE_PATH}"
    check_status "Remote directory created"
    
    # Copy files
    print_header "Copying Files"
    echo "Copying docker-compose.prod.yml..."
    scp ${COMPOSE_FILE} ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/
    check_status "Compose file copied"
    
    echo "Copying environment file..."
    scp ${ENV_FILE} ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/.env
    check_status "Environment file copied"
    
    # Deploy on remote
    print_header "Deploying on Remote Host"
    ssh ${REMOTE_USER}@${REMOTE_HOST} << EOF
        cd ${REMOTE_PATH}
        
        echo "Pulling images..."
        export VERSION=${VERSION}
        docker-compose -f ${COMPOSE_FILE} pull
        
        echo "Stopping existing containers..."
        docker-compose -f ${COMPOSE_FILE} down
        
        echo "Starting services..."
        docker-compose -f ${COMPOSE_FILE} up -d --remove-orphans
        
        echo ""
        echo "Waiting for services to start..."
        sleep 10
        
        echo ""
        echo "Service status:"
        docker-compose -f ${COMPOSE_FILE} ps
EOF
    
    check_status "Remote deployment complete"
    
    echo ""
    echo "To view logs on remote host:"
    echo "  ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ${REMOTE_PATH} && docker-compose -f ${COMPOSE_FILE} logs -f'"
    echo ""
    echo "Application should be available at:"
    echo "  http://${REMOTE_HOST}:80"
fi

# Success message
print_header "Deployment Complete"
echo -e "${GREEN}✓ Deployment successful!${NC}"
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                  Deployment Complete! 🚀                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"

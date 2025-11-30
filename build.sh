#!/bin/bash
# Build script for Travel Tracker Docker images
# This script builds all Docker images for production deployment

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VERSION=${VERSION:-latest}
REGISTRY=${REGISTRY:-}  # Optional: docker.io/username or registry.example.com
NO_CACHE=${NO_CACHE:-false}
PUSH=${PUSH:-false}

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          Travel Tracker - Docker Build Script                 ║"
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
        echo -e "${GREEN}✓ $1 successful${NC}"
    else
        echo -e "${RED}✗ $1 failed${NC}"
        exit 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --version)
            VERSION="$2"
            shift 2
            ;;
        --registry)
            REGISTRY="$2"
            shift 2
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --push)
            PUSH=true
            shift
            ;;
        --help)
            echo "Usage: ./build.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --version <version>    Set image version tag (default: latest)"
            echo "  --registry <registry>  Set Docker registry (e.g., docker.io/username)"
            echo "  --no-cache            Build without using cache"
            echo "  --push                Push images to registry after build"
            echo "  --help                Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./build.sh                                    # Build with defaults"
            echo "  ./build.sh --version 1.0.0                   # Build version 1.0.0"
            echo "  ./build.sh --version 1.0.0 --push           # Build and push"
            echo "  ./build.sh --registry myregistry.com/myapp  # Build with custom registry"
            echo "  ./build.sh --no-cache                        # Build without cache"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Run './build.sh --help' for usage information"
            exit 1
            ;;
    esac
done

# Build configuration
BUILD_ARGS=""
if [ "$NO_CACHE" = true ]; then
    BUILD_ARGS="--no-cache --pull"
fi

# Set image names
if [ -n "$REGISTRY" ]; then
    FRONTEND_IMAGE="${REGISTRY}/travel-tracker-frontend:${VERSION}"
    BACKEND_IMAGE="${REGISTRY}/travel-tracker-backend:${VERSION}"
else
    FRONTEND_IMAGE="travel-tracker-frontend:${VERSION}"
    BACKEND_IMAGE="travel-tracker-backend:${VERSION}"
fi

print_header "Build Configuration"
echo "Version:         ${VERSION}"
echo "Registry:        ${REGISTRY:-<local>}"
echo "Frontend Image:  ${FRONTEND_IMAGE}"
echo "Backend Image:   ${BACKEND_IMAGE}"
echo "No Cache:        ${NO_CACHE}"
echo "Push Images:     ${PUSH}"

# Check Docker is running
print_header "Checking Prerequisites"
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running${NC}"
    echo "Please start Docker and try again"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Check if docker-compose.prod.yml exists
if [ ! -f "docker-compose.prod.yml" ]; then
    echo -e "${RED}✗ docker-compose.prod.yml not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi
echo -e "${GREEN}✓ docker-compose.prod.yml found${NC}"

# Build Backend
print_header "Building Backend Image"
echo "Building: ${BACKEND_IMAGE}"
docker build ${BUILD_ARGS} \
    -t ${BACKEND_IMAGE} \
    -f server/Dockerfile \
    server/
check_status "Backend build"

# Tag as latest if version is not latest
if [ "$VERSION" != "latest" ]; then
    if [ -n "$REGISTRY" ]; then
        docker tag ${BACKEND_IMAGE} ${REGISTRY}/travel-tracker-backend:latest
        echo -e "${GREEN}✓ Tagged backend as latest${NC}"
    else
        docker tag ${BACKEND_IMAGE} travel-tracker-backend:latest
        echo -e "${GREEN}✓ Tagged backend as latest${NC}"
    fi
fi

# Build Frontend
print_header "Building Frontend Image"
echo "Building: ${FRONTEND_IMAGE}"
docker build ${BUILD_ARGS} \
    --build-arg REACT_APP_API_BASE_URL=/api \
    -t ${FRONTEND_IMAGE} \
    -f client/Dockerfile \
    client/
check_status "Frontend build"

# Tag as latest if version is not latest
if [ "$VERSION" != "latest" ]; then
    if [ -n "$REGISTRY" ]; then
        docker tag ${FRONTEND_IMAGE} ${REGISTRY}/travel-tracker-frontend:latest
        echo -e "${GREEN}✓ Tagged frontend as latest${NC}"
    else
        docker tag ${FRONTEND_IMAGE} travel-tracker-frontend:latest
        echo -e "${GREEN}✓ Tagged frontend as latest${NC}"
    fi
fi

# Show built images
print_header "Built Images"
docker images | grep "travel-tracker" | grep -E "(${VERSION}|latest)"

# Calculate image sizes
FRONTEND_SIZE=$(docker images ${FRONTEND_IMAGE} --format "{{.Size}}")
BACKEND_SIZE=$(docker images ${BACKEND_IMAGE} --format "{{.Size}}")
echo ""
echo "Frontend image size: ${FRONTEND_SIZE}"
echo "Backend image size:  ${BACKEND_SIZE}"

# Push images if requested
if [ "$PUSH" = true ]; then
    if [ -z "$REGISTRY" ]; then
        echo ""
        echo -e "${YELLOW}⚠ Warning: --push specified but no registry configured${NC}"
        echo "Use --registry option to specify a registry"
        exit 1
    fi
    
    print_header "Pushing Images to Registry"
    
    echo "Pushing: ${BACKEND_IMAGE}"
    docker push ${BACKEND_IMAGE}
    check_status "Backend push"
    
    echo "Pushing: ${FRONTEND_IMAGE}"
    docker push ${FRONTEND_IMAGE}
    check_status "Frontend push"
    
    # Push latest tags
    if [ "$VERSION" != "latest" ]; then
        echo "Pushing: ${REGISTRY}/travel-tracker-backend:latest"
        docker push ${REGISTRY}/travel-tracker-backend:latest
        check_status "Backend latest push"
        
        echo "Pushing: ${REGISTRY}/travel-tracker-frontend:latest"
        docker push ${REGISTRY}/travel-tracker-frontend:latest
        check_status "Frontend latest push"
    fi
fi

# Summary
print_header "Build Complete"
echo -e "${GREEN}✓ All images built successfully!${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Test locally:"
echo "   export VERSION=${VERSION}"
echo "   docker-compose -f docker-compose.prod.yml up"
echo ""
echo "2. Deploy to production:"
echo "   Copy docker-compose.prod.yml and .env.production to your server"
echo "   Then run: docker-compose -f docker-compose.prod.yml up -d"
echo ""
if [ "$PUSH" != true ] && [ -n "$REGISTRY" ]; then
    echo "3. Push to registry:"
    echo "   ./build.sh --version ${VERSION} --registry ${REGISTRY} --push"
    echo ""
fi
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                     Build Complete! 🚀                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"

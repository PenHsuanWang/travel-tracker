#!/bin/bash
#
# MinIO Bucket Setup Script for Travel Tracker
# This script sets up all required MinIO buckets and configurations
#
# Usage: ./setup-buckets.sh [mc_path]
#   mc_path: Optional path to mc binary (default: searches in PATH and common locations)
#

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default MinIO configuration
MINIO_ENDPOINT="${MINIO_ENDPOINT:-localhost:9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-minioadmin}"
MINIO_ALIAS="myminio"

# Bucket names
BUCKETS=("gps-data" "gps-analysis-data" "images" "gis-data")

# Function to print colored messages
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"
}

# Function to find mc binary
find_mc() {
    local mc_path="$1"
    
    # If path provided, use it
    if [ -n "$mc_path" ] && [ -f "$mc_path" ]; then
        echo "$mc_path"
        return 0
    fi
    
    # Check if mc is in PATH
    if command -v mc &> /dev/null; then
        echo "mc"
        return 0
    fi
    
    # Check common installation locations
    local common_paths=(
        "/usr/local/bin/mc"
        "/usr/bin/mc"
        "$HOME/bin/mc"
        "$HOME/minio-binaries/mc"
        "./mc"
    )
    
    for path in "${common_paths[@]}"; do
        if [ -f "$path" ]; then
            echo "$path"
            return 0
        fi
    done
    
    return 1
}

# Function to check if MinIO is accessible
check_minio() {
    print_info "Waiting for MinIO at ${MINIO_ENDPOINT}..."
    local max_attempts=15
    local attempt=0

    # Loop until the health check passes or we time out
    while ! curl -sf "http://${MINIO_ENDPOINT}/minio/health/live" > /dev/null 2>&1; do
        attempt=$((attempt + 1))
        if [ $attempt -ge $max_attempts ]; then
            echo # Newline after dots
            print_error "MinIO did not become accessible at http://${MINIO_ENDPOINT}"
            print_warning "Please ensure:"
            echo "  1. MinIO container is running (docker ps | grep minio)"
            echo "  2. Network configuration allows connection between containers"
            return 1
        fi
        echo -n "."
        sleep 2
    done
    
    echo # Newline after dots
    print_success "MinIO is accessible."
    return 0
}

# Function to configure mc client
configure_mc() {
    local mc_cmd="$1"
    
    print_info "Configuring MinIO client alias '${MINIO_ALIAS}'..."
    
    if $mc_cmd alias set "${MINIO_ALIAS}" "http://${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" > /dev/null 2>&1; then
        print_success "MinIO client configured successfully"
        return 0
    else
        print_error "Failed to configure MinIO client"
        return 1
    fi
}

# Function to create bucket
create_bucket() {
    local mc_cmd="$1"
    local bucket_name="$2"
    
    if $mc_cmd ls "${MINIO_ALIAS}/${bucket_name}" > /dev/null 2>&1; then
        print_warning "Bucket '${bucket_name}' already exists"
        return 0
    else
        if $mc_cmd mb "${MINIO_ALIAS}/${bucket_name}" > /dev/null 2>&1; then
            print_success "Created bucket: ${bucket_name}"
            return 0
        else
            print_error "Failed to create bucket: ${bucket_name}"
            return 1
        fi
    fi
}

# Function to set bucket policy
set_bucket_policy() {
    local mc_cmd="$1"
    local bucket_name="$2"
    
    if $mc_cmd anonymous set download "${MINIO_ALIAS}/${bucket_name}" > /dev/null 2>&1; then
        print_success "Set public read access for: ${bucket_name}"
        return 0
    else
        print_error "Failed to set policy for: ${bucket_name}"
        return 1
    fi
}

# Function to display bucket info
display_bucket_info() {
    local mc_cmd="$1"
    
    print_header "Bucket Configuration Summary"
    
    echo -e "${BLUE}Bucket Name${NC}     ${BLUE}Objects${NC}  ${BLUE}Size${NC}      ${BLUE}Access Policy${NC}"
    echo "─────────────────────────────────────────────────────"
    
    for bucket in "${BUCKETS[@]}"; do
        local size=$($mc_cmd du "${MINIO_ALIAS}/${bucket}" 2>/dev/null | awk '{print $1, $2}' || echo "0B")
        local count=$($mc_cmd du "${MINIO_ALIAS}/${bucket}" 2>/dev/null | awk '{print $3}' || echo "0")
        local policy=$($mc_cmd anonymous get "${MINIO_ALIAS}/${bucket}" 2>/dev/null | grep -o "download\|upload\|public\|private" || echo "private")
        
        printf "%-15s %-8s %-10s %s\n" "$bucket" "$count" "$size" "$policy"
    done
    
    echo ""
}

# Function to upload GIS data
upload_gis_data() {
    local mc_cmd="$1"
    local data_file="$2"
    
    if [ ! -f "$data_file" ]; then
        print_warning "GIS data file not found: $data_file"
        print_info "Skipping GIS data upload. You can upload it manually later."
        return 0
    fi
    
    print_info "Uploading GIS data file: $(basename "$data_file")"
    
    if $mc_cmd cp "$data_file" "${MINIO_ALIAS}/gis-data/$(basename "$data_file")" > /dev/null 2>&1; then
        print_success "GIS data uploaded successfully"
        return 0
    else
        print_error "Failed to upload GIS data"
        return 1
    fi
}

# Main execution
main() {
    print_header "MinIO Bucket Setup for Travel Tracker"
    
    # Find mc binary
    print_info "Searching for MinIO Client (mc)..."
    MC_PATH=$(find_mc "$1")
    
    if [ $? -ne 0 ]; then
        print_error "MinIO Client (mc) not found"
        echo ""
        echo "Please install mc first:"
        echo "  Linux/Mac: wget https://dl.min.io/client/mc/release/linux-amd64/mc && chmod +x mc"
        echo "  Or follow: https://min.io/docs/minio/linux/reference/minio-mc.html"
        echo ""
        echo "Then either:"
        echo "  1. Add mc to PATH"
        echo "  2. Run this script with mc path: $0 /path/to/mc"
        exit 1
    fi
    
    print_success "Found MinIO Client: ${MC_PATH}"
    
    # Check MinIO accessibility
    if ! check_minio; then
        exit 1
    fi
    
    # Configure mc client
    if ! configure_mc "$MC_PATH"; then
        exit 1
    fi
    
    # Create buckets
    print_header "Creating Buckets"
    for bucket in "${BUCKETS[@]}"; do
        create_bucket "$MC_PATH" "$bucket"
    done
    
    # Set bucket policies
    print_header "Setting Bucket Access Policies"
    for bucket in "${BUCKETS[@]}"; do
        set_bucket_policy "$MC_PATH" "$bucket"
    done
    
    # Upload GIS data if available
    print_header "GIS Data Upload"
    GIS_DATA_FILE="${GIS_DATA_FILE:-/home/pwang/pwang-dev/geo-data-analysis/data/geo-data/taiwan-river.pickle}"
    upload_gis_data "$MC_PATH" "$GIS_DATA_FILE"
    
    # Display summary
    display_bucket_info "$MC_PATH"
    
    # Success message
    print_header "Setup Completed Successfully!"
    echo -e "${GREEN}MinIO is ready for the Travel Tracker application!${NC}"
    echo ""
    echo "Access Points:"
    echo "  • MinIO API:     http://${MINIO_ENDPOINT}"
    echo "  • MinIO Console: http://localhost:9001"
    echo "  • Username:      ${MINIO_ACCESS_KEY}"
    echo "  • Password:      ${MINIO_SECRET_KEY}"
    echo ""
    echo "Buckets:"
    echo "  • gps-data   - For GPX track files"
    echo "  • gps-analysis-data - For analyzed GPX pickle artifacts"
    echo "  • images     - For geotagged photos (with EXIF data)"
    echo "  • gis-data   - For GIS data (rivers, shapefiles, etc.)"
    echo ""
    echo "Next steps:"
    echo "  1. Start the backend server: cd server && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt && python server.py"
    echo "  2. Start the frontend: cd client && npm install && npm start"
    echo "  3. Upload data via web UI at http://localhost:3000"
    echo ""
}

# Run main function
main "$@"

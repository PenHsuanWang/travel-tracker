# Travel Tracker

A web-based application for visualizing GPS tracking data and geographic information on interactive maps. Upload and display GPX tracks, explore river networks, and combine multiple layers for comprehensive geographic analysis.

## 🌟 Features

### 📍 GPX Track Visualization
- **Upload GPX files** containing GPS tracking data
- **Interactive track rendering** on the map
- **Trip Statistics**: View distance, duration, elevation gain, and max elevation
- **Elevation Profile**: Interactive graph showing elevation changes over distance
- **Auto-centering** to track locations

### 🌊 River Network Display
- **Comprehensive river database** with 1,600+ rivers
- **Search and filter** rivers by name
- **Multi-select capability** to display multiple rivers
- **Client-side rendering** for instant display without server requests
- **Color-coded rivers** for visual distinction
- **Interactive popups** showing river information

### 🗺️ Map Features
- **Multiple base map layers**:
  - OpenStreetMap (default)
  - Rudy Map (Taiwan-specific)
  - Mapbox (customizable)
- **Layer switcher** in top-left corner
- **Zoom and pan** controls
- **Combined layers** - display GPX tracks and rivers simultaneously
- **Responsive design** for various screen sizes

### 📸 Photo Management
- **Upload and geotag photos**
- **Display photos on map** at capture locations
- **Photo Timeline**: Chronological view of trip photos
- **Photo Viewer**: Full-screen gallery with navigation
- **Notes**: Add and edit notes for each photo

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Python 3.8+
- Node.js 14+
- npm or yarn
- MinIO Client (mc) for bucket setup

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/travel-tracker.git
   cd travel-tracker
   ```

2. **Start Docker services**
   ```bash
   # Start MinIO and MongoDB
   docker-compose up -d
   
   # Verify services are running
   docker ps
   ```

3. **Setup MinIO buckets**
   ```bash
   # Install MinIO Client if not already installed
   # Linux/macOS:
   wget https://dl.min.io/client/mc/release/linux-amd64/mc
   chmod +x mc
   sudo mv mc /usr/local/bin/
   
   # Run automated bucket setup
   cd databases/minio
   ./setup-buckets.sh
   cd ../..
   ```
   
   This will create and configure:
   - `gps-data` bucket for GPX files
   - `images` bucket for geotagged photos
   - `gis-data` bucket for GIS data (rivers, maps)

4. **Upload GIS data (optional)**
   ```bash
   # If you have river data file
   export PATH="/path/to/minio-binaries:$PATH"
   mc cp /path/to/taiwan-river.pickle myminio/gis-data/
   ```

5. **Set up Python backend**
   ```bash
   cd server
   
   # Create and activate virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Create .env file with MinIO credentials
   cat > .env << EOF
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false
EOF
   ```

6. **Set up React frontend**
   ```bash
   cd ../client
   npm install
   
   # Create .env file
   echo "REACT_APP_API_BASE_URL=http://localhost:8000/api" > .env
   ```

7. **Start the backend server**
   ```bash
   cd ../server
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   python server.py
   ```
   Backend runs on http://localhost:8000

8. **Start the frontend development server**
   ```bash
   cd ../client
   npm start
   ```
   Frontend runs on http://localhost:3000

9. **Open your browser**
   Navigate to http://localhost:3000

### Quick Start with Script (Alternative)

```bash
# Use the convenience script
./start-dev.sh

# This will:
# - Start Docker services
# - Setup MinIO buckets (if mc is available)
# - Start backend server
# - Start frontend server
```

## 📖 User Guide

### Displaying GPX Tracks

1. **Access GPX Files**
   - Click the "Show GPX Files" button in the top-right corner
   - A dropdown menu will appear showing all available GPX files

2. **Select Tracks**
   - Check the boxes next to the GPX files you want to display
   - Each track will appear on the map in a unique color
   - The filename will be colored to match the track on the map

3. **View Multiple Tracks**
   - Select multiple files to display them simultaneously
   - Each track maintains its own color for easy identification
   - Colors cycle through: Red, Green, Blue, Magenta, Cyan, Orange, Purple, Yellow, Pink, Mint

4. **Toggle Tracks**
   - Uncheck a box to hide that track instantly
   - Check it again to show the track
   - Map position and zoom are preserved when toggling

### Working with Rivers

1. **Open Rivers Panel**
   - The Rivers panel is located in the left sidebar
   - Click to expand if collapsed

2. **Search for Rivers**
   - Use the search box to filter rivers by name
   - Search is case-insensitive and matches partial names
   - Results update as you type

3. **Select Rivers**
   - Check boxes next to rivers you want to display
   - Rivers appear on the map immediately
   - Multiple rivers can be displayed at once

4. **Clear Selection**
   - Click "Clear All" to remove all selected rivers
   - Individual rivers can be unchecked to hide them

### Changing Base Maps

1. **Access Layer Selector**
   - Located in the top-left corner of the map

2. **Choose a Layer**
   - **OpenStreetMap**: Global coverage, good for general navigation
   - **Rudy Map**: Taiwan-specific map with local details
   - **Mapbox**: Customizable map styles (requires token)

3. **Switch Layers**
   - Select from the dropdown to instantly change the base map
   - All overlays (rivers, GPX tracks) remain visible

### Tips for Best Experience

- **Performance**: Displaying too many rivers simultaneously may impact performance. Use search to narrow down selection.
- **Zoom Levels**: Some features are more visible at certain zoom levels. Try zooming in/out for better detail.
- **Color Visibility**: If tracks are hard to see, try changing the base map layer.
- **Track Order**: Tracks are drawn in the order they're selected. Later tracks appear on top.

## 🛠️ Technology Stack

### Backend
- **Python 3.8+** - Server runtime
- **FastAPI** - Modern web framework and API
- **Uvicorn** - ASGI server
- **MinIO** - Object storage for files
- **MongoDB** - Metadata storage (optional)

### Frontend
- **React 18** - UI framework
- **Leaflet** - Interactive maps
- **React-Leaflet** - React bindings for Leaflet
- **JavaScript ES6+** - Modern JavaScript features

### Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **MinIO** - S3-compatible object storage
- **MongoDB** - Document database

### Data Storage
- **MinIO Buckets**:
  - `gps-data` - GPX files and GPS tracks
  - `images` - Geotagged photos with EXIF metadata
  - `gis-data` - GIS data (rivers, shapefiles, pickle files)
- **MongoDB** - File metadata and application data
- **Local file system** - Legacy support

## 📁 Project Structure

```
travel-tracker/
├── client/                 # React frontend
│   ├── public/            # Static assets
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── sidebar/   # Sidebar components (Rivers panel)
│   │   │   ├── panels/    # UI panels (Image gallery, etc.)
│   │   │   └── map/       # Map components and layers
│   │   ├── services/      # API service layer
│   │   ├── styles/        # CSS stylesheets
│   │   └── App.js         # Main application component
│   ├── .env               # Frontend environment variables
│   └── package.json       # Frontend dependencies
├── server/                # Python backend
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── controllers/   # Business logic controllers
│   │   ├── services/      # Service layer
│   │   │   └── data_io_handlers/  # File upload handlers
│   │   ├── utils/         # Utility functions
│   │   │   └── dbbutler/  # Storage adapters
│   │   └── models/        # Data models
│   ├── .env               # Backend environment variables
│   ├── server.py          # FastAPI application
│   ├── requirements.txt   # Python dependencies
│   └── venv/              # Python virtual environment
├── databases/             # Database configuration
│   ├── minio/             # MinIO setup
│   │   ├── setup-buckets.sh   # Automated bucket setup
│   │   ├── minio-setup.sh     # Container init script
│   │   └── README.md          # MinIO documentation
│   └── mongodb/           # MongoDB configuration
├── docker-compose.yml     # Docker services configuration
├── start-dev.sh           # Development startup script
├── stop-dev.sh            # Development shutdown script
└── README.md              # This file
```

## 🔧 Configuration

### Backend Configuration

**Environment Variables (server/.env):**
```env
# MinIO Configuration
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false

# MongoDB Configuration (optional)
MONGODB_URI=mongodb://localhost:27017/
MONGODB_DB=travel_tracker

# Server Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=true
```

### Frontend Configuration

**Environment Variables (client/.env):**
```env
# API Configuration
REACT_APP_API_BASE_URL=http://localhost:8000/api

# Map Configuration (optional)
REACT_APP_MAPBOX_TOKEN=your_mapbox_token_here
```

### Docker Configuration

**Services in docker-compose.yml:**
- **MinIO**: Object storage on ports 9000 (API) and 9001 (Console)
- **MongoDB**: Document database on port 27017

**MinIO Access:**
- Console: http://localhost:9001
- Username: minioadmin
- Password: minioadmin

### MinIO Bucket Configuration

Three buckets are automatically created:

1. **gps-data** - GPX track files
   - Access: Public read
   - Purpose: Store uploaded GPS tracks

2. **images** - Geotagged photos
   - Access: Public read
   - Purpose: Store photos with EXIF metadata
   - Features: GPS extraction, camera info

3. **gis-data** - GIS data
   - Access: Public read
   - Purpose: Store rivers, shapefiles, pickle files
   - Example: taiwan-river.pickle (1,626 rivers)

## 🧪 Testing

### Backend Tests
```bash
cd server
source venv/bin/activate
pytest
```

### Frontend Tests
```bash
cd client
npm test
```

### End-to-End Testing
Refer to `TEST_RESULTS_20251030.md` for comprehensive test scenarios and results.

## 📊 Data Management

### MinIO Bucket Management

**List files:**
```bash
mc ls myminio/images/
mc ls myminio/gps-data/
mc ls myminio/gis-data/
```

**Upload files:**
```bash
# Upload GPX file
mc cp track.gpx myminio/gps-data/

# Upload image
mc cp photo.jpg myminio/images/

# Upload GIS data
mc cp taiwan-river.pickle myminio/gis-data/
```

**Download files:**
```bash
mc cp myminio/images/photo.jpg ./
```

**Check bucket size:**
```bash
mc du myminio/images
```

See [databases/minio/README.md](databases/minio/README.md) for detailed MinIO management.

### API Endpoints

**File Upload:**
- `POST /api/map/upload` - Upload files (auto-detects type)
  - Accepts: GPX, JPEG, PNG, GIF, BMP
  - Returns: File metadata, EXIF data, GPS coordinates

**File Retrieval:**
- `GET /api/list-files?bucket=images` - List files in bucket
- `GET /api/list-files/detail?bucket=images` - List with metadata
- `GET /api/files/{filename}?bucket=images` - Download file

**Geotagged Images:**
- `GET /api/images/geo` - Get all geotagged images
- `GET /api/images/geo?minLon=120&minLat=23&maxLon=122&maxLat=25` - Filter by bounding box

**GIS Data:**
- `GET /api/gis/list_rivers` - List all rivers (1,626 rivers)
- `GET /api/gis/rivers_data` - Get full river GeoJSON data

**File Management:**
- `DELETE /api/map/delete/{filename}?bucket=images` - Delete file
- `GET /api/map/metadata/{metadata_id}` - Get file metadata

### Data Format Requirements

**GPX Files:**
```xml
<?xml version="1.0"?>
<gpx version="1.1">
  <trk>
    <name>Track Name</name>
    <trkseg>
      <trkpt lat="25.033" lon="121.565">
        <ele>100</ele>
        <time>2024-01-01T12:00:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>
```

**Geotagged Images:**
- JPEG/JPG with EXIF metadata
- Required: GPS coordinates in EXIF
- Optional: Camera make/model, date taken, altitude
- Automatic GPS extraction and thumbnail generation

**River GeoJSON:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {"name": "River Name"},
      "geometry": {
        "type": "LineString",
        "coordinates": [[lon, lat], ...]
      }
    }
  ]
}
```

## 🚧 Known Issues

- Frontend first compilation can take several minutes
- Large GPX files (>10MB) may take time to load
- Internet connection required for base map tiles
- Mapbox layer requires access token
- MinIO console may show "Network Error" if accessed before MinIO is fully started

## 🗺️ Roadmap

### Version 2.0 (In Progress)
- [x] Docker-based infrastructure
- [x] MinIO object storage integration
- [x] File upload API with EXIF extraction
- [x] Geotagged image display on map
- [x] Image metadata management
- [ ] GPX track upload via web UI
- [ ] Photo markers with thumbnails
- [ ] Image gallery panel

### Version 2.1 (Planned)
- [ ] Track statistics (distance, elevation, duration)
- [ ] Elevation profile charts
- [ ] Track editing capabilities
- [ ] Export combined maps as images
- [ ] Batch file upload
- [ ] File versioning

### Version 2.2 (Future)
- [ ] User accounts and authentication
- [ ] Cloud storage integration
- [ ] Mobile app (React Native)
- [ ] Real-time GPS tracking
- [ ] Social sharing features
- [ ] Track comparison tools
- [ ] Advanced search and filtering

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Keep commits atomic and well-described

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- Your Name - Initial work

## 🙏 Acknowledgments

- OpenStreetMap contributors for map data
- Leaflet.js team for the mapping library
- React and Flask communities
- All contributors to this project

## 📧 Support

For questions, issues, or suggestions:
- Open an issue on GitHub
- Email: your.email@example.com
- Documentation: See additional docs in the project

## 🔗 Links

- [Project Repository](https://github.com/yourusername/travel-tracker)
- [Issue Tracker](https://github.com/yourusername/travel-tracker/issues)
- [Quick Start Guide](QUICK_START.md)
- [MinIO Setup Guide](databases/minio/README.md)
- [MinIO Bucket Review](MINIO_BUCKET_REVIEW.md)
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md)

## 📚 Additional Documentation

- **[MINIO_BUCKET_REVIEW.md](MINIO_BUCKET_REVIEW.md)** - Comprehensive MinIO setup and API review
- **[databases/minio/README.md](databases/minio/README.md)** - MinIO configuration and management
- **[QUICK_START.md](QUICK_START.md)** - Quick start guide for development
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Technical implementation details

---

**Last Updated**: November 20, 2025  
**Version**: 2.0.0
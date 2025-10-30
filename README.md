# Travel Tracker

A web-based application for visualizing GPS tracking data and geographic information on interactive maps. Upload and display GPX tracks, explore river networks, and combine multiple layers for comprehensive geographic analysis.

## 🌟 Features

### 📍 GPX Track Visualization
- **Upload GPX files** containing GPS tracking data
- **Display multiple tracks simultaneously** with distinct color coding
- **Interactive track management** with instant toggle on/off
- **10-color palette** for easy track differentiation
- **Smooth rendering** with no map redraw when toggling tracks
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

### 📸 Photo Management (Planned)
- Upload and geotag photos
- Display photos on map at capture locations
- Link photos to GPX tracks
- Photo gallery and timeline views

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 14+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/travel-tracker.git
   cd travel-tracker
   ```

2. **Set up Python backend**
   ```bash
   cd server
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Set up React frontend**
   ```bash
   cd ../client
   npm install
   ```

4. **Start the backend server**
   ```bash
   cd ../server
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   python server.py
   ```
   Backend runs on http://localhost:5002

5. **Start the frontend development server**
   ```bash
   cd ../client
   npm start
   ```
   Frontend runs on http://localhost:3000

6. **Open your browser**
   Navigate to http://localhost:3000

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
- **Flask** - Web framework and API
- **Flask-CORS** - Cross-origin resource sharing

### Frontend
- **React 18** - UI framework
- **Leaflet** - Interactive maps
- **React-Leaflet** - React bindings for Leaflet
- **JavaScript ES6+** - Modern JavaScript features

### Data Storage
- **Local file system** - GPX files and GeoJSON data
- **JSON** - River data format
- **GeoJSON** - Geographic data standard

## 📁 Project Structure

```
travel-tracker/
├── client/                 # React frontend
│   ├── public/            # Static assets
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── sidebar/   # Sidebar components (Rivers panel)
│   │   │   └── views/     # Map view components
│   │   ├── services/      # API service layer
│   │   ├── styles/        # CSS stylesheets
│   │   └── App.js         # Main application component
│   └── package.json       # Frontend dependencies
├── server/                # Python backend
│   ├── server.py          # Flask application
│   ├── requirements.txt   # Python dependencies
│   └── venv/              # Python virtual environment
├── databases/             # Data storage
│   ├── gis/               # Geographic data
│   │   └── rivers_data/   # River GeoJSON files
│   └── gps-data/          # GPX tracking files
└── README.md             # This file
```

## 🔧 Configuration

### Backend Configuration
- **Host**: `0.0.0.0` (accessible from network)
- **Port**: `5002`
- **Debug Mode**: Enabled for development

### Frontend Configuration
- **Development Port**: `3000`
- **API Proxy**: Configured in `package.json` to proxy to backend

### Environment Variables
Create a `.env` file in the project root for custom configuration:
```
REACT_APP_API_URL=http://localhost:5002
MAPBOX_ACCESS_TOKEN=your_token_here  # Optional, for Mapbox layer
```

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

### Adding GPX Files
1. Place `.gpx` files in `databases/gps-data/`
2. Files are automatically detected by the backend
3. Restart the backend if adding files while running

### Adding River Data
1. Place GeoJSON files in `databases/gis/rivers_data/`
2. Files should follow the naming pattern: `[river_name].json`
3. Reload the rivers data via the API

### Data Format Requirements

**GPX Files**:
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
      <!-- More track points -->
    </trkseg>
  </trk>
</gpx>
```

**River GeoJSON**:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "River Name"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [[lon, lat], ...]
      }
    }
  ]
}
```

## 🚧 Known Issues

- Photo upload functionality is not yet implemented
- Large GPX files (>10MB) may take time to load
- Internet connection required for base map tiles
- Mapbox layer requires access token

## 🗺️ Roadmap

### Version 2.0 (Planned)
- [ ] Photo upload and geotagging
- [ ] Photo markers on map
- [ ] Track statistics (distance, elevation, duration)
- [ ] Elevation profile charts
- [ ] Track editing capabilities
- [ ] Export combined maps as images

### Version 2.1 (Future)
- [ ] User accounts and authentication
- [ ] Cloud storage integration
- [ ] Mobile app (React Native)
- [ ] Real-time GPS tracking
- [ ] Social sharing features
- [ ] Track comparison tools

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
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md)

---

**Last Updated**: October 30, 2024  
**Version**: 1.1.0
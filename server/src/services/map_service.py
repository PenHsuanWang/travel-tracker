import folium

MAP_LAYERS = {
    "openstreetmap": {
        "name": "OpenStreetMap",
        "url": "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "attribution": "© OpenStreetMap contributors"
    },
    "mapbox": {
        "name": "Mapbox",
        "url": "https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=YOUR_MAPBOX_TOKEN",
        "attribution": "Mapbox"
    }
}


def create_base_map(start_coords=(23.6978, 120.9605)):
    """Create a base map with no layers."""
    return folium.Map(location=start_coords, zoom_start=8, tiles=None)


def add_tile_layer(map_object, layer='openstreetmap'):
    """Add a specified tile layer to the provided map."""
    tile_layer = MAP_LAYERS.get(layer)
    if tile_layer:
        folium.TileLayer(
            tiles=tile_layer['url'],
            attr=tile_layer['attribution']
        ).add_to(map_object)
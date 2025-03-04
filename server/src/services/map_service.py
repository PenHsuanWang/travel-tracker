import folium
import pickle
from shapely.geometry import mapping

# Predefined map layers
MAP_LAYERS = {
    "openstreetmap": {
        "url": "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "attribution": "© OpenStreetMap contributors",
    },
    "rudy map": {
        "url": "https://tile.happyman.idv.tw/map/rudy/{z}/{x}/{y}.png",
        "attribution": "Map data © Rudy contributors",
    }
}   


def create_base_map(start_coords=(24.7515, 121.2792)):
    """Create a base map with no layers."""
    return folium.Map(location=start_coords, zoom_start=16, tiles=None)

def add_tile_layer(map_object, layer='openstreetmap'):
    """Add a specified tile layer to the provided map."""
    tile_layer = MAP_LAYERS.get(layer)
    if tile_layer:
        folium.TileLayer(
            tiles=tile_layer['url'],
            attr=tile_layer['attribution']
        ).add_to(map_object)

def generate_map(layer: str, center=None):
    """
    Generate a basic folium map with the given tile layer.
    """
    if center is None:
        center = (24.7553, 121.2906)
    m = folium.Map(location=center, zoom_start=15, tiles=None)
    tile_layer = MAP_LAYERS.get(layer)
    if not tile_layer:
        raise Exception("Layer not found")
    folium.TileLayer(
        tiles=tile_layer['url'],
        attr=tile_layer['attribution']
    ).add_to(m)
    return m._repr_html_()

def generate_gis_map(layer: str, center=None, selected_rivers=None):
    """
    Generate a folium map that overlays river shapes (loaded from a pickle file in the MinIO bucket "gis-data").
    The user may select a subset of rivers to display.
    """
    if center is None:
        center = (24.7553, 121.2906)
    m = folium.Map(location=center, zoom_start=8, tiles=None)
    # Add the chosen base tile layer
    tile_layer = MAP_LAYERS.get(layer, MAP_LAYERS['openstreetmap'])
    folium.TileLayer(
        tiles=tile_layer['url'],
        attr=tile_layer['attribution']
    ).add_to(m)

    # Load the pickle file from MinIO bucket "gis-data"
    from src.utils.dbbutler.storage_manager import StorageManager
    from src.utils.dbbutler.minio_adapter import MinIOAdapter
    storage_manager = StorageManager()
    minio_adapter = MinIOAdapter(
        endpoint="localhost:9000",
        access_key="your-access-key",
        secret_key="your-secret-key",
        secure=False
    )
    storage_manager.add_adapter('minio', minio_adapter)

    try:
        file_bytes = storage_manager.load_data('minio', "taiwan-river.pickle", bucket="gis-data")
        river_shapes = pickle.loads(file_bytes)
    except Exception as e:
        raise Exception("Error loading GIS data: " + str(e))

    # For each river (or only the selected ones) add a FeatureGroup with GeoJSON overlay.
    for river, geom in river_shapes.items():
        if selected_rivers and river not in selected_rivers:
            continue
        river_group = folium.FeatureGroup(name=river, show=False)
        if isinstance(geom, list):
            for g in geom:
                folium.GeoJson(mapping(g)).add_to(river_group)
        else:
            folium.GeoJson(mapping(geom)).add_to(river_group)
        river_group.add_to(m)

    # Add layer control so the user can toggle river layers
    folium.LayerControl(collapsed=False).add_to(m)
    return m._repr_html_()

# server/src/controllers/map_controller.py
from fastapi.responses import HTMLResponse
import folium
import pickle
from shapely.geometry import mapping
from src.services.map_service import generate_map, generate_gis_map

# Existing layers for normal maps
MAP_LAYERS = {
    "openstreetmap": {
        "url": "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "attr": "© OpenStreetMap contributors",
    },
    "rudy map": {
        "url": "https://tile.happyman.idv.tw/map/rudy/{z}/{x}/{y}.png",
        "attr": "Map data © Rudy contributors",
    },
}

def get_layers():
    """
    Return a list of available base layers.
    """
    return list(MAP_LAYERS.keys())

def generate_map_endpoint(layer: str, center=None):
    """
    Generate a basic map using folium and return an HTMLResponse.
    """
    if center is None:
        center = (24.7553, 121.2906)

    if layer not in MAP_LAYERS:
        return HTMLResponse(content="<h1>Layer not found</h1>", status_code=404)

    m = folium.Map(location=center, zoom_start=15, tiles=None)
    folium.TileLayer(
        tiles=MAP_LAYERS[layer]["url"],
        attr=MAP_LAYERS[layer]["attr"]
    ).add_to(m)

    return HTMLResponse(content=m._repr_html_())

def get_river_names():
    """
    Load the GIS pickle file from the MinIO bucket 'gis-data' and return the list of river names.
    """
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

    file_bytes = storage_manager.load_data('minio', "taiwan-river.pickle", bucket="gis-data")
    river_shapes = pickle.loads(file_bytes)
    # Filter out any None or non-string keys
    valid_keys = [k for k in river_shapes.keys() if isinstance(k, str) and k]
    return valid_keys

def get_map_metadata():
    """
    Provide metadata about this map setup so the front end can handle advanced UI or 
    partial updates without regenerating an entire HTML map each time.
    """
    return {
        "availableLayers": list(MAP_LAYERS.keys()),
        "defaultCenter": (24.7553, 121.2906)
    }

def get_river_data_as_geojson() -> dict:
    """
    Return a JSON-friendly dict {riverName: geojsonObject}, for toggling on the front end.
    """
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

    file_bytes = storage_manager.load_data('minio', "taiwan-river.pickle", bucket="gis-data")
    river_shapes = pickle.loads(file_bytes)

    result = {}
    from shapely.geometry import mapping
    for name, shape_obj in river_shapes.items():
        if isinstance(shape_obj, list):
            # multiple geometries
            geoms = [mapping(g) for g in shape_obj]
            result[name] = {
                "type": "FeatureCollection",
                "features": [
                    {"type": "Feature", "properties": {}, "geometry": g}
                    for g in geoms
                ]
            }
        else:
            # single geometry
            result[name] = {
                "type": "Feature",
                "properties": {},
                "geometry": mapping(shape_obj)
            }
    return result

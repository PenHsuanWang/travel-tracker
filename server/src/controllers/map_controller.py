# server/src/controllers/map_controller.py

from fastapi.responses import HTMLResponse
import pickle
from shapely.geometry import mapping
from src.services.map_service import generate_map, generate_gis_map

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
    return list(MAP_LAYERS.keys())

def generate_map_endpoint(layer: str, center=None):
    if layer not in MAP_LAYERS:
        return HTMLResponse(content="<h1>Layer not found</h1>", status_code=404)
    return HTMLResponse(content=generate_map(layer, center))

def get_river_names():
    """
    If you want just the list of river names (no geometry).
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
    valid_keys = [k for k in river_shapes.keys() if isinstance(k, str) and k]
    return valid_keys

def get_map_metadata():
    return {
        "availableLayers": list(MAP_LAYERS.keys()),
        "defaultCenter": (24.7553, 121.2906)
    }

# ----------------------
# Caching + Simplify
# ----------------------
_river_data_cache = None  # in-memory cache

def get_river_data_as_geojson() -> dict:
    """
    Return a JSON-friendly dict {riverName: geojsonObject}, 
    caching in memory & simplifying geometry.
    """
    global _river_data_cache
    if _river_data_cache is not None:
        return _river_data_cache

    from src.utils.dbbutler.storage_manager import StorageManager
    from src.utils.dbbutler.minio_adapter import MinIOAdapter
    from shapely.geometry import mapping

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

    # Tweak this tolerance for best results:
    TOLERANCE = 0.0001  

    result = {}
    for name, shape_obj in river_shapes.items():
        if not name or name.lower() == 'null':
            # skip invalid keys
            continue

        # If you want to skip simplifying, remove the .simplify(...) calls
        if isinstance(shape_obj, list):
            geoms = []
            for g in shape_obj:
                g_simpl = g.simplify(TOLERANCE, preserve_topology=True)
                geoms.append(mapping(g_simpl))
            result[name] = {
                "type": "FeatureCollection",
                "features": [
                    {"type": "Feature", "properties": {}, "geometry": geom} for geom in geoms
                ]
            }
        else:
            g_simpl = shape_obj.simplify(TOLERANCE, preserve_topology=True)
            result[name] = {
                "type": "Feature",
                "properties": {},
                "geometry": mapping(g_simpl)
            }

    _river_data_cache = result
    return result

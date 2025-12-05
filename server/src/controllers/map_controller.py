"""Controller utilities for map and GIS endpoints.

This module provides helpers used by the routing layer to generate HTML
map fragments, list available map layers, and to load/simplify cached
river GeoJSON data stored in object storage.
"""

from fastapi.responses import HTMLResponse
import pickle
import os
from shapely.geometry import mapping
from src.services.map_service import generate_map, generate_gis_map
from dotenv import load_dotenv

load_dotenv()

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
    """Return a list of available map layer keys."""
    return list(MAP_LAYERS.keys())


def generate_map_endpoint(layer: str, center=None):
    """Generate an HTMLResponse for a rendered map layer.

    Args:
        layer (str): Layer key from ``MAP_LAYERS``.
        center: Optional center coordinate passed to the renderer.

    Returns:
        HTMLResponse: Rendered HTML or a 404 HTMLResponse if layer missing.
    """
    if layer not in MAP_LAYERS:
        return HTMLResponse(content="<h1>Layer not found</h1>", status_code=404)
    return HTMLResponse(content=generate_map(layer, center))


def get_river_names():
    """Return the list of river names available in the GIS dataset.

    This function loads a cached pickle from object storage and returns
    the valid keys. It is intended for lightweight enumeration (no
    geometry is returned).
    """
    from src.utils.dbbutler.storage_manager import StorageManager
    from src.utils.dbbutler.minio_adapter import MinIOAdapter

    storage_manager = StorageManager()
    minio_adapter = MinIOAdapter(
        endpoint=os.getenv("MINIO_ENDPOINT", "localhost:9000"),
        access_key=os.getenv("MINIO_ACCESS_KEY"),
        secret_key=os.getenv("MINIO_SECRET_KEY"),
        secure=os.getenv("MINIO_SECURE", "False").lower() == "true"
    )
    storage_manager.add_adapter('minio', minio_adapter)

    file_bytes = storage_manager.load_data('minio', "taiwan-river.pickle", bucket="gis-data")
    river_shapes = pickle.loads(file_bytes)
    valid_keys = [k for k in river_shapes.keys() if isinstance(k, str) and k]
    return valid_keys


def get_map_metadata():
    """Return metadata about map layers and a default center coordinate."""
    return {
        "availableLayers": list(MAP_LAYERS.keys()),
        "defaultCenter": (24.7553, 121.2906)
    }


# ----------------------
# Caching + Simplify
# ----------------------
_river_data_cache = None  # in-memory cache


def get_river_data_as_geojson() -> dict:
    """Return a JSON-friendly mapping of riverName -> GeoJSON-like object.

    The function uses an in-memory cache and simplifies geometries for
    efficient delivery to the frontend.
    """
    global _river_data_cache
    if _river_data_cache is not None:
        return _river_data_cache

    from src.utils.dbbutler.storage_manager import StorageManager
    from src.utils.dbbutler.minio_adapter import MinIOAdapter
    from shapely.geometry import mapping

    storage_manager = StorageManager()
    minio_adapter = MinIOAdapter(
        endpoint=os.getenv("MINIO_ENDPOINT", "localhost:9000"),
        access_key=os.getenv("MINIO_ACCESS_KEY"),
        secret_key=os.getenv("MINIO_SECRET_KEY"),
        secure=os.getenv("MINIO_SECURE", "False").lower() == "true"
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

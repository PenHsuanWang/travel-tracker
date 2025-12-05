"""Map service helpers for generating Folium-based HTML maps.

This module provides lightweight helpers used by the backend to construct
Folium maps (returned as HTML fragments) for embedding in the frontend.

The service provides two main functions: `generate_map` to create a simple
tiled map, and `generate_gis_map` to build a map with GIS features loaded
from persistent storage (MinIO).

The implementations intentionally keep map generation synchronous and
return the raw HTML representation from Folium's `_repr_html_()` method.
"""

import folium
import pickle
import os
from shapely.geometry import mapping
from dotenv import load_dotenv

load_dotenv()

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

def generate_map(layer: str, center=None):
    """Generate a simple tiled Folium map and return HTML.

    Args:
        layer (str): Key of the tile layer to use from `MAP_LAYERS`.
        center (tuple|None): (lat, lon) center for the map. Defaults to
            Taiwan coordinates (24.7553, 121.2906) when `None`.

    Returns:
        str: HTML fragment representing the rendered Folium map.

    Raises:
        Exception: If the requested `layer` is not found in `MAP_LAYERS`.
    """
    if center is None:
        center = (24.7553, 121.2906)

    m = folium.Map(location=center, zoom_start=15, tiles=None)
    # Force a known ID so the instance is map_myLeafletMap
    m._id = "myLeafletMap"

    tile_layer = MAP_LAYERS.get(layer)
    if not tile_layer:
        raise Exception(f"Layer '{layer}' not found")

    folium.TileLayer(
        tiles=tile_layer['url'],
        attr=tile_layer['attribution']
    ).add_to(m)

    # Inject snippet to set window._leaflet_map
    custom_js = """
    <script>
      // Folium names the instance map_myLeafletMap
      window._leaflet_map = map_myLeafletMap;
    </script>
    """
    from folium import Element
    m.get_root().html.add_child(Element(custom_js))

    return m._repr_html_()

def generate_gis_map(layer: str, center=None, selected_rivers=None):
    """Generate a GIS Folium map populated with river geometries from storage.

    This function loads pre-serialized river geometries from object storage
    (MinIO) and injects them as GeoJSON layers into a Folium map. It is
    intended for server-side rendering of GIS previews and returns the HTML
    representation of the map.

    Args:
        layer (str): Key of the tile layer to use from `MAP_LAYERS`.
        center (tuple|None): (lat, lon) center for the map. Defaults to
            Taiwan coordinates (24.7553, 121.2906) when `None`.
        selected_rivers (Iterable[str]|None): If provided, only the rivers
            with names in this iterable will be added to the map.

    Returns:
        str: HTML fragment representing the rendered Folium map with GIS layers.

    Raises:
        Exception: If loading or deserializing GIS data fails.
    """
    if center is None:
        center = (24.7553, 121.2906)
    m = folium.Map(location=center, zoom_start=8, tiles=None)

    tile_layer = MAP_LAYERS.get(layer, MAP_LAYERS['openstreetmap'])
    folium.TileLayer(
        tiles=tile_layer['url'],
        attr=tile_layer['attribution']
    ).add_to(m)

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

    try:
        file_bytes = storage_manager.load_data('minio', "taiwan-river.pickle", bucket="gis-data")
        river_shapes = pickle.loads(file_bytes)
    except Exception as e:
        raise Exception("Error loading GIS data: " + str(e))

    from shapely.geometry import mapping
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

    folium.LayerControl(collapsed=False).add_to(m)
    return m._repr_html_()

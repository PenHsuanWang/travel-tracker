# server/src/services/map_service.py

import folium
import pickle
from shapely.geometry import mapping

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
    """
    If you still want the old approach: 
    Return a Folium map with selected rivers directly in HTML.
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

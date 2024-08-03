from fastapi.responses import HTMLResponse
import folium

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


def generate_map(layer: str):
    if layer not in MAP_LAYERS:
        return HTMLResponse(content="<h1>Layer not found</h1>", status_code=404)

    m = folium.Map(location=(23.6978, 120.9605), zoom_start=8, tiles=None)
    folium.TileLayer(tiles=MAP_LAYERS[layer]['url'], attr=MAP_LAYERS[layer]['attr']).add_to(m)
    return HTMLResponse(content=m._repr_html_())

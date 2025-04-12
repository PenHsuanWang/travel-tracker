# server/src/app.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from src.routes.map_routes import router as map_router
from src.routes.gis_routes import router as gis_router
from src.routes.file_upload_routes import router as file_upload_router
from src.routes.file_retrieval_routes import router as file_retrieval_router

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Enable GZip compression (shrink large JSON over the wire)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Routes for map
app.include_router(map_router, prefix="/api/map")
# Routes for GIS
app.include_router(gis_router, prefix="/api/gis")
# File upload routes
app.include_router(file_upload_router, prefix="/api/map")
# File retrieval routes
app.include_router(file_retrieval_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5002)

# server/src/app.py

from dotenv import load_dotenv
import os
load_dotenv()  # Load environment variables from .env file

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from src.routes.map_routes import router as map_router
from src.routes.gis_routes import router as gis_router
from src.routes.file_upload_routes import router as file_upload_router
from src.routes.file_retrieval_routes import router as file_retrieval_router
from src.routes.trip_routes import router as trip_router
from src.routes.auth_routes import router as auth_router
from src.routes.user_routes import router as user_router
from src.events.event_bus import EventBus
from src.services.achievement_engine import achievement_engine

# Subscribe to events
EventBus.subscribe("GPX_PROCESSED", achievement_engine.handle_gpx_processed)

app = FastAPI()

# Enable CORS
# In production, ALLOWED_ORIGINS should be set to the specific frontend domain
origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
# Trip routes
app.include_router(trip_router, prefix="/api/trips")
# Auth routes
app.include_router(auth_router, prefix="/api/auth")
# User routes
app.include_router(user_router, prefix="/api/users")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5002)

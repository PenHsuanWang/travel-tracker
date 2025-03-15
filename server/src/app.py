# server/src/app.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.routes.map_routes import router as map_router
from src.routes.file_upload_routes import router as file_upload_router
from src.routes.file_retrieval_routes import router as file_retrieval_router
from src.routes.gis_routes import router as gis_router

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Existing routes
app.include_router(map_router, prefix="/api/map")
app.include_router(file_upload_router, prefix="/api/map")
app.include_router(gis_router, prefix="/api/gis")

# for /api/list-files or /api/files routes are exposed
app.include_router(file_retrieval_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5002)

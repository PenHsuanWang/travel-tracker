from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.routes.map_routes import router as map_router
from src.routes.file_upload_routes import router as file_upload_router

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# /api/map routes (map-related)
app.include_router(map_router, prefix="/api/map")

# /api/map/upload routes (file upload)
app.include_router(file_upload_router, prefix="/api/map")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5002)
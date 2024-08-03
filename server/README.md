# Travel Tracker Backend

This repository contains the backend implementation for the Travel Tracker project. The backend is built using FastAPI and Folium and is responsible for serving map layers and other functionalities.

## Prerequisites

- Docker
- Docker Compose (optional, if you plan to use `docker-compose`)

## Project Structure
```text
server/
├── Dockerfile
├── requirements.txt
├── setup.cfg
├── .env
├── .gitignore
├── src/
│   ├── main.py
│   ├── routes/
│   │   ├── map_routes.py
│   ├── controllers/
│   │   ├── map_controller.py
│   ├── services/
│   │   ├── map_service.py
```

## Build the Docker image

To build the Docker image, run the following command in the root directory of the project:
```text
docker build -t travel-tracker-backend .
```
## Run the Docker container
```text
docker run -p 5000:5000 --env-file .env travel-tracker-backend
```
This command will start the FastAPI server on port 5000. You can access the API at http://localhost:5000.

## API Endpoints

### Get Available Map Layers

```http
GET /api/map/layers
```

Returns a list of available map layers.

### Generate Map with Specified Layer

```http
POST /api/map/generate_map
```

#### Request Body

```json
{
  "layer": "openstreetmap"
}
```

Generates a map with the specified layer.

## Project Dependencies

All project dependencies are listed in the `requirements.txt` file.

```ini
fastapi==0.70.0
uvicorn==0.15.0
pydantic==1.8.2
folium==0.12.1
python-dotenv==0.19.1
fastapi-cors==0.1.0
```


# Deployment Design: Containerizing the Travel Tracker Application

## 1. Introduction and Motivation

This document outlines the design and plan for containerizing the Travel Tracker application for easy, reliable, and repeatable deployments on external machines, such as cloud VMs or on-premise servers.

The primary motivation for this effort is to improve the portability, maintainability, and scalability of the application. By packaging the application components into containers, we can ensure that the application runs consistently across different environments (development, staging, production) and simplifies the deployment process.

This document covers the containerization plan for the backend and frontend applications, the database, and other services. It also provides a deployment workflow, configuration management strategy, and other operational considerations.

## 2. System Architecture Overview

The Travel Tracker application consists of the following components:

*   **Backend:** A Python-based backend providing a REST API for the frontend. (FastAPI)
*   **Frontend:** A JavaScript-based single-page application (SPA) that communicates with the backend API. (React)
*   **Database:** A MongoDB database for storing application data, such as trip metadata.
*   **Object Storage:** A MinIO server for storing user-uploaded files, such as GPX tracks and photos.

## 3. Containerization Plan

The containerization plan involves creating Docker images for the backend and frontend applications and using Docker Compose to orchestrate all the application components.

### 3.1. Service-to-Container Mapping

The application will be composed of the following services, each running in its own container:

*   `backend`: The Python backend application.
*   `frontend`: The React frontend application, served by a lightweight web server (Nginx).
*   `database`: The MongoDB database.
*   `storage`: The MinIO object storage server.

### 3.2. Communication and Networking

The services will communicate with each other over a dedicated Docker network. The following ports will be exposed:

*   `frontend`: Port 80 (HTTP) will be exposed to the host machine to serve the web application.
*   `backend`: Port 8000 will be exposed to the frontend service within the Docker network. It will not be exposed to the host machine directly.
*   `database`: Port 27017 will be exposed to the backend service within the Docker network.
*   `storage`: Port 9000 (API) and 9001 (Console) will be exposed to the backend service within the Docker network.

### 3.3. Configuration Management

Application configuration will be managed using environment variables. This approach allows for easy configuration of the application for different environments (development, staging, production) without modifying the application code.

A `.env` file will be used to store the environment variables for each environment. This file should not be committed to the git repository.

### 3.4. Data Persistence and Volumes

To ensure data persistence across container restarts, Docker volumes will be used for the database and object storage services:

*   `database`: A volume will be created to store the MongoDB data files.
*   `storage`: A volume will be created to store the MinIO data files.

This ensures that user data is not lost when the containers are stopped or removed.

## 4. Dockerfile and Configuration Guidelines

### 4.1. Backend Dockerfile (`server/Dockerfile`)

The backend Dockerfile will use a multi-stage build to minimize image size and enhance security.

*   **Base Image:** `python:3.9-slim`
*   **User:** Create and switch to a non-root user (e.g., `appuser`) to mitigate potential container breakout attacks.
*   **Dependencies:** Install dependencies in a virtual environment or user directory to keep the system clean.
*   **Optimization:** Use `.dockerignore` to exclude `__pycache__`, `.git`, `venv`, and `.env` files from the build context.
*   **Command:** Run `uvicorn` on port 8000 (standardizing internal port).

### 4.2. Frontend Dockerfile (`client/Dockerfile`)

The frontend Dockerfile will handle the build process and serve static assets via Nginx.

*   **Build Stage:**
    *   **Base Image:** `node:16` (or LTS version)
    *   **Build:** Run `npm run build` to generate optimized static files.
*   **Production Stage:**
    *   **Base Image:** `nginx:stable-alpine`
    *   **Configuration:** Replace default Nginx config with a custom `nginx.conf`.
    *   **SPA Routing:** The `nginx.conf` must include `try_files $uri $uri/ /index.html;` to support React Router's client-side routing (preventing 404s on refresh).
    *   **Proxy:** Configure `/api` location block to proxy requests to `http://backend:8000`.

### 4.3. General Best Practices
*   **Health Checks:** Implement `HEALTHCHECK` instructions in Dockerfiles or `docker-compose.yml` to ensure services are truly ready before dependent services start.
*   **Linting:** Use tools like Hadolint to ensure Dockerfile best practices are followed.

## 5. Deployment Workflow

The deployment workflow will consist of the following steps:

1.  **Build Images:** Build the Docker images for the backend and frontend applications using `docker-compose build`.
2.  **Deploy to Remote Host:** Copy the `docker-compose.prod.yml` and `.env` files to the remote host.
3.  **Start Application:** Start the application using `docker-compose -f docker-compose.prod.yml up -d`.
4.  **Database Initialization:** On the first run, the database and object storage will be initialized automatically.
5.  **Schema Migration:** For subsequent deployments with schema changes, a migration script will need to be run.
6.  **Backups:** Regular backups of the database and object storage volumes should be performed.

## 6. Risk Analysis and Mitigation Strategies

### 6.1. Security Risks
*   **Root Access:** Default containers run as root. If compromised, this could lead to host privilege escalation.
    *   *Mitigation:* Enforce non-root users in Dockerfiles.
*   **Database Authentication:** Running MongoDB without authentication is a major security flaw.
    *   *Mitigation:* Enable MongoDB authentication by setting `MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD` in `docker-compose.yml` and updating the backend `adapter_factory.py` to use these credentials.
*   **Secret Leakage:** Committing `.env` files or hardcoding secrets.
    *   *Mitigation:* Strict `.gitignore` policies. Use environment variable injection at runtime.

### 6.2. Operational Risks
*   **SPA Routing Errors:** Users refreshing pages on non-root paths (e.g., `/trips/123`) may encounter 404 errors if the web server isn't configured for Single Page Applications.
    *   *Mitigation:* Ensure Nginx configuration includes the `try_files` directive to fallback to `index.html`.
*   **Data Persistence:** Loss of data if volumes are deleted or not mounted correctly.
    *   *Mitigation:* Use named Docker volumes (e.g., `mongo_data`, `minio_data`) instead of anonymous volumes. Implement a backup strategy for these volumes.
*   **Initialization Race Conditions:** The backend might start before the database is ready, causing crash loops.
    *   *Mitigation:* Use `depends_on` with `condition: service_healthy` in `docker-compose.yml` to wait for database health checks.

## 7. Optional Scalability Path

For future scalability, the following steps can be taken:

*   **Load Balancing:** A load balancer can be placed in front of the backend service to distribute traffic across multiple containers.
*   **Orchestration:** For more complex deployments, a container orchestration tool like Kubernetes can be used to manage the application at scale.
*   **Externalizing Services:** The database and object storage can be moved to managed services to reduce operational overhead.

This design provides a solid foundation for a containerized deployment of the Travel Tracker application. By following this plan, we can achieve a more robust, portable, and maintainable application.

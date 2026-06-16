# HealthNest Backend

## Overview

The HealthNest backend is a FastAPI application that provides authentication, appointment scheduling, secure messaging, lab result management, and AI-powered healthcare assistance for the HealthNest platform.

The backend communicates with a shared Supabase instance for authentication and data storage while exposing REST APIs consumed by the React frontend.

## Technology Stack

- Python 3.12 or 3.13
- FastAPI
- PostgreSQL
- Supabase
- Docker
- OpenAI API
- Pytest

## Core Features

### Authentication

- User registration and login
- Role-based authorization
- Patient and provider account support
- Biometric authentication using WebAuthn

### Appointment Scheduling

- Appointment creation and management
- Provider availability tracking
- Appointment retrieval and updates

### Secure Messaging

- Patient-provider messaging
- Conversation history retrieval
- Unread message tracking
- Read-status synchronization

### Lab Results

- Lab result upload and review
- Patient access to lab records
- Provider review workflows

### Pulse AI

- AI-powered patient assistant
- Healthcare information retrieval
- Context-aware patient support

## Running the Backend

### Prerequisites

- Docker Desktop
- Python 3.12 or 3.13 for local development outside Docker
- Access to the team's shared Supabase project

### Supported Python Versions

The backend supports Python `>=3.12,<3.14`. Production containers currently
use Python 3.12, while Python 3.13 is also supported for local development.
Python versions earlier than 3.12 are not supported.

### Start the Application

Copy the environment template once and fill in the local development values:

```bash
cp .env.example .env
```

The local `.env` file is ignored by Git. Do not commit Supabase service keys,
encryption keys, API keys, or database passwords.

From the project root, start the development environment:

```bash
docker compose up --build -d
```

Docker Compose automatically combines `docker-compose.yml` with
`docker-compose.override.yml`. The override enables source bind mounts and
Uvicorn `--reload` for development only.

The backend API will be available at:

```text
http://localhost:8000
```

### Test Production Configuration Locally

Production uses only the base Compose file. Supply production secrets through
the deployment environment or secret manager:

```bash
APP_ENV=production UVICORN_WORKERS=2 \
  docker compose -f docker-compose.yml up --build -d
```

The production configuration does not use Uvicorn `--reload`, does not mount
the source tree into the backend container, disables FastAPI debug output and
interactive API documentation, and does not publish the database port.

### Stop the Application

```bash
docker compose down
```

## Configuration

Application behavior is selected with `APP_ENV`:

- `development`: debug behavior and API documentation are enabled.
- `test`: debug behavior is disabled, but API documentation remains available.
- `production`: debug behavior and API documentation are disabled.

Environment values are read from the shell or the root `.env` file during
local development. Production values should come from the deployment
platform's environment or secret manager.

Key configuration values include:

- Application environment and Uvicorn worker count
- Supabase URL
- Supabase API keys
- PostgreSQL connection settings
- OpenAI API configuration
- CORS configuration

## API Documentation

FastAPI generates interactive API documentation in development and test
environments. These routes are disabled when `APP_ENV=production`.

Swagger UI:

```text
http://localhost:8000/docs
```

ReDoc:

```text
http://localhost:8000/redoc
```

## Testing

Run backend tests:

```bash
pytest
```

Run a specific test module:

```bash
pytest backend/tests/
```

## Backend Architecture

The backend follows a feature-based structure. Each feature contains its own routes, schemas, and business logic.

Typical module structure:

```text
feature/
├── router.py
├── schemas.py
└── service.py
```

Examples include:

- ai
- appointments
- auth
- lab-results
- messages
- patients
- providers

## Security Notes

This project uses:

- Supabase Authentication
- JWT-based authorization
- Role-based access controls
- Protected API endpoints
- Secure handling of patient information

The current implementation is intended for educational purposes and demonstrates healthcare security concepts inspired by HIPAA requirements.

## Contributors

Developed as part of Boston University MET CS 673 Software Engineering.

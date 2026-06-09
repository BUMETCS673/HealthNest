# HealthNest Backend

## Overview

The HealthNest backend is a FastAPI application that provides authentication, appointment scheduling, secure messaging, lab result management, and AI-powered healthcare assistance for the HealthNest platform.

The backend communicates with a shared Supabase instance for authentication and data storage while exposing REST APIs consumed by the React frontend.

## Technology Stack

- Python
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
- Access to the team's shared Supabase project

### Start the Application

From the project root:

```bash
docker compose up --build
```

The backend API will be available at:

```text
http://localhost:8000
```

### Stop the Application

```bash
docker compose down
```

## Configuration

Application configuration is currently managed through the project's `docker-compose.yml` file.

Key configuration values include:

- Supabase URL
- Supabase API keys
- PostgreSQL connection settings
- OpenAI API configuration
- CORS configuration

## API Documentation

FastAPI automatically generates interactive API documentation.

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

import os
from dataclasses import dataclass


VALID_ENVIRONMENTS = {"development", "test", "production"}


def environment_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def required_environment_variable(name: str) -> str:
    value = os.getenv(name)

    if not value:
        raise RuntimeError(
            f"Required environment variable {name} is not configured."
        )

    return value


@dataclass(frozen=True)
class Settings:
    environment: str
    debug: bool
    docs_enabled: bool
    cors_allowed_origins: list[str]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


def load_settings() -> Settings:
    environment = os.getenv("APP_ENV", "development").lower()

    if environment not in VALID_ENVIRONMENTS:
        raise RuntimeError(
            "APP_ENV must be development, test, or production."
        )

    origins = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ALLOWED_ORIGINS",
            (
                "http://localhost:5173,http://127.0.0.1:5173,"
                "http://localhost:4173,http://127.0.0.1:4173"
            ),
        ).split(",")
        if origin.strip()
    ]

    if environment == "production":
        required_environment_variable("SUPABASE_URL")
        required_environment_variable("SUPABASE_KEY")
        required_environment_variable("SUPABASE_SERVICE_KEY")
        required_environment_variable("LAB_RESULTS_KEK")

        if "*" in origins:
            raise RuntimeError(
                "Wildcard CORS origins are prohibited in production."
            )

    return Settings(
        environment=environment,
        debug=environment == "development" and environment_flag("APP_DEBUG"),
        docs_enabled=environment != "production",
        cors_allowed_origins=origins,
    )


settings = load_settings()

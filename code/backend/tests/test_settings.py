from settings import load_settings


def test_debug_mode_is_disabled_by_default(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("APP_DEBUG", raising=False)

    assert load_settings().debug is False


def test_debug_mode_requires_explicit_development_opt_in(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("APP_DEBUG", "true")

    assert load_settings().debug is True


def test_debug_mode_cannot_be_enabled_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("APP_DEBUG", "true")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "test-anon-key")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "test-service-key")
    monkeypatch.setenv("LAB_RESULTS_KEK", "test-kek")

    assert load_settings().debug is False


def test_default_cors_origins_include_vite_dev_and_preview(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)

    assert load_settings().cors_allowed_origins == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ]

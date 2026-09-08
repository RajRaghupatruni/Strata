from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Strata"
    environment: str = "local"
    database_url: str = "sqlite:///./strata.db"
    riot_api_key: str | None = None
    riot_default_region: str = "na"
    coaching_ai_enabled: bool = False
    coaching_mode: str = "deterministic"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()

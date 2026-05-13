from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # MongoDB Atlas
    MONGODB_URI: str="mongodb+srv://gauryosborn:gaury1234@cluster0.t80nv87.mongodb.net/?appName=Cluster0"
    MONGODB_DB: str = "resumebuilder"
    MONGODB_COLLECTION: str = "resumes"

    # Groq via OpenAI SDK
    GROQ_API_KEY: str
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_MODEL: str = "openai/gpt-oss-120b"  # 109B total / ~120B marketed
    GROQ_FALLBACK_MODEL: str = "llama-3.3-70b-versatile"

    # Server
    PORT: int = 3001
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:4173,https://jobx-delta.vercel.app"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()

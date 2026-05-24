from pydantic import BaseModel


class ProviderOut(BaseModel):
    id: str
    first_name: str
    last_name: str
    title: str | None = None
    specialty: str | None = None
    status: str

from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from api.files import router as file_router

app = FastAPI()

app.include_router(file_router, prefix="/file", tags=["Upload"])
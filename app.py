import base64
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

BASE_DIR = Path(__file__).parent

app = FastAPI(title="Lucky Draw")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

# ─── In-memory state ───────────────────────────────────────────────────────────
state: dict = {
    "participants": [],
    "config": {
        "winners_count": 3,
        "speed": "medium",
    },
    "banner": {
        "type": "none",       # "none" | "text" | "image"
        "text": "",
        "style": "elegant",   # "elegant" | "neon" | "festive"
        "image_data": None,
    },
}


# ─── Request models ────────────────────────────────────────────────────────────
class ParticipantIn(BaseModel):
    emoji: str
    name: str


class ConfigIn(BaseModel):
    winners_count: int
    speed: str


class BannerIn(BaseModel):
    type: str
    text: str = ""
    style: str = "elegant"


# ─── Routes ────────────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def game_page(request: Request):
    return templates.TemplateResponse(request, "game.html")


@app.get("/admin", response_class=HTMLResponse)
async def admin_page(request: Request):
    return templates.TemplateResponse(request, "admin.html")


@app.get("/api/state")
async def get_state():
    return state


@app.post("/api/participants", status_code=201)
async def add_participant(participant: ParticipantIn):
    if not participant.name.strip():
        raise HTTPException(status_code=400, detail="name must not be empty")
    if not participant.emoji.strip():
        raise HTTPException(status_code=400, detail="emoji must not be empty")
    new_p = {
        "id": str(uuid.uuid4()),
        "emoji": participant.emoji.strip(),
        "name": participant.name.strip(),
    }
    state["participants"].append(new_p)
    return new_p


@app.delete("/api/participants/{participant_id}")
async def remove_participant(participant_id: str):
    before = len(state["participants"])
    state["participants"] = [p for p in state["participants"] if p["id"] != participant_id]
    if len(state["participants"]) == before:
        raise HTTPException(status_code=404, detail="participant not found")
    return {"ok": True}


@app.put("/api/config")
async def update_config(config: ConfigIn):
    if config.winners_count < 1:
        raise HTTPException(status_code=400, detail="winners_count must be >= 1")
    if config.speed not in ("slow", "medium", "fast"):
        raise HTTPException(status_code=400, detail="speed must be slow, medium, or fast")
    state["config"]["winners_count"] = config.winners_count
    state["config"]["speed"] = config.speed
    return state["config"]


@app.put("/api/banner")
async def update_banner(banner: BannerIn):
    if banner.type not in ("none", "text", "image"):
        raise HTTPException(status_code=400, detail="type must be none, text, or image")
    if banner.style not in ("elegant", "neon", "festive"):
        raise HTTPException(status_code=400, detail="style must be elegant, neon, or festive")
    text = banner.text.strip()
    if banner.type == "text":
        if not text:
            raise HTTPException(status_code=400, detail="text must not be empty")
        if len(text) > 80:
            raise HTTPException(status_code=400, detail="text must be 80 characters or fewer")
    state["banner"]["type"] = banner.type
    state["banner"]["text"] = text
    state["banner"]["style"] = banner.style
    return state["banner"]


@app.post("/api/banner/upload")
async def upload_banner_image(file: UploadFile = File(...)):
    MAX_BYTES = 2 * 1024 * 1024
    ALLOWED_MIME = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="image must be jpeg, png, gif, or webp")
    raw = await file.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="image must be 2 MB or smaller")
    encoded = base64.b64encode(raw).decode("ascii")
    data_url = f"data:{file.content_type};base64,{encoded}"
    state["banner"]["image_data"] = data_url
    state["banner"]["type"] = "image"
    return {"ok": True, "data_url": data_url}

# Lucky Draw 🎲

A physics-based lucky draw web app. Emoji+name balls fall through a peg board, funnel into a narrow bucket, and winners are announced in arrival order.

## Quick start

```bash
cd lucky_draw
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

| Page | URL |
|------|-----|
| 🎮 Game (full-screen) | http://localhost:8000 |
| ⚙️ Admin | http://localhost:8000/admin |

## Usage

1. Open **Admin** → add participants (choose emoji + enter name)
2. Set the number of winners and drop speed, click **Save Settings**
3. Click **Open Game** to open the game in a new tab (best on a projector/large screen)
4. Click **Start Round** — balls drop, bounce off pegs, race to the bucket
5. Winners are announced in the order they reach the bucket
6. Click **New Round** to play again (participants and settings are preserved)

> **Note:** State is in-memory. Participants and settings reset when the server restarts.

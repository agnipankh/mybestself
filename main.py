# MVP Step 1 & 2: Onboarding Q&A + Simple Tracker (FastAPI backend)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import datetime

app = FastAPI()

# Allow frontend dev on localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for demo (can be upgraded to DB later)
USERS = {}
CHECKINS = {}

# Models
class OnboardingResponse(BaseModel):
    user_id: str
    goals: str
    strengths: str
    weaknesses: str

class HabitLog(BaseModel):
    user_id: str
    habit: str
    timestamp: Optional[datetime.datetime] = None

# Step 1: Onboarding Q&A
@app.post("/onboarding")
def onboarding(response: OnboardingResponse):
    USERS[response.user_id] = {
        "goals": response.goals,
        "strengths": response.strengths,
        "weaknesses": response.weaknesses,
        "created": datetime.datetime.utcnow()
    }
    return {"message": "User profile created", "user": USERS[response.user_id]}

# Step 2: Track simple actions (habits)
@app.post("/checkin")
def checkin(log: HabitLog):
    ts = log.timestamp or datetime.datetime.utcnow()
    if log.user_id not in CHECKINS:
        CHECKINS[log.user_id] = []
    CHECKINS[log.user_id].append({"habit": log.habit, "timestamp": ts})
    return {"message": "Check-in recorded", "count": len(CHECKINS[log.user_id])}

# Debug routes
@app.get("/user/{user_id}")
def get_user(user_id: str):
    return USERS.get(user_id, {})

@app.get("/checkins/{user_id}")
def get_checkins(user_id: str):
    return CHECKINS.get(user_id, [])


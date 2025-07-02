#!/usr/bin/env python3

"""
Create test data for dashboard visualization
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from db import SessionLocal, init_db
from models import User, Persona, Goal
from datetime import datetime, date, timedelta

def create_test_data():
    """Create comprehensive test data for dashboard"""
    
    # Initialize database
    init_db()
    db = SessionLocal()
    
    try:
        # Check if test user already exists
        existing_user = db.query(User).filter_by(email="sarah@dashboard-test.com").first()
        if existing_user:
            print("Test user already exists. Cleaning up first...")
            # Clean up existing data
            db.query(Goal).filter_by(user_id=existing_user.id).delete()
            db.query(Persona).filter_by(user_id=existing_user.id).delete()
            db.query(User).filter_by(id=existing_user.id).delete()
            db.commit()
        
        # Create test user
        user = User(
            name="Sarah Chen",
            email="sarah@dashboard-test.com"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"✅ Created user: {user.name} (ID: {user.id})")
        
        # Create test personas with varying importance
        personas_data = [
            {
                'label': 'Professional Leader',
                'north_star': 'Lead with impact and integrity',
                'importance': 5,
                'goals': [
                    {'name': 'Complete Q4 Strategy', 'planned': 12, 'actual': 8, 'progress': 65},
                    {'name': 'Build Team Culture', 'planned': 6, 'actual': 9, 'progress': 85},
                    {'name': 'Get AWS Certification', 'planned': 20, 'actual': 15, 'progress': 40}
                ]
            },
            {
                'label': 'Health Optimizer',
                'north_star': 'Maintain physical and mental wellness',
                'importance': 4,
                'goals': [
                    {'name': 'Run 3x/week', 'planned': 4, 'actual': 3, 'progress': 75},
                    {'name': 'Meal prep Sundays', 'planned': 2, 'actual': 2, 'progress': 90},
                    {'name': 'Sleep 8h nightly', 'planned': 1, 'actual': 0.5, 'progress': 60}
                ]
            },
            {
                'label': 'Creative Explorer',
                'north_star': 'Express creativity and learn new skills',
                'importance': 3,
                'goals': [
                    {'name': 'Write 500 words daily', 'planned': 7, 'actual': 4, 'progress': 30},
                    {'name': 'Learn watercolors', 'planned': 5, 'actual': 6, 'progress': 60}
                ]
            },
            {
                'label': 'Family Connector',
                'north_star': 'Strengthen relationships with loved ones',
                'importance': 5,
                'goals': [
                    {'name': 'Date nights weekly', 'planned': 3, 'actual': 2, 'progress': 80},
                    {'name': 'Kids bedtime stories', 'planned': 3, 'actual': 4, 'progress': 95},
                    {'name': 'Call parents weekly', 'planned': 1, 'actual': 1, 'progress': 100}
                ]
            }
        ]
        
        # Create personas and goals
        for persona_data in personas_data:
            persona = Persona(
                user_id=user.id,
                label=persona_data['label'],
                north_star=persona_data['north_star'],
                importance=persona_data['importance']
            )
            db.add(persona)
            db.commit()
            db.refresh(persona)
            
            print(f"✅ Created persona: {persona.label} (importance: {persona.importance})")
            
            # Create goals for this persona
            for goal_data in persona_data['goals']:
                goal = Goal(
                    user_id=user.id,
                    persona_id=persona.id,
                    name=goal_data['name'],
                    planned_hours=goal_data['planned'],
                    actual_hours=goal_data['actual'],
                    success_percentage=goal_data['progress'],
                    review_date=datetime.now() + timedelta(days=7),  # Next week
                    status='active'
                )
                db.add(goal)
            
            db.commit()
            print(f"  └─ Added {len(persona_data['goals'])} goals")
        
        print(f"\n🎉 Test data created successfully!")
        print(f"📊 Dashboard URL: http://localhost:3000/dashboard")
        print(f"👤 User ID for API testing: {user.id}")
        print(f"🔗 API endpoint: http://localhost:8000/users/{user.id}/dashboard")
        
        return user.id
        
    except Exception as e:
        print(f"❌ Error creating test data: {e}")
        db.rollback()
        return None
        
    finally:
        db.close()

if __name__ == "__main__":
    user_id = create_test_data()
    if user_id:
        sys.exit(0)
    else:
        sys.exit(1)
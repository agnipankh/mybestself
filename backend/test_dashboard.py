#!/usr/bin/env python3

"""
Quick test script for dashboard functionality
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from db import SessionLocal, init_db
from models import User, Persona, Goal
from datetime import datetime, date

def test_dashboard_data():
    """Test dashboard data generation with new fields"""
    
    # Initialize database
    init_db()
    db = SessionLocal()
    
    try:
        # Create test user with unique email
        import time
        user = User(
            name="Sarah Chen",
            email=f"sarah_test_{int(time.time())}@example.com"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Create test personas with importance
        persona1 = Persona(
            user_id=user.id,
            label="Professional Leader",
            north_star="Lead with impact and integrity",
            importance=5
        )
        
        persona2 = Persona(
            user_id=user.id,
            label="Health Optimizer", 
            north_star="Maintain physical and mental wellness",
            importance=4
        )
        
        db.add(persona1)
        db.add(persona2)
        db.commit()
        db.refresh(persona1)
        db.refresh(persona2)
        
        # Create test goals with new fields
        goal1 = Goal(
            user_id=user.id,
            persona_id=persona1.id,
            name="Complete Q4 Strategy",
            planned_hours=12,
            actual_hours=8,
            success_percentage=65,
            review_date=datetime.now()
        )
        
        goal2 = Goal(
            user_id=user.id,
            persona_id=persona1.id,
            name="Build Team Culture",
            planned_hours=6,
            actual_hours=9,
            success_percentage=85,
            review_date=datetime.now()
        )
        
        goal3 = Goal(
            user_id=user.id,
            persona_id=persona2.id,
            name="Run 3x/week",
            planned_hours=4,
            actual_hours=3,
            success_percentage=75,
            review_date=datetime.now()
        )
        
        db.add(goal1)
        db.add(goal2)
        db.add(goal3)
        db.commit()
        
        # Test dashboard calculation logic
        print("=== Dashboard Data Test ===")
        print(f"User: {user.name}")
        print(f"User ID: {user.id}")
        
        for persona in user.personas:
            total_actual = sum(goal.actual_hours for goal in persona.goals)
            total_planned = sum(goal.planned_hours for goal in persona.goals)
            
            # Calculate weighted progress
            weighted_progress = sum(goal.success_percentage * goal.planned_hours for goal in persona.goals)
            persona_progress = int(weighted_progress / total_planned) if total_planned > 0 else 0
            
            print(f"\nPersona: {persona.label}")
            print(f"  Importance: {persona.importance}")
            print(f"  Actual Time: {total_actual}h")
            print(f"  Planned Time: {total_planned}h") 
            print(f"  Progress: {persona_progress}%")
            print(f"  Goals: {len(persona.goals)}")
            
            for goal in persona.goals:
                print(f"    - {goal.name}: {goal.planned_hours}h planned, {goal.actual_hours}h actual, {goal.success_percentage}% done")
        
        # Calculate user overall progress
        total_importance = sum(p.importance for p in user.personas)
        total_weighted = sum(p.importance * 
                           (sum(g.success_percentage * g.planned_hours for g in p.goals) / 
                            sum(g.planned_hours for g in p.goals) if sum(g.planned_hours for g in p.goals) > 0 else 0)
                           for p in user.personas)
        user_progress = int(total_weighted / total_importance) if total_importance > 0 else 0
        
        print(f"\nUser Overall Progress: {user_progress}%")
        print("✅ Dashboard data test completed successfully!")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False
        
    finally:
        # Cleanup
        db.query(Goal).delete()
        db.query(Persona).delete() 
        db.query(User).delete()
        db.commit()
        db.close()

if __name__ == "__main__":
    success = test_dashboard_data()
    sys.exit(0 if success else 1)
#!/usr/bin/env python3
"""
Create test users for LearnSphere LMS testing
"""

import requests
import json

BACKEND_URL = "https://b77a6ae7-123f-4230-b258-9cac6644c213.preview.emergentagent.com/api"

def create_test_users():
    """Create test users for testing"""
    
    users_to_create = [
        {
            "email": "instructor@learnsphere.com",
            "password": "instructor123",
            "full_name": "Test Instructor",
            "role": "instructor"
        },
        {
            "email": "student@learnsphere.com", 
            "password": "student123",
            "full_name": "Test Student",
            "role": "student"
        },
        {
            "email": "admin@learnsphere.com",
            "password": "admin123", 
            "full_name": "Test Admin",
            "role": "admin"
        }
    ]
    
    session = requests.Session()
    
    for user_data in users_to_create:
        try:
            response = session.post(f"{BACKEND_URL}/auth/register", json=user_data)
            
            if response.status_code == 201:
                user_info = response.json()
                print(f"✅ Created user: {user_info['email']} ({user_info['role']})")
            elif response.status_code == 400 and "already registered" in response.text:
                print(f"ℹ️  User already exists: {user_data['email']}")
            else:
                print(f"❌ Failed to create user {user_data['email']}: {response.status_code} - {response.text}")
                
        except Exception as e:
            print(f"❌ Error creating user {user_data['email']}: {str(e)}")

if __name__ == "__main__":
    print("Creating test users for LearnSphere LMS...")
    create_test_users()
    print("Done!")
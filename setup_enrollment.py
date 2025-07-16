#!/usr/bin/env python3
"""
Enroll test student in test course and publish course
"""

import requests
import json

BACKEND_URL = "https://b77a6ae7-123f-4230-b258-9cac6644c213.preview.emergentagent.com/api"
STUDENT_EMAIL = "student@learnsphere.com"
STUDENT_PASSWORD = "student123"
INSTRUCTOR_EMAIL = "instructor@learnsphere.com"
INSTRUCTOR_PASSWORD = "instructor123"

def authenticate_user(email, password):
    """Authenticate user and return token"""
    session = requests.Session()
    response = session.post(f"{BACKEND_URL}/auth/login", json={
        "email": email,
        "password": password
    })
    
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token"), data.get("user")
    return None, None

def get_test_course():
    """Get the test course created by instructor"""
    instructor_token, instructor_user = authenticate_user(INSTRUCTOR_EMAIL, INSTRUCTOR_PASSWORD)
    if not instructor_token:
        print("❌ Failed to authenticate instructor")
        return None
    
    headers = {"Authorization": f"Bearer {instructor_token}"}
    response = requests.get(f"{BACKEND_URL}/courses", headers=headers)
    
    if response.status_code == 200:
        courses = response.json()
        for course in courses:
            if "Test Course for API Testing" in course.get("title", ""):
                return course, instructor_token
    
    return None, instructor_token

def publish_course(course_id, instructor_token):
    """Publish the test course"""
    headers = {"Authorization": f"Bearer {instructor_token}"}
    response = requests.put(f"{BACKEND_URL}/courses/{course_id}", 
        json={"is_published": True},
        headers=headers
    )
    
    if response.status_code == 200:
        print(f"✅ Course published: {course_id}")
        return True
    else:
        print(f"❌ Failed to publish course: {response.status_code} - {response.text}")
        return False

def enroll_student(course_id):
    """Enroll student in the course"""
    student_token, student_user = authenticate_user(STUDENT_EMAIL, STUDENT_PASSWORD)
    if not student_token:
        print("❌ Failed to authenticate student")
        return False
    
    headers = {"Authorization": f"Bearer {student_token}"}
    response = requests.post(f"{BACKEND_URL}/enrollments", 
        json={"course_id": course_id},
        headers=headers
    )
    
    if response.status_code == 201:
        print(f"✅ Student enrolled in course: {course_id}")
        return True
    elif response.status_code == 400 and "Already enrolled" in response.text:
        print(f"ℹ️  Student already enrolled in course: {course_id}")
        return True
    else:
        print(f"❌ Failed to enroll student: {response.status_code} - {response.text}")
        return False

def main():
    print("Setting up test course enrollment...")
    
    # Get test course
    course, instructor_token = get_test_course()
    if not course:
        print("❌ No test course found")
        return False
    
    course_id = course.get("id")
    print(f"Found test course: {course_id}")
    
    # Publish course if not published
    if not course.get("is_published"):
        if not publish_course(course_id, instructor_token):
            return False
    else:
        print(f"ℹ️  Course already published: {course_id}")
    
    # Enroll student
    if not enroll_student(course_id):
        return False
    
    print("✅ Setup complete!")
    return True

if __name__ == "__main__":
    main()
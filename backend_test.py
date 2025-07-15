#!/usr/bin/env python3
"""
LearnSphere Backend API Test Suite
Tests all API endpoints for the course management system
"""

import requests
import sys
import json
from datetime import datetime
import uuid

class LearnSphereAPITester:
    def __init__(self, base_url="https://bf6245ba-628d-4f62-8002-e4d50439359a.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tokens = {}  # Store tokens for different users
        self.users = {}   # Store user data
        self.courses = {} # Store course data
        self.tests_run = 0
        self.tests_passed = 0
        
        # Test data
        self.test_timestamp = datetime.now().strftime('%H%M%S')
        
    def log(self, message, level="INFO"):
        """Log test messages"""
        print(f"[{level}] {message}")
        
    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, user_token=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if user_token:
            test_headers['Authorization'] = f'Bearer {user_token}'
        elif headers:
            test_headers.update(headers)

        self.tests_run += 1
        self.log(f"Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}", "PASS")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}", "FAIL")
                try:
                    error_detail = response.json()
                    self.log(f"   Error details: {error_detail}", "ERROR")
                except:
                    self.log(f"   Response text: {response.text}", "ERROR")
                return False, {}

        except Exception as e:
            self.log(f"❌ {name} - Exception: {str(e)}", "FAIL")
            return False, {}

    def test_user_registration(self):
        """Test user registration for different roles"""
        self.log("\n=== Testing User Registration ===")
        
        # Test data for different roles
        test_users = [
            {
                "role": "admin",
                "email": f"admin_{self.test_timestamp}@test.com",
                "password": "AdminPass123!",
                "full_name": "Test Admin"
            },
            {
                "role": "instructor", 
                "email": f"instructor_{self.test_timestamp}@test.com",
                "password": "InstructorPass123!",
                "full_name": "Test Instructor"
            },
            {
                "role": "student",
                "email": f"student_{self.test_timestamp}@test.com", 
                "password": "StudentPass123!",
                "full_name": "Test Student"
            }
        ]
        
        for user_data in test_users:
            success, response = self.run_test(
                f"Register {user_data['role']}",
                "POST",
                "auth/register",
                200,
                data=user_data
            )
            
            if success:
                self.users[user_data['role']] = {
                    'email': user_data['email'],
                    'password': user_data['password'],
                    'user_data': response
                }
                
        # Test duplicate registration
        if 'student' in self.users:
            self.run_test(
                "Register duplicate user",
                "POST", 
                "auth/register",
                400,
                data=self.users['student']
            )

    def test_user_login(self):
        """Test user login for all registered users"""
        self.log("\n=== Testing User Login ===")
        
        for role, user_info in self.users.items():
            success, response = self.run_test(
                f"Login {role}",
                "POST",
                "auth/login", 
                200,
                data={
                    "email": user_info['email'],
                    "password": user_info['password']
                }
            )
            
            if success and 'access_token' in response:
                self.tokens[role] = response['access_token']
                self.log(f"   Token obtained for {role}")
                
        # Test invalid login
        self.run_test(
            "Login with invalid credentials",
            "POST",
            "auth/login",
            401,
            data={
                "email": "invalid@test.com",
                "password": "wrongpassword"
            }
        )

    def test_auth_me(self):
        """Test getting current user info"""
        self.log("\n=== Testing Auth Me Endpoint ===")
        
        for role, token in self.tokens.items():
            self.run_test(
                f"Get current user info ({role})",
                "GET",
                "auth/me",
                200,
                user_token=token
            )
            
        # Test without token
        self.run_test(
            "Get current user info without token",
            "GET", 
            "auth/me",
            401
        )

    def test_dashboard_stats(self):
        """Test dashboard statistics for different roles"""
        self.log("\n=== Testing Dashboard Stats ===")
        
        for role, token in self.tokens.items():
            success, response = self.run_test(
                f"Get dashboard stats ({role})",
                "GET",
                "dashboard/stats", 
                200,
                user_token=token
            )
            
            if success:
                self.log(f"   {role} stats: {response}")

    def test_course_management(self):
        """Test course creation and management"""
        self.log("\n=== Testing Course Management ===")
        
        # Test course creation by instructor
        if 'instructor' in self.tokens:
            course_data = {
                "title": f"Test Course {self.test_timestamp}",
                "description": "This is a test course for API testing",
                "instructor_id": "will_be_set_by_backend",
                "duration_weeks": 12,
                "max_students": 30,
                "is_published": True
            }
            
            success, response = self.run_test(
                "Create course (instructor)",
                "POST",
                "courses",
                200,
                data=course_data,
                user_token=self.tokens['instructor']
            )
            
            if success:
                self.courses['test_course'] = response
                self.log(f"   Created course ID: {response.get('id')}")
                
        # Test course creation by student (should fail)
        if 'student' in self.tokens:
            self.run_test(
                "Create course (student - should fail)",
                "POST", 
                "courses",
                403,
                data=course_data,
                user_token=self.tokens['student']
            )
            
        # Test getting courses for different roles
        for role, token in self.tokens.items():
            self.run_test(
                f"Get courses ({role})",
                "GET",
                "courses",
                200,
                user_token=token
            )

    def test_course_details(self):
        """Test getting specific course details"""
        self.log("\n=== Testing Course Details ===")
        
        if 'test_course' in self.courses and 'student' in self.tokens:
            course_id = self.courses['test_course']['id']
            
            self.run_test(
                "Get course details",
                "GET",
                f"courses/{course_id}",
                200,
                user_token=self.tokens['student']
            )
            
            # Test non-existent course
            fake_id = str(uuid.uuid4())
            self.run_test(
                "Get non-existent course",
                "GET",
                f"courses/{fake_id}",
                404,
                user_token=self.tokens['student']
            )

    def test_course_updates(self):
        """Test course updates by instructor"""
        self.log("\n=== Testing Course Updates ===")
        
        if 'test_course' in self.courses and 'instructor' in self.tokens:
            course_id = self.courses['test_course']['id']
            
            update_data = {
                "title": f"Updated Test Course {self.test_timestamp}",
                "description": "This course has been updated",
                "instructor_id": "will_be_ignored",
                "duration_weeks": 16,
                "max_students": 40,
                "is_published": True
            }
            
            self.run_test(
                "Update course (instructor)",
                "PUT",
                f"courses/{course_id}",
                200,
                data=update_data,
                user_token=self.tokens['instructor']
            )
            
        # Test update by student (should fail)
        if 'test_course' in self.courses and 'student' in self.tokens:
            course_id = self.courses['test_course']['id']
            
            self.run_test(
                "Update course (student - should fail)",
                "PUT",
                f"courses/{course_id}",
                403,
                data=update_data,
                user_token=self.tokens['student']
            )

    def test_enrollments(self):
        """Test course enrollment functionality"""
        self.log("\n=== Testing Course Enrollments ===")
        
        if 'test_course' in self.courses and 'student' in self.tokens:
            course_id = self.courses['test_course']['id']
            
            # Test enrollment
            success, response = self.run_test(
                "Enroll in course (student)",
                "POST",
                "enrollments",
                200,
                data={"course_id": course_id},
                user_token=self.tokens['student']
            )
            
            # Test duplicate enrollment
            self.run_test(
                "Duplicate enrollment (should fail)",
                "POST",
                "enrollments", 
                400,
                data={"course_id": course_id},
                user_token=self.tokens['student']
            )
            
            # Test enrollment by instructor (should fail)
            if 'instructor' in self.tokens:
                self.run_test(
                    "Enroll in course (instructor - should fail)",
                    "POST",
                    "enrollments",
                    403,
                    data={"course_id": course_id},
                    user_token=self.tokens['instructor']
                )
                
        # Test enrollment in non-existent course
        if 'student' in self.tokens:
            fake_id = str(uuid.uuid4())
            self.run_test(
                "Enroll in non-existent course",
                "POST",
                "enrollments",
                404,
                data={"course_id": fake_id},
                user_token=self.tokens['student']
            )

    def test_get_enrollments(self):
        """Test getting user enrollments"""
        self.log("\n=== Testing Get Enrollments ===")
        
        if 'student' in self.tokens:
            success, response = self.run_test(
                "Get student enrollments",
                "GET",
                "enrollments",
                200,
                user_token=self.tokens['student']
            )
            
            if success:
                self.log(f"   Student has {len(response)} enrollments")

    def test_modules(self):
        """Test course modules functionality"""
        self.log("\n=== Testing Course Modules ===")
        
        if 'test_course' in self.courses and 'instructor' in self.tokens:
            course_id = self.courses['test_course']['id']
            
            # Test module creation by instructor
            module_data = {
                "title": "Introduction Module",
                "description": "This is the first module of the course",
                "content": "Welcome to the course! This module covers basic concepts.",
                "order": 1,
                "content_type": "text"
            }
            
            success, response = self.run_test(
                "Create module (instructor)",
                "POST",
                f"courses/{course_id}/modules",
                200,
                data=module_data,
                user_token=self.tokens['instructor']
            )
            
            if success:
                self.courses['test_module'] = response
                self.log(f"   Created module ID: {response.get('id')}")
                
            # Test module creation by student (should fail)
            if 'student' in self.tokens:
                self.run_test(
                    "Create module (student - should fail)",
                    "POST",
                    f"courses/{course_id}/modules",
                    403,
                    data=module_data,
                    user_token=self.tokens['student']
                )
                
            # Test getting modules
            for role, token in self.tokens.items():
                if role in ['instructor', 'student']:  # Only enrolled users can see modules
                    self.run_test(
                        f"Get modules ({role})",
                        "GET",
                        f"courses/{course_id}/modules",
                        200,
                        user_token=token
                    )

    def test_assignments(self):
        """Test assignment functionality"""
        self.log("\n=== Testing Assignments ===")
        
        if 'test_course' in self.courses and 'instructor' in self.tokens:
            course_id = self.courses['test_course']['id']
            
            # Test assignment creation by instructor
            assignment_data = {
                "title": "First Assignment",
                "description": "Complete the reading and answer questions",
                "due_date": "2024-12-31T23:59:59",
                "max_score": 100,
                "instructions": "Read chapter 1 and answer all questions in detail."
            }
            
            success, response = self.run_test(
                "Create assignment (instructor)",
                "POST",
                f"courses/{course_id}/assignments",
                200,
                data=assignment_data,
                user_token=self.tokens['instructor']
            )
            
            if success:
                self.courses['test_assignment'] = response
                assignment_id = response.get('id')
                self.log(f"   Created assignment ID: {assignment_id}")
                
                # Test assignment submission by student
                if 'student' in self.tokens:
                    submission_data = {
                        "assignment_id": assignment_id,
                        "content": "This is my submission for the first assignment.",
                        "file_path": None
                    }
                    
                    success, sub_response = self.run_test(
                        "Submit assignment (student)",
                        "POST",
                        f"assignments/{assignment_id}/submissions",
                        200,
                        data=submission_data,
                        user_token=self.tokens['student']
                    )
                    
                    if success:
                        self.courses['test_submission'] = sub_response
                        
                    # Test duplicate submission (should fail)
                    self.run_test(
                        "Duplicate assignment submission (should fail)",
                        "POST",
                        f"assignments/{assignment_id}/submissions",
                        400,
                        data=submission_data,
                        user_token=self.tokens['student']
                    )
                    
                # Test getting submissions
                self.run_test(
                    "Get assignment submissions (instructor)",
                    "GET",
                    f"assignments/{assignment_id}/submissions",
                    200,
                    user_token=self.tokens['instructor']
                )
                
                if 'student' in self.tokens:
                    self.run_test(
                        "Get assignment submissions (student)",
                        "GET",
                        f"assignments/{assignment_id}/submissions",
                        200,
                        user_token=self.tokens['student']
                    )
                    
                # Test grading submission
                if 'test_submission' in self.courses:
                    submission_id = self.courses['test_submission']['id']
                    grade_data = {
                        "score": 85,
                        "feedback": "Good work! Consider expanding on point 3."
                    }
                    
                    self.run_test(
                        "Grade submission (instructor)",
                        "PUT",
                        f"submissions/{submission_id}/grade",
                        200,
                        data=grade_data,
                        user_token=self.tokens['instructor']
                    )
                    
            # Test getting assignments
            for role, token in self.tokens.items():
                if role in ['instructor', 'student']:
                    self.run_test(
                        f"Get assignments ({role})",
                        "GET",
                        f"courses/{course_id}/assignments",
                        200,
                        user_token=token
                    )

    def test_quizzes(self):
        """Test quiz functionality"""
        self.log("\n=== Testing Quizzes ===")
        
        if 'test_course' in self.courses and 'instructor' in self.tokens:
            course_id = self.courses['test_course']['id']
            
            # Test quiz creation by instructor
            quiz_data = {
                "title": "Chapter 1 Quiz",
                "description": "Test your knowledge of chapter 1 concepts",
                "duration_minutes": 30,
                "max_attempts": 2,
                "questions": [
                    {
                        "question": "What is the capital of France?",
                        "options": ["London", "Berlin", "Paris", "Madrid"],
                        "correct_answer": 2,
                        "points": 1
                    },
                    {
                        "question": "Which programming language is this course about?",
                        "options": ["Java", "Python", "C++", "JavaScript"],
                        "correct_answer": 1,
                        "points": 1
                    }
                ]
            }
            
            success, response = self.run_test(
                "Create quiz (instructor)",
                "POST",
                f"courses/{course_id}/quizzes",
                200,
                data=quiz_data,
                user_token=self.tokens['instructor']
            )
            
            if success:
                self.courses['test_quiz'] = response
                quiz_id = response.get('id')
                self.log(f"   Created quiz ID: {quiz_id}")
                
                # Test quiz attempt by student
                if 'student' in self.tokens:
                    attempt_data = {
                        "quiz_id": quiz_id,
                        "answers": [
                            {"answer": 2},  # Correct answer for question 1
                            {"answer": 1}   # Correct answer for question 2
                        ]
                    }
                    
                    success, attempt_response = self.run_test(
                        "Submit quiz attempt (student)",
                        "POST",
                        f"quizzes/{quiz_id}/attempts",
                        200,
                        data=attempt_data,
                        user_token=self.tokens['student']
                    )
                    
                    if success:
                        self.log(f"   Quiz score: {attempt_response.get('score')}/{attempt_response.get('max_score')}")
                        
                    # Test getting quiz attempts
                    self.run_test(
                        "Get quiz attempts (student)",
                        "GET",
                        f"quizzes/{quiz_id}/attempts",
                        200,
                        user_token=self.tokens['student']
                    )
                    
                    self.run_test(
                        "Get quiz attempts (instructor)",
                        "GET",
                        f"quizzes/{quiz_id}/attempts",
                        200,
                        user_token=self.tokens['instructor']
                    )
                    
            # Test getting quizzes
            for role, token in self.tokens.items():
                if role in ['instructor', 'student']:
                    self.run_test(
                        f"Get quizzes ({role})",
                        "GET",
                        f"courses/{course_id}/quizzes",
                        200,
                        user_token=token
                    )

    def test_discussions(self):
        """Test discussion functionality"""
        self.log("\n=== Testing Discussions ===")
        
        if 'test_course' in self.courses:
            course_id = self.courses['test_course']['id']
            
            # Test discussion creation by instructor
            if 'instructor' in self.tokens:
                discussion_data = {
                    "title": "Welcome Discussion",
                    "content": "Welcome to the course! Please introduce yourselves here."
                }
                
                success, response = self.run_test(
                    "Create discussion (instructor)",
                    "POST",
                    f"courses/{course_id}/discussions",
                    200,
                    data=discussion_data,
                    user_token=self.tokens['instructor']
                )
                
                if success:
                    self.courses['test_discussion'] = response
                    discussion_id = response.get('id')
                    self.log(f"   Created discussion ID: {discussion_id}")
                    
                    # Test reply creation by student
                    if 'student' in self.tokens:
                        reply_data = {
                            "content": "Hello everyone! I'm excited to be part of this course."
                        }
                        
                        self.run_test(
                            "Create reply (student)",
                            "POST",
                            f"discussions/{discussion_id}/replies",
                            200,
                            data=reply_data,
                            user_token=self.tokens['student']
                        )
                        
                        # Test getting replies
                        self.run_test(
                            "Get discussion replies",
                            "GET",
                            f"discussions/{discussion_id}/replies",
                            200,
                            user_token=self.tokens['student']
                        )
                        
            # Test discussion creation by student
            if 'student' in self.tokens:
                student_discussion_data = {
                    "title": "Question about Assignment",
                    "content": "I have a question about the first assignment. Can someone help?"
                }
                
                self.run_test(
                    "Create discussion (student)",
                    "POST",
                    f"courses/{course_id}/discussions",
                    200,
                    data=student_discussion_data,
                    user_token=self.tokens['student']
                )
                
            # Test getting discussions
            for role, token in self.tokens.items():
                if role in ['instructor', 'student']:
                    self.run_test(
                        f"Get discussions ({role})",
                        "GET",
                        f"courses/{course_id}/discussions",
                        200,
                        user_token=token
                    )

    def run_all_tests(self):
        """Run all API tests"""
        self.log("🚀 Starting LearnSphere API Tests")
        self.log(f"Backend URL: {self.base_url}")
        
        try:
            # Test authentication
            self.test_user_registration()
            self.test_user_login()
            self.test_auth_me()
            
            # Test dashboard
            self.test_dashboard_stats()
            
            # Test course management
            self.test_course_management()
            self.test_course_details()
            self.test_course_updates()
            
            # Test enrollments
            self.test_enrollments()
            self.test_get_enrollments()
            
            # Test enhanced features
            self.test_modules()
            self.test_assignments()
            self.test_quizzes()
            self.test_discussions()
            
        except Exception as e:
            self.log(f"Critical error during testing: {str(e)}", "ERROR")
            
        # Print final results
        self.log(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            self.log("🎉 All tests passed!", "SUCCESS")
            return 0
        else:
            self.log(f"❌ {self.tests_run - self.tests_passed} tests failed", "FAIL")
            return 1

def main():
    """Main test runner"""
    tester = LearnSphereAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())
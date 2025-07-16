#!/usr/bin/env python3
"""
Comprehensive Backend API Tests for LearnSphere LMS
Tests the new features: File Upload System, Progress Tracking, and Coursera Integration
"""

import requests
import json
import os
import time
from io import BytesIO

# Configuration
BACKEND_URL = "https://b77a6ae7-123f-4230-b258-9cac6644c213.preview.emergentagent.com/api"
TEST_EMAIL = "instructor@learnsphere.com"
TEST_PASSWORD = "instructor123"
STUDENT_EMAIL = "student@learnsphere.com"
STUDENT_PASSWORD = "student123"

class LearnSphereAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.instructor_token = None
        self.student_token = None
        self.instructor_user = None
        self.student_user = None
        self.test_course_id = None
        self.test_results = {
            "file_upload": {},
            "progress_tracking": {},
            "coursera_integration": {}
        }

    def log(self, message, level="INFO"):
        """Log test messages"""
        print(f"[{level}] {message}")

    def authenticate_users(self):
        """Authenticate both instructor and student users"""
        self.log("=== AUTHENTICATION TESTS ===")
        
        # Test instructor authentication
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/login", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.instructor_token = data.get("access_token")
                self.instructor_user = data.get("user")
                self.log(f"✅ Instructor authentication successful: {self.instructor_user.get('full_name')}")
            else:
                self.log(f"❌ Instructor authentication failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Instructor authentication error: {str(e)}", "ERROR")
            return False

        # Test student authentication
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/login", json={
                "email": STUDENT_EMAIL,
                "password": STUDENT_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.student_token = data.get("access_token")
                self.student_user = data.get("user")
                self.log(f"✅ Student authentication successful: {self.student_user.get('full_name')}")
            else:
                self.log(f"❌ Student authentication failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Student authentication error: {str(e)}", "ERROR")
            return False

        return True

    def get_auth_headers(self, user_type="instructor"):
        """Get authorization headers for API calls"""
        token = self.instructor_token if user_type == "instructor" else self.student_token
        return {"Authorization": f"Bearer {token}"}

    def create_test_course(self):
        """Create a test course for testing"""
        self.log("Creating test course...")
        
        try:
            response = self.session.post(f"{BACKEND_URL}/courses", 
                json={
                    "title": "Test Course for API Testing",
                    "description": "A test course for validating API functionality",
                    "duration_weeks": 4,
                    "max_students": 20,
                    "is_published": True  # Publish immediately
                },
                headers=self.get_auth_headers("instructor")
            )
            
            if response.status_code == 201:
                course_data = response.json()
                self.test_course_id = course_data.get("id")
                self.log(f"✅ Test course created: {self.test_course_id}")
                
                # Enroll student in the course
                self.enroll_student_in_course()
                return True
            else:
                self.log(f"❌ Failed to create test course: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error creating test course: {str(e)}", "ERROR")
            return False

    def enroll_student_in_course(self):
        """Enroll the test student in the test course"""
        if not self.test_course_id:
            return False
            
        try:
            response = self.session.post(f"{BACKEND_URL}/enrollments",
                json={"course_id": self.test_course_id},
                headers=self.get_auth_headers("student")
            )
            
            if response.status_code == 201:
                self.log(f"✅ Student enrolled in test course")
                return True
            elif response.status_code == 400 and "Already enrolled" in response.text:
                self.log(f"ℹ️  Student already enrolled in test course")
                return True
            else:
                self.log(f"❌ Failed to enroll student: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error enrolling student: {str(e)}", "ERROR")
            return False

    def test_file_upload_system(self):
        """Test all file upload endpoints"""
        self.log("\n=== FILE UPLOAD SYSTEM TESTS ===")
        
        # Test 1: Upload single file
        self.log("Testing single file upload...")
        try:
            # Create a test PDF file
            test_content = b"This is a test PDF content for LearnSphere LMS testing"
            files = {
                'file': ('test_document.pdf', BytesIO(test_content), 'application/pdf')
            }
            
            response = self.session.post(f"{BACKEND_URL}/uploads/single",
                files=files,
                headers=self.get_auth_headers("instructor")
            )
            
            if response.status_code == 201:
                data = response.json()
                uploaded_file = data.get("file")
                self.test_results["file_upload"]["single_upload"] = {
                    "status": "success",
                    "filename": uploaded_file.get("filename"),
                    "file_id": uploaded_file.get("id")
                }
                self.log(f"✅ Single file upload successful: {uploaded_file.get('filename')}")
            else:
                self.test_results["file_upload"]["single_upload"] = {
                    "status": "failed",
                    "error": f"{response.status_code} - {response.text}"
                }
                self.log(f"❌ Single file upload failed: {response.status_code} - {response.text}", "ERROR")
                
        except Exception as e:
            self.test_results["file_upload"]["single_upload"] = {
                "status": "error",
                "error": str(e)
            }
            self.log(f"❌ Single file upload error: {str(e)}", "ERROR")

        # Test 2: Upload multiple files
        self.log("Testing multiple file upload...")
        try:
            files = [
                ('files', ('test_image.jpg', BytesIO(b"fake image content"), 'image/jpeg')),
                ('files', ('test_video.mp4', BytesIO(b"fake video content"), 'video/mp4'))
            ]
            
            response = self.session.post(f"{BACKEND_URL}/uploads/multiple",
                files=files,
                headers=self.get_auth_headers("instructor")
            )
            
            if response.status_code == 201:
                data = response.json()
                uploaded_files = data.get("files", [])
                self.test_results["file_upload"]["multiple_upload"] = {
                    "status": "success",
                    "files_count": len(uploaded_files)
                }
                self.log(f"✅ Multiple file upload successful: {len(uploaded_files)} files")
            else:
                self.test_results["file_upload"]["multiple_upload"] = {
                    "status": "failed",
                    "error": f"{response.status_code} - {response.text}"
                }
                self.log(f"❌ Multiple file upload failed: {response.status_code} - {response.text}", "ERROR")
                
        except Exception as e:
            self.test_results["file_upload"]["multiple_upload"] = {
                "status": "error",
                "error": str(e)
            }
            self.log(f"❌ Multiple file upload error: {str(e)}", "ERROR")

        # Test 3: Get storage statistics
        self.log("Testing storage statistics...")
        try:
            response = self.session.get(f"{BACKEND_URL}/uploads/stats",
                headers=self.get_auth_headers("instructor")
            )
            
            if response.status_code == 200:
                stats = response.json()
                self.test_results["file_upload"]["storage_stats"] = {
                    "status": "success",
                    "stats": stats
                }
                self.log(f"✅ Storage statistics retrieved successfully")
            else:
                self.test_results["file_upload"]["storage_stats"] = {
                    "status": "failed",
                    "error": f"{response.status_code} - {response.text}"
                }
                self.log(f"❌ Storage statistics failed: {response.status_code} - {response.text}", "ERROR")
                
        except Exception as e:
            self.test_results["file_upload"]["storage_stats"] = {
                "status": "error",
                "error": str(e)
            }
            self.log(f"❌ Storage statistics error: {str(e)}", "ERROR")

        # Test 4: Test file serving (if we have a filename from previous test)
        if self.test_results["file_upload"].get("single_upload", {}).get("filename"):
            filename = self.test_results["file_upload"]["single_upload"]["filename"]
            self.log(f"Testing file serving for: {filename}")
            
            try:
                response = self.session.get(f"{BACKEND_URL}/uploads/serve/{filename}",
                    headers=self.get_auth_headers("instructor")
                )
                
                if response.status_code == 200:
                    self.test_results["file_upload"]["file_serving"] = {"status": "success"}
                    self.log(f"✅ File serving successful")
                else:
                    self.test_results["file_upload"]["file_serving"] = {
                        "status": "failed",
                        "error": f"{response.status_code} - {response.text}"
                    }
                    self.log(f"❌ File serving failed: {response.status_code} - {response.text}", "ERROR")
                    
            except Exception as e:
                self.test_results["file_upload"]["file_serving"] = {
                    "status": "error",
                    "error": str(e)
                }
                self.log(f"❌ File serving error: {str(e)}", "ERROR")

        # Test 5: Test authentication requirements (student should not be able to upload)
        self.log("Testing upload authentication (student should be denied)...")
        try:
            test_content = b"Student should not be able to upload this"
            files = {
                'file': ('student_test.pdf', BytesIO(test_content), 'application/pdf')
            }
            
            response = self.session.post(f"{BACKEND_URL}/uploads/single",
                files=files,
                headers=self.get_auth_headers("student")
            )
            
            if response.status_code == 403:
                self.test_results["file_upload"]["auth_test"] = {"status": "success"}
                self.log(f"✅ Upload authentication working correctly (student denied)")
            else:
                self.test_results["file_upload"]["auth_test"] = {
                    "status": "failed",
                    "error": f"Expected 403, got {response.status_code}"
                }
                self.log(f"❌ Upload authentication failed: Expected 403, got {response.status_code}", "ERROR")
                
        except Exception as e:
            self.test_results["file_upload"]["auth_test"] = {
                "status": "error",
                "error": str(e)
            }
            self.log(f"❌ Upload authentication test error: {str(e)}", "ERROR")

    def test_progress_tracking_system(self):
        """Test all progress tracking endpoints"""
        self.log("\n=== PROGRESS TRACKING SYSTEM TESTS ===")
        
        if not self.test_course_id:
            self.log("❌ No test course available for progress tracking tests", "ERROR")
            return

        student_id = self.student_user.get("id")
        course_id = self.test_course_id

        # Test 1: Initialize progress for student
        self.log("Testing progress initialization...")
        try:
            response = self.session.post(f"{BACKEND_URL}/progress/initialize",
                json={
                    "student_id": student_id,
                    "course_id": course_id
                },
                headers=self.get_auth_headers("instructor")
            )
            
            if response.status_code == 200:
                self.test_results["progress_tracking"]["initialization"] = {"status": "success"}
                self.log(f"✅ Progress initialization successful")
            else:
                self.test_results["progress_tracking"]["initialization"] = {
                    "status": "failed",
                    "error": f"{response.status_code} - {response.text}"
                }
                self.log(f"❌ Progress initialization failed: {response.status_code} - {response.text}", "ERROR")
                
        except Exception as e:
            self.test_results["progress_tracking"]["initialization"] = {
                "status": "error",
                "error": str(e)
            }
            self.log(f"❌ Progress initialization error: {str(e)}", "ERROR")

        # Test 2: Get student progress
        self.log("Testing student progress retrieval...")
        try:
            response = self.session.get(f"{BACKEND_URL}/progress/student/{student_id}/course/{course_id}",
                headers=self.get_auth_headers("student")
            )
            
            if response.status_code == 200:
                progress_data = response.json()
                self.test_results["progress_tracking"]["student_progress"] = {
                    "status": "success",
                    "summary": progress_data.get("summary")
                }
                self.log(f"✅ Student progress retrieval successful")
            else:
                self.test_results["progress_tracking"]["student_progress"] = {
                    "status": "failed",
                    "error": f"{response.status_code} - {response.text}"
                }
                self.log(f"❌ Student progress retrieval failed: {response.status_code} - {response.text}", "ERROR")
                
        except Exception as e:
            self.test_results["progress_tracking"]["student_progress"] = {
                "status": "error",
                "error": str(e)
            }
            self.log(f"❌ Student progress retrieval error: {str(e)}", "ERROR")

        # Test 3: Get course progress (instructor view)
        self.log("Testing course progress retrieval (instructor view)...")
        try:
            response = self.session.get(f"{BACKEND_URL}/progress/course/{course_id}",
                headers=self.get_auth_headers("instructor")
            )
            
            if response.status_code == 200:
                course_progress = response.json()
                self.test_results["progress_tracking"]["course_progress"] = {
                    "status": "success",
                    "statistics": course_progress.get("statistics")
                }
                self.log(f"✅ Course progress retrieval successful")
            else:
                self.test_results["progress_tracking"]["course_progress"] = {
                    "status": "failed",
                    "error": f"{response.status_code} - {response.text}"
                }
                self.log(f"❌ Course progress retrieval failed: {response.status_code} - {response.text}", "ERROR")
                
        except Exception as e:
            self.test_results["progress_tracking"]["course_progress"] = {
                "status": "error",
                "error": str(e)
            }
            self.log(f"❌ Course progress retrieval error: {str(e)}", "ERROR")

        # Test 4: Get student dashboard
        self.log("Testing student dashboard...")
        try:
            response = self.session.get(f"{BACKEND_URL}/progress/dashboard",
                headers=self.get_auth_headers("student")
            )
            
            if response.status_code == 200:
                dashboard_data = response.json()
                self.test_results["progress_tracking"]["dashboard"] = {
                    "status": "success",
                    "summary": dashboard_data.get("summary")
                }
                self.log(f"✅ Student dashboard retrieval successful")
            else:
                self.test_results["progress_tracking"]["dashboard"] = {
                    "status": "failed",
                    "error": f"{response.status_code} - {response.text}"
                }
                self.log(f"❌ Student dashboard retrieval failed: {response.status_code} - {response.text}", "ERROR")
                
        except Exception as e:
            self.test_results["progress_tracking"]["dashboard"] = {
                "status": "error",
                "error": str(e)
            }
            self.log(f"❌ Student dashboard retrieval error: {str(e)}", "ERROR")

        # Test 5: Get overdue items
        self.log("Testing overdue items retrieval...")
        try:
            response = self.session.get(f"{BACKEND_URL}/progress/overdue",
                headers=self.get_auth_headers("student")
            )
            
            if response.status_code == 200:
                overdue_items = response.json()
                self.test_results["progress_tracking"]["overdue_items"] = {
                    "status": "success",
                    "count": len(overdue_items)
                }
                self.log(f"✅ Overdue items retrieval successful")
            else:
                self.test_results["progress_tracking"]["overdue_items"] = {
                    "status": "failed",
                    "error": f"{response.status_code} - {response.text}"
                }
                self.log(f"❌ Overdue items retrieval failed: {response.status_code} - {response.text}", "ERROR")
                
        except Exception as e:
            self.test_results["progress_tracking"]["overdue_items"] = {
                "status": "error",
                "error": str(e)
            }
            self.log(f"❌ Overdue items retrieval error: {str(e)}", "ERROR")

        # Test 6: Get upcoming deadlines
        self.log("Testing upcoming deadlines retrieval...")
        try:
            response = self.session.get(f"{BACKEND_URL}/progress/upcoming-deadlines",
                headers=self.get_auth_headers("student")
            )
            
            if response.status_code == 200:
                upcoming_deadlines = response.json()
                self.test_results["progress_tracking"]["upcoming_deadlines"] = {
                    "status": "success",
                    "count": len(upcoming_deadlines)
                }
                self.log(f"✅ Upcoming deadlines retrieval successful")
            else:
                self.test_results["progress_tracking"]["upcoming_deadlines"] = {
                    "status": "failed",
                    "error": f"{response.status_code} - {response.text}"
                }
                self.log(f"❌ Upcoming deadlines retrieval failed: {response.status_code} - {response.text}", "ERROR")
                
        except Exception as e:
            self.test_results["progress_tracking"]["upcoming_deadlines"] = {
                "status": "error",
                "error": str(e)
            }
            self.log(f"❌ Upcoming deadlines retrieval error: {str(e)}", "ERROR")

    def test_coursera_integration(self):
        """Test all Coursera integration endpoints"""
        self.log("\n=== COURSERA INTEGRATION TESTS ===")
        
        # Test 1: Test connection
        self.log("Testing Coursera API connection...")
        try:
            response = self.session.get(f"{BACKEND_URL}/coursera/test-connection",
                headers=self.get_auth_headers("instructor")
            )
            
            if response.status_code == 200:
                connection_data = response.json()
                self.test_results["coursera_integration"]["connection_test"] = {
                    "status": "success",
                    "connection_status": connection_data.get("status")
                }
                self.log(f"✅ Coursera connection test successful: {connection_data.get('status')}")
            else:
                self.test_results["coursera_integration"]["connection_test"] = {
                    "status": "failed",
                    "error": f"{response.status_code} - {response.text}"
                }
                self.log(f"❌ Coursera connection test failed: {response.status_code} - {response.text}", "ERROR")
                
        except Exception as e:
            self.test_results["coursera_integration"]["connection_test"] = {
                "status": "error",
                "error": str(e)
            }
            self.log(f"❌ Coursera connection test error: {str(e)}", "ERROR")

        # Test 2: Search courses
        self.log("Testing Coursera course search...")
        try:
            response = self.session.get(f"{BACKEND_URL}/coursera/search",
                params={"query": "machine learning", "limit": 5},
                headers=self.get_auth_headers("instructor")
            )
            
            if response.status_code == 200:
                search_data = response.json()
                courses = search_data.get("courses", [])
                self.test_results["coursera_integration"]["course_search"] = {
                    "status": "success",
                    "courses_found": len(courses)
                }
                self.log(f"✅ Coursera course search successful: {len(courses)} courses found")
            else:
                self.test_results["coursera_integration"]["course_search"] = {
                    "status": "failed",
                    "error": f"{response.status_code} - {response.text}"
                }
                self.log(f"❌ Coursera course search failed: {response.status_code} - {response.text}", "ERROR")
                
        except Exception as e:
            self.test_results["coursera_integration"]["course_search"] = {
                "status": "error",
                "error": str(e)
            }
            self.log(f"❌ Coursera course search error: {str(e)}", "ERROR")

        # Test 3: Get course details
        self.log("Testing Coursera course details...")
        try:
            test_course_id = "machine-learning-001"  # Using mock course ID
            response = self.session.get(f"{BACKEND_URL}/coursera/course/{test_course_id}",
                headers=self.get_auth_headers("instructor")
            )
            
            if response.status_code == 200:
                course_data = response.json()
                course_info = course_data.get("course")
                self.test_results["coursera_integration"]["course_details"] = {
                    "status": "success",
                    "course_name": course_info.get("name") if course_info else None
                }
                self.log(f"✅ Coursera course details successful")
            else:
                self.test_results["coursera_integration"]["course_details"] = {
                    "status": "failed",
                    "error": f"{response.status_code} - {response.text}"
                }
                self.log(f"❌ Coursera course details failed: {response.status_code} - {response.text}", "ERROR")
                
        except Exception as e:
            self.test_results["coursera_integration"]["course_details"] = {
                "status": "error",
                "error": str(e)
            }
            self.log(f"❌ Coursera course details error: {str(e)}", "ERROR")

        # Test 4: Import course
        self.log("Testing Coursera course import...")
        try:
            test_course_id = "machine-learning-001"  # Using mock course ID
            response = self.session.post(f"{BACKEND_URL}/coursera/import/{test_course_id}",
                json={
                    "customize_title": "Imported ML Course for Testing",
                    "customize_description": "A machine learning course imported from Coursera for testing purposes"
                },
                headers=self.get_auth_headers("instructor")
            )
            
            if response.status_code == 201:
                import_data = response.json()
                imported_course = import_data.get("course")
                self.test_results["coursera_integration"]["course_import"] = {
                    "status": "success",
                    "imported_course_id": imported_course.get("id") if imported_course else None
                }
                self.log(f"✅ Coursera course import successful")
            else:
                self.test_results["coursera_integration"]["course_import"] = {
                    "status": "failed",
                    "error": f"{response.status_code} - {response.text}"
                }
                self.log(f"❌ Coursera course import failed: {response.status_code} - {response.text}", "ERROR")
                
        except Exception as e:
            self.test_results["coursera_integration"]["course_import"] = {
                "status": "error",
                "error": str(e)
            }
            self.log(f"❌ Coursera course import error: {str(e)}", "ERROR")

        # Test 5: Get import history
        self.log("Testing Coursera import history...")
        try:
            response = self.session.get(f"{BACKEND_URL}/coursera/imports",
                headers=self.get_auth_headers("instructor")
            )
            
            if response.status_code == 200:
                import_history = response.json()
                imported_courses = import_history.get("imported_courses", [])
                self.test_results["coursera_integration"]["import_history"] = {
                    "status": "success",
                    "imported_courses_count": len(imported_courses)
                }
                self.log(f"✅ Coursera import history successful: {len(imported_courses)} imported courses")
            else:
                self.test_results["coursera_integration"]["import_history"] = {
                    "status": "failed",
                    "error": f"{response.status_code} - {response.text}"
                }
                self.log(f"❌ Coursera import history failed: {response.status_code} - {response.text}", "ERROR")
                
        except Exception as e:
            self.test_results["coursera_integration"]["import_history"] = {
                "status": "error",
                "error": str(e)
            }
            self.log(f"❌ Coursera import history error: {str(e)}", "ERROR")

        # Test 6: Test authentication requirements (student should not be able to access)
        self.log("Testing Coursera authentication (student should be denied)...")
        try:
            response = self.session.get(f"{BACKEND_URL}/coursera/search",
                params={"query": "test"},
                headers=self.get_auth_headers("student")
            )
            
            if response.status_code == 403:
                self.test_results["coursera_integration"]["auth_test"] = {"status": "success"}
                self.log(f"✅ Coursera authentication working correctly (student denied)")
            else:
                self.test_results["coursera_integration"]["auth_test"] = {
                    "status": "failed",
                    "error": f"Expected 403, got {response.status_code}"
                }
                self.log(f"❌ Coursera authentication failed: Expected 403, got {response.status_code}", "ERROR")
                
        except Exception as e:
            self.test_results["coursera_integration"]["auth_test"] = {
                "status": "error",
                "error": str(e)
            }
            self.log(f"❌ Coursera authentication test error: {str(e)}", "ERROR")

    def generate_summary(self):
        """Generate test summary"""
        self.log("\n=== TEST SUMMARY ===")
        
        total_tests = 0
        passed_tests = 0
        failed_tests = 0
        error_tests = 0
        
        for feature, tests in self.test_results.items():
            self.log(f"\n{feature.upper().replace('_', ' ')}:")
            for test_name, result in tests.items():
                total_tests += 1
                status = result.get("status", "unknown")
                
                if status == "success":
                    passed_tests += 1
                    self.log(f"  ✅ {test_name.replace('_', ' ').title()}")
                elif status == "failed":
                    failed_tests += 1
                    self.log(f"  ❌ {test_name.replace('_', ' ').title()}: {result.get('error', 'Unknown error')}")
                elif status == "error":
                    error_tests += 1
                    self.log(f"  🔥 {test_name.replace('_', ' ').title()}: {result.get('error', 'Unknown error')}")
        
        self.log(f"\n=== OVERALL RESULTS ===")
        self.log(f"Total Tests: {total_tests}")
        self.log(f"Passed: {passed_tests}")
        self.log(f"Failed: {failed_tests}")
        self.log(f"Errors: {error_tests}")
        self.log(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%" if total_tests > 0 else "0%")
        
        return {
            "total": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "errors": error_tests,
            "success_rate": (passed_tests/total_tests)*100 if total_tests > 0 else 0
        }

    def run_all_tests(self):
        """Run all backend API tests"""
        self.log("Starting LearnSphere Backend API Tests...")
        
        # Step 1: Authenticate users
        if not self.authenticate_users():
            self.log("❌ Authentication failed. Cannot proceed with tests.", "ERROR")
            return False
        
        # Step 2: Create test course
        if not self.create_test_course():
            self.log("❌ Test course creation failed. Some tests may not work.", "WARNING")
        
        # Step 3: Run all feature tests
        self.test_file_upload_system()
        self.test_progress_tracking_system()
        self.test_coursera_integration()
        
        # Step 4: Generate summary
        summary = self.generate_summary()
        
        return summary

if __name__ == "__main__":
    tester = LearnSphereAPITester()
    results = tester.run_all_tests()
    
    # Save results to file
    with open("/app/test_results_backend.json", "w") as f:
        json.dump({
            "summary": results,
            "detailed_results": tester.test_results
        }, f, indent=2)
    
    print(f"\nDetailed test results saved to: /app/test_results_backend.json")
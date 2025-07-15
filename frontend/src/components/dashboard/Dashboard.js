import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useApi } from '../../hooks/useApi';
import CourseDetail from '../course/CourseDetail';
import CreateCourseModal from '../forms/CreateCourseModal';
import LoadingSpinner from '../common/LoadingSpinner';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({});
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [loading, setLoading] = useState(true);
  const { apiCall } = useApi();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch dashboard stats
        const statsResult = await apiCall('GET', 'dashboard/stats');
        if (statsResult.success) {
          setStats(statsResult.data);
        }

        // Fetch courses
        const coursesResult = await apiCall('GET', 'courses');
        if (coursesResult.success) {
          setCourses(coursesResult.data);
        }

        // Fetch enrollments for students
        if (user.role === 'student') {
          const enrollmentsResult = await apiCall('GET', 'enrollments');
          if (enrollmentsResult.success) {
            setEnrollments(enrollmentsResult.data);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleEnroll = async (courseId) => {
    const result = await apiCall('POST', 'enrollments', { course_id: courseId });
    if (result.success) {
      // Refresh enrollments
      const enrollmentsResult = await apiCall('GET', 'enrollments');
      if (enrollmentsResult.success) {
        setEnrollments(enrollmentsResult.data);
      }
    }
  };

  const isEnrolled = (courseId) => {
    return enrollments.some(enrollment => enrollment.course.id === courseId);
  };

  const handleCourseClick = (course) => {
    setSelectedCourse(course);
  };

  if (selectedCourse) {
    return (
      <CourseDetail 
        course={selectedCourse} 
        onBack={() => setSelectedCourse(null)} 
      />
    );
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">LearnSphere</h1>
              <span className="ml-4 px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                {user.role}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user.full_name}</span>
              <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {user.role === 'admin' && (
            <>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900">Total Users</h3>
                <p className="text-3xl font-bold text-blue-600">{stats.total_users}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900">Total Courses</h3>
                <p className="text-3xl font-bold text-green-600">{stats.total_courses}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900">Total Enrollments</h3>
                <p className="text-3xl font-bold text-purple-600">{stats.total_enrollments}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900">Total Assignments</h3>
                <p className="text-3xl font-bold text-orange-600">{stats.total_assignments}</p>
              </div>
            </>
          )}
          
          {user.role === 'instructor' && (
            <>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900">My Courses</h3>
                <p className="text-3xl font-bold text-blue-600">{stats.my_courses}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900">Total Students</h3>
                <p className="text-3xl font-bold text-green-600">{stats.total_students}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900">Assignments</h3>
                <p className="text-3xl font-bold text-purple-600">{stats.total_assignments}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <button
                  onClick={() => setShowCreateCourse(true)}
                  className="w-full h-full bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center"
                >
                  <span className="text-lg font-medium">Create New Course</span>
                </button>
              </div>
            </>
          )}
          
          {user.role === 'student' && (
            <>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900">Enrolled Courses</h3>
                <p className="text-3xl font-bold text-blue-600">{stats.enrolled_courses}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900">Completed Courses</h3>
                <p className="text-3xl font-bold text-green-600">{stats.completed_courses}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900">Assignments</h3>
                <p className="text-3xl font-bold text-purple-600">{stats.submitted_assignments}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900">Quiz Attempts</h3>
                <p className="text-3xl font-bold text-orange-600">{stats.quiz_attempts}</p>
              </div>
            </>
          )}
        </div>

        {/* Courses Grid */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              {user.role === 'instructor' ? 'My Courses' : 'Available Courses'}
            </h2>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <div 
                  key={course.id} 
                  className="border rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleCourseClick(course)}
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{course.title}</h3>
                  <p className="text-gray-600 mb-4">{course.description}</p>
                  
                  <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                    <span>Duration: {course.duration_weeks} weeks</span>
                    <span>Students: {course.enrolled_students.length}/{course.max_students}</span>
                  </div>
                  
                  {user.role === 'student' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEnroll(course.id);
                      }}
                      disabled={isEnrolled(course.id)}
                      className={`w-full py-2 px-4 rounded ${
                        isEnrolled(course.id)
                          ? 'bg-green-100 text-green-800 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isEnrolled(course.id) ? 'Enrolled' : 'Enroll Now'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* My Enrollments for Students */}
        {user.role === 'student' && enrollments.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">My Enrolled Courses</h2>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {enrollments.map((enrollment) => (
                  <div 
                    key={enrollment.enrollment.id} 
                    className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => handleCourseClick(enrollment.course)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {enrollment.course.title}
                        </h3>
                        <p className="text-gray-600">{enrollment.course.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">
                          Progress: {Math.round(enrollment.enrollment.progress)}%
                        </div>
                        <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${enrollment.enrollment.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Create Course Modal */}
      {showCreateCourse && (
        <CreateCourseModal
          onClose={() => setShowCreateCourse(false)}
          onSuccess={() => {
            setShowCreateCourse(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
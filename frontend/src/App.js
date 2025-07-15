import React, { useState, useEffect, createContext, useContext } from 'react';
import './App.css';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Context for authentication
const AuthContext = createContext();

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// AuthProvider component
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(response.data);
        } catch (error) {
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [token]);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    }
  };

  const register = async (userData) => {
    try {
      await axios.post(`${API}/auth/register`, userData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Registration failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Login Component
const Login = ({ onToggle }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);
    
    if (!result.success) {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Welcome to LearnSphere</h2>
          <p className="mt-2 text-gray-600">Sign in to your account</p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
          
          <div className="text-center">
            <button
              type="button"
              onClick={onToggle}
              className="text-indigo-600 hover:text-indigo-500"
            >
              Don't have an account? Sign up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Register Component
const Register = ({ onToggle }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'student'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await register(formData);
    
    if (result.success) {
      setSuccess(true);
      setTimeout(() => onToggle(), 2000);
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg text-center">
          <div className="text-green-600">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Registration Successful!</h2>
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Join LearnSphere</h2>
          <p className="mt-2 text-gray-600">Create your account</p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                value={formData.full_name}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </div>
          
          <div className="text-center">
            <button
              type="button"
              onClick={onToggle}
              className="text-indigo-600 hover:text-indigo-500"
            >
              Already have an account? Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({});
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        // Fetch dashboard stats
        const statsResponse = await axios.get(`${API}/dashboard/stats`, { headers });
        setStats(statsResponse.data);

        // Fetch courses
        const coursesResponse = await axios.get(`${API}/courses`, { headers });
        setCourses(coursesResponse.data);

        // Fetch enrollments for students
        if (user.role === 'student') {
          const enrollmentsResponse = await axios.get(`${API}/enrollments`, { headers });
          setEnrollments(enrollmentsResponse.data);
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
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/enrollments`, { course_id: courseId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh enrollments
      const enrollmentsResponse = await axios.get(`${API}/enrollments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEnrollments(enrollmentsResponse.data);
    } catch (error) {
      console.error('Error enrolling:', error);
    }
  };

  const isEnrolled = (courseId) => {
    return enrollments.some(enrollment => enrollment.course.id === courseId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                <h3 className="text-lg font-medium text-gray-900">Progress</h3>
                <p className="text-3xl font-bold text-purple-600">
                  {stats.enrolled_courses > 0 ? Math.round((stats.completed_courses / stats.enrolled_courses) * 100) : 0}%
                </p>
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
                <div key={course.id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{course.title}</h3>
                  <p className="text-gray-600 mb-4">{course.description}</p>
                  
                  <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                    <span>Duration: {course.duration_weeks} weeks</span>
                    <span>Students: {course.enrolled_students.length}/{course.max_students}</span>
                  </div>
                  
                  {user.role === 'student' && (
                    <button
                      onClick={() => handleEnroll(course.id)}
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
                  <div key={enrollment.enrollment.id} className="border rounded-lg p-4">
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

// Create Course Modal Component
const CreateCourseModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration_weeks: 8,
    max_students: 50,
    is_published: false
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/courses`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onSuccess();
    } catch (error) {
      console.error('Error creating course:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Create New Course</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Course Title</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Duration (weeks)</label>
              <input
                type="number"
                name="duration_weeks"
                value={formData.duration_weeks}
                onChange={handleChange}
                min="1"
                max="52"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Max Students</label>
              <input
                type="number"
                name="max_students"
                value={formData.max_students}
                onChange={handleChange}
                min="1"
                max="1000"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              name="is_published"
              checked={formData.is_published}
              onChange={handleChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-700">
              Publish course immediately
            </label>
          </div>
          
          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const [showLogin, setShowLogin] = useState(true);

  return (
    <AuthProvider>
      <div className="App">
        <AuthenticatedApp showLogin={showLogin} setShowLogin={setShowLogin} />
      </div>
    </AuthProvider>
  );
};

const AuthenticatedApp = ({ showLogin, setShowLogin }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return showLogin ? (
      <Login onToggle={() => setShowLogin(false)} />
    ) : (
      <Register onToggle={() => setShowLogin(true)} />
    );
  }

  return <Dashboard />;
};

export default App;
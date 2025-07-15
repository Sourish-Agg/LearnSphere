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

// Utility component for API calls
const useApi = () => {
  const { token } = useAuth();
  
  const apiCall = async (method, endpoint, data = null) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };

    try {
      const response = await axios({
        method,
        url: `${API}/${endpoint}`,
        data,
        headers
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'An error occurred' 
      };
    }
  };

  return { apiCall };
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

// Course Detail Component
const CourseDetail = ({ course, onBack }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [modules, setModules] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [showDiscussionForm, setShowDiscussionForm] = useState(false);
  const { user } = useAuth();
  const { apiCall } = useApi();

  useEffect(() => {
    const fetchCourseData = async () => {
      setLoading(true);
      
      // Fetch modules
      const modulesResult = await apiCall('GET', `courses/${course.id}/modules`);
      if (modulesResult.success) {
        setModules(modulesResult.data);
      }
      
      // Fetch assignments
      const assignmentsResult = await apiCall('GET', `courses/${course.id}/assignments`);
      if (assignmentsResult.success) {
        setAssignments(assignmentsResult.data);
      }
      
      // Fetch quizzes
      const quizzesResult = await apiCall('GET', `courses/${course.id}/quizzes`);
      if (quizzesResult.success) {
        setQuizzes(quizzesResult.data);
      }
      
      // Fetch discussions
      const discussionsResult = await apiCall('GET', `courses/${course.id}/discussions`);
      if (discussionsResult.success) {
        setDiscussions(discussionsResult.data);
      }
      
      setLoading(false);
    };

    fetchCourseData();
  }, [course.id]);

  const handleCreateModule = async (moduleData) => {
    const result = await apiCall('POST', `courses/${course.id}/modules`, moduleData);
    if (result.success) {
      setModules([...modules, result.data]);
      setShowModuleForm(false);
    }
  };

  const handleCreateAssignment = async (assignmentData) => {
    const result = await apiCall('POST', `courses/${course.id}/assignments`, assignmentData);
    if (result.success) {
      setAssignments([...assignments, result.data]);
      setShowAssignmentForm(false);
    }
  };

  const handleCreateQuiz = async (quizData) => {
    const result = await apiCall('POST', `courses/${course.id}/quizzes`, quizData);
    if (result.success) {
      setQuizzes([...quizzes, result.data]);
      setShowQuizForm(false);
    }
  };

  const handleCreateDiscussion = async (discussionData) => {
    const result = await apiCall('POST', `courses/${course.id}/discussions`, discussionData);
    if (result.success) {
      setDiscussions([...discussions, result.data]);
      setShowDiscussionForm(false);
    }
  };

  const isInstructor = user.role === 'instructor';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading course content...</div>
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
              <button
                onClick={onBack}
                className="mr-4 text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
                <p className="text-gray-600">{course.description}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {['overview', 'modules', 'assignments', 'quizzes', 'discussions'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {activeTab === 'overview' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Course Overview</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-gray-900">Duration</h3>
                <p className="text-gray-600">{course.duration_weeks} weeks</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Enrolled Students</h3>
                <p className="text-gray-600">{course.enrolled_students.length}/{course.max_students}</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Modules</h3>
                <p className="text-gray-600">{modules.length} modules</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Assignments</h3>
                <p className="text-gray-600">{assignments.length} assignments</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'modules' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Course Modules</h2>
                {isInstructor && (
                  <button
                    onClick={() => setShowModuleForm(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                  >
                    Add Module
                  </button>
                )}
              </div>
            </div>
            <div className="p-6">
              {modules.length === 0 ? (
                <p className="text-gray-500">No modules yet.</p>
              ) : (
                <div className="space-y-4">
                  {modules.map((module) => (
                    <div key={module.id} className="border rounded-lg p-4">
                      <h3 className="font-semibold text-lg">{module.title}</h3>
                      <p className="text-gray-600 mb-2">{module.description}</p>
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-sm">{module.content}</p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {module.content_type}
                        </span>
                        <span className="ml-2">Module {module.order}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'assignments' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Assignments</h2>
                {isInstructor && (
                  <button
                    onClick={() => setShowAssignmentForm(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                  >
                    Create Assignment
                  </button>
                )}
              </div>
            </div>
            <div className="p-6">
              {assignments.length === 0 ? (
                <p className="text-gray-500">No assignments yet.</p>
              ) : (
                <div className="space-y-4">
                  {assignments.map((assignment) => (
                    <div key={assignment.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{assignment.title}</h3>
                          <p className="text-gray-600 mb-2">{assignment.description}</p>
                          <p className="text-sm text-gray-500">
                            Due: {new Date(assignment.due_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-medium">Max Score: {assignment.max_score}</span>
                        </div>
                      </div>
                      <div className="mt-3 bg-gray-50 p-3 rounded">
                        <h4 className="font-medium mb-1">Instructions:</h4>
                        <p className="text-sm">{assignment.instructions}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'quizzes' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Quizzes</h2>
                {isInstructor && (
                  <button
                    onClick={() => setShowQuizForm(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                  >
                    Create Quiz
                  </button>
                )}
              </div>
            </div>
            <div className="p-6">
              {quizzes.length === 0 ? (
                <p className="text-gray-500">No quizzes yet.</p>
              ) : (
                <div className="space-y-4">
                  {quizzes.map((quiz) => (
                    <div key={quiz.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{quiz.title}</h3>
                          <p className="text-gray-600 mb-2">{quiz.description}</p>
                          <div className="flex space-x-4 text-sm text-gray-500">
                            <span>Duration: {quiz.duration_minutes} minutes</span>
                            <span>Max Attempts: {quiz.max_attempts}</span>
                            <span>Questions: {quiz.questions.length}</span>
                          </div>
                        </div>
                        {user.role === 'student' && (
                          <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                            Take Quiz
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'discussions' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Discussions</h2>
                <button
                  onClick={() => setShowDiscussionForm(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                >
                  Start Discussion
                </button>
              </div>
            </div>
            <div className="p-6">
              {discussions.length === 0 ? (
                <p className="text-gray-500">No discussions yet.</p>
              ) : (
                <div className="space-y-4">
                  {discussions.map((discussion) => (
                    <div key={discussion.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{discussion.title}</h3>
                          <p className="text-gray-600 mb-2">{discussion.content}</p>
                          <div className="text-sm text-gray-500">
                            By {discussion.creator_name} • {new Date(discussion.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-gray-500">
                            {discussion.replies.length} replies
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showModuleForm && (
        <ModuleForm
          onSubmit={handleCreateModule}
          onClose={() => setShowModuleForm(false)}
        />
      )}

      {showAssignmentForm && (
        <AssignmentForm
          onSubmit={handleCreateAssignment}
          onClose={() => setShowAssignmentForm(false)}
        />
      )}

      {showQuizForm && (
        <QuizForm
          onSubmit={handleCreateQuiz}
          onClose={() => setShowQuizForm(false)}
        />
      )}

      {showDiscussionForm && (
        <DiscussionForm
          onSubmit={handleCreateDiscussion}
          onClose={() => setShowDiscussionForm(false)}
        />
      )}
    </div>
  );
};

// Module Form Component
const ModuleForm = ({ onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    order: 1,
    content_type: 'text'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Create Module</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
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
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Content</label>
            <textarea
              name="content"
              value={formData.content}
              onChange={handleChange}
              required
              rows={4}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Order</label>
              <input
                type="number"
                name="order"
                value={formData.order}
                onChange={handleChange}
                min="1"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Content Type</label>
              <select
                name="content_type"
                value={formData.content_type}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="text">Text</option>
                <option value="video">Video</option>
                <option value="pdf">PDF</option>
                <option value="link">Link</option>
              </select>
            </div>
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
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              Create Module
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Assignment Form Component
const AssignmentForm = ({ onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    max_score: 100,
    instructions: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      due_date: new Date(formData.due_date).toISOString()
    };
    onSubmit(submitData);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Create Assignment</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
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
              <label className="block text-sm font-medium text-gray-700">Due Date</label>
              <input
                type="datetime-local"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Max Score</label>
              <input
                type="number"
                name="max_score"
                value={formData.max_score}
                onChange={handleChange}
                min="1"
                max="1000"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Instructions</label>
            <textarea
              name="instructions"
              value={formData.instructions}
              onChange={handleChange}
              required
              rows={4}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
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
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              Create Assignment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Quiz Form Component
const QuizForm = ({ onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration_minutes: 30,
    max_attempts: 3,
    questions: []
  });

  const [currentQuestion, setCurrentQuestion] = useState({
    question: '',
    options: ['', '', '', ''],
    correct_answer: 0,
    points: 1
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleQuestionChange = (e) => {
    setCurrentQuestion({
      ...currentQuestion,
      [e.target.name]: e.target.value
    });
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...currentQuestion.options];
    newOptions[index] = value;
    setCurrentQuestion({
      ...currentQuestion,
      options: newOptions
    });
  };

  const addQuestion = () => {
    if (currentQuestion.question.trim() && currentQuestion.options.every(opt => opt.trim())) {
      setFormData({
        ...formData,
        questions: [...formData.questions, { ...currentQuestion }]
      });
      setCurrentQuestion({
        question: '',
        options: ['', '', '', ''],
        correct_answer: 0,
        points: 1
      });
    }
  };

  const removeQuestion = (index) => {
    const newQuestions = formData.questions.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      questions: newQuestions
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Create Quiz</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
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
              <label className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
              <input
                type="number"
                name="duration_minutes"
                value={formData.duration_minutes}
                onChange={handleChange}
                min="1"
                max="180"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Max Attempts</label>
              <input
                type="number"
                name="max_attempts"
                value={formData.max_attempts}
                onChange={handleChange}
                min="1"
                max="10"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Questions Section */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-medium mb-3">Questions ({formData.questions.length})</h3>
            
            {/* Current Question Builder */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <h4 className="font-medium mb-2">Add Question</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  name="question"
                  placeholder="Enter question..."
                  value={currentQuestion.question}
                  onChange={handleQuestionChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                
                {currentQuestion.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="correct_answer"
                      value={index}
                      checked={currentQuestion.correct_answer === index}
                      onChange={() => setCurrentQuestion({...currentQuestion, correct_answer: index})}
                      className="text-indigo-600"
                    />
                    <input
                      type="text"
                      placeholder={`Option ${index + 1}...`}
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={addQuestion}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Add Question
                </button>
              </div>
            </div>

            {/* Questions List */}
            {formData.questions.map((question, index) => (
              <div key={index} className="border rounded-lg p-3 mb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-medium">Q{index + 1}: {question.question}</h5>
                    <div className="text-sm text-gray-600 mt-1">
                      {question.options.map((option, optIndex) => (
                        <div key={optIndex} className={`ml-4 ${optIndex === question.correct_answer ? 'font-medium text-green-600' : ''}`}>
                          {optIndex === question.correct_answer ? '✓' : '○'} {option}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeQuestion(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
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
              disabled={formData.questions.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Create Quiz
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Discussion Form Component
const DiscussionForm = ({ onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Start Discussion</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
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
            <label className="block text-sm font-medium text-gray-700">Content</label>
            <textarea
              name="content"
              value={formData.content}
              onChange={handleChange}
              required
              rows={5}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
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
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              Start Discussion
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
  const { apiCall } = useApi();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await apiCall('POST', 'courses', formData);
    if (result.success) {
      onSuccess();
    }
    setLoading(false);
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
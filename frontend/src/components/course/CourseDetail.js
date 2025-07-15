import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useApi } from '../../hooks/useApi';
import ModuleForm from '../forms/ModuleForm';
import AssignmentForm from '../forms/AssignmentForm';
import QuizForm from '../forms/QuizForm';
import DiscussionForm from '../forms/DiscussionForm';
import LoadingSpinner from '../common/LoadingSpinner';

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
    return <LoadingSpinner message="Loading course content..." />;
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

export default CourseDetail;
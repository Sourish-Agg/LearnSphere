from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import os
import uuid
from pathlib import Path
from dotenv import load_dotenv
import logging

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = "your-secret-key-here-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# FastAPI app
app = FastAPI(title="LearnSphere API")
api_router = APIRouter(prefix="/api")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Models
class UserRole(str):
    ADMIN = "admin"
    INSTRUCTOR = "instructor"
    STUDENT = "student"

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str = UserRole.STUDENT

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class CourseBase(BaseModel):
    title: str
    description: str
    instructor_id: str
    duration_weeks: int = 8
    max_students: int = 50
    is_published: bool = False

class CourseCreate(BaseModel):
    title: str
    description: str
    duration_weeks: int = 8
    max_students: int = 50
    is_published: bool = False

class Course(CourseBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    enrolled_students: List[str] = []
    modules: List[Dict[str, Any]] = []

class EnrollmentCreate(BaseModel):
    course_id: str

class Enrollment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    course_id: str
    enrolled_at: datetime = Field(default_factory=datetime.utcnow)
    progress: float = 0.0
    completed: bool = False

# New Models for Enhanced Features
class ModuleCreate(BaseModel):
    title: str
    description: str
    content: str
    order: int
    content_type: str = "text"  # text, video, pdf, link

class Module(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    course_id: str
    title: str
    description: str
    content: str
    order: int
    content_type: str = "text"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AssignmentCreate(BaseModel):
    title: str
    description: str
    due_date: datetime
    max_score: int = 100
    instructions: str

class Assignment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    course_id: str
    title: str
    description: str
    due_date: datetime
    max_score: int = 100
    instructions: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str

class SubmissionCreate(BaseModel):
    assignment_id: str
    content: str
    file_path: Optional[str] = None

class Submission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    assignment_id: str
    student_id: str
    content: str
    file_path: Optional[str] = None
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    score: Optional[int] = None
    feedback: Optional[str] = None
    graded_at: Optional[datetime] = None
    graded_by: Optional[str] = None

class QuizCreate(BaseModel):
    title: str
    description: str
    duration_minutes: int = 30
    max_attempts: int = 3
    questions: List[Dict[str, Any]]

class Quiz(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    course_id: str
    title: str
    description: str
    duration_minutes: int = 30
    max_attempts: int = 3
    questions: List[Dict[str, Any]]
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str

class QuizAttemptCreate(BaseModel):
    quiz_id: str
    answers: List[Dict[str, Any]]

class QuizAttempt(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quiz_id: str
    student_id: str
    answers: List[Dict[str, Any]]
    score: int
    max_score: int
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    attempt_number: int = 1

class DiscussionCreate(BaseModel):
    title: str
    content: str

class Discussion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    course_id: str
    title: str
    content: str
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    replies: List[Dict[str, Any]] = []

class ReplyCreate(BaseModel):
    content: str

class Reply(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    discussion_id: str
    content: str
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"email": email})
    if user is None:
        raise credentials_exception
    return UserInDB(**user)

async def get_current_active_user(current_user: UserInDB = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def require_role(required_role: str):
    def role_checker(current_user: UserInDB = Depends(get_current_active_user)):
        if current_user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return role_checker

async def check_course_access(course_id: str, current_user: UserInDB):
    course = await db.courses.find_one({"id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Admin can access all courses
    if current_user.role == UserRole.ADMIN:
        return course
    
    # Instructor can access their own courses
    if current_user.role == UserRole.INSTRUCTOR and course["instructor_id"] == current_user.id:
        return course
    
    # Students can access if enrolled OR if course is published (for viewing before enrollment)
    if current_user.role == UserRole.STUDENT:
        # Check if student is enrolled
        enrollment = await db.enrollments.find_one({
            "student_id": current_user.id,
            "course_id": course_id
        })
        if enrollment:
            return course
        
        # Allow access to published courses for browsing
        if course.get("is_published", False):
            return course
    
    raise HTTPException(status_code=403, detail="Access denied")

# Authentication Routes
@api_router.post("/auth/register", response_model=User)
async def register(user: UserCreate):
    if await db.users.find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    user_dict = user.dict()
    del user_dict["password"]
    user_in_db = UserInDB(**user_dict, hashed_password=hashed_password)
    
    await db.users.insert_one(user_in_db.dict())
    return User(**user_dict, id=user_in_db.id)

@api_router.post("/auth/login", response_model=Token)
async def login(user_credentials: UserLogin):
    user = await db.users.find_one({"email": user_credentials.email})
    if not user or not verify_password(user_credentials.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"]}, expires_delta=access_token_expires
    )
    
    user_obj = User(**{k: v for k, v in user.items() if k != "hashed_password"})
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.get("/auth/me", response_model=User)
async def get_current_user_info(current_user: UserInDB = Depends(get_current_active_user)):
    return User(**current_user.dict())

# Course Routes
@api_router.post("/courses", response_model=Course)
async def create_course(
    course: CourseCreate,
    current_user: UserInDB = Depends(require_role(UserRole.INSTRUCTOR))
):
    course_dict = course.dict()
    course_dict["instructor_id"] = current_user.id
    course_obj = Course(**course_dict)
    
    await db.courses.insert_one(course_obj.dict())
    return course_obj

@api_router.get("/courses", response_model=List[Course])
async def get_courses(current_user: UserInDB = Depends(get_current_active_user)):
    if current_user.role == UserRole.INSTRUCTOR:
        courses = await db.courses.find({"instructor_id": current_user.id}).to_list(1000)
    else:
        courses = await db.courses.find({"is_published": True}).to_list(1000)
    
    return [Course(**course) for course in courses]

@api_router.get("/courses/{course_id}", response_model=Course)
async def get_course(course_id: str, current_user: UserInDB = Depends(get_current_active_user)):
    course = await check_course_access(course_id, current_user)
    return Course(**course)

@api_router.put("/courses/{course_id}", response_model=Course)
async def update_course(
    course_id: str,
    course_update: CourseCreate,
    current_user: UserInDB = Depends(require_role(UserRole.INSTRUCTOR))
):
    course = await db.courses.find_one({"id": course_id, "instructor_id": current_user.id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    update_dict = course_update.dict()
    await db.courses.update_one({"id": course_id}, {"$set": update_dict})
    
    updated_course = await db.courses.find_one({"id": course_id})
    return Course(**updated_course)

# Module Routes
@api_router.post("/courses/{course_id}/modules", response_model=Module)
async def create_module(
    course_id: str,
    module: ModuleCreate,
    current_user: UserInDB = Depends(require_role(UserRole.INSTRUCTOR))
):
    # Check if user owns the course
    course = await db.courses.find_one({"id": course_id, "instructor_id": current_user.id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    module_dict = module.dict()
    module_dict["course_id"] = course_id
    module_obj = Module(**module_dict)
    
    await db.modules.insert_one(module_obj.dict())
    return module_obj

@api_router.get("/courses/{course_id}/modules", response_model=List[Module])
async def get_modules(course_id: str, current_user: UserInDB = Depends(get_current_active_user)):
    await check_course_access(course_id, current_user)
    
    modules = await db.modules.find({"course_id": course_id}).sort("order", 1).to_list(1000)
    return [Module(**module) for module in modules]

@api_router.put("/courses/{course_id}/modules/{module_id}", response_model=Module)
async def update_module(
    course_id: str,
    module_id: str,
    module_update: ModuleCreate,
    current_user: UserInDB = Depends(require_role(UserRole.INSTRUCTOR))
):
    # Check if user owns the course
    course = await db.courses.find_one({"id": course_id, "instructor_id": current_user.id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    module = await db.modules.find_one({"id": module_id, "course_id": course_id})
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    update_dict = module_update.dict()
    await db.modules.update_one({"id": module_id}, {"$set": update_dict})
    
    updated_module = await db.modules.find_one({"id": module_id})
    return Module(**updated_module)

@api_router.delete("/courses/{course_id}/modules/{module_id}")
async def delete_module(
    course_id: str,
    module_id: str,
    current_user: UserInDB = Depends(require_role(UserRole.INSTRUCTOR))
):
    # Check if user owns the course
    course = await db.courses.find_one({"id": course_id, "instructor_id": current_user.id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    result = await db.modules.delete_one({"id": module_id, "course_id": course_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Module not found")
    
    return {"message": "Module deleted successfully"}

# Assignment Routes
@api_router.post("/courses/{course_id}/assignments", response_model=Assignment)
async def create_assignment(
    course_id: str,
    assignment: AssignmentCreate,
    current_user: UserInDB = Depends(require_role(UserRole.INSTRUCTOR))
):
    # Check if user owns the course
    course = await db.courses.find_one({"id": course_id, "instructor_id": current_user.id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    assignment_dict = assignment.dict()
    assignment_dict["course_id"] = course_id
    assignment_dict["created_by"] = current_user.id
    assignment_obj = Assignment(**assignment_dict)
    
    await db.assignments.insert_one(assignment_obj.dict())
    return assignment_obj

@api_router.get("/courses/{course_id}/assignments", response_model=List[Assignment])
async def get_assignments(course_id: str, current_user: UserInDB = Depends(get_current_active_user)):
    await check_course_access(course_id, current_user)
    
    assignments = await db.assignments.find({"course_id": course_id}).to_list(1000)
    return [Assignment(**assignment) for assignment in assignments]

@api_router.post("/assignments/{assignment_id}/submissions", response_model=Submission)
async def submit_assignment(
    assignment_id: str,
    submission: SubmissionCreate,
    current_user: UserInDB = Depends(require_role(UserRole.STUDENT))
):
    # Check if assignment exists and student is enrolled
    assignment = await db.assignments.find_one({"id": assignment_id})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    await check_course_access(assignment["course_id"], current_user)
    
    # Check if already submitted
    existing_submission = await db.submissions.find_one({
        "assignment_id": assignment_id,
        "student_id": current_user.id
    })
    if existing_submission:
        raise HTTPException(status_code=400, detail="Assignment already submitted")
    
    submission_dict = submission.dict()
    submission_dict["student_id"] = current_user.id
    submission_obj = Submission(**submission_dict)
    
    await db.submissions.insert_one(submission_obj.dict())
    return submission_obj

@api_router.get("/assignments/{assignment_id}/submissions", response_model=List[Dict[str, Any]])
async def get_submissions(
    assignment_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    assignment = await db.assignments.find_one({"id": assignment_id})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    await check_course_access(assignment["course_id"], current_user)
    
    if current_user.role == UserRole.STUDENT:
        # Students can only see their own submissions
        submissions = await db.submissions.find({
            "assignment_id": assignment_id,
            "student_id": current_user.id
        }).to_list(1000)
    else:
        # Instructors can see all submissions
        submissions = await db.submissions.find({"assignment_id": assignment_id}).to_list(1000)
        
        # Add student info for instructors
        for submission in submissions:
            student = await db.users.find_one({"id": submission["student_id"]})
            submission["student_name"] = student["full_name"] if student else "Unknown"
    
    # Convert MongoDB documents to dict and remove MongoDB ObjectId fields
    result = []
    for submission in submissions:
        # Remove MongoDB ObjectId fields
        clean_submission = {k: v for k, v in submission.items() if k != "_id"}
        result.append(clean_submission)
    
    return result

@api_router.put("/submissions/{submission_id}/grade")
async def grade_submission(
    submission_id: str,
    grade_data: Dict[str, Any],
    current_user: UserInDB = Depends(require_role(UserRole.INSTRUCTOR))
):
    submission = await db.submissions.find_one({"id": submission_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    assignment = await db.assignments.find_one({"id": submission["assignment_id"]})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Check if instructor owns the course
    course = await db.courses.find_one({"id": assignment["course_id"], "instructor_id": current_user.id})
    if not course:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {
        "score": grade_data.get("score"),
        "feedback": grade_data.get("feedback", ""),
        "graded_at": datetime.utcnow(),
        "graded_by": current_user.id
    }
    
    await db.submissions.update_one({"id": submission_id}, {"$set": update_data})
    
    updated_submission = await db.submissions.find_one({"id": submission_id})
    # Remove MongoDB ObjectId fields
    clean_submission = {k: v for k, v in updated_submission.items() if k != "_id"}
    return clean_submission

# Quiz Routes
@api_router.post("/courses/{course_id}/quizzes", response_model=Quiz)
async def create_quiz(
    course_id: str,
    quiz: QuizCreate,
    current_user: UserInDB = Depends(require_role(UserRole.INSTRUCTOR))
):
    # Check if user owns the course
    course = await db.courses.find_one({"id": course_id, "instructor_id": current_user.id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    quiz_dict = quiz.dict()
    quiz_dict["course_id"] = course_id
    quiz_dict["created_by"] = current_user.id
    quiz_obj = Quiz(**quiz_dict)
    
    await db.quizzes.insert_one(quiz_obj.dict())
    return quiz_obj

@api_router.get("/courses/{course_id}/quizzes", response_model=List[Quiz])
async def get_quizzes(course_id: str, current_user: UserInDB = Depends(get_current_active_user)):
    await check_course_access(course_id, current_user)
    
    quizzes = await db.quizzes.find({"course_id": course_id}).to_list(1000)
    return [Quiz(**quiz) for quiz in quizzes]

@api_router.post("/quizzes/{quiz_id}/attempts", response_model=QuizAttempt)
async def submit_quiz_attempt(
    quiz_id: str,
    attempt: QuizAttemptCreate,
    current_user: UserInDB = Depends(require_role(UserRole.STUDENT))
):
    quiz = await db.quizzes.find_one({"id": quiz_id})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    await check_course_access(quiz["course_id"], current_user)
    
    # Check attempt limit
    attempts_count = await db.quiz_attempts.count_documents({
        "quiz_id": quiz_id,
        "student_id": current_user.id
    })
    
    if attempts_count >= quiz["max_attempts"]:
        raise HTTPException(status_code=400, detail="Maximum attempts reached")
    
    # Calculate score
    score = 0
    max_score = len(quiz["questions"])
    
    for i, question in enumerate(quiz["questions"]):
        if i < len(attempt.answers):
            student_answer = attempt.answers[i]
            if student_answer.get("answer") == question.get("correct_answer"):
                score += 1
    
    attempt_dict = attempt.dict()
    attempt_dict["student_id"] = current_user.id
    attempt_dict["score"] = score
    attempt_dict["max_score"] = max_score
    attempt_dict["attempt_number"] = attempts_count + 1
    attempt_dict["completed_at"] = datetime.utcnow()
    attempt_obj = QuizAttempt(**attempt_dict)
    
    await db.quiz_attempts.insert_one(attempt_obj.dict())
    return attempt_obj

@api_router.get("/quizzes/{quiz_id}/attempts", response_model=List[QuizAttempt])
async def get_quiz_attempts(
    quiz_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    quiz = await db.quizzes.find_one({"id": quiz_id})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    await check_course_access(quiz["course_id"], current_user)
    
    if current_user.role == UserRole.STUDENT:
        attempts = await db.quiz_attempts.find({
            "quiz_id": quiz_id,
            "student_id": current_user.id
        }).to_list(1000)
    else:
        attempts = await db.quiz_attempts.find({"quiz_id": quiz_id}).to_list(1000)
    
    return [QuizAttempt(**attempt) for attempt in attempts]

# Discussion Routes
@api_router.post("/courses/{course_id}/discussions", response_model=Discussion)
async def create_discussion(
    course_id: str,
    discussion: DiscussionCreate,
    current_user: UserInDB = Depends(get_current_active_user)
):
    await check_course_access(course_id, current_user)
    
    discussion_dict = discussion.dict()
    discussion_dict["course_id"] = course_id
    discussion_dict["created_by"] = current_user.id
    discussion_obj = Discussion(**discussion_dict)
    
    await db.discussions.insert_one(discussion_obj.dict())
    return discussion_obj

@api_router.get("/courses/{course_id}/discussions", response_model=List[Dict[str, Any]])
async def get_discussions(course_id: str, current_user: UserInDB = Depends(get_current_active_user)):
    await check_course_access(course_id, current_user)
    
    discussions = await db.discussions.find({"course_id": course_id}).to_list(1000)
    
    # Add creator info and clean MongoDB ObjectId fields
    result = []
    for discussion in discussions:
        creator = await db.users.find_one({"id": discussion["created_by"]})
        # Remove MongoDB ObjectId fields
        clean_discussion = {k: v for k, v in discussion.items() if k != "_id"}
        clean_discussion["creator_name"] = creator["full_name"] if creator else "Unknown"
        result.append(clean_discussion)
    
    return result

@api_router.post("/discussions/{discussion_id}/replies", response_model=Reply)
async def create_reply(
    discussion_id: str,
    reply: ReplyCreate,
    current_user: UserInDB = Depends(get_current_active_user)
):
    discussion = await db.discussions.find_one({"id": discussion_id})
    if not discussion:
        raise HTTPException(status_code=404, detail="Discussion not found")
    
    await check_course_access(discussion["course_id"], current_user)
    
    reply_dict = reply.dict()
    reply_dict["discussion_id"] = discussion_id
    reply_dict["created_by"] = current_user.id
    reply_obj = Reply(**reply_dict)
    
    await db.replies.insert_one(reply_obj.dict())
    
    # Update discussion with reply
    await db.discussions.update_one(
        {"id": discussion_id},
        {"$push": {"replies": reply_obj.dict()}}
    )
    
    return reply_obj

@api_router.get("/discussions/{discussion_id}/replies", response_model=List[Dict[str, Any]])
async def get_replies(discussion_id: str, current_user: UserInDB = Depends(get_current_active_user)):
    discussion = await db.discussions.find_one({"id": discussion_id})
    if not discussion:
        raise HTTPException(status_code=404, detail="Discussion not found")
    
    await check_course_access(discussion["course_id"], current_user)
    
    replies = await db.replies.find({"discussion_id": discussion_id}).to_list(1000)
    
    # Add creator info and clean MongoDB ObjectId fields
    result = []
    for reply in replies:
        creator = await db.users.find_one({"id": reply["created_by"]})
        # Remove MongoDB ObjectId fields
        clean_reply = {k: v for k, v in reply.items() if k != "_id"}
        clean_reply["creator_name"] = creator["full_name"] if creator else "Unknown"
        result.append(clean_reply)
    
    return result

# Enrollment Routes
@api_router.post("/enrollments", response_model=Enrollment)
async def enroll_in_course(
    enrollment: EnrollmentCreate,
    current_user: UserInDB = Depends(require_role(UserRole.STUDENT))
):
    course = await db.courses.find_one({"id": enrollment.course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    existing_enrollment = await db.enrollments.find_one({
        "student_id": current_user.id,
        "course_id": enrollment.course_id
    })
    if existing_enrollment:
        raise HTTPException(status_code=400, detail="Already enrolled in this course")
    
    enrollment_obj = Enrollment(
        student_id=current_user.id,
        course_id=enrollment.course_id
    )
    
    await db.enrollments.insert_one(enrollment_obj.dict())
    
    await db.courses.update_one(
        {"id": enrollment.course_id},
        {"$push": {"enrolled_students": current_user.id}}
    )
    
    return enrollment_obj

@api_router.get("/enrollments", response_model=List[Dict[str, Any]])
async def get_user_enrollments(current_user: UserInDB = Depends(get_current_active_user)):
    enrollments = await db.enrollments.find({"student_id": current_user.id}).to_list(1000)
    
    result = []
    for enrollment in enrollments:
        course = await db.courses.find_one({"id": enrollment["course_id"]})
        if course:
            result.append({
                "enrollment": Enrollment(**enrollment),
                "course": Course(**course)
            })
    
    return result

# Dashboard Routes
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: UserInDB = Depends(get_current_active_user)):
    if current_user.role == UserRole.ADMIN:
        total_users = await db.users.count_documents({})
        total_courses = await db.courses.count_documents({})
        total_enrollments = await db.enrollments.count_documents({})
        total_assignments = await db.assignments.count_documents({})
        total_discussions = await db.discussions.count_documents({})
        
        return {
            "total_users": total_users,
            "total_courses": total_courses,
            "total_enrollments": total_enrollments,
            "total_assignments": total_assignments,
            "total_discussions": total_discussions,
            "role": current_user.role
        }
    
    elif current_user.role == UserRole.INSTRUCTOR:
        my_courses = await db.courses.count_documents({"instructor_id": current_user.id})
        my_course_ids = [course["id"] for course in await db.courses.find({"instructor_id": current_user.id}).to_list(1000)]
        total_students = await db.enrollments.count_documents({"course_id": {"$in": my_course_ids}})
        total_assignments = await db.assignments.count_documents({"course_id": {"$in": my_course_ids}})
        total_submissions = await db.submissions.count_documents({"assignment_id": {"$in": [
            assignment["id"] for assignment in await db.assignments.find({"course_id": {"$in": my_course_ids}}).to_list(1000)
        ]}})
        
        return {
            "my_courses": my_courses,
            "total_students": total_students,
            "total_assignments": total_assignments,
            "total_submissions": total_submissions,
            "role": current_user.role
        }
    
    else:  # Student
        my_enrollments = await db.enrollments.count_documents({"student_id": current_user.id})
        completed_courses = await db.enrollments.count_documents({
            "student_id": current_user.id,
            "completed": True
        })
        my_submissions = await db.submissions.count_documents({"student_id": current_user.id})
        my_quiz_attempts = await db.quiz_attempts.count_documents({"student_id": current_user.id})
        
        return {
            "enrolled_courses": my_enrollments,
            "completed_courses": completed_courses,
            "submitted_assignments": my_submissions,
            "quiz_attempts": my_quiz_attempts,
            "role": current_user.role
        }

# Include router
app.include_router(api_router)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
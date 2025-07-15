from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
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

class CourseCreate(CourseBase):
    pass

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

class Module(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    content: str
    order: int
    course_id: str

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

# Authentication Routes
@api_router.post("/auth/register", response_model=User)
async def register(user: UserCreate):
    # Check if user already exists
    if await db.users.find_one({"email": user.email}):
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    # Create user
    hashed_password = get_password_hash(user.password)
    user_dict = user.dict()
    del user_dict["password"]
    user_in_db = UserInDB(**user_dict, hashed_password=hashed_password)
    
    # Insert into database
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
    course = await db.courses.find_one({"id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
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

# Enrollment Routes
@api_router.post("/enrollments", response_model=Enrollment)
async def enroll_in_course(
    enrollment: EnrollmentCreate,
    current_user: UserInDB = Depends(require_role(UserRole.STUDENT))
):
    # Check if course exists
    course = await db.courses.find_one({"id": enrollment.course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Check if already enrolled
    existing_enrollment = await db.enrollments.find_one({
        "student_id": current_user.id,
        "course_id": enrollment.course_id
    })
    if existing_enrollment:
        raise HTTPException(status_code=400, detail="Already enrolled in this course")
    
    # Create enrollment
    enrollment_obj = Enrollment(
        student_id=current_user.id,
        course_id=enrollment.course_id
    )
    
    await db.enrollments.insert_one(enrollment_obj.dict())
    
    # Update course enrolled students
    await db.courses.update_one(
        {"id": enrollment.course_id},
        {"$push": {"enrolled_students": current_user.id}}
    )
    
    return enrollment_obj

@api_router.get("/enrollments", response_model=List[Dict[str, Any]])
async def get_user_enrollments(current_user: UserInDB = Depends(get_current_active_user)):
    enrollments = await db.enrollments.find({"student_id": current_user.id}).to_list(1000)
    
    # Get course details for each enrollment
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
        
        return {
            "total_users": total_users,
            "total_courses": total_courses,
            "total_enrollments": total_enrollments,
            "role": current_user.role
        }
    
    elif current_user.role == UserRole.INSTRUCTOR:
        my_courses = await db.courses.count_documents({"instructor_id": current_user.id})
        total_students = await db.enrollments.count_documents({
            "course_id": {"$in": [course["id"] for course in await db.courses.find({"instructor_id": current_user.id}).to_list(1000)]}
        })
        
        return {
            "my_courses": my_courses,
            "total_students": total_students,
            "role": current_user.role
        }
    
    else:  # Student
        my_enrollments = await db.enrollments.count_documents({"student_id": current_user.id})
        completed_courses = await db.enrollments.count_documents({
            "student_id": current_user.id,
            "completed": True
        })
        
        return {
            "enrolled_courses": my_enrollments,
            "completed_courses": completed_courses,
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
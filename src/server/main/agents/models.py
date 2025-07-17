from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, List

class TaskStep(BaseModel):
    tool: str
    description: str

class GeneratePlanRequest(BaseModel):
    prompt: str

class AddTaskRequest(BaseModel):
    description: str
    priority: int = 1
    plan: List[TaskStep]
    schedule: Optional[Dict[str, Any]] = None

class UpdateTaskRequest(BaseModel):
    taskId: str
    description: Optional[str] = None
    priority: Optional[int] = None
    plan: Optional[List[TaskStep]] = None
    schedule: Optional[Dict[str, Any]] = None
    enabled: Optional[bool] = None

class ActionItemRequest(BaseModel):
    description: str

class TaskIdRequest(BaseModel):
    taskId: str
class AnswerItem(BaseModel):
    question_id: str
    answer_text: str

class AnswerClarificationRequest(BaseModel):
    taskId: str
    answers: List[AnswerItem]

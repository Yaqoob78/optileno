from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional


class AgentEvent(BaseModel):
    event: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    user_id: Optional[int] = None
    occurred_at: Optional[str] = None
    source: str = "optileno"


class AgentAction(BaseModel):
    type: str
    value: Optional[float] = None
    after_hours: Optional[int] = None
    payload: Dict[str, Any] = Field(default_factory=dict)


class AgentDecision(BaseModel):
    decision: str = "NO_ACTION"
    actions: List[AgentAction] = Field(default_factory=list)
    analysis: Optional[str] = None

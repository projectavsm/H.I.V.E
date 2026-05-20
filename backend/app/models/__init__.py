from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class MessageParam(BaseModel):
    """Represents a single message node within the conversational stream context."""
    role: str = Field(..., description="The structural authority of the emitter (e.g., 'user', 'assistant', 'system')")
    content: str = Field(..., description="The raw textual character payload of the message context")

class ChatCompletionRequest(BaseModel):
    """The hardened incoming schema sent by the React frontend UI."""
    messages: List[MessageParam] = Field(..., min_items=1, description="The sequential thread history of the dialog stream")
    stream: Optional[bool] = Field(default=True, description="Flag determining whether tokens emit via Server-Sent Events (SSE)")
    system_prompt: Optional[str] = Field(default=None, description="Injected core runtime directive override")

class ToolExecutionLog(BaseModel):
    """Internal validation object capturing agent execution meta-steps for logging metrics."""
    tool_name: str
    arguments: Dict[str, Any]
    execution_status: str
    result_summary: Optional[str] = None
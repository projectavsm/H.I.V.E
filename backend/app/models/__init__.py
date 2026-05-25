from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class MessageParam(BaseModel):
    """Represents a single message node within the conversational stream context."""
    role: str = Field(..., description="The structural authority of the emitter (e.g., 'user', 'assistant', 'system')")
    content: str = Field(..., description="The raw textual character payload of the message context")

class ChatCompletionRequest(BaseModel):
    """The hardened incoming schema sent by the React frontend UI, aligned with local RAG strategy metrics."""
    model: str = Field(default="llama3.1", description="The target core local intelligence model requested")
    messages: List[MessageParam] = Field(..., min_items=1, description="The sequential thread history of the dialog stream")
    stream: Optional[bool] = Field(default=True, description="Flag determining whether tokens emit via Server-Sent Events (SSE)")
    system_prompt: Optional[str] = Field(default=None, description="Injected core runtime directive override")
    temperature: Optional[float] = Field(default=0.4, description="Inference randomness control layer bounds")
    rag_mode: Optional[str] = Field(default="global", description="RAG Execution Strategy boundary rules: 'global' (All files), 'strict' (Selected file), or 'off' (Bypass database context)")
    target_file: Optional[str] = Field(default=None, description="The specific structural target metadata filename when operating in 'strict' mode")

class ToolExecutionLog(BaseModel):
    """Internal validation object capturing agent execution meta-steps for logging metrics."""
    tool_name: str
    arguments: Dict[str, Any]
    execution_status: str
    result_summary: Optional[str] = None
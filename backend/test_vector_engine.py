import asyncio
import sys
import os

# Add the backend folder to path so app modules can be resolved
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.rag_service import LocalRAGEngine

async def diagnose_rag():
    print("🛰️ Initializing Local RAG Engine Diagnostic Check...")
    engine = LocalRAGEngine()
    
    # Test query targeting specific data you know exists in your documentation
    test_query = "What are the hardware boundary constraints and VRAM limits?"
    print(f"🔍 Dispatched Test Query: '{test_query}'")
    
    try:
        raw_result = await engine.query_knowledge_base(test_query)
        
        print("\n=== DIAGNOSTIC MATRIX OUTPUT ===")
        print(f"Data Type Returned: {type(raw_result)}")
        
        if raw_result is None:
            print("❌ CRITICAL: Engine returned 'None'. Check if your function misses a return statement.")
        elif str(raw_result).strip() == "":
            print("⚠️ WARNING: Engine returned an empty string. Database exists but no chunks matched.")
        else:
            print(f"✅ SUCCESS! Retrieved Context Length: {len(str(raw_result))} characters.")
            print(f"Content Sample:\n{str(raw_result)[:300]}...")
            
    except Exception as e:
        print(f"💥 ENGINE CRASHED: {str(e)}")

if __name__ == "__main__":
    asyncio.run(diagnose_rag())
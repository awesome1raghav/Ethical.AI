from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import shutil
from typing import Dict, Any

# Import the new docling service
from app.services.parsers.docling_service import analyze_file

router = APIRouter(tags=["Analysis"])

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Receives an attached file from the frontend, parses it using Docling,
    and returns a structured markdown representation to be sent to the NEXUS agent.
    """
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided.")
            
        file_location = os.path.join(UPLOAD_DIR, file.filename)
        
        # Save the file temporarily
        with open(file_location, "wb+") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Parse the file using docling service
        analysis_result = analyze_file(file_location)
        
        # Remove the temporary file after processing
        if os.path.exists(file_location):
            os.remove(file_location)
            
        if analysis_result.get("success"):
            return {
                "parsed_markdown": analysis_result.get("markdown"),
                "element_count": analysis_result.get("element_count")
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to process file: {analysis_result.get('error', 'Unknown parsing error')}"
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import os
from typing import Dict, Any

try:
    from docling.document_converter import DocumentConverter
    HAS_DOCLING = True
except ImportError:
    HAS_DOCLING = False

def analyze_file(file_path: str) -> Dict[str, Any]:
    """
    Parses a document using Docling or falls back to plain-text reading.
    Returns a dictionary containing the extracted Markdown context.
    """
    try:
        if not os.path.exists(file_path):
            return {"success": False, "error": "File not found."}
            
        if HAS_DOCLING:
            # Initialize Docling converter
            converter = DocumentConverter()
            
            # Convert the document
            result = converter.convert(file_path)
            
            # Extract markdown representation
            markdown_content = result.document.export_to_markdown()
            
            return {
                "success": True, 
                "markdown": markdown_content, 
                "element_count": 1 # Representing 1 unified markdown document
            }
        else:
            # Fallback for plain text/code files when docling is unavailable
            lower_path = file_path.lower()
            if lower_path.endswith(('.txt', '.md', '.markdown', '.json', '.py', '.js', '.ts', '.tsx', '.css', '.html', '.csv', '.yaml', '.yml')):
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                return {
                    "success": True,
                    "markdown": content,
                    "element_count": 1
                }
            return {
                "success": False,
                "error": "Docling library is not installed. To parse PDFs, Word docs, or images, please run pip install docling. Plain text files (.txt, .md, .py, etc.) are still supported."
            }
    except Exception as e:
        return {"success": False, "error": str(e)}

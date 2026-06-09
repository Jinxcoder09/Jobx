import io
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import StreamingResponse

from ..database import get_resumes_collection
from ..services.pdf_generator import PdfResumeBuilder
from ..services.docx_generator import DocxResumeBuilder

router = APIRouter()

@router.post("/resume/generate-pdf")
async def generate_pdf(resume_data: dict):
    try:
        builder = PdfResumeBuilder(resume_data)
        pdf_bytes = builder.generate()
        
        title = resume_data.get("title", "resume")
        filename = f"{title}.pdf".replace(" ", "_")
        
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")

@router.post("/resume/generate-docx")
async def generate_docx(resume_data: dict):
    try:
        builder = DocxResumeBuilder(resume_data)
        docx_bytes = builder.generate()
        
        title = resume_data.get("title", "resume")
        filename = f"{title}.docx".replace(" ", "_")
        
        return StreamingResponse(
            io.BytesIO(docx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate DOCX: {str(e)}")

@router.post("/resume/preview")
async def preview_resume(resume_data: dict):
    try:
        builder = PdfResumeBuilder(resume_data)
        pdf_bytes = builder.generate()
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate preview: {str(e)}")

@router.get("/resume/download/{resume_id}")
async def download_resume(resume_id: str):
    col = get_resumes_collection()
    doc = await col.find_one({"id": resume_id}, projection={"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Resume not found")
        
    try:
        builder = PdfResumeBuilder(doc)
        pdf_bytes = builder.generate()
        
        title = doc.get("title", "resume")
        filename = f"{title}.pdf".replace(" ", "_")
        
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF download: {str(e)}")

from fastapi import APIRouter, UploadFile, File, HTTPException
from utils.s3 import upload_file_to_s3, list_files_in_s3
from utils.extraction import run_extraction, get_artifact

router = APIRouter()


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        result = upload_file_to_s3(
            file.file,
            filename=file.filename,
            content_type=file.content_type,
        )

        return {
            "success": True,
            "data": result,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@router.get("/list")
async def list_files():
    try:
        files = list_files_in_s3()
        return {
            "success": True,
            "data": files,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract")
async def extract_invoice(body: dict):
    try:
        file_id: str | None = body.get("id")
        ext: str = body.get("ext", "pdf")
        print(f"Received extraction request for file_id={file_id} with ext={ext}")
        if not file_id:
            raise HTTPException(status_code=400, detail="Missing file id")

        result = await run_extraction(file_id, ext)

        if not result:
            raise HTTPException(
                status_code=422, detail="Extraction returned no data"
            )

        return {"success": True, "id": file_id, "data": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/artifacts/{file_id}/data.json")
async def get_artifact_data(file_id: str):
    data = get_artifact(file_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return {"success": True, "data": data}
import os
from utils.s3 import get_artifact_from_s3, save_artifact_to_s3
from utils.adi import extract_invoice_data


def get_artifact(file_id: str) -> dict | None:
    return get_artifact_from_s3(file_id)


def save_artifact(file_id: str, data: dict) -> None:
    save_artifact_to_s3(file_id, data)


async def run_extraction(file_id: str, ext: str) -> dict:
    """
    Run the extraction pipeline for the given file id and cache the result.
    Replace the pipeline block with your actual implementation.
    """
    # 1. Return cached result if already extracted
    formUrl = f"https://s3-jetl.s3.us-east-2.amazonaws.com/uploads/{file_id}.{ext}"
    cached = get_artifact(formUrl)
    if cached is not None:
        return cached
    print(f"No cached result for {formUrl} — running extraction...")
    result: dict = extract_invoice_data(formUrl)
    # ------------------------------------------------

    # 3. Cache result on S3
    if result:
        save_artifact(file_id, result)

    return result
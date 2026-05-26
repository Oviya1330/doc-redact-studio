import boto3
import os
from uuid import uuid4
import json

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
S3_BUCKET = os.getenv("S3_BUCKET_NAME")
print(f"Using S3 bucket: {S3_BUCKET} in region: {AWS_REGION}")
s3_client = boto3.client(
    "s3",
    region_name=AWS_REGION,
)

def generate_file_key(filename: str) -> str:
    ext = filename.split(".")[-1]
    return f"uploads/{uuid4()}.{ext}"


def upload_file_to_s3(file_obj, filename: str, content_type: str):
    key = generate_file_key(filename)

    s3_client.upload_fileobj(
        Fileobj=file_obj,
        Bucket=S3_BUCKET,
        Key=key,
        ExtraArgs={
            "ContentType": content_type,
        },
    )

    file_url = f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}"

    return {
        "key": key,
        "file_url": file_url,
    }

def list_files_in_s3(prefix: str = "uploads/"):
    """
    List all files in the 'uploads/' folder of the bucket
    """
    response = s3_client.list_objects_v2(Bucket=S3_BUCKET, Prefix=prefix)

    files = []
    if "Contents" in response:
        for obj in response["Contents"]:
            files.append(
                {
                    "key": obj["Key"],
                    "last_modified": obj["LastModified"].isoformat(),
                    "size": obj["Size"],
                    "url": f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{obj['Key']}",
                }
            )
    return files


def get_artifact_from_s3(file_id: str) -> dict | None:
    key = f"artifacts/{file_id}/data.json"
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=key)
        return json.loads(response["Body"].read().decode("utf-8"))
    except s3_client.exceptions.NoSuchKey:
        return None
    except Exception:
        return None


def save_artifact_to_s3(file_id: str, data: dict) -> None:
    key = f"artifacts/{file_id}/data.json"
    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8"),
        ContentType="application/json",
    )
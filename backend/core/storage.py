"""
JARVIS File Storage — Railway Object Storage (S3-compatible)
Leer/escribir archivos en el bucket de Railway.
Variables de entorno automáticas cuando se crea un bucket en Railway.
"""

import os
from typing import Optional

try:
    import boto3
    from botocore.client import Config
    _S3_AVAILABLE = True
except ImportError:
    _S3_AVAILABLE = False


def _get_s3_client():
    """Crear cliente S3 para Railway Object Storage."""
    if not _S3_AVAILABLE:
        raise RuntimeError("boto3 no instalado. Ejecuta: pip install boto3")
    
    endpoint = os.environ.get("ENDPOINT", os.environ.get("RAILWAY_BUCKET_ENDPOINT"))
    access_key = os.environ.get("ACCESS_KEY_ID", os.environ.get("RAILWAY_BUCKET_ACCESS_KEY"))
    secret_key = os.environ.get("SECRET_ACCESS_KEY", os.environ.get("RAILWAY_BUCKET_SECRET_KEY"))
    
    if not all([endpoint, access_key, secret_key]):
        raise RuntimeError(
            "Railway Object Storage no configurado. "
            "Crea un bucket en Railway y conectalo al servicio."
        )
    
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4"),
    )


def _get_bucket_name():
    """Nombre del bucket. Railway lo pone en env var BUCKET."""
    return os.environ.get("BUCKET", os.environ.get("RAILWAY_BUCKET_NAME"))


def upload_file(local_path: str, object_key: str, content_type: Optional[str] = None) -> str:
    """Sube un archivo al bucket. Devuelve la URL del objeto."""
    s3 = _get_s3_client()
    bucket = _get_bucket_name()
    extra = {}
    if content_type:
        extra["ContentType"] = content_type
    s3.upload_file(local_path, bucket, object_key, ExtraArgs=extra)
    endpoint = os.environ.get("ENDPOINT", os.environ.get("RAILWAY_BUCKET_ENDPOINT"))
    return f"{endpoint}/{bucket}/{object_key}"


def upload_bytes(data: bytes, object_key: str, content_type: Optional[str] = None) -> str:
    """Sube bytes al bucket."""
    s3 = _get_s3_client()
    bucket = _get_bucket_name()
    extra = {}
    if content_type:
        extra["ContentType"] = content_type
    s3.put_object(Bucket=bucket, Key=object_key, Body=data, **extra)
    endpoint = os.environ.get("ENDPOINT", os.environ.get("RAILWAY_BUCKET_ENDPOINT"))
    return f"{endpoint}/{bucket}/{object_key}"


def download_file(object_key: str, local_path: str):
    """Descarga un archivo del bucket."""
    s3 = _get_s3_client()
    bucket = _get_bucket_name()
    s3.download_file(bucket, object_key, local_path)


def download_bytes(object_key: str) -> bytes:
    """Descarga bytes del bucket."""
    s3 = _get_s3_client()
    bucket = _get_bucket_name()
    response = s3.get_object(Bucket=bucket, Key=object_key)
    return response["Body"].read()


def delete_file(object_key: str):
    """Borra un archivo del bucket."""
    s3 = _get_s3_client()
    bucket = _get_bucket_name()
    s3.delete_object(Bucket=bucket, Key=object_key)


def list_files(prefix: str = "") -> list[dict]:
    """Lista archivos en el bucket."""
    s3 = _get_s3_client()
    bucket = _get_bucket_name()
    response = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
    return response.get("Contents", [])


def generate_presigned_url(object_key: str, expiration: int = 3600) -> str:
    """Genera URL presignada para compartir archivos."""
    s3 = _get_s3_client()
    bucket = _get_bucket_name()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": object_key},
        ExpiresIn=expiration,
    )

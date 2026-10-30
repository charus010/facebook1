from functools import lru_cache

from app.core.config import get_settings


class S3Storage:
    """S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, …). Videos never touch local disk."""

    def __init__(self) -> None:
        import boto3
        from botocore.config import Config

        s = get_settings()
        self.bucket = s.s3_bucket
        self.client = boto3.client(
            "s3", endpoint_url=s.s3_endpoint_url, region_name=s.s3_region,
            aws_access_key_id=s.s3_access_key, aws_secret_access_key=s.s3_secret_key,
            config=Config(signature_version="s3v4"),
        )

    def presign_put(self, key: str, content_type: str, expires: int = 900) -> str:
        return self.client.generate_presigned_url(
            "put_object", Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type}, ExpiresIn=expires)

    def head_size(self, key: str) -> int | None:
        from botocore.exceptions import ClientError
        try:
            return int(self.client.head_object(Bucket=self.bucket, Key=key)["ContentLength"])
        except ClientError:
            return None

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)


@lru_cache
def get_storage() -> S3Storage:
    return S3Storage()

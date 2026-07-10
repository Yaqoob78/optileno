import os
import re
from functools import lru_cache
from typing import Optional


def infer_rds_region(hostname: str) -> Optional[str]:
    match = re.search(r"\.([a-z]{2}-[a-z]+-\d)\.rds\.amazonaws\.com(?:\.cn)?$", hostname or "")
    if match:
        return match.group(1)
    return None


@lru_cache(maxsize=8)
def _rds_client(region_name: str):
    import boto3

    return boto3.client("rds", region_name=region_name)


def generate_db_auth_token(
    *,
    hostname: str,
    port: int,
    username: str,
    region_name: Optional[str] = None,
) -> str:
    region = (
        region_name
        or os.getenv("DATABASE_AWS_REGION")
        or os.getenv("AWS_REGION")
        or os.getenv("AWS_DEFAULT_REGION")
        or infer_rds_region(hostname)
    )
    if not region:
        raise RuntimeError("DATABASE_AWS_REGION or AWS_REGION is required for RDS IAM auth")

    return _rds_client(region).generate_db_auth_token(
        DBHostname=hostname,
        Port=int(port or 5432),
        DBUsername=username,
        Region=region,
    )

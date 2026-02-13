from backend.auth.auth_utils import verify_password
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Test truncation logic directly
password = "a" * 80
hashed = pwd_context.hash(password[:72]) # Create a valid hash for truncated password

with open("result_auth_utils.txt", "w") as f:
    f.write(f"Testing verify_password with length {len(password)}\n")
    try:
        result = verify_password(password, hashed)
        f.write(f"Result: {result}\n")
    except Exception as e:
        f.write(f"Error: {e}\n")

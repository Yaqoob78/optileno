import sys
from passlib.context import CryptContext

try:
    with open("result.txt", "w") as f:
        f.write("Starting test\n")
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        long_password = "a" * 80
        
        try:
            hash_ = pwd_context.hash(long_password)
            f.write(f"Hash created successfully: {hash_}\n")
            
            try:
                verify = pwd_context.verify(long_password, hash_)
                f.write(f"Verification result: {verify}\n")
            except Exception as e:
                f.write(f"Verification failed with error: {e}\n")
                
        except Exception as e:
            f.write(f"Hashing failed with error: {e}\n")
            
except Exception as e:
    print(f"File writing failed: {e}")

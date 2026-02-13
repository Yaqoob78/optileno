from passlib.context import CryptContext

try:
    with open("result_short.txt", "w") as f:
        f.write("Starting short test\n")
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        pw = "short"
        
        try:
            hash_ = pwd_context.hash(pw)
            f.write(f"Hash created successfully: {hash_}\n")
            
            v = pwd_context.verify(pw, hash_)
            f.write(f"Verify result: {v}\n")
            
        except Exception as e:
            f.write(f"Failed with error: {e}\n")
            
except Exception as e:
    print(f"File writing failed: {e}")

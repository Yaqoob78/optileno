from passlib.context import CryptContext

try:
    with open("result_truncate_50_str.txt", "w") as f:
        f.write("Starting truncate test 50 str\n")
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        long_password = "a" * 80
        truncated_pw = long_password[:50] # Check this is str
        f.write(f"Truncated type: {type(truncated_pw)}\n")
        f.write(f"Truncated length: {len(truncated_pw)}\n")

        try:
            hash_ = pwd_context.hash(truncated_pw)
            f.write(f"Hash created successfully: {hash_}\n")
            
            # Verify
            v = pwd_context.verify(truncated_pw, hash_)
            f.write(f"Verify result: {v}\n")
            
        except Exception as e:
            f.write(f"Failed with error: {e}\n")
            
except Exception as e:
    print(f"File writing failed: {e}")

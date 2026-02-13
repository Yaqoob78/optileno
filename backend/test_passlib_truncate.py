from passlib.context import CryptContext

try:
    with open("result_truncate.txt", "w") as f:
        f.write("Starting truncate test\n")
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        long_password = "a" * 80
        
        try:
            # Simulate truncation logic
            password_bytes = long_password.encode('utf-8')
            if len(password_bytes) > 72:
                truncated_pw = password_bytes[:72]
            else:
                truncated_pw = long_password
                
            f.write(f"Truncated type: {type(truncated_pw)}\n")
            f.write(f"Truncated length: {len(truncated_pw)}\n")

            hash_ = pwd_context.hash(truncated_pw)
            f.write(f"Hash created successfully with truncated input: {hash_}\n")
            
            try:
                # Verify with truncated input
                verify = pwd_context.verify(truncated_pw, hash_)
                f.write(f"Verification result with truncated input: {verify}\n")
                
                # Verify with original input (simulating the fix inside verify_password)
                # This tests if my proposed fix inside verify_password works
                # verify_password logic:
                try:
                    p_bytes = long_password.encode('utf-8')
                    if len(p_bytes) > 72:
                        p_truncated = p_bytes[:72]
                    else:
                        p_truncated = long_password
                        
                    verify_fix = pwd_context.verify(p_truncated, hash_)
                    f.write(f"Verification result with fix logic: {verify_fix}\n")
                except Exception as e:
                    f.write(f"Fix logic verification failed: {e}\n")

            except Exception as e:
                f.write(f"Verification failed with error: {e}\n")
                
        except Exception as e:
            f.write(f"Hashing failed with error: {e}\n")
            
except Exception as e:
    print(f"File writing failed: {e}")

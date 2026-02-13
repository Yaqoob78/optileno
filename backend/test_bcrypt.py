import bcrypt

try:
    with open("result_bcrypt.txt", "w") as f:
        f.write("Starting bcrypt direct test\n")
        
        long_password = b"a" * 80
        truncated_pw = long_password[:50]
        f.write(f"Password length: {len(truncated_pw)}\n")
        
        try:
            salt = bcrypt.gensalt()
            f.write(f"Salt: {salt}\n")
            
            hashed = bcrypt.hashpw(truncated_pw, salt)
            f.write(f"Hash: {hashed}\n")
            
        except Exception as e:
            f.write(f"Bcrypt error: {e}\n")
            
except Exception as e:
    print(f"File writing failed: {e}")

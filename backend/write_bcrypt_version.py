import bcrypt
try:
    with open("bcrypt_version.txt", "w", encoding="utf-8") as f:
        f.write(str(bcrypt.__version__))
except Exception as e:
    print(f"Failed: {e}")

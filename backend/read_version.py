try:
    with open("backend_bcrypt_version.txt", "r", encoding="utf-16le") as f:
        print(f.read())
except Exception as e:
    try:
        with open("backend_bcrypt_version.txt", "r", encoding="utf-8") as f:
            print(f.read())
    except Exception as e2:
        print(f"Failed to read: {e}, {e2}")

import bcrypt
try:
    print(bcrypt.__version__)
except AttributeError:
    try:
        print(bcrypt._bcrypt.__version__)
    except Exception as e:
        print(f"Failed to get version: {e}")

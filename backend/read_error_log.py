try:
    with open('error_log.txt', 'rb') as f:
        content = f.read()
        try:
            print(content.decode('utf-16le'))
        except:
            print(content.decode('utf-8'))
except Exception as e:
    print(e)

import zipfile
from pathlib import Path
path = Path('optileno-eb.zip')
with zipfile.ZipFile(path, 'r') as z:
    names = z.namelist()
print('count', len(names))
print('tops', sorted({n.split('/')[0] for n in names if n})[:30])
print('\n'.join(names[:40]))

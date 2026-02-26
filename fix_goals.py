with open('backend/api/v1/endpoints/goals.py', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('# is_tracked: bool = False  # Commented out for database compatibility', 'is_tracked: bool = False')
text = text.replace('# probability_status: str = "Medium"  # Commented out for database compatibility', 'probability_status: str = "Medium"')

with open('backend/api/v1/endpoints/goals.py', 'w', encoding='utf-8') as f:
    f.write(text)

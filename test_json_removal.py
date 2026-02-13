
import sys

def remove_json_structures(text):
    output = []
    i = 0
    n = len(text)
    
    while i < n:
        char = text[i]
        
        if char in ('{', '['):
            stack = [char]
            j = i + 1
            is_in_string = False
            string_char = None
            
            while j < n and stack:
                c = text[j]
                if c in ('"', "'") and (j == 0 or text[j-1] != '\\'):
                    if not is_in_string:
                        is_in_string = True
                        string_char = c
                    elif c == string_char:
                        is_in_string = False
                        string_char = None
                
                if not is_in_string:
                    if c == '{' or c == '[':
                        stack.append(c)
                    elif c == '}' or c == ']':
                        if not stack: break
                        last = stack[-1]
                        if (c == '}' and last == '{') or (c == ']' and last == '['):
                            stack.pop()
                        else:
                            break
                j += 1
            
            if not stack:
                block = text[i:j]
                # Heuristic
                if '"' in block and ':' in block:
                     # It has quotes and colons, likely JSON.
                     i = j
                     continue
        
        output.append(char)
        i += 1
    
    return "".join(output)

test_inputs = [
    """Here is a task.
    {
        "intent": "CREATE_TASK",
        "actions": []
    }
    Done.""",
    
    """Mixed text { "key": "value" } end.""",
    
    """No JSON here.""",
    
    """Malformed { "key": "val" but missing brace""",
    
    """Nested { "a": { "b": 1 } } works?"""
]

with open("json_removal_output.txt", "w") as f:
    for t in test_inputs:
        f.write(f"--- Input ---\n{t}\n")
        f.write(f"--- Output ---\n{remove_json_structures(t)}\n\n")

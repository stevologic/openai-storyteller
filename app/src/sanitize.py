import re
import html

def sanitize_input(input_str: str) -> str:
    """
    Sanitize input string to prevent injection attacks.
    """
    # Remove leading and trailing white space
    input_str = input_str.strip()
  
    # Remove any characters that are not alphanumeric or spaces
    input_str = re.sub(r'[^\w\s]', '', input_str)
  
    # Replace multiple spaces with a single space
    input_str = re.sub(r'\s+', ' ', input_str)
  
    # Escape any special characters to prevent injection attacks
    input_str = html.escape(input_str)
  
    return input_str


if __name__ == '__main__':
    print(sanitize_input("!@#d<><>''';   asdfasd"))

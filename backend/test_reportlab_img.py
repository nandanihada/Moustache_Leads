import os
from io import BytesIO
from reportlab.platypus import Image

signature_path = os.path.join(os.getcwd(), 'uploads', 'signature.jpeg')
print(f"Path: {signature_path}")
print(f"Exists: {os.path.exists(signature_path)}")

try:
    img = Image(signature_path)
    print("Successfully loaded image in reportlab")
except Exception as e:
    print(f"Error: {e}")

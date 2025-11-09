from google import genai
import os
from dotenv import load_dotenv


# Load the .env file (adjust path if your .env is elsewhere)
env_path = '../.env'
load_dotenv(dotenv_path=env_path)




# api key
api_key = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL")
print(api_key)

client = genai.Client(api_key=api_key)
content = ""
prompt = "you are a Retrieval Augmented Generation Model. Answer the question based on the context below. " \
         "The content may also contain irrelevant content, so make sure just to use the relevant answer and dont make " \
         "up any things\n" \
         f"Context: {content}\n" \

print(prompt)
response = client.models.generate_content(
    model=GEMINI_MODEL,
    contents=prompt,
)

print(response.text)
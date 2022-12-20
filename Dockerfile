FROM python:3.8-slim

LABEL name ="openai-storyteller" \
      version="1.0"

# Set the working directory
WORKDIR /openai-storyteller

# Copy the requirements file
COPY requirements.txt .

# Install the required packages
RUN pip install -r requirements.txt

# Copy the source code
COPY app .

# Set the entry point
ENTRYPOINT ["python", "app_runner.py"]

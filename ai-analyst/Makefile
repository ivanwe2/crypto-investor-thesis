APP_NAME = ai-analyst
MAIN_FILE = main.py
VENV = venv
PYTHON = $(VENV)/bin/python
PIP = $(VENV)/bin/pip

.PHONY: all venv install run freeze clean docker

# Default target
all: venv install

# Creates a Python virtual environment if it doesn't exist
venv:
	python3 -m venv $(VENV)

# Installs dependencies from requirements.txt into the virtual environment
install:
	$(PIP) install -r requirements.txt

# Runs the AI Analyst service using the virtual environment python
run:
	$(PYTHON) $(MAIN_FILE)

# Freezes current packages into requirements.txt
freeze:
	$(PIP) freeze > requirements.txt

# Removes the virtual environment and cached bytecode
clean:
	rm -rf $(VENV)
	rm -rf __pycache__
	rm -rf .pytest_cache

# Builds the Docker container for the Python service
docker:
	docker build -t $(APP_NAME):latest .
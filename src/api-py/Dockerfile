FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DB_FILE=/app/data/app.db

WORKDIR /app/api-py

COPY api-py/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY api-py/ ./
COPY database/ /app/database/

EXPOSE 3000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000"]

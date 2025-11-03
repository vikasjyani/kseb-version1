#!/bin/bash
# KSEB FastAPI Backend Startup Script
# =====================================

echo "🚀 Starting KSEB FastAPI Backend..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "⚠️  Virtual environment not found. Creating one..."
    python3 -m venv venv
    echo "✅ Virtual environment created."
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install/Update dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt --quiet

# Start the server
echo "✅ Starting FastAPI server on http://0.0.0.0:8000"
echo "📚 API Documentation: http://localhost:8000/docs"
echo ""
python main.py

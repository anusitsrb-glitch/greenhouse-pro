#!/bin/bash
# GreenHouse Pro - Deployment Script
# Usage: ./deploy.sh

set -e

echo "🚀 Starting GreenHouse Pro deployment..."

# Navigate to project root
cd "$(dirname "$0")/../.."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found! Please create one from .env.example"
    exit 1
fi

# Load environment variables
source .env

# Build frontend
echo "📦 Building frontend..."
cd client
npm ci
npm run build
cd ..

# Build backend
echo "📦 Building backend..."
cd server
npm ci
npm run build
cd ..

# Run database migrations
echo "🔄 Running database migrations..."
cd server
npm run db:migrate
npm run db:seed
cd ..

# Start Docker containers
echo "🐳 Starting Docker containers..."
cd infra
docker compose down --remove-orphans
docker compose build
docker compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check health
echo "🔍 Checking service health..."
if curl -s http://localhost:80/api/health | grep -q "ok"; then
    echo "✅ Deployment successful!"
    echo ""
    echo "🌐 Application is now running at:"
    echo "   http://localhost (or your domain)"
    echo ""
    echo "📊 Container status:"
    docker compose ps
else
    echo "❌ Health check failed. Check logs:"
    docker compose logs --tail=50
    exit 1
fi

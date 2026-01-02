#!/bin/bash

# Travel Expense Pro - Deployment Script
# Supports: Produciton (IIS behind) and Development

ECHO_PREFIX="[TEP-DEPLOY]"

echo "$ECHO_PREFIX Starting Deployment Script..."

# 1. Select Mode
echo "Select Deployment Mode:"
echo "1) Production (IIS -> Nginx:8090)"
echo "2) Development (Localhost only)"
read -p "Enter choice [1/2]: " mode

if [ "$mode" == "1" ]; then
    ENV="prod"
    COMPOSE_FILE="docker-compose.prod.yml"
    echo "$ECHO_PREFIX Selected: PRODUCTION Mode"
else
    ENV="dev"
    COMPOSE_FILE="docker-compose.yml"
    echo "$ECHO_PREFIX Selected: DEVELOPMENT Mode"
fi

# 2. Database Backup
read -p "Do you want to backup the database first? (y/n): " backup_choice
if [ "$backup_choice" == "y" ]; then
    echo "$ECHO_PREFIX Running database backup..."
    ./backup-db.sh
else
    echo "$ECHO_PREFIX Skipping backup."
fi

# 3. Pull & Build
echo "$ECHO_PREFIX Building containers..."
docker-compose -f $COMPOSE_FILE build

# 4. Deploy
echo "$ECHO_PREFIX Stopping existing containers..."
docker-compose -f $COMPOSE_FILE down

echo "$ECHO_PREFIX Starting new containers..."
docker-compose -f $COMPOSE_FILE up -d

# 5. Status
echo "$ECHO_PREFIX Checking status..."
sleep 5
docker-compose -f $COMPOSE_FILE ps

echo "=================================================="
echo "Deployment Complete!"
if [ "$ENV" == "prod" ]; then
    echo "Access Application at: http://localhost:8090"
    echo "Ensure IIS forwards 'travel.orangebiznext.com' to 'localhost:8090'"
else
    echo "Access Application at: http://localhost:8000 (Backend) / 5173 (Frontend) / 80 (Nginx)"
fi
echo "=================================================="

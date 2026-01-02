#!/bin/bash

# Travel Expense Pro - Deployment Script
# Supports: Produciton (IIS behind) and Development

ECHO_PREFIX="[TEP-DEPLOY]"

# --- Setup Logging ---
mkdir -p logs
LOG_FILE="logs/deploy_$(date +%Y%m%d_%H%M%S).log"
echo "$ECHO_PREFIX Logging to: $LOG_FILE"

# Redirect stdout and stderr to both console and log file
# We use a subshell or specific redirection to ensure 'read' commands still work from terminal
# Simple 'tee' pipe hides input prompts, so we just log specific info or use process substitution carefully.
# For simplicity in Git Bash (Windows), we will just append important info to log manually or use exec redirection.
exec > >(tee -a "$LOG_FILE") 2>&1

echo "$ECHO_PREFIX Starting Deployment Script..."

# 1. Select Mode
echo "Select Deployment Mode:"
echo "1) Production (IIS -> Nginx:8090)"
echo "2) Development (Localhost only)"
# 'read' reads from TTY directly if stdin is redirected, but in some shells it might be tricky.
# We trust standard Git Bash behavior here.
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
# Use /dev/tty to force read from keyboard even if stdin is redirected
if [ -t 0 ]; then
    read -p "Do you want to backup the database first? (y/n): " backup_choice
else
    # Fallback if tty not available (shouldn't happen in interactive git bash)
    backup_choice="n"
fi

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

# 5. Post-Deployment Steps
echo "$ECHO_PREFIX Waiting for services to stabilize..."
sleep 10

if [ "$ENV" == "prod" ]; then
    echo "$ECHO_PREFIX Running Migrations..."
    docker-compose -f $COMPOSE_FILE exec -T backend python manage.py migrate --noinput
    
    echo "$ECHO_PREFIX Collecting Static Files..."
    docker-compose -f $COMPOSE_FILE exec -T backend python manage.py collectstatic --noinput
    
    echo "$ECHO_PREFIX Cleaning up unused images..."
    docker system prune -f --volumes=false
fi

# 6. Status
echo "$ECHO_PREFIX Checking status..."
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
echo "Log saved to: $LOG_FILE"
echo "=================================================="

# Pause to keep window open
read -p "Press Enter to exit..."

#!/bin/bash
set -e # Exit immediately if any command fails

echo "🚀 Starting Master Production Deployment..."

# 1. Frontend Build
echo "📦 Building Frontend (Vite)..."
cd frontend
npm install --quiet
npm run build
cd ..

# 2. Docker Orchestration
echo "🐳 Building and Starting Docker Containers..."
# We use --build to ensure code changes are picked up
docker compose -f docker-compose.prod.yml up --build -d

# 3. Wait for Database Readiness
echo "⏳ Waiting for MySQL to be healthy..."
# We use a loop to check the health status defined in docker-compose
until [ "$(docker inspect -f {{.State.Health.Status}} prod_mysql)" == "healthy" ]; do
    printf '.'
    sleep 2
done
echo -e "\n✅ Database is ready!"

# 4. Backend Synchronization
echo "⚙️ Running Migrations and Static Collection..."
docker compose -f docker-compose.prod.yml exec -T backend python manage.py migrate --noinput
docker compose -f docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput

# 5. Optional: Populate Master Data
# If you have a command to populate data, uncomment the line below:
# echo "💾 Populating master data..."
# docker compose -f docker-compose.prod.yml exec -T backend python manage.py populate_master_data

# 6. Backup Verification
echo "🛡️ Triggering initial safety backup..."
docker exec prod_db_backup /bin/bash /usr/local/bin/backup.sh

# 7. Housekeeping
echo "🧹 Cleaning up dangling images..."
docker system prune -f --volumes=false

echo "--------------------------------------------------"
echo "✅ DEPLOYMENT SUCCESSFUL!"
echo "🌐 Frontend: http://travel.orangebiznext.com:5173"
echo "🌐 Admin:    http://travel.orangebiznext.com:5173/admin/"
echo "--------------------------------------------------"

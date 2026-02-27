import os
from celery import Celery
from django.conf import settings
from kombu import Queue

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Main.settings')

# Create Celery app
app = Celery('Main')

# Load config from Django settings with CELERY namespace
app.config_from_object('django.conf:settings', namespace='CELERY')

app.conf.task_queues = (
    Queue("celery"),
    Queue("notifications"),
)
app.conf.task_default_queue = "celery"

# Auto-discover tasks from all registered Django apps
app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)

# Optional: Configure task routes
app.conf.task_routes = {
    'apps.notifications.tasks.send_notification_task': {'queue': 'notifications'},
    'apps.notifications.tasks.notification_reminder_worker': {'queue': 'notifications'},
    'apps.notifications.tasks.mark_travel_as_completed': {'queue': 'notifications'},
}

@app.task(bind=True)
def debug_task(self):
    """Debug task to test Celery setup"""
    print(f'Request: {self.request!r}')
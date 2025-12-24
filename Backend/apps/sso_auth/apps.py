from django.apps import AppConfig


class SsoAuthConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.sso_auth'
    verbose_name = 'SSO Authentication'

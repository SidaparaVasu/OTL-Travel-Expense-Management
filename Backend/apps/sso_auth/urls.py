from django.urls import path
from .views import SSOLoginView

app_name = 'sso_auth'

urlpatterns = [
    path('login/', SSOLoginView.as_view(), name='sso_login'),
]

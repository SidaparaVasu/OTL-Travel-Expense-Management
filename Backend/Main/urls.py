from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from utils.document_viewer import view_document_by_path

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # JWT token refresh
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # SSO Authentication
    path('api/sso/', include('apps.sso_auth.urls')),
    
    # App URLs
    path('api/', include('apps.authentication.urls')),
    path('api/master/', include('apps.master_data.urls')),
    path('api/travel/', include('apps.travel.urls')),
    path('api/expense/', include('apps.expenses.urls')),

    path("api/file/", view_document_by_path, name="view-file"),
    
    # Legacy API support (gradually migrate these)
    # path('api/legacy/', include('apps.api.urls')),
    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
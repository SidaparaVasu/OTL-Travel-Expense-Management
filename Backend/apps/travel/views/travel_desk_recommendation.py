from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from apps.authentication.permissions import IsTravelDesk
from apps.travel.models import TravelApplication
from apps.travel.services.booking_agent_recommendation import get_recommended_booking_agents
from utils.response_formatter import success_response, error_response


class TravelDeskRecommendedAgentsView(APIView):
    permission_classes = [IsAuthenticated, IsTravelDesk]

    def get(self, request, application_id):
        try:
            application = TravelApplication.objects.get(id=application_id)
        except TravelApplication.DoesNotExist:
            return error_response(message="Travel application not found")

        data = get_recommended_booking_agents(application)

        return success_response(
            message="Recommended booking agents fetched successfully",
            data=data
        )

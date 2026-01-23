from rest_framework import serializers
from apps.travel.models.traveler import GuestProfile

class GuestProfileSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    company_name = serializers.CharField(source='company.name', read_only=True)

    class Meta:
        model = GuestProfile
        fields = [
            'id', 'created_by', 'created_by_name', 'company', 'company_name',
            'first_name', 'last_name', 'email', 
            'gender', 'age', 'contact_number', 'date_of_birth',
            'nationality_type', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'company', 'created_at', 'updated_at']

    def create(self, validated_data):
        # Auto-set created_by and company from context
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user
            
            # Assuming organizational user has a company
            profile = request.user.get_profile()
            if profile and hasattr(profile, 'company'):
                validated_data['company'] = profile.company
            else:
                # Fallback or error if no company (should not happen for org users)
                raise serializers.ValidationError({"company": "User does not belong to a company"})
        
        return super().create(validated_data)

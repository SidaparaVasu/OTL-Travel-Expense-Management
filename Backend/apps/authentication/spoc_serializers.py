from rest_framework import serializers
from .models.spoc import LocationSPOCAssignment
from .models.roles import Role, UserRole
from apps.master_data.models.geography import LocationMaster
from apps.authentication.models import User

class SimpleUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'employee_id', 'full_name']
        
    def get_full_name(self, obj):
        return obj.get_full_name()

class SimpleRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name']

class SimpleLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocationMaster
        fields = ['location_id', 'location_name', 'location_code']

class LocationSPOCAssignmentSerializer(serializers.ModelSerializer):
    # Nested Read-Only Serializers for Display
    user = SimpleUserSerializer(read_only=True)
    role = SimpleRoleSerializer(read_only=True)
    locations = SimpleLocationSerializer(many=True, read_only=True)
    
    # helper fields for backward compatibility if needed, but nesting is better
    user_name = serializers.CharField(source='user.username', read_only=True)
    role_name = serializers.CharField(source='role.name', read_only=True)
    location_names = serializers.SerializerMethodField()
    
    # Write fields
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='user', write_only=True
    )
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), source='role', write_only=True
    )
    location_ids = serializers.PrimaryKeyRelatedField(
        queryset=LocationMaster.objects.all(), many=True, write_only=True, required=False
    )

    class Meta:
        model = LocationSPOCAssignment
        fields = [
            'id', 'user', 'user_id', 'user_name', 
            'role', 'role_id', 'role_name', 
            'locations', 'location_names', 'location_ids',
            'is_active', 'assigned_by', 'created_at', 'updated_at',
            'is_global'
        ]
        read_only_fields = ['assigned_by', 'created_at', 'updated_at']

    def get_location_names(self, obj):
        return [loc.location_name for loc in obj.locations.all()]

    def create(self, validated_data):
        locations = validated_data.pop('location_ids', [])
        
        # Check uniqueness manually if needed, or rely on db constraint
        # create() will handle unique_together automatically but might need cleaner error
        
        assignment = LocationSPOCAssignment.objects.create(**validated_data)
        
        if locations:
            assignment.locations.set(locations)
            
        return assignment

    def update(self, instance, validated_data):
        locations = validated_data.pop('location_ids', None)
        
        instance = super().update(instance, validated_data)
        
        if locations is not None:
            instance.locations.set(locations)
            
        return instance

    def validate(self, data):
        # 1. Resolve User and Role
        user = data.get('user')
        role = data.get('role')
        
        # For updates, fall back to instance
        if not user and self.instance:
            user = self.instance.user
            
        if not role and self.instance:
            role = self.instance.role
            
        # 2. Check if User has this Role assigned (UserRole)
        if user and role:
            if not UserRole.objects.filter(user=user, role=role, is_active=True).exists():
                raise serializers.ValidationError({
                    "role": f"User does not have the role '{role.name}' assigned."
                })

        # 3. Check Uniqueness (User + Role)
        # Exclude current instance in case of update
        if user and role:
            qs = LocationSPOCAssignment.objects.filter(user=user, role=role)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            
            if qs.exists():
                raise serializers.ValidationError({
                    "detail": "This user is already assigned as SPOC for this role. Update existing assignment instead."
                })

        # 4. Global vs Location Logic
        # For is_global, need to handle default False if not provided in data
        # But if it's an update, we should check instance.is_global if not in data?
        # Standard: data.get -> if None -> instance.is_global -> else False
        
        is_global = data.get('is_global')
        if is_global is None and self.instance:
            is_global = self.instance.is_global
        if is_global is None:
            is_global = False
            
        # Locations handling      
        location_ids = data.get('location_ids', [])
        
        # Note: On Update, if location_ids is NOT provided, it might mean "no change" 
        # OR it might mean "clear locations" if empty list passed?
        # DRF behavior: Not provided = No change. Empty list = Clear.
        
        if is_global:
            if location_ids:
                raise serializers.ValidationError({
                    "locations": "Global SPOC cannot have specific locations assigned."
                })
        else:
            # Not global -> Must have locations
            # Check if creating or updating with explicit empty list
            if 'location_ids' in data and not location_ids:
                 raise serializers.ValidationError({
                    "locations": "Non-Global SPOC must have at least one location."
                })
            # If updating and 'location_ids' not in data, we assume previous locations exist?
            # Ideally we should enforce strict rule: 
            # If converting from Global -> Non-Global, MUST provide locations.
            
            if self.instance and self.instance.is_global and not is_global and 'location_ids' not in data:
                 raise serializers.ValidationError({
                    "locations": "Must provide locations when converting from Global to Non-Global."
                })

        return data
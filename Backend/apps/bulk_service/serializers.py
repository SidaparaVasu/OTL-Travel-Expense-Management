from rest_framework import serializers

class BulkImportRowStatusSerializer(serializers.Serializer):
    """
    Serializer for individual row results.
    """
    row_number = serializers.IntegerField()
    status = serializers.ChoiceField(choices=['success', 'failed', 'skipped'])
    action = serializers.ChoiceField(choices=['create', 'update', 'none'])
    errors = serializers.ListField(child=serializers.CharField(), default=[])
    warnings = serializers.ListField(child=serializers.CharField(), default=[])
    cleaned_payload = serializers.DictField(required=False, allow_null=True)

class BulkImportSummarySerializer(serializers.Serializer):
    """
    Serializer for the overall import summary.
    """
    total_rows = serializers.IntegerField()
    valid_rows = serializers.IntegerField()
    invalid_rows = serializers.IntegerField()
    created_count = serializers.IntegerField()
    updated_count = serializers.IntegerField()
    skipped_count = serializers.IntegerField()
    dry_run = serializers.BooleanField()
    execution_time = serializers.FloatField(help_text="Time in seconds")

class BulkImportResultSerializer(serializers.Serializer):
    """
    Main response serializer for bulk import operations.
    """
    summary = BulkImportSummarySerializer()
    rows = serializers.ListField(child=BulkImportRowStatusSerializer())
    error = serializers.CharField(required=False, allow_null=True)

class DynamicModelSerializer(serializers.ModelSerializer):
    """
    Factory for creating dynamic model serializers on the fly.
    """
    class Meta:
        model = None 
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

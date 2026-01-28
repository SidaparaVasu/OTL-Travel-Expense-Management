from django.core.management.base import BaseCommand
from apps.master_data.models.travel import MealPreferenceMaster

class Command(BaseCommand):
    help = "Seed meal preference master data"

    def handle(self, *args, **options):
        # Format: (code, name, allowed_modes)
        # 0 = Ticketing (Flight/Train)
        # 1 = Accommodation (Hotel)
        
        preferences = [
            # Common options
            ("VEG", "Vegetarian", [0, 1]),
            ("NON_VEG", "Non-Vegetarian", [0, 1]),
            ("JAIN", "Jain", [0, 1]),
            ("VEGAN", "Vegan", [0, 1]),
            
            # Flight Specific
            ("GF", "Gluten Free", [0]),
            ("LF", "Lactose Free", [0]),
            ("DB", "Diabetic", [0]),
            ("KS", "Kosher", [0]),
            ("HL", "Halal", [0]),
            
            # Hotel Specific
            ("NO_FOOD", "No Food", [1]),
            ("ANY", "Any", [1]),
        ]

        count = 0
        for code, name, modes in preferences:
            obj, created = MealPreferenceMaster.objects.update_or_create(
                code=code,
                defaults={
                    "name": name,
                    "allowed_modes": modes,
                    "is_active": True
                }
            )
            if created:
                count += 1
        
        self.stdout.write(self.style.SUCCESS(f"Seeded {count} meal preferences"))

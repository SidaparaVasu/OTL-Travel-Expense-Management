
import logging
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.expenses.models import ExpenseClaim, DAIncidentalBreakdown
from apps.expenses.business_logic.claims import calculate_da_breakdown, _to_decimal

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Recover missing DA incidental breakdown segments for expense claims'

    def add_arguments(self, parser):
        parser.add_argument('--claim-id', type=int, help='Specific claim ID to recover')
        parser.add_argument('--all', action='store_true', help='Check and recover for all claims missing breakdown')
        parser.add_argument('--force', action='store_true', help='Force recalculation even if breakdown exists')
        parser.add_argument('--dry-run', action='store_true', help='Show what would be done without saving')

    def handle(self, *args, **options):
        claim_id = options.get('claim_id')
        all_claims = options.get('all')
        force = options.get('force')
        dry_run = options.get('dry_run')

        if not claim_id and not all_claims:
            self.stderr.write("Please provide --claim-id or --all")
            return

        if claim_id:
            claims = ExpenseClaim.objects.filter(id=claim_id)
        else:
            claims = ExpenseClaim.objects.all()

        count = 0
        recovered = 0
        errors = 0

        for claim in claims:
            count += 1
            has_breakdown = DAIncidentalBreakdown.objects.filter(claim=claim).exists()
            
            if has_breakdown and not force:
                self.stdout.write(f"Claim #{claim.id} already has breakdown entries. Skipping. Use --force to override.")
                continue

            self.stdout.write(f"Processing Claim #{claim.id} (TR: {claim.travel_application_id})...")

            try:
                breakdown = calculate_da_breakdown(
                    claim.travel_application,
                    actual_start_date=claim.actual_travel_start_date,
                    actual_start_time=claim.actual_travel_start_time,
                    actual_end_date=claim.actual_travel_end_date,
                    actual_end_time=claim.actual_travel_end_time,
                    one_way_distance_km=claim.one_way_distance_km
                )

                if not breakdown:
                    self.stderr.write(f"  Warning: No breakdown segments calculated for claim #{claim.id}. Check travel dates.")
                    continue

                total_da = sum([row["da"] for row in breakdown])
                total_incidental = sum([row["incidental"] for row in breakdown])

                self.stdout.write(f"  Calculated segments: {len(breakdown)}")
                self.stdout.write(f"  Total DA: {total_da} (Stored: {claim.total_da})")
                self.stdout.write(f"  Total Inc: {total_incidental} (Stored: {claim.total_incidental})")

                if not dry_run:
                    with transaction.atomic():
                        if has_breakdown:
                            DAIncidentalBreakdown.objects.filter(claim=claim).delete()
                        
                        for day in breakdown:
                            DAIncidentalBreakdown.objects.create(
                                claim=claim,
                                date=day["date"],
                                eligible_da=day["da"],
                                eligible_incidental=day["incidental"],
                                hours=day["duration_hours"],
                            )
                        
                        # Optionally update the claim totals if they don't match?
                        # The user mentioned "clean option" by recalculating.
                        # We'll update the totals on the claim to ensure consistency.
                        claim.total_da = _to_decimal(total_da)
                        claim.total_incidental = _to_decimal(total_incidental)
                        
                        # Recalculate final amount
                        gross = claim.total_da + claim.total_incidental + claim.total_expenses
                        claim.final_amount_payable = gross - claim.advance_received
                        claim.save()
                        
                        recovered += 1
                        self.stdout.write(self.style.SUCCESS(f"  Successfully recovered breakdown for claim #{claim.id}"))
                else:
                    self.stdout.write(f"  Dry-run: Would create {len(breakdown)} segments.")

            except Exception as e:
                self.stderr.write(self.style.ERROR(f"  Error processing claim #{claim.id}: {str(e)}"))
                errors += 1

        self.stdout.write(f"\nSummary:")
        self.stdout.write(f"  Claims checked: {count}")
        self.stdout.write(f"  Claims recovered: {recovered}")
        self.stdout.write(f"  Errors: {errors}")

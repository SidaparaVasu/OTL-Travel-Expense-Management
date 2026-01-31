from django.db import models
from django.conf import settings
from apps.travel.models.application import TravelApplication

"""
STATUS MASTER
"""
class ExpenseTypeMaster(models.Model):
    '''
    Docstring for ExpenseTypeMaster

    example status choices:
        EXPENSE_TYPES = [
        ('taxi', 'Taxi'),
        ('auto', 'Auto / Local Travel'),
        ('bus', 'Bus'),
        ('train', 'Train'),
        ('flight', 'Flight'),
        ('hotel', 'Hotel'),
        ('personal_car', 'Personal Car'),
        ('meal', 'Meals'),
        ('fuel', 'Fuel'),
        ('toll', 'Toll'),
        ('parking', 'Parking'),
        ('misc', 'Miscellaneous'),
    ]
    '''
    code = models.CharField(max_length=50, unique=True)   # e.g., taxi, hotel, meal
    name = models.CharField(max_length=100)               # e.g., Taxi, Hotel, Meals
    requires_receipt = models.BooleanField(default=True)
    is_distance_based = models.BooleanField(default=False)  # auto/own_car
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class ClaimStatusMaster(models.Model):
    '''
    Docstring for ClaimStatusMaster

    example status choices:
        CLAIM_STATUS = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('manager_pending', 'Manager Pending'),
        ('finance_pending', 'Finance Pending'),
        ('chro_pending', 'CHRO Pending'),
        ('revision_required', 'Revision Required'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('paid', 'Paid'),
        ('closed', 'Closed'),
    ]
    '''
    code = models.CharField(max_length=50, unique=True)     # e.g., draft, submitted, approved
    label = models.CharField(max_length=100)                # e.g., Draft, Submitted, Approved
    sequence = models.PositiveIntegerField(default=1)       # for ordering
    is_terminal = models.BooleanField(default=False)        # approved/rejected/closed

    def __str__(self):
        return self.label
""" """

class ExpenseClaim(models.Model):
    """
    Main expense claim object for a completed TravelApplication.
    One TravelApplication -> One ExpenseClaim
    """

    travel_application = models.OneToOneField(
        TravelApplication,
        on_delete=models.CASCADE,
        related_name='expense_claim'
    )

    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='expense_claims'
    )

    submitted_on = models.DateTimeField(null=True, blank=True)
    status = models.ForeignKey(
        ClaimStatusMaster,
        on_delete=models.PROTECT,
        related_name="claims",
        null=True,
        blank=True
    )

    # Auto calculated totals
    total_da = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_incidental = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_expenses = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Advance received from travel module
    advance_received = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Net final calculation
    final_amount_payable = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text="Positive = Payable to employee; Negative = Recoverable from employee"
    )

    is_late_submission = models.BooleanField(default=False)
    late_submission_reason = models.TextField(blank=True)

    # Exception flags handled by backend
    exceptions = models.JSONField(default=dict, blank=True)

    # Finance action timestamps
    paid_on = models.DateTimeField(null=True, blank=True)
    closed_on = models.DateTimeField(null=True, blank=True)

    created_on = models.DateTimeField(auto_now_add=True)
    updated_on = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"ExpenseClaim #{self.id} for TR: {self.travel_application_id}"


class DAIncidentalBreakdown(models.Model):
    claim = models.ForeignKey(
        ExpenseClaim,
        on_delete=models.CASCADE,
        related_name='da_breakdown'
    )

    date = models.DateField()

    eligible_da = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    eligible_incidental = models.DecimalField(max_digits=7, decimal_places=2, default=0)

    hours = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        help_text="Hours worked/travelled used for DA calculation"
    )

    remarks = models.TextField(blank=True)

    def __str__(self):
        return f"{self.date} - DA: {self.eligible_da}, IC: {self.eligible_incidental}"


class ExpenseItem(models.Model):
    """
    Individual expense item rows within an ExpenseClaim.
    """

    claim = models.ForeignKey(
        ExpenseClaim,
        on_delete=models.CASCADE,
        related_name='items'
    )

    expense_type = models.ForeignKey(
        ExpenseTypeMaster,
        on_delete=models.PROTECT,
        related_name="expense_items"
    )
    expense_date = models.DateField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)

    # For receipt uploads
    receipt_file = models.FileField(upload_to="claims/receipts/", null=True, blank=True)
    has_receipt = models.BooleanField(default=True)

    # Self certification fields
    is_self_certified = models.BooleanField(default=False)
    self_certified_reason = models.TextField(blank=True)

    # Additional fields depending on type
    distance_km = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    vendor_name = models.CharField(max_length=255, blank=True)
    bill_number = models.CharField(max_length=100, blank=True)

    city_category = models.CharField(max_length=10, blank=True)

    remarks = models.TextField(blank=True)

    # Link to original booking (if applicable)
    booking_id = models.IntegerField(null=True, blank=True)

    # Flag to distinguish booking expenses from additional expenses
    is_booking_expense = models.BooleanField(default=False)

    created_on = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.expense_type} - {self.amount}"


class ClaimDocument(models.Model):
    claim = models.ForeignKey(
        ExpenseClaim,
        on_delete=models.CASCADE,
        related_name='documents'
    )

    doc_type = models.CharField(max_length=50)   # e.g., "summary_pdf", "combined_receipts"
    file = models.FileField(upload_to='claims/docs/')
    uploaded_on = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.doc_type} for Claim #{self.claim_id}"


class ClaimApprovalFlow(models.Model):
    claim = models.ForeignKey(
        ExpenseClaim,
        on_delete=models.CASCADE,
        related_name='approval_flow'
    )

    approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )

    level = models.PositiveIntegerField()  # 1=Manager, 2=Finance, 3=CHRO
    status = models.CharField(max_length=50, default='pending') 
    remarks = models.TextField(blank=True)
    acted_on = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Claim#{self.claim_id} - Level {self.level} - {self.status}"


class ClaimFinanceActionLog(models.Model):
    """
    Log of finance actions performed on claims (mark as paid, closed, etc.)
    """
    claim = models.ForeignKey(
        ExpenseClaim,
        on_delete=models.CASCADE,
        related_name='finance_action_logs'
    )
    
    action_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='finance_actions_performed'
    )
    
    action = models.CharField(max_length=50)  # mark_paid, mark_closed
    previous_status_code = models.CharField(max_length=50, blank=True)
    new_status_code = models.CharField(max_length=50)
    remarks = models.TextField(blank=True)
    action_date = models.DateTimeField()
    
    created_on = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-action_date']
    
    def __str__(self):
        return f"Claim#{self.claim_id} - {self.action} by {self.action_by.username}"


from django.urls import path
from apps.expenses.views import *

urlpatterns = [
    # --- Claim APIs ---
    
    # Claims validate
    path("claims/validate/", ClaimValidateView.as_view(), name="claim-validate"),
    
    # My Claims (list) + Create (submit)
    path("claims/", ClaimListCreateView.as_view(), name="expense-claim-list-create"),


    # Claim detail
    path("claims/<int:claim_id>/", ClaimDetailView.as_view(), name="claim-detail"),

    # Claim Approval (Approve / Reject)
    path("claims/<int:claim_id>/action/", ClaimActionView.as_view(), name="expense-claim-action"),

    # Finance Action (Mark as Paid / Closed)
    path("claims/<int:claim_id>/finance-action/", ClaimFinanceActionView.as_view(), name="expense-claim-finance-action"),

    # Pending Claim Approval
    path("claims/pending-approvals/",  ClaimPendingApprovalListView.as_view(), name="expense-claim-pending-approvals"),

    # Claimable Travel Application
     path("claimable-travel-applications/", ClaimableTravelApplicationsView.as_view()),

    # --- Receipts Upload ---
    path("claims/<int:claim_id>/upload-receipts/", 
         ClaimReceiptUploadView.as_view(), 
         name="claim-upload-receipts"),

    # Claim Reports (PDF)
    # path("reports/claims/pdf/", ClaimReportPDFView.as_view(), name="expense-claims-report-pdf"),

    # --- Master Data APIs ---
    path("expense-types/", ExpenseTypeListCreateView.as_view(), name="expense-types"),
    path("expense-types/<int:pk>/", ExpenseTypeDetailView.as_view(), name="expense-type-detail"),

    path("claim-status/", ClaimStatusListCreateView.as_view(), name="claim-status"),
    path("claim-status/<int:pk>/", ClaimStatusDetailView.as_view(), name="claim-status-detail"),

]
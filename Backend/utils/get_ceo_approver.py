def get_ceo_approver(application):
    return (
        application.approval_flows
        .filter(approval_level="ceo")
        .select_related("approver")
        .first()
    )
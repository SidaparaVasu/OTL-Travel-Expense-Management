def get_ceo_approver(application):
    flow = (
        application.active_approval_flows()
        .filter(approval_level="ceo", status="pending")
        .select_related("approver")
        .first()
    )
    if flow:
        return flow
    return (
        application.approval_flows.filter(
            approval_level="ceo",
            edit_count=application.edit_count,
        )
        .select_related("approver")
        .first()
    )

import os
import logging
import datetime
from django.utils import timezone
from apps.travel.models.hrms_leave import HRMSLeaveRecord
from apps.sso_auth.hrms_service import HRMSSyncService

logger = logging.getLogger('travel.hrms_leave')


class HRMSLeaveService:
    """
    Service for integrating TravelExpensePro with HRMS OD Leave APIs.
    """

    @classmethod
    def _is_mock_enabled(cls) -> bool:
        return os.getenv("HRMS_LEAVE_MOCK", "False").lower() in ("true", "1", "yes")

    @classmethod
    def _get_cmp_id(cls, user=None) -> int:
        env_cmp_id = os.getenv("HRMS_CMP_ID")
        if env_cmp_id:
            try:
                return int(env_cmp_id)
            except ValueError:
                pass
        if user:
            org_profile = getattr(user, 'organizational_profile', None)
            if org_profile and org_profile.company and org_profile.company.id:
                return org_profile.company.id
        return 1

    @classmethod
    def _get_od_leave_id(cls) -> int:
        return int(os.getenv("HRMS_OD_LEAVE_ID", 1))

    @classmethod
    def _extract_approval_id(cls, res_data) -> int | None:
        """
        Flexibly extract leaveApprovalId from various HRMS JSON response formats.
        """
        if isinstance(res_data, int):
            return res_data
        if isinstance(res_data, str) and res_data.isdigit():
            return int(res_data)

        if isinstance(res_data, dict):
            # Check direct keys
            for key in [
                'leaveApprovalId', 'LeaveApprovalId', 'leave_approval_id',
                'Leave_Approval_ID', 'approvalId', 'ApprovalId', 'id', 'Id'
            ]:
                if key in res_data and res_data[key] is not None:
                    try:
                        return int(res_data[key])
                    except (ValueError, TypeError):
                        pass

            # Check nested 'data' key
            nested = res_data.get('data')
            if nested is not None:
                return cls._extract_approval_id(nested)

        return None

    @classmethod
    def _resolve_ip(cls, request=None, client_ip: str = None) -> str:
        if client_ip:
            return client_ip
        if request:
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                return x_forwarded_for.split(',')[0].strip()
            return request.META.get('REMOTE_ADDR', '127.0.0.1')
        return "127.0.0.1"

    @classmethod
    def _format_datetime(cls, d: datetime.date, t: datetime.time = None) -> str:
        """Format as ISO 8601 string: YYYY-MM-DDTHH:MM:SS.000Z"""
        t = t or datetime.time(0, 0, 0)
        dt = datetime.datetime.combine(d, t)
        return dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")

    @classmethod
    def approve_od_leave(cls, travel_app, approver=None, client_ip: str = None, request=None) -> HRMSLeaveRecord | None:
        """
        Calls HRMS /api/v1/OdLeaveApprove to confirm OD leave for self-travel.
        """
        resolved_ip = cls._resolve_ip(request, client_ip)

        # 1. Eligibility Checks
        if travel_app.travel_for not in ['self', 'self_guest']:
            logger.info(f"[HRMS Leave] Skipping OD Leave for TR #{travel_app.id}: travel_for is '{travel_app.travel_for}'")
            return None

        employee = travel_app.employee
        if not employee or not employee.hrms_id:
            logger.warning(f"[HRMS Leave] Cannot approve leave for TR #{travel_app.id}: employee #{getattr(employee, 'id', None)} has no hrms_id")
            return None

        start_date = travel_app.get_travel_start_date()
        end_date = travel_app.get_travel_end_date()
        if not start_date or not end_date:
            logger.warning(f"[HRMS Leave] Cannot approve leave for TR #{travel_app.id}: missing travel dates")
            return None

        # Check if an active leave record already exists for this application
        existing_active = travel_app.hrms_leave_records.filter(status='ACTIVE').first()
        if existing_active:
            logger.info(f"[HRMS Leave] Active leave record #{existing_active.id} already exists for TR #{travel_app.id}")
            return existing_active

        first_trip = travel_app.trip_details.first()
        last_trip = travel_app.trip_details.last()
        start_time = first_trip.start_time if first_trip else None
        end_time = last_trip.end_time if last_trip else None

        from_date_iso = cls._format_datetime(start_date, start_time)
        to_date_iso = cls._format_datetime(end_date, end_time)
        leave_period = travel_app.get_travel_duration_days()

        is_backdated = 1 if start_date < timezone.now().date() else 0
        cmp_id = cls._get_cmp_id(employee)
        od_leave_id = cls._get_od_leave_id()
        approver_hrms_id = getattr(approver, 'hrms_id', None) or employee.hrms_id

        payload = {
            "cmpId": cmp_id,
            "empId": employee.hrms_id,
            "sEmpId": approver_hrms_id,
            "loginId": employee.hrms_id,
            "userId": employee.username,
            "approvalDate": timezone.now().strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "approvalStatus": "A",
            "isBackdatedApp": is_backdated,
            "leaveId": od_leave_id,
            "fromDate": from_date_iso,
            "toDate": to_date_iso,
            "leavePeriod": leave_period,
            "leaveAssignAs": os.getenv("HRMS_LEAVE_ASSIGN_AS", "Full"),
            "cancelWeekoffHoliday": 0,
            "halfLeaveDate": None,
            "ipAddress": resolved_ip,
        }

        # 2. Mock Mode Check
        if cls._is_mock_enabled():
            mock_id = int(timezone.now().timestamp())
            logger.info(f"[HRMS Leave MOCK] Generated mock leaveApprovalId={mock_id} for TR #{travel_app.id}")
            return HRMSLeaveRecord.objects.create(
                travel_application=travel_app,
                leave_approval_id=mock_id,
                from_date=start_date,
                to_date=end_date,
                leave_period=leave_period,
                status='ACTIVE',
                request_payload=payload,
                response_payload={"mock": True, "leaveApprovalId": mock_id, "message": "Simulated UAT response"},
            )

        # 3. Live API Call
        url = f"{HRMSSyncService.BASE_URL}/api/v1/OdLeaveApprove"
        try:
            logger.info(f"[HRMS Leave] Calling OdLeaveApprove for TR #{travel_app.id} | empId={employee.hrms_id}")
            response = HRMSSyncService._make_hrms_request("POST", url, json=payload, timeout=15)
            response.raise_for_status()

            res_json = response.json() if response.content else {}
            approval_id = cls._extract_approval_id(res_json)

            leave_record = HRMSLeaveRecord.objects.create(
                travel_application=travel_app,
                leave_approval_id=approval_id,
                from_date=start_date,
                to_date=end_date,
                leave_period=leave_period,
                status='ACTIVE' if approval_id else 'FAILED',
                request_payload=payload,
                response_payload=res_json,
                error_message="" if approval_id else "HRMS responded 200 OK but leaveApprovalId was missing in payload",
            )
            logger.info(f"[HRMS Leave] Leave record #{leave_record.id} created with leave_approval_id={approval_id}")
            return leave_record

        except Exception as exc:
            logger.error(f"[HRMS Leave] OdLeaveApprove API failed for TR #{travel_app.id}: {exc}", exc_info=True)
            return HRMSLeaveRecord.objects.create(
                travel_application=travel_app,
                leave_approval_id=None,
                from_date=start_date,
                to_date=end_date,
                leave_period=leave_period,
                status='FAILED',
                request_payload=payload,
                error_message=str(exc),
            )

    @classmethod
    def delete_approved_leave(cls, travel_app, user=None, client_ip: str = None, request=None) -> bool:
        """
        Calls HRMS /api/v1/DeleteApprovedLeave to delete the active leave record for a travel application.
        """
        resolved_ip = cls._resolve_ip(request, client_ip)
        active_records = travel_app.hrms_leave_records.filter(status='ACTIVE')
        if not active_records.exists():
            logger.info(f"[HRMS Leave] No active leave records to delete for TR #{travel_app.id}")
            return False

        employee = travel_app.employee
        user = user or employee
        cmp_id = cls._get_cmp_id(employee)
        actor_hrms_id = getattr(user, 'hrms_id', None) or employee.hrms_id
        emp_hrms_id = getattr(employee, 'hrms_id', actor_hrms_id)

        all_success = True

        for record in active_records:
            if not record.leave_approval_id:
                logger.warning(f"[HRMS Leave] Record #{record.id} has no leave_approval_id. Marking DELETED locally.")
                record.status = 'DELETED'
                record.save(update_fields=['status', 'updated_at'])
                continue

            payload = {
                "leaveApprovalId": record.leave_approval_id,
                "loginId": actor_hrms_id,
                "userId": user.username if user else "",
                "ipAddress": resolved_ip,
                "cmpId": cmp_id,
                "empId": emp_hrms_id,
                "sEmpId": actor_hrms_id,
            }

            # Mock check
            if cls._is_mock_enabled():
                logger.info(f"[HRMS Leave MOCK] Simulating DeleteApprovedLeave for leaveApprovalId={record.leave_approval_id}")
                record.status = 'DELETED'
                record.save(update_fields=['status', 'updated_at'])
                continue

            # Live API Call
            url = f"{HRMSSyncService.BASE_URL}/api/v1/DeleteApprovedLeave"
            try:
                logger.info(f"[HRMS Leave] Calling DeleteApprovedLeave for TR #{travel_app.id} | leaveApprovalId={record.leave_approval_id}")
                response = HRMSSyncService._make_hrms_request("POST", url, json=payload, timeout=15)
                response.raise_for_status()

                record.status = 'DELETED'
                record.response_payload = response.json() if response.content else {}
                record.save(update_fields=['status', 'response_payload', 'updated_at'])
                logger.info(f"[HRMS Leave] Leave record #{record.id} deleted successfully in HRMS.")

            except Exception as exc:
                logger.error(f"[HRMS Leave] DeleteApprovedLeave API failed for record #{record.id} (leaveApprovalId={record.leave_approval_id}): {exc}", exc_info=True)
                record.error_message = f"Delete failed: {str(exc)}"
                record.save(update_fields=['error_message', 'updated_at'])
                all_success = False

        return all_success

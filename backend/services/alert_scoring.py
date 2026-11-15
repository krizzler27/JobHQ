"""Job alert rescoring service across saved Target Role Profile and tracked history."""

from backend.core.database import DatabaseManager
from backend.parsing.scorer import score_job_title
from backend.repositories.alerts import JobAlertRepository
from backend.repositories.applications import ApplicationRepository
from backend.repositories.profile import ProfileRepository


def rescore_all_alerts(db_manager: DatabaseManager) -> dict:
    with db_manager.session_scope() as session:
        profile_dict = ProfileRepository(session).get_or_create().to_dict()
        past_apps = [a.to_dict() for a in ApplicationRepository(session).list_filtered()]
        alerts = JobAlertRepository(session).list_filtered()
        for alert in alerts:
            score, reason = score_job_title(
                alert.job_title, alert.company_name, profile_dict, past_apps
            )
            alert.relevance_score = score
            alert.relevance_reason = reason[:255]
        return {"rescored": len(alerts)}

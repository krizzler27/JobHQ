"""Repository for encrypted local IMAP configuration and effective credential resolution."""

from sqlalchemy.orm import Session

from backend.core.crypto import ENC_PREFIX, SecretCipher
from backend.core.models import ImapConfig, now_iso


class ImapConfigRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_or_create(self) -> ImapConfig:
        cfg = self.session.get(ImapConfig, 1)
        if not cfg:
            cfg = ImapConfig(id=1, updated_at=now_iso())
            self.session.add(cfg)
            self.session.flush()
        return cfg

    def get_effective_credentials(self) -> tuple[dict, str]:
        """Returns (raw_credentials_dict, source='saved'|'none')."""
        saved = self.get_or_create()
        if saved.email and saved.password and saved.host:
            try:
                decrypted_password = SecretCipher.decrypt(saved.password)
            except ValueError:
                # Key rotation, machine migration, or missing key: gracefully treat as unconfigured
                decrypted_password = ""

            if decrypted_password:
                # Silently upgrade any legacy plaintext password in DB to encrypted storage
                if not str(saved.password).startswith(ENC_PREFIX):
                    saved.password = SecretCipher.encrypt(decrypted_password)
                    self.session.flush()
                return {
                    "provider": saved.provider,
                    "host": saved.host,
                    "port": saved.port,
                    "email": saved.email,
                    "password": decrypted_password,
                    "folder": saved.folder or "INBOX",
                    "use_ssl": bool(saved.use_ssl),
                }, "saved"

        return {
            "provider": saved.provider,
            "host": saved.host,
            "port": saved.port,
            "email": saved.email if saved.email else "",
            "password": "",
            "folder": saved.folder or "INBOX",
            "use_ssl": bool(saved.use_ssl),
        }, "none"

    def get_masked_status(self) -> dict:
        creds, source = self.get_effective_credentials()
        folders = [f.strip() for f in str(creds["folder"] or "INBOX").split(",") if f.strip()] or ["INBOX"]
        return {
            "connected": source != "none",
            "provider": creds["provider"],
            "host": creds["host"],
            "port": creds["port"],
            "email": creds["email"],
            "folder": ", ".join(folders),
            "folders": folders,
            "use_ssl": creds["use_ssl"],
            "has_password": bool(creds["password"]),
            "source": source,
        }

    def save_config(self, payload: dict) -> dict:
        cfg = self.get_or_create()
        cfg.provider = str(payload.get("provider", cfg.provider)).strip().lower() or "gmail"
        cfg.host = str(payload.get("host", cfg.host)).strip()
        cfg.port = int(payload.get("port") or 993)
        cfg.email = str(payload.get("email", cfg.email)).strip()
        if payload.get("password"):
            cfg.password = SecretCipher.encrypt(str(payload["password"]).strip())
        raw_folders = payload.get("folders")
        if isinstance(raw_folders, list) and raw_folders:
            cfg.folder = ", ".join(str(x).strip() for x in raw_folders if str(x).strip()) or "INBOX"
        else:
            cleaned = ", ".join(
                f.strip() for f in str(payload.get("folder", "INBOX")).split(",") if f.strip()
            )
            cfg.folder = cleaned or "INBOX"
        cfg.use_ssl = 1 if payload.get("use_ssl", True) else 0
        cfg.updated_at = now_iso()
        self.session.flush()
        return self.get_masked_status()

    def clear_config(self) -> dict:
        cfg = self.get_or_create()
        cfg.email = ""
        cfg.password = ""
        cfg.updated_at = now_iso()
        self.session.flush()
        return self.get_masked_status()

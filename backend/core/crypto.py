"""Symmetric Fernet (AES-128-CBC + HMAC-SHA256) encryption for local IMAP App Passwords."""

import os
from pathlib import Path
from cryptography.fernet import Fernet, InvalidToken

from backend.core.config import config

ENC_PREFIX = "enc:"


class SecretCipher:
    """Encrypts and decrypts local IMAP credentials using ~/.jobhq/.secret.key or JOBHQ_ENCRYPTION_KEY."""

    _mem_key: bytes | None = None

    @classmethod
    def _get_fernet(cls) -> Fernet:
        # 1. Environment variable override
        if config.encryption_key:
            return Fernet(config.encryption_key.encode("ascii"))

        # 2. Configured key path (~/.jobhq/.secret.key)
        key_path = config.secret_key_path
        if key_path.is_file():
            try:
                raw_key = key_path.read_bytes().strip()
                if raw_key:
                    return Fernet(raw_key)
            except (PermissionError, OSError):
                pass

        # 3. Check legacy project-level key for seamless migration (data/.secret.key)
        legacy_key_path = Path.cwd() / "data" / ".secret.key"
        if legacy_key_path.is_file():
            try:
                legacy_key = legacy_key_path.read_bytes().strip()
                if legacy_key:
                    # Attempt to copy to home dir if possible
                    try:
                        key_path.parent.mkdir(parents=True, exist_ok=True)
                        key_path.write_bytes(legacy_key)
                    except (PermissionError, OSError):
                        pass
                    return Fernet(legacy_key)
            except (PermissionError, OSError):
                pass

        # 4. Generate new key at ~/.jobhq/.secret.key
        try:
            key_path.parent.mkdir(parents=True, exist_ok=True)
            new_key = Fernet.generate_key()
            key_path.write_bytes(new_key)
            try:
                key_path.chmod(0o600)
            except OSError:
                pass
            return Fernet(new_key)
        except (PermissionError, OSError):
            # In-memory fallback if user profile is strictly read-only
            if cls._mem_key is None:
                cls._mem_key = Fernet.generate_key()
            return Fernet(cls._mem_key)

    @classmethod
    def encrypt(cls, plaintext: str) -> str:
        clean = str(plaintext or "").strip()
        if not clean:
            return ""
        if clean.startswith(ENC_PREFIX):
            return clean
        token = cls._get_fernet().encrypt(clean.encode("utf-8")).decode("ascii")
        return f"{ENC_PREFIX}{token}"

    @classmethod
    def decrypt(cls, stored: str) -> str:
        val = str(stored or "").strip()
        if not val:
            return ""
        if not val.startswith(ENC_PREFIX):
            # Stored unencrypted legacy password
            return val
        token = val[len(ENC_PREFIX):]
        try:
            decrypted = cls._get_fernet().decrypt(token.encode("ascii"))
            return decrypted.decode("utf-8")
        except (InvalidToken, ValueError) as err:
            raise ValueError(
                "Saved email password could not be unlocked with the local key. Please re-enter your App Password in Connect Email."
            ) from err

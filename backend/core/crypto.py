"""Symmetric Fernet (AES-128-CBC + HMAC-SHA256) encryption for local IMAP App Passwords."""

import os

from cryptography.fernet import Fernet, InvalidToken

ENC_PREFIX = "enc:"


class SecretCipher:
    """Encrypts and decrypts local IMAP credentials using data/.secret.key or JOB_TRACKER_KEY."""

    _mem_key: bytes | None = None

    @classmethod
    def _get_fernet(cls) -> Fernet:
        env_key = os.environ.get("JOB_TRACKER_KEY", "").strip()
        if env_key:
            return Fernet(env_key.encode("ascii"))

        data_dir = os.path.join(os.getcwd(), "data")
        key_path = os.path.join(data_dir, ".secret.key")
        if os.path.isfile(key_path):
            with open(key_path, "rb") as f:
                raw_key = f.read().strip()
            if raw_key:
                return Fernet(raw_key)

        os.makedirs(data_dir, exist_ok=True)
        new_key = Fernet.generate_key()
        with open(key_path, "wb") as f:
            f.write(new_key)
        try:
            os.chmod(key_path, 0o600)
        except OSError:
            pass
        return Fernet(new_key)

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
            # Legacy plaintext value stored prior to encryption support
            return val
        token = val[len(ENC_PREFIX) :].encode("ascii")
        try:
            return cls._get_fernet().decrypt(token).decode("utf-8")
        except InvalidToken as err:
            raise ValueError(
                "Saved email password could not be unlocked with the local key. Please re-enter your App Password in Connect Email."
            ) from err

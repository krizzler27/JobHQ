"""Standalone CLI helper to decrypt the locally stored IMAP App Password."""

import argparse
import os
import sqlite3
import sys
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

ENC_PREFIX = "enc:"


def load_fernet(key_arg: str, key_file: Path) -> Fernet:
    raw = key_arg.strip() or os.environ.get("JOB_TRACKER_KEY", "").strip()
    if raw:
        return Fernet(raw.encode("ascii"))

    if not key_file.is_file():
        raise FileNotFoundError(
            f"Secret key file not found at '{key_file}'. Pass --key or set JOB_TRACKER_KEY."
        )

    file_key = key_file.read_bytes().strip()
    if not file_key:
        raise ValueError(f"Secret key file '{key_file}' is empty.")
    return Fernet(file_key)


def decrypt_value(stored: str, fernet: Fernet) -> str:
    val = stored.strip()
    if not val:
        return ""
    if not val.startswith(ENC_PREFIX):
        return val
    token = val[len(ENC_PREFIX) :].encode("ascii")
    return fernet.decrypt(token).decode("utf-8")


def read_from_db(db_path: Path) -> tuple[str, str]:
    if not db_path.is_file():
        raise FileNotFoundError(f"Database file not found at '{db_path}'.")
    conn = sqlite3.connect(str(db_path))
    try:
        row = conn.execute("SELECT email, password FROM imap_configs WHERE id = 1").fetchone()
        if not row:
            return "", ""
        return str(row[0] or ""), str(row[1] or "")
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Decrypt the locally stored Job Tracker IMAP App Password."
    )
    parser.add_argument(
        "--db",
        default="data/job_tracker.db",
        help="Path to SQLite database (default: data/job_tracker.db)",
    )
    parser.add_argument(
        "--key-file",
        default="data/.secret.key",
        help="Path to Fernet key file (default: data/.secret.key)",
    )
    parser.add_argument(
        "--key",
        default="",
        help="Optional Fernet key string (overrides --key-file and JOB_TRACKER_KEY)",
    )
    parser.add_argument(
        "--token",
        default="",
        help="Optional enc:... token to decrypt directly instead of reading from SQLite",
    )
    args = parser.parse_args()

    try:
        fernet = load_fernet(args.key, Path(args.key_file))
        if args.token:
            plain = decrypt_value(args.token, fernet)
            print(plain)
            return 0

        email_addr, stored_pw = read_from_db(Path(args.db))
        if not stored_pw:
            print("No IMAP App Password is saved in the database.", file=sys.stderr)
            return 1

        plain = decrypt_value(stored_pw, fernet)
        if email_addr:
            print(f"Email: {email_addr}")
        print(f"App Password: {plain}")
        return 0
    except InvalidToken:
        print(
            "Error: Key does not match the saved password (InvalidToken).",
            file=sys.stderr,
        )
        return 1
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

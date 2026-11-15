"""Two-stage Python stdlib IMAP4/IMAP4_SSL client with folder discovery and BODY.PEEK fetching."""

import email
import imaplib
import logging
import re
import threading
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Callable

from backend.core.models import now_iso
from backend.imap.queries import (
    build_imap_search_queries,
    decode_mime_header,
    parse_folder_list,
    parse_imap_list_line,
)
from backend.parsing.html_links import html_to_text_links_rich

logger = logging.getLogger("job_tracker.sync")


class SyncCancelledError(Exception):
    """Raised cleanly when user cancels an active sync job."""


class ImapClient:
    """Single-responsibility Python stdlib IMAP client supporting Gmail, Outlook, Yahoo, and Custom."""

    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        folder: str | list[str] = "INBOX",
        use_ssl: bool = True,
    ) -> None:
        self.host = host
        self.port = int(port or 993)
        self.username = username
        self.password = password
        self.folders = parse_folder_list(folder)
        self.folder = ", ".join(self.folders)
        self.use_ssl = use_ssl

    def _open_connection(self) -> imaplib.IMAP4:
        logger.info("[imap] Connecting to %s:%d (ssl=%s)...", self.host, self.port, self.use_ssl)
        conn: imaplib.IMAP4 = (
            imaplib.IMAP4_SSL(self.host, self.port, timeout=20)
            if self.use_ssl
            else imaplib.IMAP4(self.host, self.port, timeout=20)
        )
        conn.login(self.username, self.password)
        return conn

    @staticmethod
    def _select_folder(conn: imaplib.IMAP4, folder_name: str) -> bool:
        escaped = folder_name.replace('"', '\\"')
        status, _ = conn.select(f'"{escaped}"', readonly=True)
        if status == "OK":
            return True
        status_plain, _ = conn.select(folder_name, readonly=True)
        return status_plain == "OK"

    def list_folders(self) -> list[str]:
        conn = self._open_connection()
        try:
            status, raw_lines = conn.list()
            if status != "OK" or not raw_lines:
                return ["INBOX"]
            folders: list[str] = []
            seen: set[str] = set()
            for entry in raw_lines:
                parsed = parse_imap_list_line(entry)
                if not parsed:
                    continue
                flags, name = parsed
                if "\\noselect" in flags or not name:
                    continue
                if name.lower() not in seen:
                    seen.add(name.lower())
                    folders.append(name)
            folders.sort(key=lambda x: (0 if x.upper() == "INBOX" else 1, x.lower()))
            return folders or ["INBOX"]
        finally:
            try:
                conn.logout()
            except Exception:
                pass

    def test_connection(self) -> dict:
        conn = self._open_connection()
        try:
            total = 0
            checked: list[str] = []
            missing: list[str] = []
            for folder_name in self.folders:
                if self._select_folder(conn, folder_name):
                    checked.append(folder_name)
                    _, data = conn.search(None, "ALL")
                    total += len(data[0].split()) if data and data[0] else 0
                else:
                    missing.append(folder_name)
            if not checked:
                raise ValueError(
                    f"Could not find folder(s): {', '.join(missing)}. Click 'Load Folders' to pick exact folder names."
                )
            return {
                "ok": True,
                "mailbox_messages": total,
                "folders_checked": checked,
                "missing_folders": missing,
            }
        finally:
            try:
                conn.logout()
            except Exception:
                pass

    def fetch_headers_and_bodies(
        self,
        days: int,
        limit_per_folder: int,
        is_already_processed: Callable[[list[str]], set[str]],
        is_job_header: Callable[[dict], bool],
        force_rescan: bool = False,
        cancel_event: threading.Event | None = None,
        progress_cb: Callable[[dict], None] | None = None,
        profile: dict | None = None,
        active_companies: list[str] | None = None,
    ) -> dict:
        """
        Two-stage fetch with server-side IMAP SEARCH pre-filtering:
        1) Run compact IMAP UID SEARCH batches (SUBJECT/FROM keywords + active companies) per folder so unrelated noise stays on the mail server.
        2) Peek lightweight headers on matched UIDs -> apply skip words -> download BODY.PEEK[] only for new candidates.
        """
        days = max(1, min(int(days or 30), 180))
        since_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%d-%b-%Y")
        search_queries = build_imap_search_queries(
            since_date, profile, active_companies=active_companies
        )
        conn = self._open_connection()

        all_headers: list[dict] = []
        seen_ids: set[str] = set()
        folder_uids: dict[str, list[bytes]] = {}

        try:
            for folder_name in self.folders:
                if cancel_event and cancel_event.is_set():
                    raise SyncCancelledError("Sync cancelled while checking folders.")
                if not self._select_folder(conn, folder_name):
                    logger.warning("[imap] Folder '%s' could not be selected, skipping.", folder_name)
                    continue

                matched_uid_bytes: dict[int, bytes] = {}
                fallback_needed = False

                for query in search_queries:
                    if cancel_event and cancel_event.is_set():
                        raise SyncCancelledError("Sync cancelled while searching folder.")
                    try:
                        status, data = conn.uid("search", None, query)
                    except imaplib.IMAP4.error as err:
                        logger.warning(
                            "[imap] Folder '%s' search query error (%s); falling back to date search.",
                            folder_name,
                            err,
                        )
                        fallback_needed = True
                        break
                    if status != "OK":
                        logger.warning(
                            "[imap] Folder '%s' search returned %s; falling back to date search.",
                            folder_name,
                            status,
                        )
                        fallback_needed = True
                        break
                    if data and data[0]:
                        for uid_b in data[0].split():
                            try:
                                uid_num = int(uid_b)
                            except ValueError:
                                continue
                            matched_uid_bytes[uid_num] = uid_b

                if fallback_needed:
                    matched_uid_bytes.clear()
                    status, data = conn.uid("search", None, f'(SINCE "{since_date}")')
                    if status == "OK" and data and data[0]:
                        for uid_b in data[0].split():
                            try:
                                uid_num = int(uid_b)
                            except ValueError:
                                continue
                            matched_uid_bytes[uid_num] = uid_b

                if not matched_uid_bytes:
                    logger.info(
                        "[imap] Folder '%s': 0 matching emails since %s (%d server queries).",
                        folder_name,
                        since_date,
                        len(search_queries),
                    )
                    continue

                sorted_uids = [matched_uid_bytes[k] for k in sorted(matched_uid_bytes.keys())]
                recent_uids = list(reversed(sorted_uids[-limit_per_folder:]))
                folder_uids[folder_name] = recent_uids
                logger.info(
                    "[imap] Folder '%s': %d matching email(s) via %d IMAP search query(s) (since %s).",
                    folder_name,
                    len(recent_uids),
                    1 if fallback_needed else len(search_queries),
                    since_date,
                )

                for start in range(0, len(recent_uids), 50):
                    if cancel_event and cancel_event.is_set():
                        raise SyncCancelledError("Sync cancelled while reading email headers.")
                    chunk = recent_uids[start : start + 50]
                    uid_list_bytes = b",".join(chunk)
                    h_status, h_data = conn.uid(
                        "fetch",
                        uid_list_bytes,
                        "(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID IN-REPLY-TO REFERENCES)])",
                    )
                    if h_status != "OK" or not h_data:
                        continue
                    for item in h_data:
                        if not isinstance(item, tuple) or len(item) < 2:
                            continue
                        meta_bytes, raw_hdr = item[0], item[1]
                        uid_m = re.search(rb"UID\s+(\d+)", meta_bytes)
                        uid_str = (
                            uid_m.group(1).decode("ascii", errors="ignore")
                            if uid_m
                            else f"h-{len(all_headers)}"
                        )
                        hdr = self._parse_header_bytes(folder_name, uid_str, raw_hdr)
                        if hdr["id"] not in seen_ids:
                            seen_ids.add(hdr["id"])
                            all_headers.append(hdr)

            all_headers.sort(key=lambda m: m.get("date_iso", ""), reverse=True)
            already_seen_ids = (
                set()
                if force_rescan
                else is_already_processed([h["id"] for h in all_headers])
            )

            candidates: list[dict] = []
            filtered_out_headers: list[dict] = []
            skipped_existing = 0

            for hdr in all_headers:
                if hdr["id"] in already_seen_ids:
                    skipped_existing += 1
                    continue
                if is_job_header(hdr):
                    candidates.append(hdr)
                else:
                    filtered_out_headers.append(hdr)

            logger.info(
                "[imap] Header filter summary: %d total headers, %d already scanned, %d non-job filtered out, %d job candidates.",
                len(all_headers),
                skipped_existing,
                len(filtered_out_headers),
                len(candidates),
            )

            if progress_cb:
                progress_cb(
                    {
                        "phase": "downloading" if candidates else "reading",
                        "total_headers": len(all_headers),
                        "skipped_existing": skipped_existing,
                        "filtered_out": len(filtered_out_headers),
                        "total": len(candidates),
                        "current": 0,
                    }
                )

            by_folder: dict[str, list[dict]] = {}
            for cand in candidates:
                by_folder.setdefault(cand["folder"], []).append(cand)

            downloaded_messages: list[dict] = []
            fetched_idx = 0
            total_cands = len(candidates)

            for folder_name, folder_cands in by_folder.items():
                if not self._select_folder(conn, folder_name):
                    continue
                for cand in folder_cands:
                    if cancel_event and cancel_event.is_set():
                        raise SyncCancelledError("Sync cancelled while downloading emails.")
                    fetched_idx += 1
                    if progress_cb:
                        progress_cb(
                            {
                                "phase": "downloading",
                                "current": fetched_idx,
                                "total": total_cands,
                                "current_subject": cand["subject"][:100],
                            }
                        )
                    f_status, msg_data = conn.uid(
                        "fetch", cand["uid"].encode("ascii"), "(BODY.PEEK[])"
                    )
                    if f_status != "OK" or not msg_data:
                        continue
                    raw_bytes = None
                    for item in msg_data:
                        if isinstance(item, tuple) and len(item) >= 2:
                            raw_bytes = item[1]
                            break
                    if raw_bytes:
                        downloaded_messages.append(self._parse_rfc822(cand["uid"], raw_bytes))

            downloaded_messages.sort(key=lambda m: m.get("date_iso", ""), reverse=True)
            return {
                "total_headers": len(all_headers),
                "skipped_existing": skipped_existing,
                "filtered_out_headers": filtered_out_headers,
                "messages": downloaded_messages,
            }
        finally:
            try:
                conn.logout()
            except Exception:
                pass

    @staticmethod
    def _parse_header_bytes(folder_name: str, uid: str, raw_header_bytes: bytes) -> dict:
        msg = email.message_from_bytes(raw_header_bytes)
        subject = decode_mime_header(msg.get("Subject")) or "(No Subject)"
        sender = decode_mime_header(msg.get("From"))
        msg_id = (msg.get("Message-ID") or f"imap:{folder_name}:{uid}").strip("<> \t\r\n")
        thread_id = (
            (msg.get("In-Reply-To") or msg.get("References") or msg_id).split()[0].strip("<>")
        )

        date_header = msg.get("Date") or ""
        try:
            date_iso = (
                parsedate_to_datetime(date_header).strftime("%Y-%m-%dT%H:%M:%SZ")
                if date_header
                else now_iso()
            )
        except Exception:
            date_iso = now_iso()

        return {
            "folder": folder_name,
            "uid": uid,
            "id": msg_id[:250],
            "thread_id": thread_id[:120],
            "subject": subject,
            "sender": sender,
            "date_iso": date_iso,
        }

    @staticmethod
    def _parse_rfc822(uid: str, raw_bytes: bytes) -> dict:
        msg = email.message_from_bytes(raw_bytes)
        subject = decode_mime_header(msg.get("Subject")) or "(No Subject)"
        sender = decode_mime_header(msg.get("From"))
        msg_id = (msg.get("Message-ID") or f"imap:{uid}").strip("<> \t\r\n")
        thread_id = (
            (msg.get("In-Reply-To") or msg.get("References") or msg_id).split()[0].strip("<>")
        )

        date_header = msg.get("Date") or ""
        try:
            date_iso = (
                parsedate_to_datetime(date_header).strftime("%Y-%m-%dT%H:%M:%SZ")
                if date_header
                else now_iso()
            )
        except Exception:
            date_iso = now_iso()

        plain_parts: list[str] = []
        html_parts: list[str] = []

        if msg.is_multipart():
            for part in msg.walk():
                ctype = part.get_content_type()
                disp = str(part.get("Content-Disposition") or "").lower()
                if "attachment" in disp:
                    continue
                payload = part.get_payload(decode=True)
                if not payload:
                    continue
                charset = part.get_content_charset() or "utf-8"
                try:
                    text = payload.decode(charset, errors="replace")
                except LookupError:
                    text = payload.decode("utf-8", errors="replace")
                if ctype == "text/plain":
                    plain_parts.append(text)
                elif ctype == "text/html":
                    html_parts.append(text)
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                try:
                    text = payload.decode(charset, errors="replace")
                except LookupError:
                    text = payload.decode("utf-8", errors="replace")
                if msg.get_content_type() == "text/html":
                    html_parts.append(text)
                else:
                    plain_parts.append(text)

        link_items: list[tuple[str, str]] = []
        html_text = ""
        if html_parts:
            html_text, link_items = html_to_text_links_rich("\n".join(html_parts))
        links = [u for u, _ in link_items]
        plain_text = "\n".join(plain_parts).strip()
        body = (
            html_text
            if len(html_text) > len(plain_text) * 0.6 and html_text
            else (plain_text or html_text)
        )
        snippet = re.sub(r"\s+", " ", body).strip()[:280]

        return {
            "id": msg_id[:250],
            "thread_id": thread_id[:120],
            "subject": subject,
            "sender": sender,
            "date_iso": date_iso,
            "snippet": snippet,
            "body": body,
            "links": links,
            "link_items": link_items,
        }

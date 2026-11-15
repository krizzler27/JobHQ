"""IMAP search query builder, folder parser, and low-level IMAP protocol client."""

from backend.imap.client import ImapClient, SyncCancelledError
from backend.imap.queries import (
    build_imap_search_queries,
    decode_mime_header,
    parse_folder_list,
    parse_imap_list_line,
)

__all__ = [
    "ImapClient",
    "SyncCancelledError",
    "build_imap_search_queries",
    "decode_mime_header",
    "parse_folder_list",
    "parse_imap_list_line",
]

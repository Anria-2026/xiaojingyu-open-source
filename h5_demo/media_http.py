"""Bounded, byte-range file responses for local native audio/video decoders."""
import os
import re


def serve_file(handler, path, content_type):
    try:
        source = open(path, "rb")
    except OSError:
        return handler.send_error(404)
    with source:
        size = os.fstat(source.fileno()).st_size
        start, end, code = 0, size - 1, 200
        requested = handler.headers.get("Range", "") if handler.command == "GET" else ""
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", requested.strip())
        if match and any(match.groups()):
            first, last = match.groups()
            if first:
                start = int(first)
                end = min(size - 1, int(last)) if last else size - 1
            else:
                start = max(0, size - int(last))
            if start > end or start >= size:
                handler.send_response(416)
                handler.send_header("Content-Range", "bytes */%d" % size)
                handler.send_header("Content-Length", "0")
                handler.end_headers()
                return
            code = 206
        length = max(0, end - start + 1)
        try:
            handler.send_response(code)
            handler.send_header("Content-Type", content_type)
            handler.send_header("Accept-Ranges", "bytes")
            handler.send_header("Content-Length", str(length))
            handler.send_header("Cache-Control", "no-store")
            if code == 206:
                handler.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
            handler.end_headers()
            if handler.command == "HEAD":
                return
            source.seek(start)
            while length:
                chunk = source.read(min(length, 256 * 1024))
                if not chunk:
                    break
                handler.wfile.write(chunk)
                length -= len(chunk)
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError, TimeoutError):
            handler.close_connection = True

"""
Will be used to host the webui later on.
"""

import http.server
import socketserver

PORT = 8111

Handler = http.server.SimpleHTTPRequestHandler

httpd = socketserver.TCPServer(("", PORT), Handler)

print("serving at port", PORT)
httpd.serve_forever()

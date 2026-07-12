from http.server import BaseHTTPRequestHandler, HTTPServer
import os
import json
import subprocess
import re
import sys
import threading
if sys.stdout is None:
    class _Null:
        def write(self, *a): pass
        def flush(self): pass
    sys.stdout = _Null()
if sys.stderr is None:
    class _Null2:
        def write(self, *a): pass
        def flush(self): pass
    sys.stderr = _Null2()
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

OUTPUT_FILE = "last_output.txt"
SESSION_CONFIRMED = False

def ask_confirmation(command):
    import tkinter as tk
    answer_holder = {"value": False}
    root = tk.Tk()
    root.title("FlowBridge")
    root.attributes("-topmost", True)
    root.resizable(False, False)
    root.configure(bg="#1E1B4B")
    width, height = 400, 210
    screen_w = root.winfo_screenwidth()
    screen_h = root.winfo_screenheight()
    x = (screen_w - width) // 2
    y = (screen_h - height) // 2
    root.geometry(str(width) + "x" + str(height) + "+" + str(x) + "+" + str(y))

    header = tk.Label(root, text=">_ FlowBridge", font=("Consolas", 16, "bold"), fg="#34D399", bg="#1E1B4B")
    header.pack(pady=(18, 4))

    subtitle = tk.Label(root, text="wants to run this command:", font=("Segoe UI", 10), fg="#CBD5E1", bg="#1E1B4B")
    subtitle.pack()

    cmd_box = tk.Label(root, text=command, font=("Consolas", 10), fg="#FFFFFF", bg="#0F0D2B", wraplength=340, justify="left", padx=10, pady=8)
    cmd_box.pack(pady=10, padx=20, fill="x")

    def on_allow():
        answer_holder["value"] = True
        root.destroy()

    def on_deny():
        answer_holder["value"] = False
        root.destroy()

    btn_frame = tk.Frame(root, bg="#1E1B4B")
    btn_frame.pack(pady=6)

    deny_btn = tk.Button(btn_frame, text="Deny", command=on_deny, bg="#374151", fg="#FFFFFF", activebackground="#4B5563", relief="flat", width=10, font=("Segoe UI", 9, "bold"))
    deny_btn.pack(side="left", padx=8)

    allow_btn = tk.Button(btn_frame, text="Allow", command=on_allow, bg="#16A34A", fg="#FFFFFF", activebackground="#15803D", relief="flat", width=10, font=("Segoe UI", 9, "bold"))
    allow_btn.pack(side="left", padx=8)

    root.lift()
    root.attributes("-topmost", True)
    root.focus_force()
    root.mainloop()

    return answer_holder["value"]

def execute_command(command):
    result = subprocess.run(
        ["powershell", "-Command", command],
        shell=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore"
    )

    stdout_text = result.stdout if result.stdout else ""
    stderr_text = result.stderr if result.stderr else ""

    full_output = stdout_text
    if stderr_text:
        full_output += "\n[Terminal Error]:\n" + stderr_text

    match = re.search(r"(?:code|type|cat|Get-Content)\s+([^\s]+)", command)

    if match:
        filename = match.group(1)
        if os.path.exists(filename) and os.path.isfile(filename):
            try:
                with open(filename, "r", encoding="utf-8", errors="ignore") as file_content:
                    actual_code = file_content.read()

                full_output = "[File Content of '" + filename + "']:\n\n```" + (os.path.splitext(filename)[1][1:] or "text") + "\n" + actual_code + "\n```"
                print("Captured inner code of: " + filename)
            except Exception as e:
                full_output = "Error reading file " + filename + ": " + str(e)

    if not full_output or not full_output.strip():
        full_output = "Success: The command [" + command + "] executed successfully with no direct text output."

    print(full_output)
    with open(OUTPUT_FILE, "w", encoding="utf-8", errors="ignore") as f:
        f.write(full_output)

def manual_input_loop():
    try:
        print("\nType a command below and press Enter to run it manually and send the result to Claude:")
        while True:
            cmd = input("> ")
            if cmd.strip():
                print("\n----------------------------------------------------")
                print("Manual command entered:")
                print("[ " + cmd.strip() + " ]")
                print("----------------------------------------------------\n")
                execute_command(cmd.strip())
    except Exception:
        pass

class BridgeHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if os.path.exists(OUTPUT_FILE):
            with open(OUTPUT_FILE, "r", encoding="utf-8", errors="ignore") as f:
                last_output = f.read()
        else:
            last_output = "No recent terminal output found."

        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"output": last_output}).encode("utf-8"))

    def do_POST(self):
        content_length = int(self.headers["Content-Length"])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode("utf-8"))
        command = data.get("command", "").strip()

        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "success"}).encode("utf-8"))

        if command:
            global SESSION_CONFIRMED
            print("\n----------------------------------------------------")
            print("Received command from Claude:")
            print("[ " + command + " ]")

            if not SESSION_CONFIRMED:
                try:
                    approved = ask_confirmation(command)
                except Exception as e:
                    with open("debug_error.txt", "w", encoding="utf-8", errors="ignore") as ef:
                        import traceback
                        ef.write(traceback.format_exc())
                    approved = False
                if approved:
                    SESSION_CONFIRMED = True
                else:
                    print("Command cancelled by user.")
                    with open(OUTPUT_FILE, "w", encoding="utf-8", errors="ignore") as f:
                        f.write("Command cancelled by user.")
                    return

            print("Executing inside PowerShell...")
            print("----------------------------------------------------\n")
            execute_command(command)

def run():
    server_address = ("127.0.0.1", 9988)
    httpd = HTTPServer(server_address, BridgeHandler)
    print("[FlowBridge Server] Daemon running successfully...")
    print("Listening for secure incoming commands from Claude...")
    threading.Thread(target=manual_input_loop, daemon=True).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped successfully.")

if __name__ == "__main__":
    run()

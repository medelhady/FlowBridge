from http.server import BaseHTTPRequestHandler, HTTPServer
import os
import json
import subprocess
import re
import sys
import threading
import tempfile
import urllib.request
import ctypes
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

BASE_DIR = os.path.dirname(sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__))

def find_data_dir():
    for candidate in (os.path.join(tempfile.gettempdir(), "FlowBridge"),):
        try:
            os.makedirs(candidate, exist_ok=True)
            test_file = os.path.join(candidate, ".write_test")
            with open(test_file, "w", encoding="utf-8") as f:
                f.write("ok")
            os.remove(test_file)
            return candidate
        except Exception:
            continue
    return BASE_DIR

DATA_DIR = find_data_dir()
OUTPUT_FILE = os.path.join(DATA_DIR, "last_output.txt")
TRACE_FILE = os.path.join(DATA_DIR, "startup_trace.txt")
SESSION_CONFIRMED = False
SECURITY_MODE = "smart"
INSTANCE_MUTEX = None

def trace_startup(message):
    try:
        with open(TRACE_FILE, "a", encoding="utf-8", errors="ignore") as f:
            f.write(message + "\n")
    except Exception:
        pass

def bridge_already_running():
    try:
        with urllib.request.urlopen("http://127.0.0.1:9988/", timeout=1) as response:
            return response.status == 200
    except Exception:
        return False

def acquire_single_instance_lock():
    global INSTANCE_MUTEX
    try:
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        mutex_name = "Global\\FlowBridgeBridgeServerSingleInstance"
        handle = kernel32.CreateMutexW(None, False, mutex_name)
        if not handle:
            return True
        last_error = ctypes.get_last_error()
        if last_error == 183:
            return False
        INSTANCE_MUTEX = handle
        return True
    except Exception:
        return True

def reset_last_output():
    try:
        with open(OUTPUT_FILE, "w", encoding="utf-8", errors="ignore") as f:
            f.write("No recent terminal output found.")
    except Exception:
        pass

def classify_command(command):
    normalized = " " + re.sub(r"\s+", " ", command.lower()).strip() + " "
    dangerous_rules = [
        ("Remove files recursively", [r"\bremove-item\b.*\s-recurse\b", r"\brm\b.*\s-rf\b", r"\bdel\b.*\s/s\b", r"\brmdir\b.*\s/s\b"]),
        ("Format or wipe storage", [r"\bformat\b", r"\bdiskpart\b", r"\bclean\b.*\bdisk\b"]),
        ("Registry deletion", [r"\breg\b\s+delete\b", r"\bremove-item\b.*registry::"]),
        ("System shutdown or reboot", [r"\bshutdown\b", r"\brestart-computer\b", r"\bstop-computer\b"]),
        ("Force kill processes", [r"\btaskkill\b.*\s/f\b", r"\bstop-process\b.*\s-force\b"]),
        ("Permission or ownership changes", [r"\btakeown\b", r"\bicacls\b.*\b/grant\b", r"\bchmod\b.*\b777\b"]),
    ]
    risky_rules = [
        ("Uses force flag", [r"\s-force\b", r"\s--force\b", r"\s-f\b"]),
        ("Installs or executes remote code", [r"\biex\b", r"\binvoke-expression\b", r"\bcurl\b.*\|", r"\biwr\b.*\|", r"\binvoke-webrequest\b.*\|"]),
        ("Package install", [r"\bnpm\s+install\b", r"\bpip\s+install\b", r"\bwinget\s+install\b", r"\bchoco\s+install\b"]),
        ("Git destructive action", [r"\bgit\s+reset\b.*\b--hard\b", r"\bgit\s+clean\b.*\b-f\b"]),
    ]

    for reason, patterns in dangerous_rules:
        if any(re.search(pattern, normalized) for pattern in patterns):
            return "dangerous", reason

    for reason, patterns in risky_rules:
        if any(re.search(pattern, normalized) for pattern in patterns):
            return "risky", reason

    return "safe", "Looks like a normal command"

def ask_confirmation(command, risk_level="safe", reason=""):
    import tkinter as tk
    answer_holder = {"value": False}

    root = tk.Tk()
    root.title("FlowBridge Approval")
    root.attributes("-topmost", True)
    root.resizable(False, False)
    root.configure(bg="#eef4ff")
    width, height = 430, 290
    screen_w = root.winfo_screenwidth()
    screen_h = root.winfo_screenheight()
    x = (screen_w - width) // 2
    y = (screen_h - height) // 2
    root.geometry(str(width) + "x" + str(height) + "+" + str(x) + "+" + str(y))

    canvas = tk.Canvas(root, width=width, height=height, bg="#eef4ff", highlightthickness=0)
    canvas.pack(fill="both", expand=True)
    canvas.create_oval(-90, -80, 170, 170, fill="#dbeafe", outline="")
    canvas.create_oval(292, 186, 540, 430, fill="#dcfce7", outline="")

    card_x, card_y, card_w, card_h = 28, 24, 374, 238
    canvas.create_rectangle(card_x + 3, card_y + 8, card_x + card_w + 3, card_y + card_h + 8, fill="#d9e2f0", outline="")
    canvas.create_rectangle(card_x, card_y, card_x + card_w, card_y + card_h, fill="#ffffff", outline="#e2e8f0")

    risk_styles = {
        "safe": ("Safe", "#047857", "#dcfce7"),
        "risky": ("Review", "#a16207", "#fef3c7"),
        "dangerous": ("Danger", "#b91c1c", "#fee2e2"),
    }
    risk_title, risk_fg, risk_bg = risk_styles.get(risk_level, risk_styles["safe"])

    header = tk.Label(root, text="FlowBridge wants to run", font=("Segoe UI", 14, "bold"), fg="#0f172a", bg="#ffffff")
    header.place(x=card_x + 18, y=card_y + 18)

    risk_label = tk.Label(root, text=risk_title, font=("Segoe UI", 8, "bold"), fg=risk_fg, bg=risk_bg, padx=8, pady=3)
    risk_label.place(x=card_x + card_w - 76, y=card_y + 18)

    source_label = tk.Label(root, text="AI Chat", font=("Segoe UI", 8, "bold"), fg="#2563eb", bg="#ffffff")
    source_label.place(x=card_x + 110, y=card_y + 56)
    terminal_label = tk.Label(root, text="Terminal", font=("Segoe UI", 8, "bold"), fg="#16a34a", bg="#ffffff")
    terminal_label.place(x=card_x + 218, y=card_y + 56)
    bridge_line = canvas.create_line(card_x + 158, card_y + 80, card_x + 230, card_y + 80, fill="#bfdbfe", width=3)
    spark = canvas.create_oval(card_x + 156, card_y + 75, card_x + 166, card_y + 85, fill="#2563eb", outline="")

    reason_text = reason if reason else "FlowBridge will only run this after your approval."
    reason_label = tk.Label(root, text=reason_text, font=("Segoe UI", 8), fg="#64748b", bg="#ffffff", wraplength=324, justify="left")
    reason_label.place(x=card_x + 18, y=card_y + 98)

    cmd_frame = tk.Frame(root, bg="#f8fafc", highlightbackground="#e2e8f0", highlightthickness=1)
    cmd_frame.place(x=card_x + 18, y=card_y + 126, width=card_w - 36, height=56)
    cmd_box = tk.Label(cmd_frame, text=command, font=("Consolas", 9), fg="#0f172a", bg="#f8fafc", wraplength=306, justify="left", padx=10, pady=8, anchor="w")
    cmd_box.pack(fill="both", expand=True)

    def on_allow():
        answer_holder["value"] = True
        root.destroy()

    def on_deny():
        answer_holder["value"] = False
        root.destroy()

    deny_btn = tk.Button(root, text="Deny", command=on_deny, bg="#f1f5f9", fg="#334155", activebackground="#e2e8f0", relief="flat", width=10, font=("Segoe UI", 9, "bold"), cursor="hand2")
    deny_btn.place(x=card_x + 188, y=card_y + 196, height=36)

    allow_btn = tk.Button(root, text="Allow once", command=on_allow, bg="#111827", fg="#ffffff", activebackground="#020617", relief="flat", width=12, font=("Segoe UI", 9, "bold"), cursor="hand2")
    allow_btn.place(x=card_x + 276, y=card_y + 196, height=36)

    def animate_spark(step=0):
        if not root.winfo_exists():
            return
        left = card_x + 156
        x_offset = (step % 72)
        canvas.coords(spark, left + x_offset, card_y + 75, left + x_offset + 10, card_y + 85)
        fill = "#2563eb" if x_offset < 45 else "#22c55e"
        canvas.itemconfig(spark, fill=fill)
        root.after(28, animate_spark, step + 2)

    animate_spark()

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
            risk_level, risk_reason = classify_command(command)
            reset_last_output()
            print("\n----------------------------------------------------")
            print("Received command from Claude:")
            print("[ " + command + " ]")
            print("Risk level: " + risk_level + " (" + risk_reason + ")")

            needs_confirmation = (
                SECURITY_MODE == "strict" or
                not SESSION_CONFIRMED or
                risk_level in ("risky", "dangerous")
            )

            if needs_confirmation:
                try:
                    approved = ask_confirmation(command, risk_level, risk_reason)
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
    trace_startup("run entered")
    if not acquire_single_instance_lock():
        trace_startup("single instance lock already held")
        return

    if bridge_already_running():
        trace_startup("another bridge already running")
        return

    trace_startup("reset output")
    reset_last_output()
    server_address = ("127.0.0.1", 9988)
    trace_startup("creating http server")
    httpd = HTTPServer(server_address, BridgeHandler)
    trace_startup("http server created")
    print("[FlowBridge Server] Daemon running successfully...")
    print("Listening for secure incoming commands from Claude...")
    threading.Thread(target=manual_input_loop, daemon=True).start()
    trace_startup("serve_forever starting")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped successfully.")

if __name__ == "__main__":
    try:
        run()
    except Exception:
        import traceback
        with open(os.path.join(DATA_DIR, "startup_error.txt"), "w", encoding="utf-8", errors="ignore") as f:
            f.write(traceback.format_exc())
        raise

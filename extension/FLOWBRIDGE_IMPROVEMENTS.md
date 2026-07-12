# FlowBridge Improvement Notes

## Next improvements

- Auto-start FlowBridge with Windows in the final version. Test scripts added: `install_autostart.ps1` and `uninstall_autostart.ps1`.
- Add a small FlowBridge Launcher for users who prefer manual startup.
- Prevent running two bridge servers at the same time. Done in `bridge_server.py`.
- Make the extension show a friendly status when the bridge is offline.
- Add Chrome toolbar status states: Connected, Offline, Needs approval.
- Keep security prompts simple and avoid making the first-use experience hard.
- Add smoother onboarding that explains: install extension, run bridge, approve first command.

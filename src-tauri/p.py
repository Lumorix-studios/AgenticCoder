"""
Debugged & enhanced Kivy app.
Run: python p.py
"""
from kivy.config import Config

# ---- Config MUST come before any other Kivy imports ----
Config.set("graphics", "width", "360")
Config.set("graphics", "height", "640")
Config.set("graphics", "resizable", "1")   # allow resize for debugging
Config.set("kivy", "log_level", "debug")   # verbose logs
Config.set("kivy", "log_enable", "1")

import sys
import traceback
from kivy.app import App
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput
from kivy.logger import Logger


class DebugLayout(BoxLayout):
    """Root widget with interactive elements to verify touch/render/input."""

    def __init__(self, **kwargs):
        super().__init__(orientation="vertical", padding=20, spacing=15, **kwargs)

        # Title
        self.add_widget(Label(text="[b]Kivy Debug App[/b]", markup=True, font_size=24, size_hint_y=None, height=50))

        # Text input to test keyboard
        self.txt = TextInput(hint_text="Type something…", multiline=False, size_hint_y=None, height=50)
        self.add_widget(self.txt)

        # Buttons
        btn_row = BoxLayout(spacing=10, size_hint_y=None, height=50)
        btn_row.add_widget(Button(text="Print Input", on_press=self.on_print))
        btn_row.add_widget(Button(text="Clear", on_press=self.on_clear))
        btn_row.add_widget(Button(text="Crash Test", on_press=self.on_crash))
        self.add_widget(btn_row)

        # Output label
        self.out = Label(text="Ready.", size_hint_y=None, height=80, halign="left", valign="top", text_size=(320, None))
        self.out.bind(size=lambda *a: setattr(self.out, "text_size", (self.out.width, None)))
        self.add_widget(self.out)

        # FPS / debug info
        self.fps_lbl = Label(text="FPS: --", size_hint_y=None, height=30, font_size=14)
        self.add_widget(self.fps_lbl)

        # Schedule FPS update
        from kivy.clock import Clock
        Clock.schedule_interval(self.update_fps, 0.5)

    def on_print(self, _):
        val = self.txt.text.strip()
        self.out.text = f"Input: {val!r}" if val else "(empty)"
        Logger.info(f"User input: {val!r}")

    def on_clear(self, _):
        self.txt.text = ""
        self.out.text = "Cleared."
        Logger.info("Cleared input")

    def on_crash(self, _):
        """Intentional crash to test exception handling."""
        raise RuntimeError("Intentional crash for debugging")

    def update_fps(self, dt):
        from kivy.clock import Clock
        self.fps_lbl.text = f"FPS: {Clock.get_fps():.1f}"


class DebugApp(App):
    def build(self):
        return DebugLayout()

    def on_start(self):
        Logger.info("App started successfully")

    def on_stop(self):
        Logger.info("App stopped")


# ---- Global exception hook (catches crashes in main thread) ----
def _excepthook(exc_type, exc_value, exc_tb):
    Logger.critical("Uncaught exception:", exc_info=(exc_type, exc_value, exc_tb))
    # Also print to stderr so you see it in terminal
    traceback.print_exception(exc_type, exc_value, exc_tb)
    sys.__excepthook__(exc_type, exc_value, exc_tb)


if __name__ == "__main__":
    sys.excepthook = _excepthook
    try:
        DebugApp().run()
    except Exception:
        # Catch any exception during App.run()
        Logger.exception("Fatal error in App.run()")
        raise
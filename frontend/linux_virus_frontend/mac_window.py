from __future__ import annotations

from importlib.resources import files
from typing import Any

from AppKit import (
    NSBackingStoreBuffered,  # ty: ignore[unresolved-import]
    NSColor,  # ty: ignore[unresolved-import]
    NSFloatingWindowLevel,  # ty: ignore[unresolved-import]
    NSMakeRect,  # ty: ignore[unresolved-import]
    NSScreen,  # ty: ignore[unresolved-import]
    NSWindow,  # ty: ignore[unresolved-import]
    NSWindowCollectionBehaviorCanJoinAllSpaces,  # ty: ignore[unresolved-import]
    NSWindowCollectionBehaviorFullScreenAuxiliary,  # ty: ignore[unresolved-import]
    NSWindowCollectionBehaviorStationary,  # ty: ignore[unresolved-import]
    NSWindowStyleMaskBorderless,  # ty: ignore[unresolved-import]
    NSWindowStyleMaskTitled,  # ty: ignore[unresolved-import]
)
from Foundation import NSURL  # ty: ignore[unresolved-import]
from WebKit import (
    WKUserContentController,  # ty: ignore[unresolved-import]
    WKWebView,  # ty: ignore[unresolved-import]
    WKWebViewConfiguration,  # ty: ignore[unresolved-import]
)

from linux_virus_frontend.config import EDGE_MARGIN, TOP_MARGIN
from linux_virus_frontend.web_bridge import _ScriptMessageHandler

_OVERLAY_WINDOW_LEVEL = NSFloatingWindowLevel - 1
_QUIZ_WINDOW_LEVEL = NSFloatingWindowLevel


def _top_right_frame(width: float, height: float) -> Any:
    screen = NSScreen.mainScreen()
    frame = screen.visibleFrame()
    x = frame.origin.x + frame.size.width - width - EDGE_MARGIN
    y = frame.origin.y + frame.size.height - height - TOP_MARGIN
    return NSMakeRect(x, y, width, height)


def _build_web_window(
    controller: Any,
    width: float,
    height: float,
    filename: str = "default.html",
) -> tuple[NSWindow, WKWebView, _ScriptMessageHandler]:
    style = NSWindowStyleMaskTitled
    window = NSWindow.alloc().initWithContentRect_styleMask_backing_defer_(
        _top_right_frame(width, height),
        style,
        NSBackingStoreBuffered,
        False,
    )
    window.setTitle_("Linux Virus")
    window.setLevel_(_QUIZ_WINDOW_LEVEL)
    window.setOpaque_(False)
    window.setBackgroundColor_(
        NSColor.colorWithCalibratedRed_green_blue_alpha_(0.09, 0.10, 0.12, 0.96)
    )
    window.setCollectionBehavior_(
        NSWindowCollectionBehaviorCanJoinAllSpaces
        | NSWindowCollectionBehaviorFullScreenAuxiliary
        | NSWindowCollectionBehaviorStationary
    )
    window.setReleasedWhenClosed_(False)
    window.setDelegate_(controller)

    configuration = WKWebViewConfiguration.alloc().init()
    configuration.setMediaTypesRequiringUserActionForPlayback_(0)
    user_content = WKUserContentController.alloc().init()
    message_handler = _ScriptMessageHandler.alloc().initWithController_(controller)
    user_content.addScriptMessageHandler_name_(message_handler, "resident")
    configuration.setUserContentController_(user_content)

    content = window.contentView()
    webview = WKWebView.alloc().initWithFrame_configuration_(content.bounds(), configuration)
    webview.setAutoresizingMask_(18)
    content.addSubview_(webview)
    _load_web_ui(webview, filename)
    return window, webview, message_handler


def _build_overlay() -> list[tuple[NSWindow, WKWebView]]:
    overlays: list[tuple[NSWindow, WKWebView]] = []
    for screen in NSScreen.screens():
        overlay = NSWindow.alloc().initWithContentRect_styleMask_backing_defer_(
            screen.frame(),
            NSWindowStyleMaskBorderless,
            NSBackingStoreBuffered,
            False,
        )
        overlay.setLevel_(_OVERLAY_WINDOW_LEVEL)
        overlay.setOpaque_(False)
        overlay.setBackgroundColor_(
            NSColor.colorWithCalibratedRed_green_blue_alpha_(0.0, 0.0, 0.0, 0.55)
        )
        overlay.setIgnoresMouseEvents_(False)
        overlay.setCollectionBehavior_(
            NSWindowCollectionBehaviorCanJoinAllSpaces
            | NSWindowCollectionBehaviorStationary
        )
        overlay.setReleasedWhenClosed_(False)

        content = overlay.contentView()
        configuration = WKWebViewConfiguration.alloc().init()
        webview = WKWebView.alloc().initWithFrame_configuration_(
            content.bounds(),
            configuration,
        )
        webview.setAutoresizingMask_(18)
        webview.setValue_forKey_(False, "drawsBackground")
        content.addSubview_(webview)
        _load_web_ui(webview, "blocking_overlay.html")

        overlays.append((overlay, webview))
    return overlays


def _load_web_ui(webview: WKWebView, filename: str = "default.html") -> None:
    package_dir = files("linux_virus_frontend")
    web_dir = package_dir.joinpath("web")
    index_path = web_dir.joinpath(filename)
    index_url = NSURL.fileURLWithPath_(str(index_path))
    read_access_url = NSURL.fileURLWithPath_(str(package_dir))
    webview.loadFileURL_allowingReadAccessToURL_(index_url, read_access_url)

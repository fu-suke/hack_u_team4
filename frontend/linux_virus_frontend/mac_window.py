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
) -> tuple[NSWindow, WKWebView, _ScriptMessageHandler]:
    style = NSWindowStyleMaskTitled
    window = NSWindow.alloc().initWithContentRect_styleMask_backing_defer_(
        _top_right_frame(width, height),
        style,
        NSBackingStoreBuffered,
        False,
    )
    window.setTitle_("Linux Virus")
    window.setLevel_(NSFloatingWindowLevel)
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
    user_content = WKUserContentController.alloc().init()
    message_handler = _ScriptMessageHandler.alloc().initWithController_(controller)
    user_content.addScriptMessageHandler_name_(message_handler, "resident")
    configuration.setUserContentController_(user_content)

    content = window.contentView()
    webview = WKWebView.alloc().initWithFrame_configuration_(content.bounds(), configuration)
    webview.setAutoresizingMask_(18)
    content.addSubview_(webview)
    _load_web_ui(webview)
    return window, webview, message_handler


def _build_overlay() -> NSWindow:
    screen = NSScreen.mainScreen()
    frame = screen.frame()
    overlay = NSWindow.alloc().initWithContentRect_styleMask_backing_defer_(
        frame,
        NSWindowStyleMaskBorderless,
        NSBackingStoreBuffered,
        False,
    )
    overlay.setLevel_(NSFloatingWindowLevel - 1)
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
    return overlay


def _load_web_ui(webview: WKWebView) -> None:
    package_dir = files("linux_virus_frontend")
    web_dir = package_dir.joinpath("web")
    index_path = web_dir.joinpath("index.html")
    index_url = NSURL.fileURLWithPath_(str(index_path))
    read_access_url = NSURL.fileURLWithPath_(str(package_dir))
    webview.loadFileURL_allowingReadAccessToURL_(index_url, read_access_url)

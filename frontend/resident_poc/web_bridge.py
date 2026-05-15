from __future__ import annotations

from typing import Any

from Foundation import NSObject
from objc import super as objc_super


class _ScriptMessageHandler(NSObject):
    def initWithController_(self, controller: Any) -> _ScriptMessageHandler:
        self = objc_super(_ScriptMessageHandler, self).init()
        self._controller = controller
        return self

    def userContentController_didReceiveScriptMessage_(
        self,
        _user_content_controller: object,
        message: Any,
    ) -> None:
        self._controller.handle_script_message(message.body())

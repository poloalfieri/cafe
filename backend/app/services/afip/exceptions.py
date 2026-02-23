from typing import Any, Dict, Optional


class AfipError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class AfipNotReadyError(AfipError):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(
            code="AFIP_NOT_READY",
            message=message,
            status_code=409,
            details=details,
        )


class AfipRejectedError(AfipError):
    def __init__(
        self,
        message: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            code="AFIP_REJECTED",
            message=message,
            status_code=422,
            details=details,
        )


class AfipExternalError(AfipError):
    def __init__(
        self,
        message: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            code="AFIP_EXTERNAL_ERROR",
            message=message,
            status_code=502,
            details=details,
        )

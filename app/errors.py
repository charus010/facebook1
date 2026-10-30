import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("app")


class AppError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message


def _body(code: str, message: str, details=None) -> dict:
    return {"error": {"code": code, "message": message, "details": details}}


def install_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app(_: Request, e: AppError):
        return JSONResponse(_body(e.code, e.message), status_code=e.status)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, e: StarletteHTTPException):
        return JSONResponse(_body("HTTP_ERROR", str(e.detail)), status_code=e.status_code, headers=getattr(e, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def _val(_: Request, e: RequestValidationError):
        details = [{"field": ".".join(str(p) for p in x["loc"][1:]), "message": x["msg"]} for x in e.errors()]
        return JSONResponse(_body("VALIDATION_ERROR", "Invalid input.", details), status_code=422)

    @app.exception_handler(IntegrityError)
    async def _integrity(_: Request, e: IntegrityError):
        log.warning("integrity error: %s", type(e.orig).__name__)  # no SQL / values logged
        return JSONResponse(_body("CONFLICT", "The request conflicts with existing data."), status_code=409)

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, e: Exception):
        log.exception("unhandled error")
        return JSONResponse(_body("INTERNAL_ERROR", "Something went wrong."), status_code=500)

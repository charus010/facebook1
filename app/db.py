from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def make_engine(url: str, **kw) -> Engine:
    if url.startswith("sqlite"):
        kw.setdefault("connect_args", {"check_same_thread": False})
    else:
        kw.setdefault("pool_pre_ping", True)
    engine = create_engine(url, **kw)
    if url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def _fk_on(dbapi_conn, _):  # enforce foreign keys in SQLite like PostgreSQL does
            dbapi_conn.execute("PRAGMA foreign_keys=ON")
    return engine


engine = make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

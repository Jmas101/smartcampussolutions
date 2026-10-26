import logging
import os
from datetime import date, time

import psycopg
from fastapi import FastAPI, HTTPException, Response, status
from psycopg.rows import dict_row
from pydantic import BaseModel, Field, model_validator


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="SmartCampus API",
    description="API para gestionar aulas y reservas universitarias.",
    version="1.0.0",
)


# Configuración recibida mediante variables de entorno.
# Las credenciales no se escriben en el código.
def get_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST", "database"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        connect_timeout=5,
        row_factory=dict_row,
    )


# Modelos de entrada: FastAPI valida automáticamente los datos.
class RoomCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    edificio: str = Field(min_length=1, max_length=100)
    capacidad: int = Field(gt=0)
    equipamiento: list[str] = Field(default_factory=list)


class BookingCreate(BaseModel):
    aula_id: int = Field(gt=0)
    usuario: str = Field(min_length=1, max_length=120)
    fecha: date
    hora_inicio: time
    hora_fin: time

    @model_validator(mode="after")
    def validate_schedule(self):
        if self.hora_fin <= self.hora_inicio:
            raise ValueError(
                "La hora de fin debe ser posterior a la hora de inicio."
            )
        return self


# Las excepciones HTTP se mantienen.
# Los errores internos se registran sin mostrar detalles al usuario.
def database_error(exc: Exception):
    logger.exception("Error al acceder a PostgreSQL")
    raise HTTPException(
        status_code=503,
        detail="La base de datos no está disponible.",
    ) from exc


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "smartcampus-backend",
        "environment": os.getenv("APP_ENV", "local"),
    }


@app.get("/ready")
def ready():
    try:
        with get_connection() as conn:
            conn.execute("SELECT 1").fetchone()

        return {
            "status": "ok",
            "database": "connected",
        }
    except (psycopg.Error, KeyError, ValueError) as exc:
        database_error(exc)


@app.get("/rooms")
def get_rooms():
    try:
        with get_connection() as conn:
            return conn.execute(
                """
                SELECT id, nombre, edificio, capacidad, equipamiento
                FROM rooms
                ORDER BY id
                """
            ).fetchall()
    except (psycopg.Error, KeyError, ValueError) as exc:
        database_error(exc)


@app.get("/rooms/{room_id}")
def get_room(room_id: int):
    try:
        with get_connection() as conn:
            room = conn.execute(
                """
                SELECT id, nombre, edificio, capacidad, equipamiento
                FROM rooms
                WHERE id = %s
                """,
                (room_id,),
            ).fetchone()

        if room is None:
            raise HTTPException(
                status_code=404,
                detail="Aula no encontrada.",
            )

        return room
    except (psycopg.Error, KeyError, ValueError) as exc:
        database_error(exc)


@app.post("/rooms", status_code=status.HTTP_201_CREATED)
def create_room(room: RoomCreate):
    try:
        with get_connection() as conn:
            return conn.execute(
                """
                INSERT INTO rooms (
                    nombre, edificio, capacidad, equipamiento
                )
                VALUES (%s, %s, %s, %s)
                RETURNING id, nombre, edificio, capacidad, equipamiento
                """,
                (
                    room.nombre,
                    room.edificio,
                    room.capacidad,
                    room.equipamiento,
                ),
            ).fetchone()
    except (psycopg.Error, KeyError, ValueError) as exc:
        database_error(exc)


@app.delete("/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(room_id: int):
    try:
        with get_connection() as conn:
            deleted = conn.execute(
                "DELETE FROM rooms WHERE id = %s RETURNING id",
                (room_id,),
            ).fetchone()

        if deleted is None:
            raise HTTPException(
                status_code=404,
                detail="Aula no encontrada.",
            )

        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except psycopg.errors.ForeignKeyViolation as exc:
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar un aula que tiene reservas.",
        ) from exc
    except (psycopg.Error, KeyError, ValueError) as exc:
        database_error(exc)


@app.get("/bookings")
def get_bookings():
    try:
        with get_connection() as conn:
            return conn.execute(
                """
                SELECT id, aula_id, usuario, fecha, hora_inicio, hora_fin
                FROM bookings
                ORDER BY fecha, hora_inicio, id
                """
            ).fetchall()
    except (psycopg.Error, KeyError, ValueError) as exc:
        database_error(exc)


@app.post("/bookings", status_code=status.HTTP_201_CREATED)
def create_booking(booking: BookingCreate):
    try:
        with get_connection() as conn:
            return conn.execute(
                """
                INSERT INTO bookings (
                    aula_id, usuario, fecha, hora_inicio, hora_fin
                )
                VALUES (%s, %s, %s, %s, %s)
                RETURNING
                    id, aula_id, usuario, fecha, hora_inicio, hora_fin
                """,
                (
                    booking.aula_id,
                    booking.usuario,
                    booking.fecha,
                    booking.hora_inicio,
                    booking.hora_fin,
                ),
            ).fetchone()
    except psycopg.errors.ForeignKeyViolation as exc:
        raise HTTPException(
            status_code=404,
            detail="El aula indicada no existe.",
        ) from exc
    except (psycopg.Error, KeyError, ValueError) as exc:
        database_error(exc)


@app.delete("/bookings/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking(booking_id: int):
    try:
        with get_connection() as conn:
            deleted = conn.execute(
                "DELETE FROM bookings WHERE id = %s RETURNING id",
                (booking_id,),
            ).fetchone()

        if deleted is None:
            raise HTTPException(
                status_code=404,
                detail="Reserva no encontrada.",
            )

        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except (psycopg.Error, KeyError, ValueError) as exc:
        database_error(exc)
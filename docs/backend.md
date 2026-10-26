# Backend y base de datos de SmartCampus

## Tecnologías

- Python 3.11.
- FastAPI y Uvicorn.
- Psycopg para conectar con PostgreSQL.
- PostgreSQL 17.
- Docker.

## Archivos

- backend/app/main.py: endpoints, validación y consultas SQL.
- backend/requirements.txt: dependencias de Python.
- backend/Dockerfile: construcción de la imagen.
- backend/.dockerignore: exclusiones del contexto de construcción.
- database/init.sql: tablas y datos iniciales.
- .env.example: ejemplo de configuración sin credenciales reales.

## Configuración local

Desde PowerShell, en la raíz del repositorio:

```powershell
Copy-Item .env.example .env
```

Si ya existe .env, conservarlo y revisar su contenido.

Editar .env y sustituir los dos valores CAMBIAR_PASSWORD por
la misma contraseña local.

No subir .env a GitHub.

## Construcción del backend

```powershell
docker build -t smartcampus-backend:1.0 ./backend
```

## Ejecución independiente para pruebas

Los siguientes comandos se utilizan cuando todavía no existen
la red, el volumen ni los contenedores de prueba.

```powershell
docker network create smartcampus-net
docker volume create smartcampus-db-data
```

Arrancar PostgreSQL desde la raíz del repositorio:

```powershell
docker run -d --name database --network smartcampus-net --env-file .env --mount "type=volume,source=smartcampus-db-data,target=/var/lib/postgresql/data" --mount "type=bind,source=$($PWD.Path)\database\init.sql,target=/docker-entrypoint-initdb.d/init.sql,readonly" postgres:17
```

Comprobar que acepta conexiones:

```powershell
docker exec database pg_isready -U smartcampus -d smartcampus
```

Arrancar el backend:

```powershell
docker run -d --name smartcampus-backend-test --network smartcampus-net -p 8000:8000 --env-file .env smartcampus-backend:1.0
```

## Endpoints

| Método | Ruta | Función |
|---|---|---|
| GET | /health | Comprueba que responde la API y muestra APP_ENV |
| GET | /ready | Comprueba la conexión con PostgreSQL |
| GET | /rooms | Lista las aulas |
| GET | /rooms/{id} | Consulta un aula |
| POST | /rooms | Crea un aula |
| DELETE | /rooms/{id} | Elimina un aula sin reservas |
| GET | /bookings | Lista las reservas |
| POST | /bookings | Crea una reserva |
| DELETE | /bookings/{id} | Elimina una reserva |

Documentación interactiva: http://localhost:8000/docs

Las respuestas de las listas son arrays JSON directamente,
sin un objeto contenedor.

La creación devuelve 201 y el objeto creado.
La eliminación correcta devuelve 204 sin contenido.
Un recurso inexistente devuelve 404.
Eliminar un aula con reservas devuelve 409.
Los datos de entrada no válidos devuelven 422.

El prototipo valida que la hora de fin sea posterior a la de inicio.
Todavía no implementa control de reservas solapadas ni autenticación.

## Base de datos

rooms:
- id
- nombre
- edificio
- capacidad
- equipamiento: array de textos

bookings:
- id
- aula_id: referencia a rooms
- usuario
- fecha
- hora_inicio
- hora_fin

init.sql crea inicialmente tres aulas y dos reservas.

El script se ejecuta automáticamente solo cuando PostgreSQL
inicializa un directorio de datos vacío. No se vuelve a ejecutar
al reiniciar un contenedor con un volumen ya inicializado.

Modificar la contraseña en .env no cambia automáticamente
la contraseña de una base de datos ya inicializada.

## Integración con Docker Compose

- El backend escucha en el puerto 8000.
- El contexto de construcción es ./backend.
- Si el servicio PostgreSQL se llama database, DB_HOST será database.
- PostgreSQL debe tener un volumen para conservar los datos.
- Montar database/init.sql en /docker-entrypoint-initdb.d/init.sql.
- Comprobar que PostgreSQL está listo antes de probar las consultas.

## Integración con el frontend

El frontend puede usar rutas relativas como /api/rooms si su
servidor configura un proxy que envíe /api/rooms a /rooms del backend.

Este enfoque permite que el navegador acceda al mismo origen
y que el servidor del frontend resuelva los nombres internos
de Docker o Kubernetes.

No utilizar nombres internos como database o backend-service
como direcciones accesibles directamente desde el navegador.

## Integración con Kubernetes

- Imagen del backend: smartcampus-backend:1.0.
- Puerto del contenedor: 8000.
- DB_HOST: database-service, si ese es el nombre del Service.
- DB_NAME y APP_ENV pueden proceder de un ConfigMap.
- DB_USER y DB_PASSWORD deben proceder de un Secret.
- /health puede utilizarse para comprobar la actividad.
- /ready puede utilizarse para comprobar la disponibilidad.
- La base de datos necesita almacenamiento persistente.

## Pruebas realizadas

- Construcción correcta de la imagen del backend.
- Respuesta 200 de /health.
- Respuesta 200 de /ready con database: connected.
- Consulta de aulas y reservas.
- Creación de un aula mediante POST /rooms.
- Conservación del aula después de reiniciar PostgreSQL y el backend.

Estas pruebas corresponden a contenedores ejecutados directamente.
Las pruebas de Docker Compose y Kubernetes se documentarán
cuando se realicen esos despliegues.
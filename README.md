# SmartCampus Solutions

Aplicación de gestión de aulas y reservas universitarias desplegada
con Docker Compose y Kubernetes.

## Integrantes

- Jaime Nicolás Mas
- Jaime Moraleda
- Mario González

## Tecnologías

- Frontend: HTML, CSS y JavaScript con Nginx.
- Backend: Python y FastAPI.
- Base de datos: PostgreSQL 17.
- Despliegue: Docker Compose y Kubernetes con Minikube.

## Funcionalidades

Consulta de aulas y reservas, creación y eliminación de reservas
desde la web y gestión de aulas mediante la API.

El prototipo no incluye autenticación ni control de reservas solapadas.

## Ejecutar con Docker Compose

Con Docker Desktop funcionando, ejecutar desde la raíz del proyecto:

```powershell
Copy-Item .env.example .env
```

Editar `.env` y sustituir ambos valores `CAMBIAR_PASSWORD`
por la misma contraseña local. No subir `.env` a GitHub.

```powershell
docker compose up -d --build
docker compose ps
```

- Aplicación: http://localhost:8080
- Documentación de la API: http://localhost:8000/docs
- Estado del backend: http://localhost:8000/health
- Conexión con PostgreSQL: http://localhost:8000/ready

Para detener los servicios conservando los datos:

```powershell
docker compose down
```

La opción `down -v` elimina también el volumen y sus datos.

## Ejecutar con Kubernetes

Se necesitan Docker Desktop, Minikube y kubectl.

El despliegue utiliza dos réplicas del backend, una del frontend
y PostgreSQL mediante un StatefulSet con almacenamiento persistente.
La comunicación se realiza mediante Services y la configuración
se separa en ConfigMap y Secret.

Las instrucciones completas están en
[docs/kubernetes.md](docs/kubernetes.md).

## Documentación

- [Backend y base de datos](docs/backend.md)
- [Despliegue y pruebas de Kubernetes](docs/kubernetes.md)
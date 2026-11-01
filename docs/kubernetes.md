# Despliegue de SmartCampus en Kubernetes

## Requisitos

- Docker Desktop funcionando con contenedores Linux.
- Minikube.
- kubectl.
- Git.
- Ejecutar los comandos desde la raíz del repositorio.
- Los comandos están preparados para PowerShell.

## 1. Arrancar el clúster

```powershell
minikube start -p smartcampus --driver=docker --cpus=2 --memory=2200 --kubernetes-version=v1.35.0
kubectl --context=smartcampus get nodes
```

## 2. Construir y cargar las imágenes

```powershell
docker build -t smartcampus-backend:1.0 ./backend
docker build -t smartcampus-frontend:1.0 ./frontend
minikube image load smartcampus-backend:1.0 -p smartcampus
minikube image load smartcampus-frontend:1.0 -p smartcampus
```

Los Deployments utilizan imagePullPolicy: IfNotPresent para
aprovechar las imágenes cargadas en Minikube.

## 3. Crear el Namespace y las credenciales

```powershell
kubectl --context=smartcampus apply -f k8s/namespace.yaml
```

Crear el Secret sustituyendo ELEGIR_PASSWORD_LOCAL por una
contraseña para este entorno:

```powershell
kubectl --context=smartcampus -n smartcampus create secret generic database-secret --from-literal=DB_USER=smartcampus --from-literal=DB_PASSWORD=ELEGIR_PASSWORD_LOCAL
```

Este comando se ejecuta una vez en un entorno nuevo.
No se guarda un manifiesto con las credenciales en Git.

Los Secrets separan las credenciales de la configuración general,
pero no son un gestor especializado de secretos. Base64 no es
cifrado. Se necesitan controles de acceso y, en producción,
cifrado en reposo y una gestión adecuada de credenciales.

Modificar el Secret no cambia automáticamente la contraseña
de una base de datos ya inicializada.

## 4. Desplegar los recursos

```powershell
kubectl --context=smartcampus apply -f k8s/
kubectl --context=smartcampus -n smartcampus rollout status statefulset/database --timeout=300s
kubectl --context=smartcampus -n smartcampus rollout status deployment/backend --timeout=180s
kubectl --context=smartcampus -n smartcampus rollout status deployment/frontend --timeout=180s
```

El manifiesto database-init-configmap.yaml contiene el SQL inicial.
PostgreSQL lo ejecuta únicamente al inicializar un volumen vacío.

Si se modifica database/init.sql, regenerar el manifiesto:

```powershell
kubectl --context=smartcampus -n smartcampus create configmap database-init --from-file=init.sql=database/init.sql --dry-run=client -o yaml | Out-File -Encoding utf8 k8s/database-init-configmap.yaml
```

Actualizar este ConfigMap no vuelve a ejecutar el SQL sobre una
base de datos ya inicializada.

## 5. Arquitectura

Navegador → frontend-service → frontend Nginx
→ backend-service → backend → database-service → PostgreSQL.

- Frontend: Deployment con una réplica.
- Backend: Deployment con dos réplicas.
- PostgreSQL: StatefulSet con una réplica.
- ConfigMap: configuración no sensible.
- Secret: usuario y contraseña.
- PVC: almacenamiento persistente de PostgreSQL.
- NodePort: exposición del frontend.
- Services: descubrimiento y acceso a los componentes.

El navegador utiliza /api/. Nginx envía esas peticiones al Service
interno del backend y elimina el prefijo /api/.

## 6. Justificación del StatefulSet

PostgreSQL necesita conservar sus datos y una identidad estable.
El StatefulSet proporciona un nombre estable al Pod y asocia
su almacenamiento mediante volumeClaimTemplates.

El PVC se conserva al eliminar un Pod y puede reutilizarse
cuando se crea su sustituto.

Esta configuración tiene una sola instancia de PostgreSQL:
no proporciona replicación ni alta disponibilidad de la base de datos.

El backend no guarda estado local y utiliza un Deployment,
lo que permite ejecutar varias réplicas intercambiables.

## 7. Comprobar el despliegue

```powershell
kubectl --context=smartcampus -n smartcampus get pods
kubectl --context=smartcampus -n smartcampus get services
kubectl --context=smartcampus -n smartcampus get deployments
kubectl --context=smartcampus -n smartcampus get statefulsets,pvc
```

Comprobar los datos iniciales:

```powershell
kubectl --context=smartcampus -n smartcampus exec database-0 -- psql -U smartcampus -d smartcampus -c "SELECT id, nombre, capacidad FROM rooms;"
```

Abrir la aplicación:

```powershell
minikube service frontend-service -n smartcampus -p smartcampus
```

Mantener esta terminal abierta si Minikube utiliza un túnel.
Utilizar otra terminal para los demás comandos.

## 8. Escalado

```powershell
kubectl --context=smartcampus -n smartcampus scale deployment backend --replicas=4
kubectl --context=smartcampus -n smartcampus rollout status deployment/backend --timeout=180s
kubectl --context=smartcampus -n smartcampus get pods -l app=backend
```

Volver a dos réplicas:

```powershell
kubectl --context=smartcampus -n smartcampus scale deployment backend --replicas=2
```

El escalado por comando modifica el estado del clúster.
Aplicar de nuevo el manifiesto con replicas: 2 restablece ese valor.

## 9. Recuperación automática

```powershell
$podEliminar = kubectl --context=smartcampus -n smartcampus get pods -l app=backend -o jsonpath='{.items[0].metadata.name}'
Write-Output $podEliminar
kubectl --context=smartcampus -n smartcampus delete pod $podEliminar
kubectl --context=smartcampus -n smartcampus get pods -l app=backend -w
```

Pulsar Ctrl + C al terminar la observación.

El ReplicaSet gestionado por el Deployment crea un Pod sustituto
para mantener las dos réplicas deseadas. El nuevo Pod tiene
un nombre distinto.

## 10. Cambio del ConfigMap

El backend consume APP_ENV como variable de entorno.
El valor se puede consultar mediante /health:

```powershell
kubectl --context=smartcampus -n smartcampus port-forward service/backend-service 8001:8000
```

Abrir http://localhost:8001/health.

En otra terminal, después de modificar APP_ENV en
k8s/configmap.yaml:

```powershell
kubectl --context=smartcampus apply -f k8s/configmap.yaml
```

Los Pods existentes conservan su variable de entorno anterior.
Para que los nuevos Pods reciban el cambio:

```powershell
kubectl --context=smartcampus -n smartcampus rollout restart deployment/backend
kubectl --context=smartcampus -n smartcampus rollout status deployment/backend --timeout=180s
```

Si el port-forward termina al sustituirse el Pod, ejecutarlo otra vez.

Durante la prueba se cambió APP_ENV de kubernetes a
kubernetes-pruebas. El manifiesto final conserva kubernetes-pruebas.

## 11. Diagnóstico

```powershell
kubectl --context=smartcampus -n smartcampus get events --sort-by=.metadata.creationTimestamp
kubectl --context=smartcampus -n smartcampus logs deployment/backend
kubectl --context=smartcampus -n smartcampus logs deployment/frontend
kubectl --context=smartcampus -n smartcampus logs database-0
kubectl --context=smartcampus -n smartcampus describe pod database-0
```

Incidencia encontrada: se indicó smartcampus+ como perfil al
cargar una imagen. Minikube informó de que el perfil no existía.
Se corrigió el comando utilizando el nombre smartcampus.

## 12. Detener el entorno

```powershell
minikube stop -p smartcampus
```

Detener el clúster permite conservarlo para continuar las pruebas.
No eliminar el clúster ni el PVC si se quieren conservar los datos.
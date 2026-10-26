CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    edificio VARCHAR(100) NOT NULL,
    capacidad INTEGER NOT NULL CHECK (capacidad > 0),
    equipamiento TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    aula_id INTEGER NOT NULL REFERENCES rooms(id),
    usuario VARCHAR(120) NOT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    CONSTRAINT horario_valido CHECK (hora_fin > hora_inicio)
);

INSERT INTO rooms (nombre, edificio, capacidad, equipamiento)
VALUES
    (
        'Laboratorio de Robótica',
        'Edificio A',
        30,
        ARRAY['ordenadores', 'robots', 'impresora 3D']
    ),
    (
        'Aula de Informática',
        'Edificio B',
        25,
        ARRAY['ordenadores', 'proyector']
    ),
    (
        'Sala de Estudio',
        'Biblioteca',
        12,
        ARRAY['pizarra', 'enchufes']
    );

INSERT INTO bookings (aula_id, usuario, fecha, hora_inicio, hora_fin)
VALUES
    (1, 'Jaime', CURRENT_DATE, '09:00', '10:30'),
    (2, 'Equipo SmartCampus', CURRENT_DATE, '12:00', '13:00');
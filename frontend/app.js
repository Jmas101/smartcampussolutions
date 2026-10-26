"use strict";

const statusMessage = document.querySelector("#status");
const refreshButton = document.querySelector("#refresh-button");
const roomsList = document.querySelector("#rooms-list");
const roomsCount = document.querySelector("#rooms-count");
const bookingsList = document.querySelector("#bookings-list");
const bookingsCount = document.querySelector("#bookings-count");
const bookingsEmpty = document.querySelector("#bookings-empty");
const bookingForm = document.querySelector("#booking-form");
const roomSelect = document.querySelector("#aula_id");
const submitButton = document.querySelector("#submit-button");
const formMessage = document.querySelector("#form-message");

let rooms = [];
let loading = false;

// Todas las peticiones pasan por Nginx mediante /api/.
async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...options.headers,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    let message = `Error HTTP ${response.status}.`;

    try {
      const data = await response.json();

      if (typeof data.detail === "string") {
        message = data.detail;
      } else if (Array.isArray(data.detail)) {
        message = data.detail
          .map((error) => {
            const field = error.loc?.slice(1).join(".") || "Datos";
            return `${field}: ${error.msg}`;
          })
          .join(" ");
      }
    } catch {
      // Se conserva el mensaje HTTP si no hay una respuesta JSON.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function showMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.remove("success", "error");

  if (message) {
    element.classList.add(isError ? "error" : "success");
  }
}

function addTextElement(parent, tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text;

  if (className) {
    element.className = className;
  }

  parent.append(element);
  return element;
}

function renderRooms() {
  roomsList.replaceChildren();
  roomsCount.textContent = `${rooms.length} aulas`;

  const previousSelection = roomSelect.value;
  roomSelect.replaceChildren(new Option("Selecciona un aula", ""));

  if (rooms.length === 0) {
    addTextElement(
      roomsList,
      "p",
      "No hay aulas registradas.",
      "muted"
    );
  }

  for (const room of rooms) {
    const card = document.createElement("article");
    card.className = "room-card";

    addTextElement(card, "h3", room.nombre);
    addTextElement(card, "p", room.edificio, "muted");
    addTextElement(card, "p", `Capacidad: ${room.capacidad} personas`);

    const equipmentList = document.createElement("ul");

    for (const equipment of room.equipamiento) {
      addTextElement(equipmentList, "li", equipment);
    }

    card.append(equipmentList);
    roomsList.append(card);

    roomSelect.add(new Option(room.nombre, String(room.id)));
  }

  if (rooms.some((room) => String(room.id) === previousSelection)) {
    roomSelect.value = previousSelection;
  }
}

function formatDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function renderBookings(bookings) {
  bookingsList.replaceChildren();
  bookingsCount.textContent = `${bookings.length} reservas`;
  bookingsEmpty.hidden = bookings.length !== 0;

  for (const booking of bookings) {
    const room = rooms.find((item) => item.id === booking.aula_id);
    const row = document.createElement("tr");

    addTextElement(
      row,
      "td",
      room ? room.nombre : `Aula ${booking.aula_id}`
    );
    addTextElement(row, "td", booking.usuario);
    addTextElement(row, "td", formatDate(booking.fecha));
    addTextElement(
      row,
      "td",
      `${booking.hora_inicio.slice(0, 5)} – ${booking.hora_fin.slice(0, 5)}`
    );

    const actions = document.createElement("td");
    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "Eliminar";
    deleteButton.setAttribute(
      "aria-label",
      `Eliminar reserva ${booking.id} de ${booking.usuario}`
    );

    deleteButton.addEventListener("click", () => {
      deleteBooking(booking.id, deleteButton);
    });

    actions.append(deleteButton);
    row.append(actions);
    bookingsList.append(row);
  }
}

async function loadData() {
  if (loading) {
    return false;
  }

  loading = true;
  refreshButton.disabled = true;
  statusMessage.classList.remove("success", "error");
  statusMessage.textContent = "Actualizando datos…";

  try {
    const [newRooms, bookings] = await Promise.all([
      request("/rooms"),
      request("/bookings"),
    ]);

    rooms = newRooms;
    renderRooms();
    renderBookings(bookings);

    showMessage(
      statusMessage,
      `API conectada · Actualizado a las ${new Date().toLocaleTimeString("es-ES")}`
    );

    return true;
  } catch (error) {
    showMessage(
      statusMessage,
      `No se pudieron actualizar los datos. ${error.message} Si había datos, corresponden a la última carga correcta.`,
      true
    );

    return false;
  } finally {
    loading = false;
    refreshButton.disabled = false;
  }
}

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!bookingForm.reportValidity()) {
    return;
  }

  const data = new FormData(bookingForm);
  const usuario = String(data.get("usuario")).trim();
  const horaInicio = String(data.get("hora_inicio"));
  const horaFin = String(data.get("hora_fin"));

  if (!usuario) {
    showMessage(formMessage, "Introduce un nombre de usuario.", true);
    document.querySelector("#usuario").focus();
    return;
  }

  if (horaFin <= horaInicio) {
    showMessage(
      formMessage,
      "La hora de fin debe ser posterior a la hora de inicio.",
      true
    );
    document.querySelector("#hora_fin").focus();
    return;
  }

  const booking = {
    aula_id: Number(data.get("aula_id")),
    usuario,
    fecha: String(data.get("fecha")),
    hora_inicio: horaInicio,
    hora_fin: horaFin,
  };

  submitButton.disabled = true;
  formMessage.textContent = "";

  try {
    await request("/bookings", {
      method: "POST",
      body: JSON.stringify(booking),
    });

    bookingForm.reset();
    showMessage(formMessage, "Reserva creada correctamente.");
    await loadData();
  } catch (error) {
    showMessage(
      formMessage,
      `No se ha podido confirmar la creación: ${error.message} Actualiza los datos antes de volver a intentarlo.`,
      true
    );
  } finally {
    submitButton.disabled = false;
  }
});

async function deleteBooking(id, button) {
  if (!window.confirm("¿Quieres eliminar esta reserva?")) {
    return;
  }

  button.disabled = true;

  try {
    await request(`/bookings/${id}`, {
      method: "DELETE",
    });

    showMessage(formMessage, "Reserva eliminada correctamente.");
    await loadData();
  } catch (error) {
    showMessage(
      formMessage,
      `No se ha podido confirmar la eliminación: ${error.message} Actualiza los datos para comprobar su estado.`,
      true
    );
  } finally {
    button.disabled = false;
  }
}

refreshButton.addEventListener("click", loadData);

loadData();
/**
 * chess.js — El mensajero entre React y el backend Python
 *
 * ¿Por qué este archivo existe?
 * React no puede hablar directamente con Stockfish. Necesita hacer
 * peticiones HTTP al servidor Python que levantaste con `python run.py`.
 *
 * axios es la librería que hace esas peticiones HTTP.
 * Es como hacer fetch() pero más cómodo y con manejo de errores mejor.
 *
 * baseURL: la dirección de tu servidor Python local.
 * Todas las funciones de abajo usan esta URL como base.
 */

import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000/api",
  timeout: 15000, // Si el servidor no responde en 15s, da error
});

// ─────────────────────────────────────────────────────
// Cada función de abajo representa un endpoint del backend.
// Cuando las llamas desde un componente React, le están
// preguntando algo al servidor Python.
// ─────────────────────────────────────────────────────

// Pregunta: "¿Estás vivo, servidor?"
export const checkHealth = () =>
  api.get("/health");

// Pregunta: "Dame el FEN inicial para empezar nueva partida"
export const newGame = () =>
  api.post("/new-game");

// Pregunta: "Dada esta posición FEN y este nivel, ¿qué mueve el bot?"
export const getBotMove = (fen, skillLevel = 10, timeLimit = 1.0) =>
  api.post("/move", {
    fen,
    skill_level: skillLevel,
    time_limit: timeLimit,
  });

// Pregunta: "Dame la mejor jugada como pista, sin ejecutarla"
export const getHint = (fen) =>
  api.post("/hint", { fen });

// Pregunta: "¿Cuánta ventaja tiene cada jugador en este FEN?"
export const evaluatePosition = (fen, depth = 12) =>
  api.post("/evaluate", { fen, depth });

// Pregunta: "¿Cuáles son las N mejores jugadas para esta posición?"
// Devuelve: [{ uci, san, from_square, to_square, score, piece, is_capture, is_check, fen_after }]
export const getTopMoves = (fen, count = 3, timeLimit = 1.5) =>
  api.post("/top-moves", { fen, count, time_limit: timeLimit });

// Pregunta: "Explícame esta jugada como un Gran Maestro"
// Devuelve: { titulo, razonamiento, amenaza, plan, consejo, clasificacion, eval_antes, eval_despues }
export const getCommentary = (fenAntes, fenDespues, moveSan, moveUci, color, esBot, skillLevel = 10) =>
  api.post("/commentary", {
    fen_antes:   fenAntes,
    fen_despues: fenDespues,
    move_san:    moveSan,
    move_uci:    moveUci,
    color,
    es_bot:      esBot,
    skill_level: skillLevel,
  });

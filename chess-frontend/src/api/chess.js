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
  // VITE_API_URL permite apuntar a otro puerto (ej. si el 8000 está ocupado):
  //   VITE_API_URL=http://localhost:8001/api npm run dev
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api",
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

// Pregunta: "Analiza esta jugada de una partida importada (Game Review)"
// evalBefore = eval_after de la respuesta anterior (cachear ahorra medio análisis)
// Devuelve: { san, classification, accuracy, eval_before, eval_after, cp_loss,
//             best_move_san, best_line_san, explicacion, ... }
export const analyzeMove = (fenBefore, moveUci, evalBefore = null, depth = 14) =>
  api.post("/analyze-move", {
    fen_before:  fenBefore,
    move_uci:    moveUci,
    eval_before: evalBefore,
    depth,
  }, { timeout: 60000 }); // el análisis profundo puede tardar más de 15s

// Pregunta: "¿Qué meses tienen partidas este usuario de chess.com?"
export const getChesscomArchives = (username) =>
  api.get(`/chesscom/${encodeURIComponent(username)}/archives`);

// Pregunta: "Dame las partidas de este usuario en este mes (con PGN)"
export const getChesscomGames = (username, year, month) =>
  api.get(`/chesscom/${encodeURIComponent(username)}/games/${year}/${month}`);

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

// ─────────────────────────────────────────────────────
// Historial de partidas — persiste en SQLite en el backend (sobrevive a
// reiniciar Docker gracias al volumen `games_data`, ver docker-compose.yml).
// ─────────────────────────────────────────────────────

// Pregunta: "Guarda esta partida terminada en mi historial"
// data = { player_color, skill_level, result, moves_san, white_accuracy?, black_accuracy?, opponent_label? }
// Devuelve: { id }
export const saveGame = (data) =>
  api.post("/games", data);

// Pregunta: "Dame la lista resumida de mis partidas guardadas"
// Devuelve: { games: [{ id, created_at, player_color, skill_level, result, ply_count, white_accuracy, black_accuracy, opponent_label }] }
export const listGames = () =>
  api.get("/games");

// Pregunta: "Dame la partida completa #id (con sus jugadas SAN)"
export const getGame = (id) =>
  api.get(`/games/${id}`);

// Pregunta: "Borra la partida #id de mi historial"
export const deleteGame = (id) =>
  api.delete(`/games/${id}`);

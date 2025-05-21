const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
app.use(cors());

const allowedOrigins = ["http://localhost:5173", "http://localhost:3000"];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

let players = []; // [{ id, symbol }]
let board = Array(9).fill(null);
let currentPlayer = 'X';

function checkWinner(board) {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
  ];
  for (const [a, b, c] of winPatterns) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]; // X or O
    }
  }
  return null;
}

function broadcastGameState() {
  io.emit('game-update', { board, currentPlayer });
}

function resetGame() {
  board = Array(9).fill(null);
  currentPlayer = 'X';
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  if (players.length < 2) {
    const symbol = players.length === 0 ? 'X' : 'O';
    players.push({ id: socket.id, symbol });
    socket.emit('player-assigned', symbol);

    if (players.length === 2) {
      broadcastGameState();
    } else {
      socket.emit('waiting', 'Waiting for opponent...');
    }
  } else {
    socket.emit('room-full');
    return;
  }

  socket.on('make-move', (index) => {
    const player = players.find(p => p.id === socket.id);
    if (!player || board[index] !== null || player.symbol !== currentPlayer) return;

    board[index] = currentPlayer;
    const winner = checkWinner(board);
    const isDraw = board.every(cell => cell !== null);

    if (winner) {
      broadcastGameState();
      io.emit('game-over', { winner });
      setTimeout(() => {
        resetGame();
        broadcastGameState();
      }, 3000);
    } else if (isDraw) {
      broadcastGameState();
      io.emit('game-over', { winner: 'Draw' });
      setTimeout(() => {
        resetGame();
        broadcastGameState();
      }, 3000);
    } else {
      currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
      broadcastGameState();
    }
  });

  socket.on('chat-message', (msg) => {
    io.emit('chat-message', { id: socket.id, msg });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    players = players.filter(p => p.id !== socket.id);
    resetGame();

    io.emit('player-disconnected');
    broadcastGameState();
  });
});

server.listen(4000, () => {
  console.log('Server listening on port 4000');
});

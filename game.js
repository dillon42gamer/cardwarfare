let ws;
let username = localStorage.getItem('username');
let deck = [];
let playerFarmland = [];
let playerTroops = [];
let playerPoints = 0;
let royalty = 0;
let scores = {};
let readyCount = 0;
let drawnCard;
let currentPhase = 'kingdom'; // Keep track of the current phase
let warCards = []; // Cards to be used in the war phase
let isReady = false; // Track if the player is ready for war
let boardSize = 8;

function startWebSocket() {
  ws = new WebSocket('ws://localhost:8080');

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'join', username }));
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    updateGameState(message);
  };

  ws.onclose = () => {
    console.log('WebSocket connection closed');
  };
}

function drawCard() {
  if (deck.length === 0) {
    alert('Deck is empty');
    endGame();
    return;
  }
  
  drawnCard = deck.pop();
  ws.send(JSON.stringify({ type: 'drawCard', username, card: drawnCard }));
  displayDrawnCard(drawnCard);
}

function displayDrawnCard(card) {
  document.getElementById('drawnCard').style.display = 'block';
  document.getElementById('cardValue').textContent = `You drew a ${card}`;
}

function placeFarmland() {
  if (playerFarmland.length < 10) { // Increased spots for cards
    playerFarmland.push(drawnCard);
    document.getElementById('drawnCard').style.display = 'none';
    calculatePoints();
  } else {
    alert('Farmland is full!');
  }
}

function placeTroop() {
  playerTroops.push(drawnCard);
  warCards.push(drawnCard); // Add card to warCards for use in the war phase
  document.getElementById('drawnCard').style.display = 'none';
  calculatePoints();
}

function calculatePoints() {
  let troopPoints = playerTroops.reduce((acc, card) => acc + cardValue(card), 0);
  let farmlandCapacity = playerFarmland.length * 15;
  
  if (troopPoints > farmlandCapacity) {
    alert('Too many troops for farmland capacity! Some troops will die.');
    playerTroops = playerTroops.slice(0, farmlandCapacity);
  }
  
  playerPoints = troopPoints + (royalty * royalty);
  scores[username] = playerPoints;
  updateScores();
  updatePopulationCount(troopPoints, farmlandCapacity);
  renderCards();
}

function cardValue(card) {
  if (card === 'A') return 14;
  if (['K', 'Q', 'J'].includes(card)) return 10;
  return parseInt(card);
}

function updateGameState(message) {
  if (message.type === 'drawCard' && message.username !== username) {
    handleDrawnCard(message.card);
  }
  if (message.type === 'startWar') {
    startWarPhase();
  }
  if (message.type === 'ready') {
    readyCount++;
    if (readyCount >= 2) {
      startWar();
    }
  }
}

function updateScores() {
  const scoresDiv = document.getElementById('scores');
  scoresDiv.innerHTML = '';
  for (const player in scores) {
    const scoreDiv = document.createElement('div');
    scoreDiv.textContent = `${player}: ${scores[player]}`;
    scoresDiv.appendChild(scoreDiv);
  }
}

function updatePopulationCount(troopPoints, farmlandCapacity) {
  const populationCount = document.getElementById('populationCount');
  populationCount.textContent = `${troopPoints}/${farmlandCapacity}`;
}

function renderCards() {
  const farmlandDiv = document.getElementById('farmlandSlots');
  const troopsDiv = document.getElementById('troopCards');
  
  farmlandDiv.innerHTML = '';
  troopsDiv.innerHTML = '';
  
  playerFarmland.forEach(card => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    cardDiv.textContent = card;
    farmlandDiv.appendChild(cardDiv);
  });

  playerTroops.forEach(card => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    cardDiv.textContent = card;
    troopsDiv.appendChild(cardDiv);
  });
}

function endGame() {
  const maxScorePlayer = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
  if (username === maxScorePlayer) {
    for (let i = 0; i < 5; i++) {
      const card = drawRandomCard();
      playerTroops.push(card);
      warCards.push(card); // Add card to warCards for use in the war phase
    }
  }
  ws.send(JSON.stringify({ type: 'startWar' }));
}

function drawRandomCard() {
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  return values[Math.floor(Math.random() * values.length)];
}

function startWarPhase() {
  document.getElementById('warPhase').style.display = 'block';
  setupChessboard();
}

function setupChessboard() {
  const chessboard = document.getElementById('chessboard');
  chessboard.innerHTML = '';
  
  for (let i = 0; i < boardSize; i++) {
    for (let j = 0; j < boardSize; j++) {
      const square = document.createElement('div');
      square.className = 'square';
      square.dataset.row = i;
      square.dataset.col = j;
      square.addEventListener('drop', drop);
      square.addEventListener('dragover', allowDrop);
      chessboard.appendChild(square);
    }
  }

  placeCardsOnBoard();
}

function placeCardsOnBoard() {
  const squares = document.getElementsByClassName('square');
  
  warCards.forEach((card, index) => {
    const square = squares[index];
    const cardDiv = document.createElement('img');
    cardDiv.src = username === 'player1' ? `${card}.png` : `${card}red.png`;
    cardDiv.className = username === 'player1' ? 'blue' : 'red';
    cardDiv.draggable = true;
    cardDiv.id = `card-${index}`; // Give each card a unique id
    cardDiv.dataset.value = cardValue(card); // Store the card's value
    cardDiv.dataset.player = username;
    cardDiv.addEventListener('dragstart', drag);
    square.appendChild(cardDiv);
  });
}

function allowDrop(event) {
  event.preventDefault();
}

function drag(event) {
  event.dataTransfer.setData('text', event.target.id);
}

function drop(event) {
  event.preventDefault();
  const cardId = event.dataTransfer.getData('text');
  const card = document.getElementById(cardId);
  const targetSquare = event.target;

  // Check if move is valid
  if (isMoveValid(card, targetSquare)) {
    // Check if there's already a card in the target square
    if (targetSquare.firstChild) {
      const targetCard = targetSquare.firstChild;
      const sourceValue = parseInt(card.dataset.value);
      const targetValue = parseInt(targetCard.dataset.value);
      
      // Only allow capture if the source card value is higher or equal
      if (sourceValue >= targetValue) {
        targetSquare.removeChild(targetCard);
        targetSquare.appendChild(card);
        if (sourceValue == targetValue) {
          warCards.push(targetCard.dataset.value); // Capture both cards
        }
      }
    } else {
      targetSquare.appendChild(card);
    }
  }
}

function isMoveValid(card, targetSquare) {
  const sourceSquare = card.parentElement;
  const sourceRow = parseInt(sourceSquare.dataset.row);
  const sourceCol = parseInt(sourceSquare.dataset.col);
  const targetRow = parseInt(targetSquare.dataset.row);
  const targetCol = parseInt(targetSquare.dataset.col);

  // Check if players can move anywhere within the first 3 rows initially
  if (!isReady) {
    if (card.dataset.player === 'player1' && sourceRow >= 0 && sourceRow <= 2 && targetRow >= 0 && targetRow <= 2) {
      return true;
    }
    if (card.dataset.player === 'player2' && sourceRow >= 5 && sourceRow <= 7 && targetRow >= 5 && targetRow <= 7) {
      return true;
    }
  } else {
    // Restrict movement to straight horizontal or vertical lines
    const isSameRow = sourceRow === targetRow;
    const isSameCol = sourceCol === targetCol;
    const isEmptyPath = isStraightPathClear(sourceRow, sourceCol, targetRow, targetCol);

    return (isSameRow || isSameCol) && isEmptyPath;
  }

  return false;
}

function isStraightPathClear(sourceRow, sourceCol, targetRow, targetCol) {
  const squares = document.getElementsByClassName('square');
  if (sourceRow === targetRow) {
    // Horizontal movement
    const startCol = Math

.min(sourceCol, targetCol);
    const endCol = Math.max(sourceCol, targetCol);
    for (let col = startCol + 1; col < endCol; col++) {
      if (squares[sourceRow * boardSize + col].firstChild) {
        return false;
      }
    }
  } else if (sourceCol === targetCol) {
    // Vertical movement
    const startRow = Math.min(sourceRow, targetRow);
    const endRow = Math.max(sourceRow, targetRow);
    for (let row = startRow + 1; row < endRow; row++) {
      if (squares[row * boardSize + sourceCol].firstChild) {
        return false;
      }
    }
  }
  return true;
}

function readyForWar() {
  isReady = true;
  ws.send(JSON.stringify({ type: 'ready', username }));
}

function startWar() {
  currentPhase = 'war'; // Update the current phase
  // Players can now move their pieces around
}

// Simulate deck creation for demo purposes
function createDeck() {
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  deck = [];
  for (let i = 0; i < 4; i++) {
    values.forEach(value => {
      deck.push(value);
    });
  }
  deck = shuffle(deck);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Initialize the game
createDeck();
startWebSocket();
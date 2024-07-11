const CARD_WIDTH = 360;
const CARD_HEIGHT = 540;
const CARD_CORNER_RADIUS = 30;
const CARD_ASPECT_RATIO = CARD_WIDTH / CARD_HEIGHT;

const CARD_PILE_SPACING = 0.025;
const CARD_PILE_FAN = 0.025;
const CARD_RELATIVE_HEIGHT = (1 - CARD_PILE_SPACING * 5) / 4;
const CARD_RELATIVE_WIDTH = CARD_RELATIVE_HEIGHT * CARD_ASPECT_RATIO;

const SUIT_SPADES = 0;
const SUIT_HEARTS = 1;
const SUIT_DIAMONDS = 2;
const SUIT_CLUBS = 3;
const CARD_TYPES = ["ace", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "jack", "queen", "king"];

var backCanvas, frontCanvas;
var backContext, frontContext;
var playingCards = [];
var gameLayout = [
    [[], [], [], [], [], []],
    [[], [], [], [], [], []],
    [[], [], [], [], [], []],
    [[], [], [], [], [], []]
];

var pileSpacing, cellPadding, pileFan, holdPileFan, totalFanOffset;
var layoutLeftX, layoutTopY;
var cardWidth, cardHeight, cardCornerRadius;
var cardCenterX, cardCenterY;
var cardOffsetX, cardOffsetY;
var startOffsetX, startOffsetY;
var activeCard = null;
var returnPileX, returnPileY;
var activeCardAnimating = false;

window.onerror = function(...args) {
    alert(JSON.stringify(args));
};

Array.prototype.shuffle = function() {
    var i = this.length;
    while (i > 0) {
        var j = Math.floor(Math.random() * i--);
        [this[i], this[j]] = [this[j], this[i]];
    }
};

class Card {
    constructor(x, y, value, suit, bitmap) {
        this.x = x;
        this.y = y;
        this.returnX = x;
        this.returnY = y;
        this.value = value;
        this.suit = suit;
        this.bitmap = bitmap;
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    savePosition() {
        this.returnX = this.x;
        this.returnY = this.y;
    }

    draw(context) {
        context.shadowBlur = 10;
        context.shadowColor = "rgba(0, 0, 0, 10%)";
        context.drawImage(this.bitmap, this.x, this.y, cardWidth, cardHeight);
    }
}

function drawLayout() {
    backContext.clearRect(0, 0, backCanvas.width, backCanvas.height);

    // Outline the finish piles
    backContext.beginPath();
    var finishX = startOffsetX + cardOffsetX - cellPadding;
    var finishY = startOffsetY - cellPadding;
    backContext.roundRect(finishX, finishY, cardOffsetX * 4, cardOffsetY, cardCornerRadius);
    backContext.strokeStyle = "red";
    backContext.lineWidth = 2;
    backContext.stroke();

    // Outline the holes
    backContext.beginPath();
    var holeX = startOffsetX + cardOffsetX * 2 - cellPadding;
    var holeY = startOffsetY + cardOffsetY * 3 - cellPadding;
    backContext.roundRect(holeX, holeY, cardOffsetX * 2, cardOffsetY, cardCornerRadius);
    backContext.strokeStyle = "orange";
    backContext.lineWidth = 2;
    backContext.stroke();

    // Draw the cards
    for (var i = 0, offsetY = startOffsetY; i < gameLayout.length; i++, offsetY += cardOffsetY) {
        var row = gameLayout[i];
        var fanIncrement = i == 0 ? holdPileFan : pileFan;
        for (var j = 0, offsetX = startOffsetX; j < row.length; j++, offsetX += cardOffsetX) {
            if (i > 0 || (j > 0 && j < 5)) {
                // Shade the area the pile occupies
                backContext.beginPath();
                backContext.roundRect(offsetX, offsetY, cardOffsetX - pileSpacing, cardHeight, cardCornerRadius);
                backContext.fillStyle = "rgba(0, 0, 0, 40%)";
                backContext.fill();
            }

            var pile = row[j];
            for (var k = 0, fanX = offsetX; k < pile.length; k++, fanX += fanIncrement) {
                var card = pile[k];
                card.setPosition(fanX, offsetY);
                card.draw(backContext);
            }
        }
    }
}

function drawActiveCard() {
    frontContext.clearRect(0, 0, frontCanvas.width, frontCanvas.height);
    if (activeCard) activeCard.draw(frontContext);
}

function placeActiveCard(x, y) {
    if (y == 0 && (x == 0 || x == gameLayout[0].length - 1)) {
        throw "Not a pile";
    }

    /// Check rules
    // - Black on red or red on black?
    // - Only lower?

    gameLayout[y][x].push(activeCard);
    activeCard = null;
}

function returnActiveCard() {
    const TIMER_MAX = 200;
    const TIMER_STEP = 10;

    // Set the timer and calculate the x and y increments
    var animationTimer = TIMER_MAX;
    var deltaX = (activeCard.returnX - activeCard.x) * TIMER_STEP / TIMER_MAX;
    var deltaY = (activeCard.returnY - activeCard.y) * TIMER_STEP / TIMER_MAX;

    var animate = function() {
        // Increment the position
        activeCard.x += deltaX;
        activeCard.y += deltaY;

        // Refresh and decrement the timer
        requestAnimationFrame(drawActiveCard);
        animationTimer -= TIMER_STEP;

        if (animationTimer >= 0) {
            // Request the next frame if the timer has not run out
            requestAnimationFrame(animate);
        } else {
            // Place the card, refresh, and stop animating
            placeActiveCard(returnPileX, returnPileY);
            requestAnimationFrame(drawLayout);
            activeCardAnimating = false;
        }
    };

    // Start animating
    activeCardAnimating = true;
    requestAnimationFrame(animate);
}

// This function calculates a bunch of measurements for the layout
// Everything is calculated relative to the window height
function resizeGraphics(width, height) {
    backCanvas.width = width;
    backCanvas.height = height;
    frontCanvas.width = width;
    frontCanvas.height = height;

    cardWidth = height * CARD_RELATIVE_WIDTH;
    cardHeight = height * CARD_RELATIVE_HEIGHT;
    cardCenterX = cardWidth / 2;
    cardCenterY = cardHeight / 2;
    cardCornerRadius = CARD_CORNER_RADIUS / CARD_HEIGHT * cardHeight;

    pileSpacing = height * CARD_PILE_SPACING;
    pileFan = height * CARD_PILE_FAN;
    totalFanOffset = pileFan * 2;
    cellPadding = pileSpacing / 2;
    holdPileFan = totalFanOffset / (CARD_TYPES.length - 1);

    cardOffsetX = cardWidth + totalFanOffset + pileSpacing;
    cardOffsetY = cardHeight + pileSpacing;
    layoutLeftX = (width - cardOffsetX * gameLayout[0].length) / 2;
    layoutTopY = (height - cardOffsetY * gameLayout.length) / 2;
    startOffsetX = layoutLeftX + cellPadding;
    startOffsetY = layoutTopY + cellPadding;

    requestAnimationFrame(drawLayout);
    requestAnimationFrame(drawActiveCard);
}

window.addEventListener("load", async function(event) {
    // Create a sprite for each card
    // Corresponding sections of the spritesheet are rendered to bitmaps to boost performance
    var cardSpriteSheet = document.querySelector("#deck");
    var maxCardWidth = Math.floor(screen.height * CARD_RELATIVE_WIDTH);
    var maxCardHeight = Math.floor(screen.height * CARD_RELATIVE_HEIGHT);
    for (var value = 0, sourceX = 0; value < CARD_TYPES.length; value++, sourceX += CARD_WIDTH) {
        for (var suit = SUIT_SPADES, sourceY = 0; suit <= SUIT_CLUBS; suit++, sourceY += CARD_HEIGHT) {
            playingCards.push(new Card(
                0, 0,
                value, suit,
                await createImageBitmap(
                    cardSpriteSheet,
                    sourceX, sourceY,
                    CARD_WIDTH, CARD_HEIGHT, {
                        resizeWidth: maxCardWidth,
                        resizeHeight: maxCardHeight
                    }
                )
            ));
        }
    }

    // Randomly sort the cards into the game layout
    playingCards.shuffle();
    for (var i = 1; i < gameLayout.length; i++) {
        var row = gameLayout[i];
        for (var j = 0; j < row.length; j++) {
            var pile = row[j];
            if (i < 3 || (j < 2 || j > 3)) {
                pile.push(playingCards.pop());
                pile.push(playingCards.pop());
                pile.push(playingCards.pop());
            } else {
                pile.push(playingCards.pop());
                pile.push(playingCards.pop());
            }
        }
    }

    // The back canvas holds the static game layout
    // The front canvas is where dynamic elements are drawn
    // This reduces the amount of drawing that has to be done each frame
    backCanvas = document.querySelector("canvas#back");
    frontCanvas = document.querySelector("canvas#front");
    backContext = backCanvas.getContext("2d");
    frontContext = frontCanvas.getContext("2d");

    resizeGraphics(window.innerWidth, window.innerHeight);
    window.addEventListener("resize", function(event) {
        resizeGraphics(window.innerWidth, window.innerHeight);
    });

    window.addEventListener("mousedown", function(event) {
        if (!activeCard) { // This should always be true, unless someone has insane reflexes!
            var pileX = Math.floor((event.clientX - layoutLeftX) / cardOffsetX);
            var pileY = Math.floor((event.clientY - layoutTopY) / cardOffsetY);
            if (pileX >= 0 && pileX < gameLayout[0].length && pileY >= 0 && pileY < gameLayout.length) {
                var pile = gameLayout[pileY][pileX];
                if (pile.length > 0) {
                    // Pick up the top of the selected pile
                    activeCard = pile.pop();
                    activeCard.savePosition();
                    activeCard.setPosition(event.clientX - cardCenterX, event.clientY - cardCenterY);
                    returnPileX = pileX;
                    returnPileY = pileY;
                    requestAnimationFrame(drawLayout);
                    requestAnimationFrame(drawActiveCard);
                }
            }
        }
    });

    window.addEventListener("mousemove", function(event) {
        if (activeCard && !activeCardAnimating) {
            // Update active card position to track mouse
            activeCard.setPosition(event.clientX - cardCenterX, event.clientY - cardCenterY);
            requestAnimationFrame(drawActiveCard);
        }
    });

    window.addEventListener("mouseup", function(event) {
        if (activeCard && !activeCardAnimating) {
            var pileX = Math.floor((event.clientX - layoutLeftX) / cardOffsetX);
            var pileY = Math.floor((event.clientY - layoutTopY) / cardOffsetY);
            if (pileX >= 0 && pileX < gameLayout[0].length && pileY >= 0 && pileY < gameLayout.length) {
                try {
                    placeActiveCard(pileX, pileY);
                } catch (error) {
                    // A card was placed incorrectly
                    returnActiveCard();
                }
            } else {
                // A card was not dropped in a pile
                returnActiveCard();
            }

            requestAnimationFrame(drawLayout);
            requestAnimationFrame(drawActiveCard);
        }
    });
}, false);
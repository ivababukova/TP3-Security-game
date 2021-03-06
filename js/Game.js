var Encrypt = Encrypt || {};

//title screen
Encrypt.Game = function(){};

var currentDoor = null;
var currentDoorEnemy = null; // @iva: global variable to remember the door object the enemy is on, so we can close it
//TODO decide on a default start room for the enemy and set it here, or at the beginning of the game
var text = null;
var fPause = false;
var lastKnownPlayerDirection = ['',0]; /*BMDK: for the purpose of tracking what animation frame to end on and lastKnownPlayerDirection*/
var doorPass = ''; /*BMDK: for the purpose of being able to eventually close a door via animation*/
var doorPassEnemy = ''; /* @iva: the same as doorPass */
var doorJustOpened = false;
var doorJustOpenedEnemy = false;
var doorsCollidable = true;
var doorsCollidableEnemy = true;
var doorSound = null;
var pickupSound = null;
var finalscore = 0; // @iva: variable that hold the value of the final score. Used for displaying the score on the gamewin/lost pages.
var pickedHints = []; // @iva: stores the pickedHints collected by the player so far
var lastHint = "";
var enemyFrame = 0; //this tracks the current frame of animation for the enemy
var enemyFrameRate = 0; // this stablises the rate of enemy frame changes (for now at least)
var flagEnemyOnDoor; // @iva: is the enemy in front of a door
var enemyWaitOnDoorTime = 10; // @iva: the amount of time in seconds the enemy waits on particular door
var currentEnemyRoom = null; // Andi: global variable to keep track of where the enemy is
var currentPlayerRoom = null; // Andi: global var to track where the player is
var isMoving = false;
var isPlaying = false;
var runningSound = null;
var isLethal = true;


Encrypt.Game.prototype = {
  create: function () {

    // array to hold rooms' graphics
    this.roomGraphs = [];
    // when the player touches the door, this.flagEnter is true, otherwise false.
    this.flagEnter = false;
    // flagSearch is used to update the currentRoom only when flagEnter goes from true to false.
    this.flagSearch = false;
    hook = this;

    //creating the auxiliary systems
    this.scoreSystem = new ScoreSystem(this.game); // the score is initially 0
    this.metricsSystem = new MetricsSystem(this.game);
    this.stringMatcher = new StringMatcher();

    this.map = this.game.add.tilemap('level1');

    //the first parameter is the tileset name as specified in Tiled, the second is the key to the asset
    this.map.addTilesetImage('32x32TileSet1Encrypt', '32x32TileSet1Encrypt');

    //create layer
    this.createDoorBlocks();
    this.backgroundlayer = this.map.createLayer('backgroundLayer');
    this.createDoors(); //BMDK, moved here as was rendering over the player ... might want to set invisible after door opens instead
    this.createPlayer();
    this.createEnemy(); // Andi: create the enemy
    this.blockedLayer = this.map.createLayer('blockedLayer');
    this.map.setCollisionBetween(1, 100000, true, 'blockedLayer'); //collision on blockedLayer
    this.overPlayerLayer = this.map.createLayer('overPlayerLayer');
    this.backgroundlayer.resizeWorld(); //resizes the game world to match the layer dimensions

    this.createItems();
    this.loadRooms();
    this.createInput();

    /* create a button for viewing the pickedHints and tips collected so far; @iva */
    this.hintsButton = this.game.add.button(535, 10, 'icons', this.manageHintsPopup, this, 14, 14, 14, 14);
    this.hintsButton.clicked = false;
    this.hintsButton.fixedToCamera = true;

    /* create a button for making a new note or reviewing saved passwords: @iva */
    this.noteButton = this.game.add.button(535, 70, 'icons', this.manageNote, this, 16, 15, 15, 15);
    this.noteButton.clicked = false;
    this.noteButton.fixedToCamera = true;

    /* create button to activate antivirus: @iva */
    this.antivirusButton = this.game.add.button(535, 130, 'icons', this.manageAntivirus, this, 5, 5, 5, 5);
    this.antivirusButton.fixedToCamera = true;

    /* button to activate firewall: */
    this.firewallButton = this.game.add.button(535, 190, 'icons', this.manageFirewall, this, 11, 11, 11, 11);
    this.firewallButton.fixedToCamera = true;

    /* a cross over the player's head: */
    this.cross = "_";
    this.cross_style = {font: "40px Serif", fill: "#000", align: "center"};
    this.welcomeLabel = this.game.add.text(this.player.sprite.x - 10, this.player.sprite.y - 80, this.cross, this.cross_style);
    this.welcomeLabel.anchor.set(0.5);

    /* create the score label */
    this.scoreString = "Score: " + this.scoreSystem.score;
    this.scoreLabel = this.game.add.text(0, 0, this.scoreString, {
      font: "32px Arial",
      fill: "#ffffff",
      align: "center"
    });
    this.scoreLabel.fixedToCamera = true;
    this.scoreLabel.cameraOffset.setTo(25, 25);


    //create sounds used elsewhere in the gam
    doorSound = this.game.add.audio('doorSound');
    pickupSound = this.game.add.audio('pickUpSound');
  runningSound = this.game.add.audio('runningSound');  

    // path-finding algorithm set up

    /*Andi: Set-up of the path finding algorithm
     * walkables is an array of the indexes of the walkable tiles
     * */
    var walkables = [319, 823, 3413, 3511, 4111, 4113, 4114, 4115, 4211, 4213, 4214, 4215, 4814, 4815,
      6011, 6012, 6013, 6019, 6020, 6021, 6027, 6111, 6112, 6119, 6120, 6121, 6219, 6220, 6221];

    this.pathfinder = this.game.plugins.add(Phaser.Plugin.PathFinderPlugin);
    this.pathfinder.setGrid(this.map.layers[0].data, walkables);

    // Esc and password reset buttons
    document.getElementById("esc").addEventListener("click", this.closePopup.bind(this));
    document.getElementById("resetPassword").addEventListener("click", this.resetPassword.bind(this));
    document.getElementById("showAllHints").addEventListener("click", this.displayHintsCollected.bind(this));
    document.getElementById("antiKeyLogButton").addEventListener("click", this.applyAntiKeyLogger.bind(this));

    console.log();
  },

  /* ************************************** UPDATE STATE: ************************************************* */
  update: function () {
    var self = this;
    /*This code was added to control frame rates for the enemy.
     * In the enemy update, the next frame is loaded when cond
     * is satisfied ~BMDK
     */
    enemyFrameRate += 1;
    if (enemyFrameRate % 3 === 0) {
      enemyFrame += 1;
    }
    //collision
    if (fPause === true) {
      self.stopMotion();
      return;
    }

    if (this.game.input.activePointer.justReleased()) {
      this.input.focus();
    }

    if (doorsCollidable) {
      this.game.physics.arcade.collide(this.player.sprite, this.doorBlocks);
    }

    if (doorsCollidableEnemy === true) {
      this.game.physics.arcade.collide(this.enemy.sprite, this.doorBlocks);
    }

    this.game.physics.arcade.collide(this.player.sprite, this.blockedLayer);   // set up collision with this layer
    this.game.physics.arcade.collide(this.enemy.sprite, this.blockedLayer);   // Andi: set up enemy's collision with blocked layer
    this.game.physics.arcade.collide(this.enemy.sprite, this.player.sprite, this.gameOver, null, this); // BMDK: Added collision between enemy and player
    this.game.physics.arcade.overlap(this.player.sprite, this.items, this.pickupItem, null, this);
    //this.game.physics.arcade.overlap(this.player.sprite, this.enemy.sprite, this.gameOver(), null, this);

    this.flagEnter = this.game.physics.arcade.overlap(this.player.sprite, this.doors, this.enterDoor, null, this);
    flagEnemyOnDoor = this.game.physics.arcade.overlap(this.enemy.sprite, this.doors, this.enterDoorEnemy, null, this);

    // when come out the door, check the room.
    this.updateRoomHighlighting();
    this.changeDoorStates();
    //console.log("door left, right:", this.doors.getAt(1).body.position.x, this.doors.getAt(1).body.right, "door top, down:", this.doors.getAt(1).body.position.y, this.doors.getAt(1).body.down);

    //Andi: slowing player down in infected rooms

    if (currentPlayerRoom.properties.infected) {
      var speed = 200;
    }

    else {
      var speed = 260;  // setting up the speed of the player
    }
    this.moveCharacter(this.player.sprite, speed);
  this.playRunningSound();  
    
    /*BMDK: - Moved bringToTop here to allow the score to appear on top at all times*/

    this.scoreLabel.text = "Score:" + this.scoreSystem.score; // Andi: update the score
    this.game.world.bringToTop(this.scoreLabel);              // and bring it to top of the rendered objects
    this.game.world.bringToTop(this.hintsButton);  // @iva: bring the hints button to be always at the top
    this.game.world.bringToTop(this.noteButton);
    this.game.world.bringToTop(this.antivirusButton);
    this.game.world.bringToTop(this.firewallButton);
    this.game.world.bringToTop(this.cross);

    // if the enemy is in a different room than the player is
    if (this.enemy.currentRoom !== this.player.currentRoom) {
      // keep going on the path previously had
      // the enemy can collide with a door when he's not in the same room as the player
      if (!doorJustOpenedEnemy)
        doorsCollidableEnemy = true;
      if (this.enemy.needNewPath) {
        //get it
        this.getEnemyPath();
        //and reset the value
        this.enemy.needNewPath = false;
        this.enemy.pathPosition = 1;
      }

    }
    //if he is in the same room
    else {
      // update his path on every tick - less efficient in terms of computation, but gets to player faster
      /*Andi: set to false so that the enemy won't attempt to go through doors when they're in the same room*/
      doorsCollidableEnemy = false;
      this.getEnemyPath();
      // make sure he's at the first element in the path
      this.enemy.pathPosition = 1;
    }
    this.enemy.update();
    //update its current room
    this.getCurrentRoom(this.enemy);

  },

  enemyWaitsOnDoor: function () {
    this.setEnemyUnmovable();
    this.getWaitOnDoorTime();
    console.log("enemyondoor flag: " + flagEnemyOnDoor);
    console.log("enemy is waiting: " + enemyWaitOnDoorTime + " seconds");
    //  Create our Timer
    timer = this.game.time.create(false);
    //  Set a TimerEvent to occur after 6 seconds
    timer.loop(enemyWaitOnDoorTime, this.setEnemyMovable(), this); // @iva: the waiting time is the entropy value mult by 4
    //  Start the timer running
    timer.start();
    this.changeDoorState(currentDoorEnemy, 'opening');
  },

  // this function is used in Game.js update
  setEnemyMovable: function () {
    this.enemy.isMovable = true;
    this.enemy.sprite.body.enable = true;
    this.enemy.sprite.body.isVisible = true;
    this.changeDoorState(currentDoorEnemy, 'opening');
    doorJustOpenedEnemy = true;  // @iva: the enemy doesn't get stuck in front of a door for ever
    doorsCollidableEnemy = false;
  },

  setEnemyUnmovable: function () {
    this.enemy.isMovable = false;
    this.enemy.sprite.body.enable = false;
    this.enemy.sprite.body.isVisible = false;
  },

  //create player
  createPlayer: function () {
    this.player = new Player(200, 200, this.game, this.scoreSystem, this.metricsSystem);

    this.player.sprite.animations.add('down', [1, 2, 3, 4, 5, 6, 7, 8], 14, true, true);
    this.player.sprite.animations.add('up', [10, 11, 12, 13, 14, 15, 16, 17], 14, true, true);
    this.player.sprite.animations.add('right', [19, 20, 21, 22, 23, 24, 25, 26], 14, true, true);
    this.player.sprite.animations.add('left', [28, 29, 30, 31, 32, 33, 34, 35], 14, true, true);
    //this.player.animations.add('static', [0], 1, true, true);

    // made player centered, which fixes room highlighting problems. A.M.
    this.player.sprite.anchor.setTo(0.5, 0.5);

    //move player with cursor keys
    //this.cursors = this.game.input.keyboard.createCursorKeys();
    this.cursors = {
      up: this.game.input.keyboard.addKey(Phaser.Keyboard.W),
      down: this.game.input.keyboard.addKey(Phaser.Keyboard.S),
      right: this.game.input.keyboard.addKey(Phaser.Keyboard.D),
      left: this.game.input.keyboard.addKey(Phaser.Keyboard.A)
    };

  },

  //create an enemy
  createEnemy: function () {
    this.enemy = new Enemy(1700, 2000, this.game, this.player, this.backgroundlayer);
    this.enemy.sprite.anchor.setTo(0.5, 0.5);
  },

  // create items
  createItems: function () {
    //create items
    this.items = this.game.add.group();
    this.items.enableBody = true;

    // POLICIES
    var policy;
    result = this.findObjectsByType('policy', this.map, 'objectsLayer');

    result.forEach(function (element) {
      this.createFromTiledObject(element, this.items);
    }, this);

    // ANTIKEYLOGGERS @iva
    var antikeylogger;
    result = this.findObjectsByType('AntiKeyLog', this.map, 'objectsLayer');
    result.forEach(function (element) {
      this.createFromTiledObject(element, this.items);
    }, this);

    // INFO @iva
    var info;
    result = this.findObjectsByType('info', this.map, 'objectsLayer');
    result.forEach(function (element) {
      this.createFromTiledObject(element, this.items);
    }, this);

    // FIREWALL @iva
    var firewall;
    result = this.findObjectsByType('firewall', this.map, 'objectsLayer');
    result.forEach(function (element) {
      this.createFromTiledObject(element, this.items);
    }, this);

    // ANTIVIRUS @iva
    var antivirus;
    result = this.findObjectsByType('antivirus', this.map, 'objectsLayer');
    result.forEach(function (element) {
      this.createFromTiledObject(element, this.items);
    }, this);

    //WINNING KEY @iva
    var winkey;
    result = this.findObjectsByType('winkey', this.map, 'objectsLayer');
    result.forEach(function (element) {
      this.createFromTiledObject(element, this.items);
    }, this);


  },

  createDoorBlocks: function () {
    this.doorBlocks = this.game.add.group();
    this.doorBlocks.enableBody = true;

    var result = this.findObjectsByType('block', this.map, 'doorBlocks');
    var doorBlockID = 0;

    // create the front door objects:
    result.forEach(function (element) {
      this.createFromTiledObject(element, this.doorBlocks, doorBlockID);
      doorBlockID++;
    }, this);

    this.doorBlocks.setAll('body.moves', false);
  },

  // this function creates only front doors:
  createDoors: function () {
    //create doors
    this.doors = this.game.add.group();
    this.doors.enableBody = true;


    var result = this.findObjectsByType('frontDoor', this.map, 'objectsLayer');
    var result2 = this.findObjectsByType('sideDoor', this.map, 'objectsLayer');
    var doorID = 0; // used to assign unique id for each door created


    // create the front door objects:
    result.forEach(function (element) {
      this.createDoorFromTiledObject(element, this.doors, doorID, 'frontDoor');
      doorID++;
    }, this);


    // create the side door objects:
    result2.forEach(function (element) {
      this.createDoorFromTiledObject(element, this.doors, doorID, 'sideDoor');
      doorID++;
    }, this);
  },

  /********************* POLICY METHODS ************************

   /** When found add the new policy
   * @param {object} policy
   */
  addPolicy: function (policy) {
    this.player.addPolicy(policy);
    policy.destroy();
  },
  /** Take the color of a policy ang give back its rules
   * @param {string} the color of a policy
   * @return {string} rules policy contains
   */
  retrievePolicyRules: function (colour) {
    var policy = this.player.policies[colour];
    return "MIN LENGTH: " + policy.minLength + "<br>MIN UPPER CASE LETTERS: " + policy.minUpper + "<br>MIN LOWER CASE LETTERS: " + policy.minLower +
        "<br>MIN #NUMBERS: " + policy.minNums + "<br>MIN # of PUNCTUATION or SPEC SIGNS: " + policy.minPunctOrSpecChar;
  }, /**

   **********************************************************************/
  /*****************METHODS TO MANAGE ROOM OBJECTS**********************
   /** Preload all room objects */
  loadRooms: function () {
    // Get all room objects
    this.rooms = this.findObjectsByType('room', this.map, 'RoomLayer');
    // find in which room(if any) the player is located
    this.getCurrentRoom(this.player);
    // draw rooms
    this.drawRooms();
  },
  /** Update entity's variable currentRoom to store the current room's ID */
  getCurrentRoom: function (entity) {

    // Checking each room
    this.rooms.forEach(function (element) {
      // Getting room's dimensions and coordinates
      var x = parseInt(element.x);
      var y = parseInt(element.y + this.map.tileHeight);
      var w = parseInt(element.width);
      var h = parseInt(element.height);
      var rect = new PIXI.Rectangle(x, y, w, h);

      // check if a player is in a room. If yes,
      // then memorise its ID and finish searching

      if (rect.contains(entity.sprite.x, entity.sprite.y)) {
        entity.currentRoom = parseInt(element.properties.idx);
        if (entity instanceof Enemy) {
          currentEnemyRoom = element;
        }
        else if (entity instanceof Player)
          currentPlayerRoom = element;
        return;
      }
    }, this);

  },
  /** Draws the rooms */
  drawRooms: function () {
    var graphics; // used to store room's graph
    // one room at a time
    this.rooms.forEach(function (element) {
      //  console.log(element);
      // get dimensions and coordinates
      var x = parseInt(element.x);
      var y = parseInt(element.y + this.map.tileHeight);
      var w = parseInt(element.width);
      var h = parseInt(element.height);
      // get the state of the room
      var state = parseInt(element.properties.state);
      // generating unique room's ID. Beneficial in cases when room is not a rectangle and therefore built from multiple blocks.
      var str = element.properties.idx.toString() + "+" + x.toString() + "+" + y.toString();
      // if already drawn, then destroy the graph(start from scratch)
      if (this.roomGraphs[str] != undefined && this.roomGraphs[str] != null) {
        graphics = this.roomGraphs[str];
        graphics.destroy();
      }

      // new room's graph
      graphics = this.game.add.graphics(0, 0);
      this.roomGraphs[str] = graphics;
      // in order to fix a bug as the room's height kept on shrinking by 32px
      element.y += 32;

      var color = 0xCCCCCC;
      var opacity;
      if (this.player.currentRoom === parseInt(element.properties.idx)) { // player in the room
        if(element.properties.state !== "2") {
          element.properties.state = "0"; // Change to visited
        }
        if (element.properties.infected) { // Infected
          color = 0x16E91D;
          opacity = 0.5;
        } else {
          return;
        }
      } else if (state === 0) {  // visited
        if (element.properties.infected) { // Infected
          color = 0x16E91D;
          opacity = 0.5;
        } else {
          opacity = 0.6;
        }
      } else if (state === 1) { // not visited
        color = 0x444444;
        opacity = 1;
      } else if(state === 2){ // checker block, does not need to be drawn
        opacity = 0;
      }

      graphics.beginFill(color, opacity);
      graphics.drawRect(x, y, w, h);
      graphics.endFill();
    }, this);
  },

  applyAntiKeyLogger: function () {
    // apply key-logger
    if(this.player.removeKeylogger(currentDoor)) {
      if (this.player.antikeyLoggerBag.length === 0) {
        document.getElementById("antiKeyLogButtonImg").src = "assets/images/GameIcons/AntiKeyLoggerInactive56x56.png";
      }
      document.getElementById("feedback").innerHTML = "Anti key-logger applied successfully."
      document.getElementById("keyLogIndicator").src = "assets/images/GameIcons/lockedLock.png";
      ;
    }
    // focus back on password entry box
    this.input.focus();
  },

  resetPassword: function () {
    this.input.focus();
    if (currentDoor.password === 'null') {
      document.getElementById("feedback").innerHTML = "Password is not set for this door.";
      return;
    } else if (this.player.passwordResetsAvailable === 0) {
      document.getElementById("feedback").innerHTML = "You are out of password resets.";
      return;
    }
    this.player.passwordResetsAvailable -= 1;
    var penalty = this.scoreSystem.scoreReset(this.getEntropy(currentDoor.password));
    //last parameter in function call below calls the score system for a reset and returns the value of the penalty
    this.metricsSystem.addResetPassword(currentDoor.password, currentDoor.z, penalty);
    currentDoor.password = 'null';
    document.getElementById("feedback").innerHTML = "Password reset completed.";
    document.getElementById("titlePwd").innerHTML = "Setup a password.";
  },

  closePopup: function () {
    document.getElementById("inputPwd").style.display = "none";
    document.getElementById("policyTitle").style.display = "none";
    document.getElementById("feedback").style.display = "none";
    document.getElementById("mainLayer").style.display = "none";
    document.getElementById("resetPassword").style.display = "none";
    document.getElementById("passwordStrengthBar").style.display = "none";
    document.getElementById("passStr").style.display = "none";
    document.getElementById("antiKeyLogButton").style.display = "none";
    document.getElementById("keyLogIndicator").style.display = "none";
    document.getElementById("esc").style.display = "none";
    this.game.input.keyboard.enabled = true;
    this.input.focus();
    fPause = false;
  },
  /**
   ************************************************************
   ********************ALL ABOUT THE INPUT**********************/
  createInput: function () {
    this.notes = "";
    var i = 0;
    var self = this;
    this.input = new CanvasInput({
      canvas: document.getElementById('pwdCanvas'),
      fontSize: 18,
      fontFamily: 'Arial',
      fontColor: '#212121',
      width: 340,
      padding: 8,
      borderWidth: 1,
      borderColor: '#000',
      borderRadius: 3,
      boxShadow: '1px 1px 0px #fff',
      innerShadow: '0px 0px 5px rgba(0,0,0,0.5)',
      placeHolder: 'password',
      onsubmit: function () {
        // Password note is open
        if (document.getElementById("titlePwd").innerHTML === "Type in passwords you want to save:") {
          // write it to the note
          self.player.note.write(this._value);
          self.metricsSystem.addNote(this._value); //added by BMDK to get the note into the DB

          //test whether the thing the user has written is close to a password he has set on a door
          var passwordsOnDoors = Object.keys(self.metricsSystem.passwords);

          if (self.stringMatcher.simpleMatch(this._value, passwordsOnDoors)) {
            //Andi: call the score system to penalise player for writing down passwords
            console.log("Here!");
            self.scoreSystem.scorePasswordWriteDown(self.getEntropy(this._value));

          }

          self.notes += self.player.note.passwords[i] + "<br>";
          i++;
          this._hiddenInput.value = '';
          self.manageNote();

          //Andi: call to metrics system to update the notes the player has taken
          self.metricsSystem.updateNotesTaken(self.player.note.passwords);
          return;
        }
        // when the user input password and enter 'Enter' key
        if (!this.approved) {
          //Need to check this, bit of a hack, but it prevents users entering passwords to DB
          // and to the metrics system when they type AND/OR hit enter during regular gameplay
          if (document.getElementById("inputPwd").style.display !== "none") {
            self.metricsSystem.addRejectedPassword(this._value, currentDoor.z, "inappropriate", self.getEntropy(this._value)); //Andi: adding the non-policy-conforming password to the metrics system
          }
          return;
        }
        if (currentDoor.password === 'null' && document.getElementById("inputPwd").style.display === "block") {
          self.changeDoorState(currentDoor, 'opening');
          doorSound.play();
          doorsCollidable = false;
          doorJustOpened = true; //BMDK: track that door opened
          currentDoor.password = this._value;
          //Andi: keylogger functionality
          if (currentDoor.hasKeylogger) {
            currentDoor.keylog(this._value, self.enemy);
          }

          self.scoreSystem.scorePassword(self.getEntropy(this._value));
          /*Andi: adding the password to the score & metrics systems*/
          self.metricsSystem.addPassword(this._value, self.getEntropy(this._value), currentDoor.z);
          this._hiddenInput.value = '';
          self.closePopup();
        } else { // if password was already set, then compare.
          if (currentDoor.password === this._value) {
            doorSound.play();
            /*BMDK: call to function to open door when password is successful*/
            self.changeDoorState(currentDoor, 'opening');

            //Andi: keylogger functionality
            if (currentDoor.hasKeylogger) {
              currentDoor.keylog(this._value, self.enemy);
            }

            doorsCollidable = false;
            //TODO: Confirm that currentDoor.z is the door id & add refusal of passwords not conforming with door policy
            self.metricsSystem.addUsedPassword(this._value, currentDoor.z); //Andi: adding the already set up password to the metrics system;
            self.scoreSystem.scorePassingThroughDoorWithoutResetting(this._value, self.getEntropy(this._value), self.player); //Andi: added scoring for this scenario to scoring system

            doorJustOpened = true; //BMDK: track that door opened
            self.closePopup();
          } else {
            document.getElementById("titlePwd").innerHTML = "Incorrect. Input again!";
            self.metricsSystem.addRejectedPassword(this._value, currentDoor.z, "rejected", self.getEntropy(this._value)); //Andi: adding the rejected password to the metrics system
          }
          this._hiddenInput.value = '';
        }
      },
      // Feedback generated within each key-press
      onkeyup: function () {
        // first check if main layer is open and then check if it's not a noPolicy pop up
        if (document.getElementById("feedback").style.display === "block") {
          //console.log(self.getEntropy(this._hiddenInput.value)[0]);//BMDK testing
          var policy = self.player.policies[currentDoor.policy];
          var feedback = "";
          this.approved = false;
          // CHECK LENGTH
          if (this._hiddenInput.value.length > 0 && this._hiddenInput.value.length < policy.minLength) {
            feedback = "Too short";
            // CHECK UPPER CASE LETTERS
          } else if (this._hiddenInput.value.length > 0 && this._hiddenInput.value.replace(/[^A-Z]+/g, "").length < policy.minUpper) {
            feedback = "Need more upper case letters.";
            // CHECK LOWER CASE LETTERS
          } else if (this._hiddenInput.value.length > 0 && this._hiddenInput.value.replace(/[^a-z]+/g, "").length < policy.minLower) {
            feedback = "Need more lower case letters.";
            // CHECK NUMERICALS
          } else if (this._hiddenInput.value.length > 0 && this._hiddenInput.value.replace(/\D/g, '').length < policy.minNums) {
            feedback = "Need more numbers.";
            // CHECK PUNCTUATION
          } else if (this._hiddenInput.value.length > 0 && this._hiddenInput.value.replace(/[a-zA-Z 0-9]+/g, '').length < policy.minPunctOrSpecChar) {
            feedback = "Need more punctuation or special character signs.";
          } else if (this._hiddenInput.value.length > 0) { // If policy requirements are met, approve
            this.approved = true;
            feedback = "Policy requirements met.";
          }
          self.displayPasswordStrength(self.getEntropy(this._hiddenInput.value));
          console.log(self.getEntropy(this._hiddenInput.value));
          if (this.approved) {
            document.getElementById("feedback").style.color = "green";
          } else {
            document.getElementById("feedback").style.color = "red";
          }
          document.getElementById("feedback").innerHTML = feedback;
        }
      }
    });
    this.input.focus();
    return this.input;
  },
  /* BMDK: - Function for calculation of password entropy*/
  getEntropy: function (pwdFeed) {
    /* ints to represent how many characters are in each set
     *  Note: not consistent with password policies that split into special & punctuation characters
     */
    var pwd = String(pwdFeed);
    var numbersNumOf = 10;
    var lowersNumOf = 26;
    var uppersNumOf = 26;
    var nonAlphaNumericsNumOf = 34;

    /* the range of characters used */
    var range = 0;
    /* the length of the password */
    var pwdLength = pwd.length;
    /* possible feedback for the user */


    /* increase range if numbers are present*/
    if (pwd.replace(/[0-9]+/g, "").length < pwdLength) {
      range += numbersNumOf;
    }
    /* increase range if lower case chars are present*/
    if (pwd.replace(/[a-z]+/g, "").length < pwdLength) {
      range += lowersNumOf;
    }
    /* increase range if upper case chars are present*/
    if (pwd.replace(/[A-Z]+/g, "").length < pwdLength) {
      range += uppersNumOf;
    }
    /* increase range if non-alphanumeric chars are present*/
    if (pwd.replace(/\W+/g, "").length < pwdLength) {
      range += nonAlphaNumericsNumOf;
    }

    /*bit strength calculated by log2(rangeOfChars)*lengthOfPassword*/
    var tempLogVal = Math.log(range) / Math.log(2);
    /*Array to hold entropy @ index 0 and user feedback at index 1 */
    var entropy = pwdLength * tempLogVal;
    /* Stop from returning NaN value*/
    if (entropy > 0) {
      return Math.floor(entropy); //Andi: returning the floor from here so that it doesn't need to get done everywhere else
    }
    return 0;
  },

  displayPasswordStrength: function (entropy) {
    if (entropy < 20) {
      document.getElementById("passwordStrengthBar").style.backgroundColor = "red";
      document.getElementById("passwordStrengthBar").style.width = "10%";
      document.getElementById("passwordStrengthBar").innerHTML = "Weak";
    } else if (entropy < 100) {
      document.getElementById("passwordStrengthBar").style.backgroundColor = "yellow";
      document.getElementById("passwordStrengthBar").style.width = "20%";
      document.getElementById("passwordStrengthBar").innerHTML = "Medium";
    } else {
      document.getElementById("passwordStrengthBar").style.backgroundColor = "green";
      document.getElementById("passwordStrengthBar").style.width = "30%";
      document.getElementById("passwordStrengthBar").innerHTML = "Strong";
    }
  },
  /****************HELPER METHODS TO CREATE*******************
   * find objects in a Tiled layer that contain a property called "type" equal to a certain value
   * @param type
   * @param map
   * @param layer
   * @returns {Array}
   */
  findObjectsByType: function (type, map, layer) {
    var result = [];
    map.objects[layer].forEach(function (element) {
      if (element.properties.type === type) {
        //Phaser uses top left, Tiled bottom left so we have to adjust
        //also keep in mind that the cup images are a bit smaller than the tile which is 16x16
        //so they might not be placed in the exact position as in Tiled
        element.y -= map.tileHeight;
        result.push(element);
      }
    });
    return result;
  },
  /** Create a sprite from an object
   * @param element
   * @param group
   * @param ID
   */
  createFromTiledObject: function (element, group, ID) {
    var sprite = group.create(element.x, element.y, element.properties.sprite);
    element.id = ID;
    //copy all properties to the sprite
    Object.keys(element.properties).forEach(function (key) {
      sprite[key] = element.properties[key];
    });
  },
  /** Create front or side door and load the animations for it
   * @param element
   * @param group
   * @param doorID
   * @param spritesheet
   */
  createDoorFromTiledObject: function (element, group, doorID, spritesheet) {
    //frontDoorSprite = this.game.add.sprite(element.x, element.y, 'frontDoor');
    var sprite = group.create(element.x, element.y, spritesheet);
    // these animation options are valid for both types of doors
    sprite.animations.add('opening', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 17, false, true);
    sprite.animations.add('closing', [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0], 17, false, true);
    sprite.animations.add('closed', [0], 1, true, true);
    sprite.animations.add('opened', [], 0, true, true); // no sprite, because an opened door sprite is already drawn on the map.

    this.changeDoorState(sprite, 'closed'); // the door is initially closed
    element.id = doorID; // the id of the door, not used yet

    //copy all properties to the sprite:
    Object.keys(element.properties).forEach(function (key) {
      sprite[key] = element.properties[key];
    });
  },
  /*************************METHODS CALLED BY UPDATE() **************************
   * @param doorObject
   * @param string : animation to be played
   * This function changes the current state of the doorObject to new one, specified by the string parameter
   */
  changeDoorState: function (doorObject, string) {
    doorObject.animations.play(string);
  },
  /** Method stops movable entities from moving
   */
  stopMotion: function () {
    var self = this;
    //self.enemy.sprite.animations.stop(); // not needed yet as can't get enemy animation to loop
    self.enemy.sprite.body.velocity.y = 0;
    /* Andi: stopping the enemy first */
    self.enemy.sprite.body.velocity.x = 0;

    self.player.sprite.animations.stop();
    /* BMDK: This will stop the animations running whilst game is paused*/
    self.player.sprite.body.velocity.y = 0;
    self.player.sprite.body.velocity.x = 0;
  },
  /** Method deals with states of the doors when they are being approached, opened or left
   */
  changeDoorStates: function () {
    if (this.flagEnter) {
      /*BMDK:- update doorPass to track last door action*/
      doorPass = 'in front of a door';
    }
    else if (flagEnemyOnDoor === true) {
      doorPassEnemy = 'enemy in front of a door';
    }
    else {
      /*BMDK:- if player was in front of an open door but goes away from it: close the door*/
      if (doorPass === 'in front of a door' && doorJustOpened) {
        this.changeDoorState(currentDoor, 'closing');
        doorsCollidable = true;
        doorJustOpened = !doorJustOpened; // BMDK: set false as door is no longer open
      }
      /* @iva; same as the code above, but for the enemy */
      if (doorPassEnemy === 'enemy in front of a door' && doorJustOpenedEnemy) {
        this.changeDoorState(currentDoorEnemy, 'closing');
        doorsCollidableEnemy = true;
        doorJustOpenedEnemy = !doorJustOpenedEnemy;
      }

      /* BMDK:- update doorPass to track last door action */
      doorPass = 'went away from the door';
      doorPassEnemy = 'enemy went away from the door';
    }
  },
  /** Method deals with redrawing of the rooms
   */
  updateRoomHighlighting: function () {
    if (this.flagEnter) {
      this.flagSearch = true;
    }
    else {
      if (this.flagSearch === true) {
        this.flagSearch = false;
        this.loadRooms();
      }
    }
  },
  /** Used to differentiate item types and deal with them appropriately
   * @param player
   * @param collectable
   */
  pickupItem: function (player, collectable) {

    pickupSound.play(); //play sound when object is picked up

    if (collectable.type === "info") {
      this.player.addItem(4);
      this.hintsButton.setFrames(13, 12, 12, 12);
      // this.state.start('GameLost');
      this.showHint(player, collectable);
      this.scoreSystem.scoreObjectPickUp();
    }

    else if (collectable.type === "policy") {
      this.addPolicy(collectable);
      this.scoreSystem.scoreObjectPickUp();
      this.metricsSystem.addPolicyCollected(collectable.colour);
    }

    // added by @iva 07.02.2015
    else if (collectable.type === "firewall") {
      this.player.addItem(1);
      this.firewallButton.setFrames(10, 9, 9, 9);
      this.metricsSystem.addToolCollected(1);
      this.scoreSystem.scoreObjectPickUp();
      collectable.destroy();
    }

    // added by @iva 07.02.2015
    else if (collectable.type === "antivirus") {
      this.player.addItem(2);
      this.antivirusButton.setFrames(4, 3, 3, 3);
      this.metricsSystem.addToolCollected(2);
      this.scoreSystem.scoreObjectPickUp();
      collectable.destroy();
    }

    // added by @iva 07.02.2015
    else if (collectable.type === "AntiKeyLog") {
      this.player.addItem(3);
      document.getElementById("antiKeyLogButtonImg").src = "assets/images/GameIcons/AntiKeyLogger56x56.png";
      this.metricsSystem.addToolCollected(3);
      this.scoreSystem.scoreObjectPickUp();
      collectable.destroy();
    }
    // calls the win page @iva
    else if (collectable.type === "winkey") {
      // this.scoreSystem.setScore(this.score);
      this.metricsSystem.addToolCollected(4);
      //Andi: bonus for the player if the enemy is not in the same room
      if (this.player.currentRoom != this.enemy.currentRoom)
        this.scoreSystem.scoreEnemyNotInRoomBonus();
      // Andi: award a bonus for how far away the enemy is from the player when winning
      this.scoreSystem.scoreDistanceToPlayerBonus(this.enemy.pathToPlayer.length);
      // Andi: bonus for winning the game
      this.scoreSystem.scoreGameWon();

      finalscore = this.scoreSystem.score;
      runningSound.stop();
      this.state.start('GameWon');
      collectable.destroy();
    }
  },

  /**************************************** HINTS AREA ****************************************/
  manageHintsPopup: function () {
    if(document.getElementById("mainLayer").style.display === "block")
      return;
    // if no hints available
    if (pickedHints.length === 0) {
      this.hintsButton.setFrames(14, 14, 14, 14);
      return;
    }
    this.hintsButton.clicked = !this.hintsButton.clicked;
    if (this.hintsButton.clicked) {
      this.hintsButton.setFrames(13, 13, 13, 13);
      this.displayLastHintCollected();
    } else {
      this.hintsButton.setFrames(13, 12, 12, 12);
      this.hideHintsCollected();
    }
  },

  /* displays the last hint that the player has collected @iva */
  displayLastHintCollected: function () {
    this.metricsSystem.addStartInfoRead();
    fPause = true;
    document.getElementById("hintsLayer").style.display = "block";
    document.getElementById("showAllHints").style.display = "block";

    if (lastHint === "") {
      document.getElementById("hintsDisplay").innerHTML = "<br>" + "You haven't collected any hints yet";
    }
    else {
      document.getElementById("hintsDisplay").innerHTML = "<br>" + lastHint;
    }
  },

  /* @iva */
  displayHintsCollected: function () {

    // document.getElementById ("showAllHints").style.display = "none";
    document.getElementById("hintsTitle").innerHTML = "Hints collected so far:";
    document.getElementById("hintsDisplay").innerHTML = ""; // remove the lastHintCollected display
    document.getElementById("hintsLayer").style.display = "block";

    if (lastHint === "") {
      document.getElementById("hintsDisplay").innerHTML = "<br>" + "You haven't collected any hints yet";
    }

    else {
      var hintsToDisplay = pickedHints[0] === undefined ? "" : ("1. " + pickedHints[0]);

      var i = 1;
      while (i < pickedHints.length) {
        hintsToDisplay += "<br>" + (i + 1).toString() + ". " + pickedHints[i];
        i++;
      }
      document.getElementById("hintsDisplay").innerHTML = hintsToDisplay;
    }
  },

  /* @iva hides the window with the hints */
  hideHintsCollected: function () {
    this.metricsSystem.addEndInfoRead();
    fPause = false;
    document.getElementById("hintsTitle").innerHTML = "Last hint collected:"; // the right title when the hints menu is opened again;
    document.getElementById("hintsLayer").style.display = "none"
  },

  /** function that outputs a random hint from an array of pickedHints
   *  called when the player collects a clue object
   * @param player
   * @param collectable
   */
  showHint: function (player, collectable) {
    var found = false; // false if the user has picked hint for first time
    var hintsArray = [];
    var self = this;
    hintsArray.push("Don't share your passwords with anyone");
    hintsArray.push("Use combination of small and big letters, numbers and special characters");
    hintsArray.push("Don't ever use same passwords on multiple websites");
    hintsArray.push("Don't include personal information in your passwords");
    hintsArray.push("Create passwords easy to remember but hard to guess");
    hintsArray.push("Make your passwords at least 8 characters long");
    hintsArray.push("Don't let your browser remember the password for you");
    hintsArray.push("Always log off if you leave your device and anyone is around");

    var randomIndex = Math.floor(Math.random() * (hintsArray.length) + 0); // gives random number between 0 and the length of the array
    var hint = hintsArray [randomIndex];

    for (var i = 0; i < pickedHints.length; i++) {
      if (pickedHints[i] === hint) {
        found = true;
        break;
      }
    }
    // if the user hasn't picked the same hint, store it in pickedHints:
    if (!found) {
      pickedHints.push(hint); // put the found hint in the picked pickedHints array
    }
    lastHint = hint;

    // display hint:
    var style = {font: "20px Serif", fill: "#000000", align: "center"};
    var text2 = this.game.add.text(this.player.sprite.x - 200, this.player.sprite.y, hint, style);
    this.time.events.add(4000, text2.destroy, text2);  // makes the text disappear after some time
    this.metricsSystem.addHintCollected(randomIndex); // added by Bryan to store the fact that ed info was collected
    collectable.destroy();

  },

  /**************************************** END OF HINTS AREA ****************************************/

  enterDoorEnemy: function (enemy, door) {
    if (doorsCollidableEnemy === true && flagEnemyOnDoor === true) {
      this.setEnemyUnmovable();
      currentDoorEnemy = door;

      // Andi: add keylogger if the player is unlucky enough

      if (this.enemy.willKeylog())
        this.enemy.putKeyLogger(door);

      flagEnemyOnDoor = true;
      this.getWaitOnDoorTime();
      console.log("enemy will wait " + enemyWaitOnDoorTime);
      this.game.time.events.add(enemyWaitOnDoorTime, this.setEnemyMovable, this); // @iva: the waiting time is the entropy value mult by 4
    }
  },

  /* @iva: This function calculates how long the enemy should wait on a door */
  // the waiting time is the passw entrophy for the door multiplied by 4. The result is in seconds
  getWaitOnDoorTime: function () {
    var found = false;
    // see whether we have the password stored in the enemy dictionary
    if (this.enemy.hasPassword(currentDoorEnemy.password)) {
      found = true;
      enemyWaitOnDoorTime = 1000;// the enemy waits only 1 second if it has the right
      enemyWaitOnDoorTime -= this.enemy.passwordsDictionary[currentDoorEnemy.password] * 10;
    }
    // would be great if we could implement a waiting bar on top of the enemy when he waits
    if (currentDoorEnemy.password === 'null' && !found) {
      enemyWaitOnDoorTime = 500; // the waiting time on doors without password is 10 seconds
    }
    else if (!found) {
      enemyWaitOnDoorTime = this.getEntropy(currentDoorEnemy.password) * 0.8 * 100; // wait time = entropy * 2500 seconds
      this.enemy.addPasswordToDictionary(currentDoorEnemy.password); // add this password to the dictionary
    }
  },

  /** Function deals with entering through the doors
   * @param player
   * @param door
   */
  enterDoor: function (player, door) {
    if (this.flagEnter === false) {

      // update global variables
      currentDoor = door;
      this.flagEnter = true;
      fPause = true;
      this.game.input.keyboard.reset(false);
      this.game.input.keyboard.enabled = false;
      this.input.focus();
      this.input._hiddenInput.value = '';
      this.metricsSystem.addUserDoorVisit(currentDoor.z);
      // Check if player has the right policy for the door
      if (this.player.policies[door.policy] === undefined) {
        document.getElementById("mainLayer").style.display = "block";
        document.getElementById("esc").style.display = "block";
        document.getElementById("policyRules").innerHTML = "You can't enter here. You need to collect the " + door.policy + " policy for this door first.";
      }
      else {
        // password not set yet
        if (door.password === 'null') {
          document.getElementById("titlePwd").innerHTML = "Setup password";
        }
        else {
          document.getElementById("titlePwd").innerHTML = "Input password";
        }
        // check if key logger is present
        if (currentDoor.hasKeylogger) {
          document.getElementById("keyLogIndicator").src = "assets/images/GameIcons/unlockedLock.png";
        } else {
          document.getElementById("keyLogIndicator").src = "assets/images/GameIcons/lockedLock.png";
        }

        document.getElementById("policyTitle").style.color = door.policy;
        document.getElementById("policyRules").innerHTML = this.retrievePolicyRules(door.policy);
        // display password pop up
        document.getElementById("policyTitle").innerHTML = "Policy Rules:";
        document.getElementById("mainLayer").style.display = "block";
        document.getElementById("policyTitle").style.display = "block";
        document.getElementById("inputPwd").style.display = "block";
        document.getElementById("resetPassword").style.display = "block";
        document.getElementById("feedback").style.display = "block";
        document.getElementById("passwordStrengthBar").style.display = "block";
        document.getElementById("passStr").style.display = "block";
        document.getElementById("antiKeyLogButton").style.display = "block";
        document.getElementById("keyLogIndicator").style.display = "block";
        document.getElementById("esc").style.display = "block";
      }
    }
  },
  
  playRunningSound: function() {
    if(!isPlaying && isMoving) {
      runningSound.play('',0,1,true);
      isPlaying = true;
    } if(isMoving == false) {
      runningSound.stop();
      isPlaying = false;
      }
  },

  /** Move character function for controlling animations of player
   *  This could probably be generalised to move Enemy too. - BMDK
   */
  moveCharacter: function (character, speed) {
    //player movement
    character.body.velocity.y = 0;
    character.body.velocity.x = 0;
  isMoving = true;

    /* Player moving up only */
    if (this.cursors.up.isDown && !this.cursors.right.isDown && !this.cursors.left.isDown) {
      character.body.velocity.y -= speed;
      character.animations.play('up');
      lastKnownPlayerDirection[0] = 'up';
    }
    /* Player moving down only */
    else if (this.cursors.down.isDown && !this.cursors.right.isDown && !this.cursors.left.isDown) {
      character.body.velocity.y += speed;
      character.animations.play('down');
      lastKnownPlayerDirection[0] = 'down';

    }
    /* Player moving diagonally down & right */
    else if (this.cursors.down.isDown && this.cursors.right.isDown && !this.cursors.left.isDown) {
      character.body.velocity.y += speed;
      character.body.velocity.x += speed;
      character.animations.play('right');
      lastKnownPlayerDirection[0] = 'right';

    }
    /* Player moving diagonally down & left */
    else if (this.cursors.down.isDown && this.cursors.left.isDown && !this.cursors.right.isDown) {
      character.body.velocity.y += speed;
      character.body.velocity.x -= speed;
      character.animations.play('left');
      lastKnownPlayerDirection[0] = 'left';

    }
    /* Player moving diagonally up & right */
    else if (this.cursors.up.isDown && this.cursors.right.isDown && !this.cursors.left.isDown) {
      character.body.velocity.y -= speed;
      character.body.velocity.x += speed;
      character.animations.play('right');
      lastKnownPlayerDirection[0] = 'right';

    }
    /* Player moving diagonally up & left */
    else if (this.cursors.up.isDown && this.cursors.left.isDown && !this.cursors.right.isDown) {
      character.body.velocity.y -= speed;
      character.body.velocity.x -= speed;
      character.animations.play('left');
      lastKnownPlayerDirection[0] = 'left';

    }
    /* Player moving left only */
    else if (this.cursors.left.isDown) {
      character.body.velocity.x -= speed;
      character.animations.play('left');
      lastKnownPlayerDirection[0] = 'left';
    }
    /* Player moving right only */
    else if (this.cursors.right.isDown) {
      character.body.velocity.x += speed;
      character.animations.play('right');
      lastKnownPlayerDirection[0] = 'right';
    }
    /*If player becomes static/stops, use last known direction to keep them facing that way*/
    else {
      character.animations.stop();
    isMoving = false; 
      if (lastKnownPlayerDirection [0] === 'up') {
        character.frame = 9;
        /* leave player facing up*/
      }
      else if (lastKnownPlayerDirection [0] === 'down') {
        character.frame = 0;
        /* leave player facing down*/
      }
      else if (lastKnownPlayerDirection [0] === 'left') {
        character.frame = 27;
        /* leave player facing left*/
      }
      else if (lastKnownPlayerDirection [0] === 'right') {
        character.frame = 18;
        /* leave player facing right*/
      }
    }
    this.welcomeLabel.destroy();
    this.welcomeLabel = this.game.add.text(this.player.sprite.x - 10, this.player.sprite.y - 80, this.cross, this.cross_style);
  },

  /**
   * Andi: method to get a path for the enemy
   * */
  getEnemyPath: function () {

    //get its tiles
    var currentTileX = this.backgroundlayer.getTileX(this.enemy.sprite.x);
    var currentTileY = this.backgroundlayer.getTileY(this.enemy.sprite.y);

    var playerTileX = this.backgroundlayer.getTileX(this.player.sprite.x);
    var playerTileY = this.backgroundlayer.getTileY(this.player.sprite.y);

    this.findPathTo(currentTileX, currentTileY, playerTileX, playerTileY);

  },

  /**
   * Andi: function called in the callback function of the find path algorithm
   * Sets the enemy's path to the player to that of the path just found
   * */
  setNewPath: function (path) {
    this.enemy.pathToPlayer = path;
  },

  findPathTo: function (enemyX, enemyY, playerX, playerY) {

    var self = this;
    this.pathfinder.setCallbackFunction(function (path) {
      path = path || [];
      self.setNewPath(path);
    });

    this.pathfinder.preparePathCalculation([enemyX, enemyY], [playerX, playerY]);
    this.pathfinder.calculatePath();
  },

  displayNote: function () {
    this.metricsSystem.logNoteOpened();
    fPause = true;
    this.input.focus();
    this.game.input.keyboard.reset(false);
    this.game.input.keyboard.enabled = false;
    document.getElementById("mainLayer").style.display = "block";
    //document.getElementById("mainCanvas").context.fillStyle = 'blue';
    document.getElementById("inputPwd").style.display = "block";
    document.getElementById("titlePwd").style.display = "block";
    document.getElementById("policyTitle").style.display = "block";
    document.getElementById("esc").style.display = "none";
    document.getElementById("titlePwd").innerHTML = "Type in passwords you want to save:";
    document.getElementById("policyTitle").innerHTML = "Your notes :";
    document.getElementById("policyRules").innerHTML = this.notes;
  },

  hideNote: function () {
    this.metricsSystem.logNoteClosed(); //Should be in the right place ~BMDK
    this.closePopup();
  },

  manageNote: function () {
    if(document.getElementById("esc").style.display === "block" || document.getElementById("hintsLayer").style.display === "block")
      return;
    // Switch
    this.noteButton.clicked = !this.noteButton.clicked;
    if (this.noteButton.clicked) {
      this.noteButton.setFrames(16, 16, 16, 16);
      this.displayNote();
    } else {
      this.noteButton.setFrames(16, 15, 15, 15);
      this.hideNote();
    }
  },

  manageAntivirus: function () {
    // if no antivirus available
    if (this.player.antivirusBag.length === 0) {
      this.antivirusButton.setFrames(5, 5, 5, 5);
      return;
    }
    this.getCurrentRoom(this.player);
    // if successful
    if(this.player.disinfect()){
      this.loadRooms();

      // Check again
      if (this.player.antivirusBag.length === 0) {
        this.antivirusButton.setFrames(5, 5, 5, 5);
      }
      else {
        this.antivirusButton.setFrames(3, 4, 3, 3);
      }
    }
  },

  manageFirewall: function () {
    // if no antivirus available
    console.log("number of firewall items: " + this.player.firewallBag.length);
    if (this.player.firewallBag.length === 0) {
      this.firewallButton.setFrames(11, 11, 11, 11);
      return;
    }
    else if (this.player.firewallBag.length > 0) {
      this.firewallButton.setFrames(10, 9, 9, 9);
      this.firewallButton.clicked = !this.firewallButton.clicked;
      if (this.firewallButton.clicked) {
        this.firewallButton.setFrames(10, 10, 10, 10);
        //isOnFire = true;
        this.enemy.isOnFire = true;
        this.metricsSystem.usedTool("firewall", true);
        this.scoreSystem.scoreFirewall();
        this.player.firewallBag.length -=1;
        this.setEnemyUnmovable();
        this.game.time.events.add(3500, this.setEnemyMovable, this); // the enemy stops moving for 7 seconds
        //isOnFire = false;
        if (this.player.firewallBag.length === 0) {
          this.firewallButton.setFrames(11, 11, 11, 11);
        }
        else {
          this.firewallButton.setFrames(10, 9, 9, 9);
        }
      }
    }
  },
  /**
   * Andi: game over function; simply ends the game and start the game over state
   * */
  gameOver: function(){

    if(isLethal) {
      runningSound.stop();
      finalscore = this.scoreSystem.score;
      this.state.start('GameLost');
    }

  }

};

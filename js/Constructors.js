/**
 * Created by andi on 27/01/15.
 */
var Encrypt = Encrypt || {};
/*
 * _________________________________________________________________________________________________________________
 * Note area
 * */
Note = function () {
    /* an array to keep track of the passwords written down; it should be an array of arrays so that it can track
     the password with its corresponding policy. */
    this.passwords =[];
};

Note.prototype = {
    write: function(password){
        if(typeof(password) === 'string')
            this.passwords.push(password);
        //otherwise do nothing
    }
};
/*
 * ________________________________________________________________________________________________________________
 * Player area
 * */
Player = function (currentX, currentY, game, score, metrics) {

    // player's location on the map
    this.currentX = currentX;
    this.currentY = currentY;
    this.currentRoom = 0;
    this.game = game;
    this.score = score; // variable that holds a reference to the score system | used in disinfect
    this.metrics = metrics;

    this.firewallBag = [];  // stores: firewall objects collected from the map @iva
    this.antivirusBag = []; // stores: antivirus objects collected from the map @iva
    this.antikeyLoggerBag = []; // stores: antikeylogger objects from the map @iva

    this.note = new Note();
    this.passwordResetsAvailable = 5;

    // policies dictionary: keeps track of what policies the player has access to
    this.policies = {};
    this.policies["green"] = new Policy(-1, -1, this.game, 5, 0, 0, 0, 0, "green" );

    this.sprite = game.add.sprite(currentX, currentY, 'player');
    game.physics.enable(this.sprite, Phaser.Physics.ARCADE);
    game.camera.follow(this.sprite);
    this.sprite.body.immovable = false;
    this.sprite.body.collideWorldBounds = true;
    this.sprite.body.bounce.setTo(1, 1);
};

Player.prototype = {

    /**use item from bag on a specified target - will call the object's "use()" method
     due to small number of objects, will use a switch case to handle usage */
    use: function (item) {

        switch (item) {
            case 'antivirus':
                if (this.antivirusBag != null) {
                    this.antivirusBag [this.antivirusBag.length - 1].use();  //antivirus will hold position 0
                }
                //do nothing if the player doesn't have the object; potentially play a sound to let him know what's going awn.
                break;

            case 'AntiKeyLog':
                if (this.antikeyLoggerBag [this.antikeyLoggerBag.length - 1] != null)
                    this.antikeyLoggerBag [this.antikeyLoggerBag.length - 1].use();
                break;

            case 'firewall':
                if (this.firewallBag [this.firewallBag.length - 1] != null) {
                    this.firewallBag [this.firewallBag.length - 1].use();
                }
                break;
        }

    },

    /**
     * Function used to disinfect a room
     * @param: room - the room to disinfect
     * @return: boolean - indication whether disinfection happened
     * */
    disinfect: function(){
        var successful = false;
        if( currentPlayerRoom.properties.infected && this.antivirusBag.length > 0 ){

            currentPlayerRoom.properties.infected = false;
            this.antivirusBag.splice(this.antivirusBag.length-1, 1 );
            // take note of this in the score system
            this.score.scoreNeutralise("room");
            this.metrics.usedTool("antivirus", true);
            successful = true;
        }
        else if(!currentPlayerRoom.properties.infected) {
            // mark it as a fail only when the room is not infected
            this.score.scoreNeutralise("failed");
            this.metrics.usedTool("antivirus", false);
        }
        return successful;
    },

    /**
     * Function for when the user wants to remove the keylogger on a door; should be called through a button on the input form
     * @param: door - the door to test & remove keylogger
     * */
    removeKeylogger: function(door){
        var successful = false;
        if(door.hasKeylogger !== undefined && this.antikeyLoggerBag.length > 0){

            if(door.hasKeylogger === true) {
                door.hasKeylogger = false;
                this.antikeyLoggerBag.splice(this.antikeyLoggerBag.length-1, 1);
                //take note in the score system
                this.score.scoreNeutralise("door");
                this.metrics.usedTool("antikeylogger", true);
                successful = true;
            }
            else {
                this.score.scoreNeutralise("failed");
                this.metrics.usedTool("antikeylogger", false);
            }
        }
        return successful
    },
    /**
     * Function to add an item to the player's bag; assume item is a string saying what type of item we're adding
     * */
    addItem: function (numb) {
        if (numb === 1) {
            this.firewallBag.push(this.firewallBag.length + 1);  // increment the firewall bag
        }
        else if (numb === 2) {
            this.antivirusBag.push(this.antivirusBag.length + 1);
        }
        else if (numb === 3) {
            this.antikeyLoggerBag.push(this.antikeyLoggerBag.length + 1);
        }
    },
    /**
     * Function adds policy for the player
     * @param policy - the policy to add
     */
    addPolicy: function(policy){

        // if the array stored in the player doesn't have the key corresponding to the colour of the given policy
        if(!this.policies.hasOwnProperty(policy.colour))
            this.policies[policy.colour] = policy;
        //else do nothing
    }
};

/*
 * ________________________________________________________________________________________________________________
 * Enemy area
 * */
Enemy = function(currentX, currentY, game, player, backgroundLayer) {

    // x,y coordinates
    this.currentX = currentX;
    this.currentY = currentY;

    this.game = game;
    this.player = player;
    this.backgroundLayer = backgroundLayer;
    this.currentRoom = 10;
    this.previousRoom = this.currentRoom; // Andi: a variable used for infecting rooms; set to the default room upon creation
    this.lastKnownDirections = ["",""];
    this.lastKnownY = 0;
    this.lastKnownX = 0;
    this.isstuckcount = 0;
    this.isOnFire = false;

    // @iva: the enemy's dictionary with most used passwords:
    this.passwordsDictionary = {
        letmein:1,
        00000000:1,
        qwerty:1,
        12345678:1,
        12345:1,
        monkey:1,
        123123:1,
        password:1,
        abc123: 1};
    // speed of the enemy - set to 10.0 by default
    this.speed = 280;
    // logger chance - set to 0.1 by default - set to private as not used outside of object
    this.loggerChance = 0.1;
    // room infection chance set to 0.1 by default - set to private as not used outside of object
    this.virusChance = 0.1;
    // an array that stores the path to the player
    this.pathToPlayer = [];
    //variable to keep track of how often the path-finding algorithm is called
    //this.countsToFindPath = 30;
    //variable to keep track of the position in the path array; set to 1 as the first element is the enemy's position
    this.pathPosition = 1;

    this.isMovable = true; /* @iva: is the enemy disabled to move.NOTE: this variable is used only for testing.
     As soon as the door breaking functionality is ready, I will delete it */

    // variable to keep track of whether a new path is needed; default is true as we don't have a path yet
    this.needNewPath = true;
    //variable to keep track of how long it's taking the enemy to get to the next tile; when it gets to 0, a new path is requested
    this.nextTileCounter = 15;

    // this.spriteOnFire = game.add.sprite(currentX, currentY, 'enemyOnFire');
    this.spriteNotOnFire = game.add.sprite(currentX, currentY, 'enemy');

    //add its spriteSheet
    this.sprite = this.spriteNotOnFire;

    //BMDK: - Set sprite to first frame
    this.sprite.frame = 0;
    //BMDK: - Add animation loop for alien
    this.sprite.animations.add('any', [0, 1, 2, 3, 4], 15, true, true);

    game.physics.enable (this.sprite, Phaser.ARCADE);
    this.sprite.body.immovable = false;
    this.sprite.body.collideWorldBounds = true;
    this.sprite.enableBody = true;
};

Enemy.prototype = {

    update: function () {
        if (this.isMovable && this.isOnFire){
            this.isOnFire = false;
        }
        if (this.isOnFire){
            this.sprite.frame = enemyFrame%5 + 5;
        } else {
            this.sprite.frame = enemyFrame%5;
        }

        this.hasChangedRoom();

        if (this.pathToPlayer.length !== 0) {
            // if the array is not empty or we've not reached the end of the array
            if (this.pathPosition < this.pathToPlayer.length) {
                // if we've reached the next tile in the path
                if (this._onNextTile()) {
                    //increment our position in the path
                    this.pathPosition++;
                    //re-initialise the counter when a new tile is moved to
                    this.nextTileCounter = 30;
                }
                else {
                    //otherwise, move in that direction
                    this._moveInNextDirection();
                    //decrement the tile counter at every move
                    this.nextTileCounter--;
                }

                if (this.nextTileCounter === 0) {
                    this.needNewPath = true;
                    this.nextTileCounter = 30;
                }
            }
            else {
                // need a new path
                this.needNewPath = true;
                this.nextTileCounter = 30;
                //reset the position in the array
                this.pathPosition = 0;
            }
        }
        else {
            this.needNewPath = true;
        }

    },

    /**
     * Private function that returns true if the enemy is on the next tile in the path or false if it is not
     * */
    _onNextTile: function(){
        // current tile
        var enemyTileX = this.backgroundLayer.getTileX(this.sprite.x);
        var enemyTileY = this.backgroundLayer.getTileY(this.sprite.y);

        var next = this.pathToPlayer[this.pathPosition];
        var nextTileX = next.x;
        var nextTileY = next.y;

        if( enemyTileX === nextTileX && enemyTileY === nextTileY ) {
            return true;
        }
        return false;
    },

    _moveInNextDirection: function(){
        //the positions
        var enemyTileX = this.backgroundLayer.getTileX(this.sprite.x);
        var enemyTileY = this.backgroundLayer.getTileY(this.sprite.y);

        var nextTileX = this.pathToPlayer[this.pathPosition].x;
        var nextTileY = this.pathToPlayer[this.pathPosition].y;

        this.sprite.body.velocity.x = 0;
        this.sprite.body.velocity.y = 0;

        // properly stuck, increment count for how many cycles stuck
        if (this.lastKnownX === enemyTileX && this.lastKnownY === enemyTileY){
            this.isstuckcount++;
        }
        // go right
        if( nextTileX > enemyTileX && nextTileY === enemyTileY) {
            //If he is stuck and was last headed up, shift upwards
            if (this.lastKnownX === enemyTileX && this.lastKnownDirections[0] === "up" && this.isstuckcount > 2) {
                this.lastKnownX = 0;
                this.lastKnownY = 0;
                this.sprite.body.velocity.y -= this.speed;
                this.isstuckcount = 0; //no longer stuck
            } //If he is stuck and was last headed down, shift downwards
            else if (this.lastKnownX === enemyTileX && this.lastKnownDirections[0] === "down" && this.isstuckcount > 2) {
                this.lastKnownX = 0;
                this.lastKnownY = 0;
                this.sprite.body.velocity.y += this.speed;
                this.isstuckcount = 0; //no longer stuck
            } else {
                this.lastKnownX = enemyTileX;
                this.lastKnownY = enemyTileY;
                this.sprite.body.velocity.x += this.speed;
                this.lastKnownDirections[1] = "right";
                this.lastKnownDirection = "right";
            }
        }

        // go left
        else if( nextTileX < enemyTileX && nextTileY === enemyTileY) {
            //If he is stuck and was last headed up, shift upwards
            if (this.lastKnownX === enemyTileX && this.lastKnownDirections[0] === "up" && this.isstuckcount > 2) {
                this.lastKnownX = 0;
                this.lastKnownY = 0;
                this.sprite.body.velocity.y -= this.speed;
                this.isstuckcount = 0; //no longer stuck
            } //If he is stuck and was last headed down, shift downwards
            else if (this.lastKnownX === enemyTileX && this.lastKnownDirections[0] === "down" && this.isstuckcount > 2) {
                this.lastKnownX = 0;
                this.lastKnownY = 0;
                this.sprite.body.velocity.y += this.speed;
                this.isstuckcount = 0; //no longer stuck
            } else {
                this.lastKnownX = enemyTileX;
                this.lastKnownY = enemyTileY;
                this.sprite.body.velocity.x -= this.speed;
                this.lastKnownDirections[1] = "left";
                this.lastKnownDirection = "left";
            }
        }

        // go up
        else if( nextTileX === enemyTileX && nextTileY < enemyTileY) {
            //If he is stuck and was last headed left, shift left to correct
            if (this.lastKnownY === enemyTileY && this.lastKnownDirections[1] === "left" && this.isstuckcount > 2) {
                this.lastKnownX = 0;
                this.lastKnownY = 0;
                this.sprite.body.velocity.x -= this.speed;
                this.isstuckcount = 0; //no longer stuck
            } //If he is stuck and was last headed right, shift right to correct
            else if (this.lastKnownY === enemyTileY && this.lastKnownDirections[1] === "right" && this.isstuckcount > 2) {
                this.lastKnownX = 0;
                this.lastKnownY = 0;
                this.sprite.body.velocity.x += this.speed;
                this.isstuckcount = 0; //no longer stuck
            } else {
                this.lastKnownX = enemyTileX;
                this.lastKnownY = enemyTileY;
                this.sprite.body.velocity.y -= this.speed;
                this.lastKnownDirections[0] = "up";
                this.lastKnownDirection = "up";
            }
        }

        // go down
        else if( nextTileX === enemyTileX && nextTileY > enemyTileY) {
            //If he is stuck and was last headed left, shift left to correct
            if (this.lastKnownY === enemyTileY && this.lastKnownDirections[1] === "left" && this.isstuckcount > 2) {
                this.lastKnownX = 0;
                this.lastKnownY = 0;
                this.sprite.body.velocity.x -= this.speed;
                this.isstuckcount = 0; //no longer stuck
            } //If he is stuck and was last headed right, shift right to correct
            else if (this.lastKnownY === enemyTileY && this.lastKnownDirections[1] === "right" && this.isstuckcount > 2) {
                this.lastKnownX = 0;
                this.lastKnownY = 0;
                this.sprite.body.velocity.x += this.speed;
                this.isstuckcount = 0; //no longer stuck
            } else {
                this.lastKnownX = enemyTileX;
                this.lastKnownY = enemyTileY;
                this.sprite.body.velocity.y += this.speed;
                this.lastKnownDirections[0] = "down";
                this.lastKnownDirection = "down";
            }
        }
        // go down and left
        else if( nextTileX < enemyTileX && nextTileY > enemyTileY ) {
            this.sprite.body.velocity.x -= this.speed;
            this.sprite.body.velocity.y += this.speed;
            this.lastKnownDirections[0] = "down";
            this.lastKnownDirections[1] = "left";
        }
        // down & right
        else if( nextTileX > enemyTileX && nextTileY > enemyTileY ) {
            this.sprite.body.velocity.x += this.speed;
            this.sprite.body.velocity.y += this.speed;
            this.lastKnownDirections[0] = "down";
            this.lastKnownDirections[1] = "right";
        }
        // go up and left
        else if( nextTileX < enemyTileX && nextTileY < enemyTileY ) {
            this.sprite.body.velocity.x -= this.speed;
            this.sprite.body.velocity.y -= this.speed;
            this.lastKnownDirections[0] = "up";
            this.lastKnownDirections[1] = "left";
        }

        // go up and right
        else if( nextTileX > enemyTileX && nextTileY < enemyTileY ) {
            this.sprite.body.velocity.x += this.speed;
            this.sprite.body.velocity.y -= this.speed;
            this.lastKnownDirections[0] = "up";
            this.lastKnownDirections[1] = "right";
        }
    },

    /**
     * Function used to put a keylogger on a door. Called when the enemy breaks a door
     * @param: door - the door to keylog
     * */
    putKeyLogger: function(door){
        //add property to the door object
        door.hasKeylogger = true;

        // add a function to the door to send the set passwords to the enemy array
        door.keylog = function( password, enemy ){

            enemy.addPasswordToDictionary(password);
        }
    },

    /**
     * Function that returns true if the enemy is going to keylog a door, and false if not
     * */
    willKeylog: function(){
        var infectionChance = Math.random();
        if( infectionChance < this.loggerChance)
            return true;
        return false;
    },

    /**
     * Function that returns true if the enemy is going to keylog a door, and false if not
     * */
    willInfect: function(){
        var infectionChance = Math.random();

        if( infectionChance < this.virusChance)
            return true;
        return false;
    },
    /**
     * Function used to keep track of whether the enemy has gone into a new room or not.
     * If it has, it calls infect and updates the field.
     * */
    hasChangedRoom: function(){
        if(this.currentRoom != this.previousRoom){
            this.previousRoom = this.currentRoom;

            if( this.willInfect() )
                this.infect(currentEnemyRoom);
        }

    },
    /**
     * Function used to infect a given room
     * @param room
     */
    infect: function(room){
        room.properties.infected = true;
    },
    /**
     * Function used to add a password to the enemy's dictionary
     * @param: password - the password to store
     * */
    addPasswordToDictionary: function(password){
        if(typeof(password) === "string") {

            // check if it's in the password array or not
            if (this.passwordsDictionary.hasOwnProperty(password)) {
                //add one to its value
                this.passwordsDictionary[password] += 1;
            }
            else
            //otherwise, initialise it to 1
                this.passwordsDictionary[password] = 1;
        }

    },
    /**
     * Function that checks whether the enemy has a password in its dictionary or not
     * @param: password - the password to be checked
     * @returns: true if it contains the password, false otherwise
     * */
    hasPassword: function( password ){

        if( this.passwordsDictionary.hasOwnProperty(password))
            return true;

        return false;
    }

};
/*
 *  ________________________________________________________________________________________________________________
 *  Policy area
 * */
/**
 * Policy object constructor. Used for enabling the user to go through doors of belonging to a particular policy;
 * defines the policy of a door; can be found on map; is pickable
 * */
Policy = function( currentX, currentY, game, minLength, minUpper, minLower, minNums, minPunctOrSpecChar, colour) {
    // the attributes of the policy object should be the specifications for how passwords should look like
    this.game = game;
    //minimum length of a password
    this.minLength = minLength;
    // maximum length of a password set to a default of 15; should be changed
    this.maxLength = 15;
    // minimum number of upper case letters
    this.minUpper = minUpper;
    // minimum number of lower case letters
    this.minLower = minLower;
    // minimum number of numbers
    this.minNums = minNums;
    // minimum number of punctuation signs
    // minimum number of special characters, i.e. @, #, %, ^, &, *, ~
    this.minPunctOrSpecChar = minPunctOrSpecChar;
    // colour corresponding to the policy
    this.colour = colour;

    if (currentX >= 0 && currentY >= 0) {

        this.policy = game.add.sprite(currentX, currentY, 'policy');
        game.physics.enable(this.policy, Phaser.Physics.ARCADE);
        //made immovable as we don't want it thrown around the map
        this.policy.body.immovable = true;
    }
    // there was no need for methods, as the attributes are set to public
};
/*
 *  ________________________________________________________________________________________________________________
 *  Metrics System area
 * */
MetricsSystem = function( game){
    this.game = game;

    /*an associative array to store the in-game passwords
     http://stackoverflow.com/questions/1208222/how-do-i-implement-a-dictionary-or-hashtable-in-javascript
     each entry will be a password once entered; if the password is already in, increment it's associated value
     */
    this.passwords = {};

    /*another associative array to keep track of the passwords that were reset*/
    this.resetPasswords = {};

    /* another associative array to keep track of what passwords were re-used on doors, and on which of them; used to determined best remembered password*/
    this.passwordsUsed = {};

    /*an associative array to keep track of the passwords input on doors, but rejected by the checker*/
    this.rejectedPasswords = {};

    /*another associative array to keep track of what objects were used, how many times, and how*/
    this.toolsUsed = {};
    this.toolsUsed["firewall"] = [];            // initialised three fields, where each array holds booleans
    this.toolsUsed["antivirus"] = [];           // one entry in the array will serve as a time when that tools was used
    this.toolsUsed["antikeylogger"] = [];       // it will be true if the operation was successful; false if not

};

MetricsSystem.prototype = {
    /**
     * Method to be called when a policy is picked up
     * @param colour - a colour of a policy
     */
    addPolicyCollected: function(colour){
        storeUserPoliciesCollectedToDB(colour);
    },
    /**
     * Function to be called when a password is being submited on the doors
     * @param password
     * @param entropy
     * @param doorID
     */
    addPassword: function(password, entropy, doorID){
        storePasswordToDB(password, entropy, password.length);
        var score12 = entropy*10;
        storeUserPasswordsEnteredToDB(doorID, score12);
        //first check if the parameter is actually a string
        if(typeof(password) === "string") {

            // check if it's in the password array or not
            if (this.passwords.hasOwnProperty(password)) {
                //add one to its value
                this.passwords[password] += 1;
            }
            else
            //otherwise, initialise it to 1
                this.passwords[password] = 1;
        }
    },
    /**
     * Function to be called only when a password is reset on a door; will add the password to be replaced to an array
     * @param password
     * @param doorID
     * @param penalty
     */
    addResetPassword: function(password, doorID, penalty){
        storePasswordResetsToDB(doorID, penalty);
        if( typeof(password) === "string"){
            //we'll use the same rationale as in the normal password array; if a password was reset more than once, take note

            // check if it's in the password array or not
            if (this.resetPasswords.hasOwnProperty(password)) {
                //add one to its value
                this.resetPasswords[password] += 1;
            }
            else
            //otherwise, initialise it to 1
                this.resetPasswords[password] = 1;
        }
    },
    /**
     * Function to be called whenever the player goes through a door using a password he set; doorID is the id of the door he went through
     * This can be used to determine which passwords were used on more than one door
     * @param password
     * @param doorID
     */
    addUsedPassword: function(password, doorID){
        storeUsersSuccessfulPasswordUse(doorID);
        if( typeof(password) === "string"){

            // check if it's in the password array or not
            if (this.passwordsUsed.hasOwnProperty(password)) {
                //add the ID of the door it was used on
                this.passwordsUsed[password].push(doorID);
            }
            else
            //otherwise, initialise it's array of doors with the one it was used on
            //NOTE: this does not include the time when the user set the password the first time around
                this.passwordsUsed[password] = [doorID];
        }
    },

    //Log whenever the user goes up to a door - added by BMDK
    addUserDoorVisit: function (doorID){
        storeDoorVisitsToDB(doorID);
    },
    //Log whenever the user collects a tool - added by BMDK
    addToolCollected: function (tid){
        storeUserToolsCollectedToDB(tid);
    },
    //Log whenever the user collects a hint - added by BMDK
    addHintCollected: function (cid){
        storeUserEducationalInfoCollectToDB(cid);
    },
    //log when hints & tips are opened
    addStartInfoRead: function(){
        storeUserStartedReadingTipToDB();
    },
    //log when finished reading
    addEndInfoRead: function(){
        storeUserStoppedReadingTipToDB();
    },
    /**
     * Function to be called when a password input by the user on a door is rejected.
     * @param password: the actual string that was attempted
     * @param doorID: the door on which it was tried
     * @param: reason: the reason why it was rejected, i.e. not matching a password already set, or not matching policy
     * */
    addRejectedPassword: function(password, doorID, reason, entropy){
        storePasswordToDB(password, entropy, password.length);
        if (reason === "rejected"){
            storeBadPasswordToDB(doorID);
        } else if (reason === "inappropriate"){
            storeNonConformingPasswordToDB(doorID);
        }
        if( typeof(password) === "string"){

            if( this.rejectedPasswords.hasOwnProperty(password))
            // add an array representing the id of the door and the reason
                this.rejectedPasswords[password].push([doorID, reason ]);
        }
        else
        // initialise it to hold the first attempt
            this.rejectedPasswords[password] = [doorID, reason];
    },
    addNote: function(note){
        storeNoteToDB(note);
    },
    logNoteOpened: function(){
        storeUserStartedRorWNotesToDB();
    },
    logNoteClosed: function(){
        storeUserStoppedRorWNotesToDB();
    },

    /**
     * Function used whenever the player uses a tool. It adds the outcome (i.e. whether he was successful or not) to the array.
     * Can be used to calculate total number of times a tool was used, percentage of success, either in total, or per tool.
     * Can be used to find out which tool was used, and which not.
     * */
    usedTool: function(tool, successful){

        if( tool === "firewall"){
            this.toolsUsed["firewall"].push(successful);
            if(successful){
                storeUserToolsUsedToDB(1, 1);
            } else {
                storeUserToolsUsedToDB(1, 0);
            }

        }
        else if( tool === "antivirus"){
            this.toolsUsed["antivirus"].push(successful);
            if(successful){
                storeUserToolsUsedToDB(2, 1);
            } else {
                storeUserToolsUsedToDB(2, 0);
            }
        }
        else if( tool === "antikeylogger"){
            this.toolsUsed["antikeylogger"].push(successful);
            if(successful){
                storeUserToolsUsedToDB(3, 1);
            } else {
                storeUserToolsUsedToDB(3, 0);
            }
        }
    }
};
/*
 *  ________________________________________________________________________________________________________________
 *  Score System area
 * */
ScoreSystem = function(game){
    this.game = game;

    // the variable that is going to keep track of the actual score
    this.score = 0;

    //number of consecutive successful disinfections
    this.disinfections = 0;
};

ScoreSystem.prototype = {
    /**
     * Function used to award points to the player according to the entropy score he received upon setting a password.
     * Assumption: Entropy scores ar ein range 1 - 10
     * The parameter expected is an int
     * TO BE CALLED UPON SUCCESSFULLY SETTING UP A PASSWORD
     * */
    scorePassword: function( entropy ){
        //taking the floor of the entropy as it comes as a float
        if(typeof(entropy) === "number")
            this.score += 10 * entropy;

    },

    /**
     * Function used to award points to the player when he/she successfully disinfects a door/room
     * objectName is a string denoting what the player did; it's either "room," "door," or "failed"
     * "failed" is to be passed to the function when the player uses his tool on an uninfected object
     * TO BE CALLED WHEN THE DISINFECTANT TOOLS ARE USED
     * */
    scoreNeutralise: function (objectName){
        if( objectName === "door"){
            this.score += 20;   // as specified in the score system doc, 20 points are added
            this.disinfections++;
        }
        else if(objectName === "room"){
            this.score += 10;   //as above
            this.disinfections++;
        }
        else if(objectName === "failed"){
            this.disinfections = 0; // set this variable back to 0, to reset the streak
        }

        // give a bonus for a streak of successful disinfections
        if( this.disinfections > 1 && objectName !== "failed")
            this.score += this.disinfections * 5; // award a basic bonus according to the number of success
    },


    scoreFirewall: function(){
        this.score += 15;
    },

    /**
     * Function used when the player goes through a door he's already set a password on (i.e. when he remembers a password he set before)
     * Based on the entropy of the password: 25% of the initial score awarded for setting the password
     * TO BE USED ONLY WHEN THE PLAYER INPUTS A PASSWORD HE SET PREVIOUSLY
     * */
    scorePassingThroughDoorWithoutResetting: function(password, entropy, player){
        var found = false;

        //look through the player's note to see if he has it already stored
        if( player.note.length > 0) {

            for( var i = 0; i < player.note.length && !found; i++ ){
                if( password === player.note.length[i] )
                    found  = true;
            }
        }

        if( !found )
            this.score += 0.25 * ( entropy *10 );
    },

    /**
     * Function that subtracts points from the user for each reset he uses. Initial idea: subtract 50% of initial password score given
     * TO BE CALLED ONLY WHEN A RESET IS ISSUES AND COMPLETED
     * */
    scoreReset: function(entropy){
        this.score -= 0.5 * (entropy *10);
        //returning for the purpose of storing in the database
        return 0.5 * (entropy * 10);
    },

    /**
     * Function that subtracts points from the player when they write down one of the passwords. Decided to only take 10% points/password written
     * Only occurs when the thing written on the note is a string found as a password on the doors
     * @param: entropy is the entropy of the password written down on the note; used to subtract points from the player
     * */
    scorePasswordWriteDown: function(entropy){

        this.score -= 0.1 * (entropy * 10);
    },

    /**
     * Function to award points to the player when he picks up a tool or any other object
     * TO BE CALLED WHEN PICKING UP ANYOBJECT
     * */
    scoreObjectPickUp: function (){
        this.score += 5;
    },

    /**
     * Function used to give the player a bonus for winning the game & the enemy not being in the same room
     * */
    scoreEnemyNotInRoomBonus: function(){
        this.score += 50;
    },
    /**
     * Function used to award player a bonus upon finishing the game according to how far the enemy is from him
     * @param: pathLength - is the length of the path array stored in the enemy object
     * */
    scoreDistanceToPlayerBonus: function( pathLength ){
        //award 10 points per tile distance
        this.score += pathLength * 10;
    },

    /**
     * Function used to award points to the player upon finishing the game.
     * */
    scoreGameWon: function(){
        //award 100 points for winning the game
        this.score  += 100;
    }
};
// String matcher
StringMatcher = function(){

};

StringMatcher.prototype = {
    /**
     * A simple matching method that checks whether the note taken is the same as a password set on a door
     * @param: stringToMatch - the note taken
     * @param: targetedMatches - array of passwords on the doors
     * @returns: the true if found, false if not
     * */
    simpleMatch: function(stringToMatch, targetedMatches){
        var i = 0;
        while ( i < targetedMatches.length ){
            if( stringToMatch === targetedMatches[i])
                return true;
            i++;
        }
        return false;
    }
};
/*
 *  ________________________________________________________________________________________________________________
 *  Database setup area
 * */
//Storage of successful passwords to Passwords table BMDK - DONE
function storePasswordToDB(pwd, entropy, length) {
    if (pwd === "") {
        return;
    } else {
        if (window.XMLHttpRequest) {
            // code for IE7+, Firefox, Chrome, Opera, Safari
            xmlhttp = new XMLHttpRequest();
        } else {
            // code for IE6, IE5
            xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
        }
        xmlhttp.open("GET","storepassword.php?p="+pwd+"&ent="+entropy+"&len="+length,true);
        xmlhttp.send();
    }
};

//Storage of bad passwords to UsersBadPwdEntries -forgotten passwords(potentially) - DONE
function storeBadPasswordToDB(did) {
    if (window.XMLHttpRequest) {
        // code for IE7+, Firefox, Chrome, Opera, Safari
        xmlhttp = new XMLHttpRequest();
    } else {
        // code for IE6, IE5
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xmlhttp.open("GET","storebadpassword.php?did="+did,true);
    xmlhttp.send();
};


//Storage of non-conforming password entry to UserFailedPasswordAttempts - DONE
function storeNonConformingPasswordToDB(did) {

    if (window.XMLHttpRequest) {
        // code for IE7+, Firefox, Chrome, Opera, Safari
        xmlhttp = new XMLHttpRequest();
    } else {
        // code for IE6, IE5
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xmlhttp.open("GET","storefailedpassword.php?did="+did,true);
    xmlhttp.send();

};

//Storage of User Passwords entered -- DONE
function storeUserPasswordsEnteredToDB(did, score) {
    if (did === ""){
        return;
    } else {
        if (window.XMLHttpRequest) {
            // code for IE7+, Firefox, Chrome, Opera, Safari
            xmlhttp = new XMLHttpRequest();
        } else {
            // code for IE6, IE5
            xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
        }
        xmlhttp.open("GET","storepasswordsentered.php?did="+did+"&score="+score,true);
        xmlhttp.send();
    }
};

//Storage of User Password Resets -- DONE
function storePasswordResetsToDB(did, penalty) {
    if (did === "") {
        return;
    } else {
        if (window.XMLHttpRequest) {
            // code for IE7+, Firefox, Chrome, Opera, Safari
            xmlhttp = new XMLHttpRequest();
        } else {
            // code for IE6, IE5
            xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
        }
        xmlhttp.open("GET","storepasswordresets.php?did="+did+"&penalty="+penalty,true);
        xmlhttp.send();
    }
};

//Store successful password use
function storeUsersSuccessfulPasswordUse(did){
    if (did === "") {
        return;
    } else {
        if (window.XMLHttpRequest) {
            // code for IE7+, Firefox, Chrome, Opera, Safari
            xmlhttp = new XMLHttpRequest();
        } else {
            // code for IE6, IE5
            xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
        }
        xmlhttp.open("GET","storesuccpwduse.php?did="+did,true);
        xmlhttp.send();
    }
};
//Storage of User door visits -- DONE
function storeDoorVisitsToDB(did) {
    if (did === "") {
        return;
    } else {
        if (window.XMLHttpRequest) {
            // code for IE7+, Firefox, Chrome, Opera, Safari
            xmlhttp = new XMLHttpRequest();
        } else {
            // code for IE6, IE5
            xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
        }
        xmlhttp.open("GET","storedoorvisits.php?did="+did,true);
        xmlhttp.send();
    }
};

//Storage of User hints collected -- DONE
function storeUserEducationalInfoCollectToDB(cid) {
    if (cid === "") {
        return;
    } else {
        if (window.XMLHttpRequest) {
            // code for IE7+, Firefox, Chrome, Opera, Safari
            xmlhttp = new XMLHttpRequest();
        } else {
            // code for IE6, IE5
            xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
        }
        xmlhttp.open("GET","storeuseredinfo.php?cid="+cid,true);
        xmlhttp.send();
    }
};

//Storage of User Policies collected -- DONE
function storeUserPoliciesCollectedToDB(colour) {
    if (colour === "") {
        return;
    } else {
        if (window.XMLHttpRequest) {
            // code for IE7+, Firefox, Chrome, Opera, Safari
            xmlhttp = new XMLHttpRequest();
        } else {
            // code for IE6, IE5
            xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
        }
        xmlhttp.open("GET","storeuserpoliciescollected.php?colour="+colour,true);
        xmlhttp.send();
    }
};

//Storage of User Tools collected --DONE
function storeUserToolsCollectedToDB(tid) {
    if (tid === "") {
        return;
    } else {
        if (window.XMLHttpRequest) {
            // code for IE7+, Firefox, Chrome, Opera, Safari
            xmlhttp = new XMLHttpRequest();
        } else {
            // code for IE6, IE5
            xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
        }
        xmlhttp.open("GET","storeusertoolscollected.php?tid="+tid,true);
        xmlhttp.send();
    }
};

//Storage of User Tools Used
function storeUserToolsUsedToDB(tid ,success) {
    if (tid === "") {
        return;
    } else {
        if (window.XMLHttpRequest) {
            // code for IE7+, Firefox, Chrome, Opera, Safari
            xmlhttp = new XMLHttpRequest();
        } else {
            // code for IE6, IE5
            xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
        }
        xmlhttp.open("GET","storeusertoolsused.php?tid="+tid+"&success="+success,true);
        xmlhttp.send();
    }
};

//Storage of when hints and tips are re-read
function storeUserStartedReadingTipToDB(){
    if (window.XMLHttpRequest) {
        // code for IE7+, Firefox, Chrome, Opera, Safari
        xmlhttp = new XMLHttpRequest();
    } else {
        // code for IE6, IE5
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xmlhttp.open("GET","storeuseredreads.php?",true);
    xmlhttp.send();
};

//Storage of when hints & tips are closed
function storeUserStoppedReadingTipToDB(){
    if (window.XMLHttpRequest) {
        // code for IE7+, Firefox, Chrome, Opera, Safari
        xmlhttp = new XMLHttpRequest();
    } else {
        // code for IE6, IE5
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xmlhttp.open("GET","storeuseredreadsupdate.php?",true);
    xmlhttp.send();
};

//Storage of notes taken by the user
function storeNoteToDB(note){
    if (note === "") {
        return;
    } else {
        if (window.XMLHttpRequest) {
            // code for IE7+, Firefox, Chrome, Opera, Safari
            xmlhttp = new XMLHttpRequest();
        } else {
            // code for IE6, IE5
            xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
        }
        xmlhttp.open("GET","storeusernoteswritten.php?note="+note,true);
        xmlhttp.send();
    }
};

//Storage of when notes are opened
function storeUserStartedRorWNotesToDB(){
    if (window.XMLHttpRequest) {
        // code for IE7+, Firefox, Chrome, Opera, Safari
        xmlhttp = new XMLHttpRequest();
    } else {
        // code for IE6, IE5
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xmlhttp.open("GET","storeusernotesopened.php?",true);
    xmlhttp.send();
};

//Storage of when notes are closed
function storeUserStoppedRorWNotesToDB(){
    if (window.XMLHttpRequest) {
        // code for IE7+, Firefox, Chrome, Opera, Safari
        xmlhttp = new XMLHttpRequest();
    } else {
        // code for IE6, IE5
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xmlhttp.open("GET","storeusernotesclosed.php?",true);
    xmlhttp.send();
};
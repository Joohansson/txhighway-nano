"use strict";

// urls
const urlCash = "wss://ws.blockchain.info/bch/inv",
	urlCore = "wss://ws.blockchain.info/inv",
	urlCors = "https://cors-anywhere.herokuapp.com/",
	urlBlockchairCash = urlCors + "https://api.blockchair.com/bitcoin-cash/mempool/",
	urlBlockchairCore = urlCors + "https://api.blockchair.com/bitcoin/mempool/",
	urlBlockchainCore = "https://api.blockchain.info/charts/avg-confirmation-time?format=json&cors=true",
	urlPriceCash = "https://api.coinmarketcap.com/v1/ticker/bitcoin-cash/",
	urlPriceCore = "https://api.coinmarketcap.com/v1/ticker/bitcoin/";

// sockets
const socketCash = new WebSocket(urlCash), // io(urlCash),
	socketCore = new WebSocket(urlCore); //io(urlCore);

// DOM elements
const canvas = document.getElementById("renderCanvas"),
	ctx = canvas.getContext("2d"),
	cashPoolInfo = document.getElementById("cash-pool"),
	corePoolInfo = document.getElementById("core-pool"),
	cashEta = document.getElementById("cash-eta"),
	coreEta = document.getElementById("core-eta"),
	confirmedNotify = document.getElementById("confirmed-notify"),
	confirmedAmount = document.getElementById("confirmed-amount"),
	cashAddress = document.getElementById("cash-address-input"),
	coreAddress = document.getElementById("core-address-input"),
	speedSlider = document.getElementById("speedSlider"),
	volumeSlider = document.getElementById("volumeSlider"),
	page = document.getElementById("page"),
	transactionWrap = document.getElementById("tx-wrap"),
	transactionList = document.getElementById("transactions");

// for ajax requests
const xhrCash = new XMLHttpRequest(),
	xhrCore = new XMLHttpRequest(),
	xhrBlockchain = new XMLHttpRequest();

// sprites
const carCore = new Image(),
	carMicroCash = new Image(),
	carSmallCash = new Image(),
	carMediumCash = new Image(),
	carLargeCash = new Image(),
	carXLargeCash = new Image(),
	carWhaleCash = new Image(),
	carUserCash = new Image(),
	carMicroCore = new Image(),
	carSmallCore = new Image(),
	carMediumCore = new Image(),
	carLargeCore = new Image(),
	carXLargeCore = new Image(),
	carWhaleCore = new Image(),
	carUserCore = new Image(),
	carLambo = new Image(),
	carSpam = new Image(),
	carSatoshiDice = new Image(),
	carSegwit = new Image();

// sound system
let audioContext = new AudioContext();
let gainNode = audioContext.createGain();

// sound variables
let audioMotorcycle = null,
	audioCar = null,
	audioDiesel = null,
	audioSemi = null,
	audioMercy = null,
	audioRide = null,
	audioChaChing = null,
	audioWoohoo = null,
	audioSpam = null,
	audioAllSpam = null;

// constants
let WIDTH = canvas.width;
let HEIGHT = canvas.height;
let SINGLE_LANE = HEIGHT/14;
let SPEED = 8;
let SPEED_MODIFIER = 0.5;
let VOLUME = 1;
let PRICE_BCH = 0;
let PRICE_BTC = 0;

// max value for vehicle types
let TX_MICRO = 50,
	TX_SMALL = 100,
	TX_MEDIUM = 500,
	TX_LARGE = 1000,
	TX_WHALE = 10000; 	//BCH ~0.50 USD Dec 10/17 - BTC ~5.41 USD Dec 10/17

// animation
let requestID = null;

// booleans
let isVisible = true,
	konamiActive = false,
	isCashMuted = true,
	isCoreMuted = true;

// arrays for vehicles
let txCash = [],
	txCore = [];

// connect to sockets
socketCash.onopen = ()=>{
	socketCash.send(JSON.stringify({"op":"unconfirmed_sub"}));
	socketCash.send(JSON.stringify({"op":"blocks_sub"}));
}

socketCore.onopen = ()=> {
	socketCore.send(JSON.stringify({"op":"unconfirmed_sub"}));
	socketCore.send(JSON.stringify({"op":"blocks_sub"}));
}

socketCash.onmessage = (onmsg) =>{
	let res = JSON.parse(onmsg.data);

	if (res.op == "utx"){
		let t = parseInt(cashPoolInfo.textContent.replace(/\,/g,''));			
		cashPoolInfo.textContent = formatNumbersWithCommas(t +1);

		newTX(true, res.x);
	} else {
		blockNotify(res.x, true);
	}
}

socketCore.onmessage = (onmsg)=> {
	let res = JSON.parse(onmsg.data);

	if (res.op == "utx"){
		let t = parseInt(corePoolInfo.textContent.replace(/\,/g,''));			
		corePoolInfo.textContent = formatNumbersWithCommas(t +1);

		res.x.inputs.forEach(i => {
            if (JSON.stringify(i.script).length < 120){
				res.x["sw"] = true;
            }
		});	
		
		newTX(false, res.x);
	} else {
		blockNotify(res.x, false);
	}
}

// initialise everything
function init(){
	// setup canvas
	canvas.width = window.innerWidth; 
	canvas.height = window.innerHeight;

	// listenners
	window.addEventListener("load", resize, false);
	window.addEventListener("resize", resize, false);

	//cash vehicles
	carMicroCash.src = "assets/sprites/bch-micro.png";
	carSmallCash.src = "assets/sprites/bch-small.png";
	carMediumCash.src = "assets/sprites/bch-medium.png";
	carLargeCash.src = "assets/sprites/bch-large.png";
	carXLargeCash.src = "assets/sprites/bch-xlarge.png";
	carWhaleCash.src = "assets/sprites/bch-whale.png";
	carUserCash.src = "assets/sprites/tx-taxi.png"; 
	carLambo.src = "assets/sprites/lambo.png";
	carSatoshiDice.src = "assets/sprites/dice.png";

	//core vehicles
	carMicroCore.src = "assets/sprites/core-micro.png";
	carSmallCore.src = "assets/sprites/core-small.png";
	carMediumCore.src = "assets/sprites/core-medium.png";
	carLargeCore.src = "assets/sprites/core-xlarge.png";
	carXLargeCore.src = "assets/sprites/core-large.png";
	carWhaleCore.src = "assets/sprites/core-whale.png";
	carUserCore.src = "assets/sprites/tx-taxi.png";
	carSpam.src = "assets/sprites/spam.png";
	carSegwit.src = "assets/sprites/segwit.png";

	// hide signes on small screens
	if(canvas.width <= 800 && canvas.height <= 600) {
		$("input.overlay-switch")[0].checked = true;
		$( ".sign" ).fadeToggle( "slow", "linear" );
	}

	// assign sounds to variables
	loadSound("assets/audio/motorcycle-lowergain.mp3", "motorcycle")
	loadSound("assets/audio/car-pass-lowergain.mp3", "car");
	loadSound("assets/audio/diesel-pass.mp3", "diesel");
	loadSound("assets/audio/semi-pass.mp3", "semi");
	loadSound("assets/audio/mercy-6s.mp3", "mercy");
	loadSound("assets/audio/ride-dirty-7s.mp3", "ride");
	loadSound("assets/audio/cha-ching.mp3", "cha-ching")
	loadSound("assets/audio/woohoo.mp3", "woohoo");
	loadSound("assets/audio/spam.mp3", "spam");
	loadSound("assets/audio/allspam.mp3", "allspam");

	// acquire data for signs
	getPoolData(urlBlockchairCash, xhrCash, true);
	getPoolData(urlBlockchairCore, xhrCore, false);
	getCoreConfTime(urlBlockchainCore, xhrBlockchain);
	getPriceData(urlPriceCash);
	getPriceData(urlPriceCore);

	// remove loading screen
	onReady(function () {
		show('page', true);
		show('loading', false);
	});

	requestID = requestAnimationFrame(animate);
}

function getPriceData(url){
	let xhr = new XMLHttpRequest();

	xhr.onload = function(){
		if (this.readyState == 4 && this.status == 200) {		
			let res = JSON.parse(this.responseText);
			if (res[0].symbol == "BCH"){
				PRICE_BCH = res[0].price_usd;
				document.getElementById("price_bch").textContent = "USD $" + formatNumbersWithCommas(PRICE_BCH);
			} else {
				PRICE_BTC = res[0].price_usd;
				document.getElementById("price_btc").textContent = "USD $" + formatNumbersWithCommas(PRICE_BTC);
			}
		}
	}

	xhr.open('GET', url, true);
	xhr.send(null);
}

// adds thousands seperator to large numbers
function formatNumbersWithCommas(x){
	return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");	
}

// notify users when a new block is found
function blockNotify(data, isCash){
	let t = 0;
	let ticker = "";
	let amount = 0;

	if(isCash){
		ticker = "BCH";
		t = parseInt(cashPoolInfo.textContent.replace(/\,/g,''));
		amount = data.nTx;
		cashPoolInfo.textContent = formatNumbersWithCommas(t - amount);//"UPDATING";
	} else {
		ticker = "BTC";
		t = parseInt(corePoolInfo.textContent.replace(/\,/g,''));
		amount = data.nTx;

		// sets speed modifier for btc lane
		let mod = t/amount/100;
		if (mod >= 0.9){
			SPEED_MODIFIER = 0.9;
		} else {
			SPEED_MODIFIER = 1 - mod;
		}

		corePoolInfo.textContent = formatNumbersWithCommas(t - amount);
	}

	if (isVisible) playSound(audioChaChing);
	
	confirmedAmount.textContent = amount + " " + ticker;
	confirmedNotify.style.display = "block"; //no pun intended
	setTimeout(() => {
		confirmedNotify.style.display = "none";
		getPoolData(urlBlockchairCash, xhrCash, true);
		getPoolData(urlBlockchairCore, xhrCore, false);
		getPriceData(urlPriceCash);
		getPriceData(urlPriceCore);
	}, 5000);
}

// retrieve pool information for signs
function getPoolData(url, xhr, isCash){
	xhr.onload = function () {
		if (this.readyState == 4 && this.status == 200) {
			let obj = JSON.parse(this.responseText);

			obj.data.forEach((key)=>{
				if (key.e =="mempool_transactions"){
					if (isCash){
						cashPoolInfo.textContent = formatNumbersWithCommas(key.c);
					} else {
						corePoolInfo.textContent = formatNumbersWithCommas(key.c);
						let mod = key.c/2400/100;
						if (mod >= 0.9){
							SPEED_MODIFIER = 0.9;
						} else {
							SPEED_MODIFIER = 1 - mod;
						}
					}
				}
			});
		} 
	}

	xhr.open('GET', url, true);
	xhr.send(null);
}

// get average confirmation time for btc
function getCoreConfTime(url, xhr){
	xhr.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			let obj = JSON.parse(xhr.responseText);
			coreEta.textContent = obj.period;
		}
	}
	xhr.open("GET", url, true);
	xhr.send(null);
}

// resize the window
function resize(){
	HEIGHT = window.innerHeight;
	WIDTH = window.innerWidth;
	SINGLE_LANE = HEIGHT/14;

	canvas.width = WIDTH;
	canvas.height = HEIGHT;
}


// pause everything when window loses focus
let vis = (function(){
    let stateKey, eventKey, keys = {
        hidden: "visibilitychange",
        webkitHidden: "webkitvisibilitychange",
        mozHidden: "mozvisibilitychange",
        msHidden: "msvisibilitychange"
    };
    for (stateKey in keys) {
        if (stateKey in document) {
            eventKey = keys[stateKey];
            break;
        }
    }
    return function(c) {
        if (c) document.addEventListener(eventKey, c);
        	return !document[stateKey];
    }
})();

vis(function(){
	if (vis()){
		txCash = [];
		txCore = [];
		drawBackground();
		requestAnimationFrame(animate);
		isVisible = true;
	} else{
		cancelAnimationFrame(requestID);		
		isVisible = false;
	}
});

// create a new transaction
function newTX(isCash, txInfo){
	if (isCash){
		let randLane = Math.floor(Math.random() * 8) + 1;
		createVehicle(isCash, txCash, txInfo, randLane, true);
	} else {
		createVehicle(isCash, txCore, txInfo, 10, false);
	}
}

// adds tx info to the side list
function addTxToList(isCash, txid, valueOut, car){

	let node = document.createElement("LI");
	let text = "txid: " + txid.substring(0, 7) + "...\n";
	text += "value: " + valueOut.toString().substring(0,9);
	let textNode = document.createTextNode(text);

	node.setAttribute("style", "background-image: url(" + car.src + ");");

    if (isCash){
        node.className = "txinfo-cash";
    } else {
        node.className = "txinfo-core";
    }

	node.appendChild(textNode);
	transactionList.prepend(node);

	if (transactionList.childNodes.length > 50){
		transactionList.removeChild(transactionList.childNodes[transactionList.childNodes.length -1]);
	}
}

// create vehicles and push to an array
function createVehicle(type, arr, txInfo, lane, isCash){
	let donation = false;
	let userTx = isUserTx(txInfo);
	let sdTx = false;

	if(isCash){
		donation = isDonationTx(txInfo);
		sdTx = isSatoshiDiceTx(txInfo);
	}

	let val = 0;
	txInfo.out.forEach((tx)=>{
		let v = tx.value/100000000;
		val += v;
	});

	let car = getCar(val, donation, isCash, userTx, sdTx, txInfo.sw);
	let width = SINGLE_LANE * (car.width / car.height);
	let x = -width;

	// fix vehicle positioning to prevent pile ups.
	if (arr.length > 0){
		arr.forEach((key) => {
			if (width >= key.x && lane == key.lane){
				x = key.x - width - 20;
			}
		});
	}

	// fix btc vehicle positioning to prevent pile ups. <-- use this if above causes performance issues
/*  	if (arr.length > 0 && !isCash){
		let last = arr[arr.length -1];
		if (width >= last.x && lane == last.lane){
			x = last.x - width - 10;
		}
	} */

	arr.push({
		type:type,
		id: txInfo.hash,
		car: car,
		x: x,
		lane: lane,
		h: SINGLE_LANE,
		w: width,
		valueOut: val,
		donation: donation,
		userTx: userTx,
		isCash: isCash
	});
}

/* return car based upon transaction size*/
function getCar(valueOut, donation, isCash, userTx, sdTx, sw){
	if (donation == true){
		SPEED = 4;
		return carLambo;
	}

	if(sw) return carSegwit;
	// satoshi dice tx
	if(sdTx) return carSatoshiDice;	

	// user tx vehicles need to go here
	if (userTx){
		if (isCash){
			return carUserCash;
		} else {
			return carUserCore;
		}
	}

	let val = 0;
	if (isCash){
		val = valueOut * PRICE_BCH;
	} else {
		val = valueOut * PRICE_BTC;
	}
	
	if (val <= TX_MICRO){
		if (isCash){
			return carMicroCash;
		} else {
			return carMicroCore;
		}

	} else if (val > TX_MICRO && val <= TX_SMALL){
			if (isCash){
			return carSmallCash;
		} else {
			return carSmallCore;
		}

	} else if (val > TX_SMALL && val <= TX_MEDIUM){
		if (isCash){
			return carMediumCash;
		} else {
			return carMediumCore;
		}
	} else if (val > TX_MEDIUM && val <= TX_LARGE){
		if (isCash){
			return carLargeCash;
		} else {
			return carLargeCore;
		}
	} else if (val > TX_LARGE && val <= TX_WHALE){
		if (isCash){
			return carXLargeCash;
		} else {
			return carXLargeCore;
		}
	} else if (val > TX_WHALE){
		if (isCash){
			return carWhaleCash;
		} else {
			return carWhaleCore;
		}
	}
}
/* end return car */

// add sounds to sound array for playback
function addSounds(carType){
	if (!isVisible) return;

	if (carType == carUserCash || carType == carUserCore) playSound(audioWoohoo);

	if (carType == carLambo){
		let randSong = Math.floor(Math.random() * 2) + 1;
		
		if (randSong == 1){		
			playSound(audioMercy);
		} else {
			playSound(audioRide);
		}
	}

	if (carType == carMicroCash || carType == carMicroCore){
		playSound(audioMotorcycle);
	} else if (carType == carMicroCash || carType == carMicroCore || carType == carSmallCash ||
		carType == carSmallCore){
			playSound(audioCar);
	} else if (carType == carMediumCash ||
		carType == carMediumCore ||
		carType == carLargeCash ||
		carType == carLargeCore ||
		carType == carXLargeCash ||
		carType == carXLargeCore){
			audioDiesel.playbackRate = 1.4;
			playSound(audioDiesel);	
	} else if (carType == carWhaleCash ||
		carType == carWhaleCore){
			audioSemi.playbackRate = 1.8;
			playSound(audioSemi);
	} else if (carType == carSpam){
		playSound(audioSpam);
	}
}

// plays the sound
function playSound(buffer) {
	let source = audioContext.createBufferSource();
	source.buffer = buffer;
	source.playbackRate.value = speedSlider.value/100 + 0.5;

	source.connect(gainNode);
	gainNode.connect(audioContext.destination);
	source.start(0);
}

// load the sounds into their correct variables
function loadSound(url, sound){
	let request = new XMLHttpRequest();
	request.open('GET', url, true);
	request.responseType = 'arraybuffer';
	request.onload = function(){
		audioContext.decodeAudioData(request.response, function(buffer){
			if (sound == "motorcycle"){
				audioMotorcycle = buffer;
			} else if (sound=="car") {
				audioCar = buffer;
			} else if (sound == "diesel"){
				audioDiesel = buffer;
			} else if (sound == "semi"){
				audioSemi = buffer;
			} else if (sound == "mercy"){
				audioMercy = buffer;
			} else if (sound == "ride"){
				audioRide = buffer;
			} else if (sound == "cha-ching"){
				audioChaChing = buffer;
			} else if (sound == "woohoo"){
				audioWoohoo = buffer;
			} else if (sound == "spam"){
				audioSpam = buffer;
			} else if (sound == "allspam"){
				audioAllSpam = buffer;
			}
		});
	}
	request.send();
}

// check for donations into the BCF
let isDonationTx = function(txInfo){
	let vouts = txInfo.out;//.vout;
	let isDonation = false;

	vouts.forEach((key)=>{
		let keys = Object.keys(key);
		keys.forEach((k)=> {
			if (k == "3ECKq7onkjnRQR2nNe5uUJp2yMsXRmZavC" ||
				k == "3MtCFL4aWWGS5cDFPbmiNKaPZwuD28oFvF") isDonation = true;
		});
	});

	return isDonation;
}

// check for satoshi dice tx
let isSatoshiDiceTx = function(txInfo){
	let vouts = txInfo.out;//.vout;
	let satoshiDiceTx = false;

	vouts.forEach((key)=>{
		let keys = Object.keys(key);
		keys.forEach((k)=>{
			if(k == "1DiceoejxZdTrYwu3FMP2Ldew91jq9L2u" ||
			k == "1Dice115YcjDrPM9gXFW8iFV9S3j9MtERm" ||
			k == "1Dice1FZk6Ls5LKhnGMCLq47tg1DFG763e" ||
			k == "1Dice1cF41TGRLoCTbtN33DSdPtTujzUzx" ||
			k == "1Dice1wBBY22stCobuE1LJxHX5FNZ7U97N" ||
			k == "1Dice2wTatMqebSPsbG4gKgT3HfHznsHWi" ||
			k == "1Dice5ycHmxDHUFVkdKGgrwsDDK1mPES3U" ||
			k == "1Dice7JNVnvzyaenNyNcACuNnRVjt7jBrC" ||
			k == "1Dice7v1M3me7dJGtTX6cqPggwGoRADVQJ" ||
			k == "1Dice81SKu2S1nAzRJUbvpr5LiNTzn7MDV" ||
			k == "1Dice9GgmweQWxqdiu683E7bHfpb7MUXGd") satoshiDiceTx = true;
		});
	});

	return satoshiDiceTx;
}

// check for transactions to user's addresses
let isUserTx = function(txInfo){
	let vouts = txInfo.out;//.vout;
	let isUserTx = false;

	//if (cashAddress.value.length < 34 && coreAddress.value.length < 34 ) return isUserTx;

	//console.log(vouts);
	vouts.forEach((key)=>{
		let keys = Object.keys(key);
		keys.forEach((k)=>{
			if (k == cashAddress.value || k == coreAddress.value){
				isUserTx = true;
			} 
		})
	});
	return isUserTx;
}

/** Draw the background */
function drawBackground(){
	// draw the lanes
	ctx.clearRect(0,0,WIDTH,HEIGHT);
	ctx.fillStyle = "#9EA0A3";

	// dash style
	ctx.setLineDash([6]);
	ctx.strokeStyle = "#FFF";

	// stroke
	ctx.strokeRect(-2, SINGLE_LANE * 1, WIDTH + 3, SINGLE_LANE);
	ctx.strokeRect(-2, SINGLE_LANE * 3, WIDTH + 3, SINGLE_LANE);
	ctx.strokeRect(-2, SINGLE_LANE * 5, WIDTH + 3, SINGLE_LANE);
	ctx.strokeRect(-2, SINGLE_LANE * 7, WIDTH + 3, SINGLE_LANE);

	ctx.setLineDash([0]);
	ctx.strokeStyle = "#3F3B3C";
	ctx.strokeRect(-2, SINGLE_LANE * 8, WIDTH + 3, SINGLE_LANE);

	ctx.setLineDash([6]);
	ctx.strokeStyle = "#FFF";
	ctx.strokeRect(-2, SINGLE_LANE * 10, WIDTH + 3, SINGLE_LANE);
}

// loop through transactions and draw them
function drawVehicles(arr){
	let car = null;
	let y = null;
	let width = null;
	arr.forEach(function(item, index, object){

		if(!item.isCash && konamiActive) { 
			car = carSpam;
		} else {
			car = item.car;
		}
		
		if (item.x > -car.width - SPEED - 20){
			if (!item.isPlaying){
				addTxToList(item.isCash, item.id, item.valueOut, car);
				if ((item.isCash && !isCashMuted) || (!item.isCash && !isCoreMuted)) addSounds(car);
			}
			item.isPlaying = true;

			y = (item.lane * SINGLE_LANE) - SINGLE_LANE;
			width = SINGLE_LANE * (car.width / car.height);

			// segwit swerving
			if (item.car == carSegwit){
				if (!item.y) item.y = y;
				if (!item.d) item.d = 0.3;
				if (item.y > y + 10) item.d = -0.3;
				if (item.y < y - 10) item.d = 0.3;
				item.y += item.d;
				y = item.y;
			}

			ctx.drawImage(car, item.x, y, width, SINGLE_LANE);
			
		}

		if(item.isCash){
			item.x += SPEED;
		} else {
			item.x += SPEED * SPEED_MODIFIER;
		}
	});
}

// remove vehicles that are off the map
function removeVehicles(){
	txCash.forEach(function(item, index, object){
		if (item.donation) SPEED = 8;
		if (item.x > WIDTH + 100) object.splice(index, 1);
	});

	txCore.forEach(function(item, index, object){
		if (item.x > WIDTH + 100) object.splice(index, 1);
	});
}

// animate everything
function animate(){
	requestID = requestAnimationFrame(animate);
	drawBackground();
	drawVehicles(txCash);
	drawVehicles(txCore);
	removeVehicles();
}

// adjust speed on slider change
speedSlider.oninput = function(){
	let newSpeed = 16 * (this.value/100);
	SPEED = newSpeed;
}

volumeSlider.oninput = function(){
	let newVol = this.value/100;
	VOLUME = newVol;
	gainNode.gain.value = VOLUME;
}

$('#tx-list-button').click(function(){
	if (transactionWrap.style.right == '0%'){
		transactionWrap.style.right = '-151px';
		// page.style.right = '0';
	} else {
		transactionWrap.style.right = '0%';
		// page.style.width = '85%';
	}
});


$("input.cash-mute").change(function() {
	if(this.checked) {
      if (isCashMuted) {
				isCashMuted = false;
			 } else {
				isCashMuted = true;
			 }
    } else {
      if (isCashMuted) {
				isCashMuted = false;
			 } else {
				isCashMuted = true;
			 }
    }
});

$('.nav .legend').hover(function(){
    // $(this).next('ul').slideToggle('500');
    $(this).find('i').toggleClass('fa-car fa-truck')
});

$("input.overlay-switch").change(function() {
    if(this.checked) {
      $( ".sign" ).fadeToggle( "slow", "linear" );
    } else {
      $( ".sign" ).fadeToggle( "slow", "linear" );
    }
});

$('.nav .search').click(function(){
    // $(this).next('ul').slideToggle('500');
    $(this).find('i').toggleClass('fa-search fa-eye')
});

$('.tx-list-link').click(function(){
    // $(this).next('ul').slideToggle('500');
    $(this).find('i').toggleClass('fa-list fa-close')
});

$('.nav .settings').hover(function(){
    // $(this).next('ul').slideToggle('500');
    $(this).find('i').toggleClass('fa-cog fa-cogs')
});

$('.nav .donate').hover(function(){
    // $(this).next('ul').slideToggle('500');
    $(this).find('i').toggleClass('fa-heart fa-money')
});

$("input.core-mute").change(function() {
	if(this.checked) {
      if (isCoreMuted) {
				isCoreMuted = false;
			 } else {
				isCoreMuted = true;
			 }
    } else {
      if (isCoreMuted) {
				isCoreMuted = false;
			 } else {
				isCoreMuted = true;
			 }
    }
});

$('.nav a').on('click', function(){
  $('#'+$(this).data('modal')).css('display','block');
})

$('.nav a.donate').on('click', function(){
  $('#'+$(this).data('modal')).toggleClass('donate donate-off');
})

$('.close').on('click', function(){
  $('.modal').hide();
})

//konami
let easter_egg = new Konami(function() { 
	if (konamiActive == false || konamiActive == null) {
		playSound(audioAllSpam);
		
		konamiActive = true;
		$( ".core-mode" ).fadeToggle( "slow", "linear" );
	} else if (konamiActive == true) {
		konamiActive = false;
		$( ".core-mode" ).fadeToggle( "slow", "linear" );
	}
});

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
	if($(event.target).hasClass('modal')) $('.modal').hide();
}

function onReady(callback) {
    let intervalID = window.setInterval(checkReady, 1500);

    function checkReady() {
        if (document.getElementsByTagName('body')[0] !== undefined) {
            window.clearInterval(intervalID);
            callback.call(this);
        }
    }
}

function show(id, value) {
    document.getElementById(id).style.display = value ? 'block' : 'none';
}

init();

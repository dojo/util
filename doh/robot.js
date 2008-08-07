if(window["dojo"]){
	dojo.provide("doh.robot");
	dojo.experimental("doh.robot");
	dojo.require("doh.runner");
}else if(!doh["robot"]){
	doh.robot={};
}

if(!doh.robot["_robotLoaded"]){
(function(){

	// loading state
	var _robot = null;

	// SECURITY NOTICE:
	// There is a problem of parent frames/child windows potentially loading up DOH from our website and then telling it to do evil. 
	// The solution:
	// Each of the applet's methods take a private key parameter. The key is generated in JS by Math.random and hidden in a closure. 
	// The key is assigned to the applet in the thread that inits the applet, so there is no way anyone could intercept it. 
	// Thus, only the applet and the closure know what this key is.
	// DOH wraps access to the private key through another closure containing a private isSecure function.
	// Each function in the public DOH API takes a security function that has to match the exact form new Function('return window').
	// This is the public key that DOH tests use to authenticate with the applet.
	// The public functions each pass the public key to isSecure.
	// isSecure calls a safe toString to make sure that the function matches the form new Function('return window') exactly.
	// Then, it calls the security function and compares the resulting window with the local window.
	// If these match, then isSecure returns the private key (which was wrapped in a closure) to the public DOH function so it can invoke the applet.

	var isSecure = (function(){
		var key = Math.random();
		var safetoString = Function.prototype.toString;
		var safefcn = new Function("return window");
		return function(fcn){
			try {
			        // Need to check if the security function passed contains the expected source.
			        // Ensures a malevolent function is not being passed and run before the actual check to see if secure.
				fcn.toString = safetoString;
				Function.prototype.toString = safetoString;
			        if(safefcn.toString().replace(/\n/g, " ")  != fcn.toString().replace(/\n/g, " ")){
			        	return -1;
				}else if(window.opener){
					return -1;
				}else{ return ((fcn() == window)?key:-1); }
			} catch(e){}
			return -1;
		};
	})();

	// no dojo available
	// hijack doh.run instead
	var _run = doh.run;
	doh.run = function(){
		if(!doh.robot._robotsemaphore.unlock()){
			// hijack doh._onEnd to clear the applet
			// have to do it here because _browserRunner sets it in onload in standalone case
			var __onEnd = doh._onEnd;
			doh._onEnd = function(){
				doh.robot.killRobot();
				doh._onEnd = __onEnd;
				doh._onEnd();
			};
			// if the iframe requested the applet and got a 404, then _robot is obviously unavailable
			// at least run the non-robot tests!
			if(doh.robot._appletDead){
				doh.robot._onKeyboard();
			}else{
				_robot._callLoaded(isSecure(new Function('return window')));
			}
		}
	};

	var _keyPress = function(/*Function*/ sec, /*Number*/ charCode, /*Number*/ keyCode, /*Boolean*/ alt, /*Boolean*/ ctrl, /*Boolean*/ shift, /*Number*/ delay, /*Boolean*/ async){
		// internal function to type one non-modifier key

		// typecasting Numbers helps Sun's IE plugin lookup methods that take int arguments

		// otherwise JS will send a double and Sun will complain
		_robot.typeKey(isSecure(sec), Number(charCode), Number(keyCode), Boolean(alt), Boolean(ctrl), Boolean(shift), Number(delay||0), Boolean(async||false));
	};

	doh.robot = {
	_robotLoaded: true,

	_killApplet: function(){}, // overridden by Robot.html

	killRobot: function(){
		doh.robot._robotLoaded = false;
		document.documentElement.className = document.documentElement.className.replace(/ ?dohRobot/);
		doh.robot._killApplet();
	},

	// Robot init methods
	_robotsemaphore: {
		lock:["lock"],
		unlock:function(){
			try{
				return this.lock.shift();
			}catch(e){
				return null;
			}
		}	
	},
	
	_initRobot: function(r){
		// called from Robot
		// Robot calls _initRobot in its startup sequence
		// add dohRobot class to HTML element so tests can use that in CSS rules if desired
		document.documentElement.className = document.documentElement.className.replace(/\S$/, "& ") + "dohRobot";
		window.scrollTo(0, 0);
		_robot = r;
		_robot._setKey(isSecure(new Function('return window')));
		// lazy load
		doh.run();
	},

	// some utility functions to help the iframe use private variables
	_run: function(frame){
		frame.style.visibility = "hidden";
		doh.run = _run;
		doh.run();
	},

	_initKeyboard: function(){
		_robot._initKeyboard(isSecure(new Function('return window')));
	},

	_initWheel: function(){
		_robot._initWheel(isSecure(new Function('return window')));
	},

	_setDocumentBounds: function(docScreenX, docScreenY){
		var robotView = document.getElementById("dohrobotview");
		_robot.setDocumentBounds(isSecure(new Function('return window')), Number(docScreenX), Number(docScreenY), Number(robotView.offsetLeft), Number(robotView.offsetTop));
		document.body.removeChild(robotView);
	},

	_notified: function(keystring){
		_robot._notified(isSecure(new Function('return window')), keystring);
	},

	_time:0,

	// if the applet is 404 or cert is denied, this becomes true and kills tests
	_appletDead:false,

	_assertRobot:function(){
		// make sure the applet is there and cert accepted
		// otherwise, skip the test requesting the robot action
		if(doh.robot._appletDead){ throw new Error('doh.robot not available; skipping test.'); }
	},

	_sequence:function(/*Function*/ f, /*Integer*/ delay){
		delay = delay || 1;
		doh.robot._time += delay;
		setTimeout(function(){
			doh.robot._time -= delay;
			f();
		}, doh.robot._time);
	},


	_mouseMove: function(/*Function*/ sec, /*Number*/ x, /*Number*/ y, /*Boolean*/ absolute){
		if(absolute){
			var scroll = {y: (window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0),
			x: (window.pageXOffset || (window["dojo"]?dojo._fixIeBiDiScrollLeft(document.documentElement.scrollLeft):undefined) || document.body.scrollLeft || 0)};
			y -= scroll.y;
			x -= scroll.x;
		}
		_robot.moveMouse(isSecure(sec), Number(x), Number(y), Number(0));
	},

	// Main doh.robot API
	typeKeys: function(/*Function*/ sec, /*String||Number*/ chars, /*Integer, optional*/ delay, /*Integer, optional*/ speed){
		// summary:
		//		Types a string of characters in order, or types a dojo.keys.* constant.
		//
		// description:
		// 		Types a string of characters in order, or types a dojo.keys.* constant.
		// 		Example: doh.robot.typeKeys(sec, "dijit.ed", 500);
		//
		// sec:
		//		new Function('return window')
		//		Public key that verifies that the calling window is allowed to automate user input.
		//
		// chars:
		//		String of characters to type, or a dojo.keys.* constant
		//
		// delay:
		//		Delay, in milliseconds, to wait before firing.
		//		The delay is a delta with respect to the previous automation call.
		//		For example, the following code ends after 600ms:
		//			doh.robot.mouseClick(sec,{left:true},100) // first call; wait 100ms
		//			doh.robot.typeKeys(sec,"dij",500) // 500ms AFTER previous call; 600ms in all
		//
		// speed:
		//		Delay, in milliseconds, between keypresses.
		//

		this._assertRobot();
		this._sequence(function(){
			if(typeof(chars) == Number){
				_keyPress(chars, chars, false, false, false, delay);
			}else if(chars.length){
				_keyPress(sec, chars.charCodeAt(0), 0, false, false, false, 0);
				for(var i = 1; i<chars.length; i++){
					_keyPress(sec, chars.charCodeAt(i), 0, false, false, false, speed);
				}
			}
		},delay);
	},

	keyPress: function(/*Function*/ sec, /*Number*/ charOrCode, /*Number*/ delay, /*Object*/ modifiers, /*Boolean*/ asynchronous){
		// summary:
		//		Types a key combination, like SHIFT-TAB.
		//
		// description:
		// 		Types a key combination, like SHIFT-TAB.
		// 		Example: to press shift-tab immediately, call doh.robot.keyPress(sec, dojo.keys.TAB, 0, {shift:true})
		//
		// sec:
		//		new Function('return window')
		//		Public key that verifies that the calling window is allowed to automate user input.
		//
		// charOrCode:
		//		char/JS keyCode/dojo.keys.* constant for the key you want to press
		//
		// delay:
		//		Delay, in milliseconds, to wait before firing.
		//		The delay is a delta with respect to the previous automation call.
		//		For example, the following code ends after 600ms:
		//			doh.robot.mouseClick(sec,{left:true},100) // first call; wait 100ms
		//			doh.robot.typeKeys(sec,"dij",500) // 500ms AFTER previous call; 600ms in all
		//
		// modifiers:
		//		JSON object that represents all of the modifier keys being pressed.
		//		It takes the following Boolean attributes:
		//			- shift
		//			- alt
		//			- ctrl
		//
		// asynchronous:
		//		If true, the delay happens asynchronously and immediately, outside of the browser's JavaScript thread and any previous calls.
		//		This is useful for interacting with the browser's modal dialogs.
		//

		this._assertRobot();
		if(!modifiers){
			modifiers = {alt:false, ctrl:false, shift:false};
		}else{
			// normalize modifiers
			var attrs = ["alt", "ctrl", "shift"];
			for(var i = 0; i<attrs.length; i++){
				if(!modifiers[attrs[i]]){
					modifiers[attrs[i]] = false;
				}
			}
		}
		var isChar = typeof(charOrCode)=="string";
		if(asynchronous){
			_keyPress(sec, isChar?charOrCode.charCodeAt(0):0, isChar?0:charOrCode, modifiers.alt, modifiers.ctrl, modifiers.shift, delay, true);
			return;
		}
		this._sequence(function(){
			_keyPress(sec, isChar?charOrCode.charCodeAt(0):0, isChar?0:charOrCode, modifiers.alt, modifiers.ctrl, modifiers.shift, 0);
		},delay);
	},

	keyDown: function(/*Function*/ sec, /*Number*/ charOrCode, /*Number*/ delay){
		// summary:
		//		Holds down a single key, like SHIFT or 'a'.
		//
		// description:
		// 		Holds down a single key, like SHIFT or 'a'.
		// 		Example: to hold down the 'a' key immediately, call doh.robot.keyDown(sec, 'a')
		//
		// sec:
		//		new Function('return window')
		//		Public key that verifies that the calling window is allowed to automate user input.
		//
		// charOrCode:
		//		char/JS keyCode/dojo.keys.* constant for the key you want to hold down
		//		Warning: holding down a shifted key, like 'A', can have unpredictable results.
		//
		// delay:
		//		Delay, in milliseconds, to wait before firing.
		//		The delay is a delta with respect to the previous automation call.
		//		For example, the following code ends after 600ms:
		//			doh.robot.mouseClick(sec,{left:true},100) // first call; wait 100ms
		//			doh.robot.typeKeys(sec,"dij",500) // 500ms AFTER previous call; 600ms in all
		//

		this._assertRobot();
		this._sequence(function(){
			var isChar = typeof(charOrCode)=="string";
			_robot.downKey(isSecure(sec), isChar?charOrCode:0, isChar?0:charOrCode, 0);
		},delay);
	},

	keyUp: function(/*Function*/ sec, /*Number*/ charOrCode, /*Number*/ delay){
		// summary:
		//		Releases a single key, like SHIFT or 'a'.
		//
		// description:
		// 		Releases a single key, like SHIFT or 'a'.
		// 		Example: to release the 'a' key immediately, call doh.robot.keyUp(sec, 'a')
		//
		// sec:
		//		new Function('return window')
		//		Public key that verifies that the calling window is allowed to automate user input.
		//
		// charOrCode:
		//		char/JS keyCode/dojo.keys.* constant for the key you want to release
		//		Warning: releasing a shifted key, like 'A', can have unpredictable results.
		//
		// delay:
		//		Delay, in milliseconds, to wait before firing.
		//		The delay is a delta with respect to the previous automation call.
		//		For example, the following code ends after 600ms:
		//			doh.robot.mouseClick(sec,{left:true},100) // first call; wait 100ms
		//			doh.robot.typeKeys(sec,"dij",500) // 500ms AFTER previous call; 600ms in all
		//

		this._assertRobot();
		this._sequence(function(){
			var isChar=typeof(charOrCode)=="string";
			_robot.upKey(isSecure(sec), isChar?charOrCode:0, isChar?0:charOrCode, 0);
		},delay);
	},


	mouseClick: function(/*Function*/ sec, /*Object*/ buttons, /*Number*/ delay){
		// summary:
		//		Convenience function to do a press/release.
		//		See doh.robot.mousePress for more info.
		//
		// description:
		//		Convenience function to do a press/release.
		//		See doh.robot.mousePress for more info.
		//

		this._assertRobot();
		doh.robot.mousePress(sec, buttons, delay);
		doh.robot.mouseRelease(sec, buttons, 1);
	},

	mousePress: function(/*Function*/ sec, /*Object*/ buttons, /*Number*/ delay){
		// summary:
		// 		Presses mouse buttons.
		// description:
		// 		Presses the mouse buttons you pass as true.
		// 		Example: to press the left mouse button, pass {left:true}.
		// 		Mouse buttons you don't specify keep their previous pressed state.
		//
		// sec:
		//		new Function('return window')
		//		Public key that verifies that the calling window is allowed to automate user input.
		//
		// buttons:	JSON object that represents all of the mouse buttons being pressed.
		//		It takes the following Boolean attributes:
		//			- left
		//			- middle
		//			- right
		//
		// delay:
		//		Delay, in milliseconds, to wait before firing.
		//		The delay is a delta with respect to the previous automation call.
		//		For example, the following code ends after 600ms:
		//			doh.robot.mouseClick(sec,{left:true},100) // first call; wait 100ms
		//			doh.robot.typeKeys(sec,"dij",500) // 500ms AFTER previous call; 600ms in all
		//

		this._assertRobot();
		if(!buttons){ return; }
		this._sequence(function(){
			var attrs = ["left", "middle", "right"];
			for(var i = 0; i<attrs.length; i++){
				if(!buttons[attrs[i]]){
					buttons[attrs[i]] = false;
				}
			}
			_robot.pressMouse(isSecure(sec), Boolean(buttons.left), Boolean(buttons.middle), Boolean(buttons.right), Number(0));
		},delay);
	},

	mouseMove: function(/*Function*/ sec, /*Number*/ x, /*Number*/ y, /*Number*/ delay, /*Boolean*/ absolute){
		// summary:
		// 		Moves the mouse to the specified x,y offset relative to the viewport.
		//
		// sec:
		//		new Function('return window')
		//		Public key that verifies that the calling window is allowed to automate user input.
		//
		// x:
		//		x offset relative to the viewport, in pixels, to move the mouse.
		//
		// y:
		//		y offset relative to the viewport, in pixels, to move the mouse.
		//
		// delay:
		//		Delay, in milliseconds, to wait before firing.
		//		The delay is a delta with respect to the previous automation call.
		//		For example, the following code ends after 600ms:
		//			doh.robot.mouseClick(sec,{left:true},100) // first call; wait 100ms
		//			doh.robot.typeKeys(sec,"dij",500) // 500ms AFTER previous call; 600ms in all
		//
		// absolute:
		//		Boolean indicating whether the x and y values are absolute coordinates.
		//		If false, then mouseMove expects that the x,y will be relative to the window. (clientX/Y)
		//		If true, then mouseMove expects that the x,y will be absolute. (pageX/Y)
		//

		this._assertRobot();
		this._sequence(function(){
			doh.robot._mouseMove(sec, x, y, absolute);
		},delay);
	},

	mouseRelease: function(/*Function*/ sec, /*Object*/ buttons, /*Number*/ delay){
		// summary:
		// 		Releases mouse buttons.
		//
		// description:
		// 		Releases the mouse buttons you pass as true.
		// 		Example: to release the left mouse button, pass {left:true}.
		// 		Mouse buttons you don't specify keep their previous pressed state.
		//		See doh.robot.mousePress for more info.
		//

		this._assertRobot();
		if(!buttons){ return; }
		this._sequence(function(){
			var attrs = ["left", "middle", "right"];
			for(var i = 0; i<attrs.length; i++){
				if(!buttons[attrs[i]]){
					buttons[attrs[i]] = false;
				}
			}
			_robot.releaseMouse(isSecure(sec), Boolean(buttons.left), Boolean(buttons.middle), Boolean(buttons.right), Number(0));
		},delay);
	},

	// mouseWheelSize: Integer value that determines the amount of wheel motion per unit
	mouseWheelSize: 1,

	mouseWheel: function(/*Function*/ sec, /*Number*/ wheelAmt, /*Number*/ delay){
		// summary:
		//		Spins the mouse wheel.
		//
		// description:
		// 		Spins the wheel wheelAmt "notches."
		// 		Negative wheelAmt scrolls up/away from the user.
		// 		Positive wheelAmt scrolls down/toward the user.
		// 		Note: this will all happen in one event.
		// 		Warning: the size of one mouse wheel notch is an OS setting.
		//		You can accesss this size from doh.robot.mouseWheelSize
		//
		// sec:
		//		new Function('return window')
		//		Public key that verifies that the calling window is allowed to automate user input.
		//
		// wheelAmt:
		//		Number of notches to spin the wheel.
		// 		Negative wheelAmt scrolls up/away from the user.
		// 		Positive wheelAmt scrolls down/toward the user.
		//
		// delay:
		//		Delay, in milliseconds, to wait before firing.
		//		The delay is a delta with respect to the previous automation call.
		//		For example, the following code ends after 600ms:
		//			doh.robot.mouseClick(sec,{left:true},100) // first call; wait 100ms
		//			doh.robot.typeKeys(sec,"dij",500) // 500ms AFTER previous call; 600ms in all
		//

		this._assertRobot();
		if(!wheelAmt){ return; }
		this._sequence(function(){
			_robot.wheelMouse(isSecure(sec), Number(wheelAmt), Number(0));
		},delay);
	}
	};

	// the applet itself
	// needs to be down here so the handlers are set up
	var iframesrc;
	var scripts = document.getElementsByTagName("script");
	for(var x = 0; x<scripts.length; x++){
		var s = scripts[x].src;
		if(s && (s.substr(s.length-9) == "runner.js")){
			iframesrc = s.substr(0, s.length-9)+'Robot.html';
			break;
		}
	}
	// if loaded with dojo, there might not be a runner.js!
	if(!iframesrc && window["dojo"]){
		iframesrc = dojo.moduleUrl("util", "doh/")+"Robot.html";
	}
	document.writeln('<div id="dohrobotview" style="border:0px none; margin:0px; padding:0px; position:absolute; bottom:0px; right:0px; width:1px; height:1px; overflow:hidden; background-color:red;"></div>'+
		'<iframe style="border:0px none; padding:0px; margin:0px; position:absolute; left:0px; top:0px; height:20px; width:200px; overflow:hidden; background-color:transparent;" tabIndex="-1" src="'+iframesrc+'" ALLOWTRANSPARENCY="true"></iframe>');
})();
}

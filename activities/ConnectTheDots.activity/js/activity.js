define(["sugar-web/activity/activity","colorpalette"], function (activity, colorpalette) {

	// Manipulate the DOM only when it is ready.
	requirejs(['domReady!'], function () {

		// Initialize the activity.
		activity.setup();

		var gridContainer = document.getElementById('grid-container');
		var svgCanvas = document.getElementById('line-canvas');

		//BUTTONS
		var undoBtn = document.getElementById('undo-button');
		var redoBtn = document.getElementById('redo-button');
		var clearBtn = document.getElementById('clear-button');

		// COLOR PALETTE - create and attach to the toolbar button
		var changeColorPalette = new colorpalette.ColorPalette(
			document.getElementById('changeColor-button'),
			"Change Color"
		);

		// Default drawing color
		var currentColor = 'rgba(0, 200, 0, 0.4)';

		// Listen for color selection from the palette
		changeColorPalette.addEventListener('colorChange', function(event) {
			currentColor = event.color;
		});

		//State variables
		var isDrawing = false;
		var lastDotCoords = null;

		// This tracker is also tracking the points that users go through later to be used to color the enclosed area
		// drawn by connecting those dots
		var currentShapePoints = []

		// History arrays to track the lines that users draw
		var undoStack = [];
		var redoStack = [];

		//calculate how many dots we need to fill the screen
		//Idea: we create many square wrappers (div) limited to 40x40px -> then put the dots inside (dot: styled divs)
		var columns = Math.floor(window.innerWidth / 40);
		var rows = Math.floor(window.innerHeight / 40);
		var totalDots = columns * rows;

		// Function to find exact coordinates (x, y) of a dot
		function getCoordinates(element) {
			var dotRect = element.getBoundingClientRect();

			//Get coordinates of the SVG  canvas itself
			var svgRect = svgCanvas.getBoundingClientRect();

			return {
				x: (dotRect.left - svgRect.left) + dotRect.width / 2,
				y: (dotRect.top - svgRect.top) + dotRect.height / 2
			};
		}

		// Function to draw the connecting line (SVG line)
		function drawLine(startCoords, endCoords) {
			//Create an SVG line element
			var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');

			// Set the starting and ending coordinates
			line.setAttribute('x1', startCoords.x);
			line.setAttribute('y1', startCoords.y);
			line.setAttribute('x2', endCoords.x);
			line.setAttribute('y2', endCoords.y);
			//Color the line
			line.setAttribute('stroke', currentColor);

			// Add it to the screen
			svgCanvas.appendChild(line);


			// Drawing history logic
			undoStack.push(line); // Every time we draw a new line, save this to undoStack so to undo, just need to devare the latest line
			redoStack = []; // When draw a new line, can not redo 

			console.log(undoStack);
		}

		//Generate the dots
		for(var i = 0; i < totalDots; i++) {
			(function() {  //Have to do this because of ES5, variables declared by var can still be used outside the scope
				//Create invisible wrappers
				var wrapper = document.createElement('div');
				wrapper.classList.add('dot-wrapper');

				//Create visibile dots
				var dot = document.createElement('div');
				dot.classList.add('dot');

				// Drawing connecting straight lines logic

				// Click to start/stop drawing
				dot.addEventListener('click', function() {
					//Switch drawing mode
					isDrawing = !isDrawing;

					if(isDrawing) {
						lastDotCoords = getCoordinates(dot);

						// Add very starting point to the tracker
						currentShapePoints = [lastDotCoords];

						dot.classList.add('active');
					} else {
						var stopDot = getCoordinates(dot);

						console.log( currentShapePoints );

						if ( currentShapePoints.length > 3 ) {
							var startingDot = currentShapePoints[0];

							// This condition means user has drawn lines to form a shape
							if( startingDot.x === stopDot.x && startingDot.y === stopDot.y ) {

								// Procedure to create a SVG polygons in web page: give coordinates of points and border + inside color
								// we already have a svg canvas in html, just need to draw on this
								var polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');

								//Reformat the dot coordinates to string like this "x-coordinate,y-coordinate"
								//We got an array like this "x1,y1 x2,y2 x3,y3..."
								var polygonPoints = currentShapePoints.map( point => `${point.x},${point.y}` ).join(' ');

								polygon.setAttribute('points', polygonPoints);
								polygon.style.fill = currentColor;

								// Draw on the screen
								svgCanvas.appendChild(polygon);

								// Track polygon in history so undo/redo works
								undoStack.push(polygon);
								redoStack = [] // When draw a new polygon, can not redo
							}
						}

						//Clear trackers
						lastDotCoords = null;
						currentShapePoints = [];


						//Remove highlighting dots when stop drawing
						document.querySelectorAll('.dot.active').forEach(function(activeDots) {
							activeDots.classList.remove('active');
						});
					}
				});

				// Drag to another dot to draw lines
				dot.addEventListener('mouseenter', function() {
					// If we're not in drawing mode, we ignore and don't do anything
					if(!isDrawing) return;
					
					// Get coordinates of the wrapper we just enter;
					var currentDotCoords = getCoordinates(dot);

					//Draw line from the last remembered dot to this new dot
					drawLine(lastDotCoords, currentDotCoords);

					// Track dots coordinates
					currentShapePoints.push(currentDotCoords);

					//Update the latest dot to continue the drawing
					lastDotCoords = currentDotCoords;

					// highlight the dots
					dot.classList.add('active');
				});

				//Put dot inside wrapper, wrappper into the grid
				wrapper.appendChild(dot);
				gridContainer.appendChild(wrapper);
			})();
		}

		// Clear button Logic
		clearBtn.addEventListener('click', function() {
			//Clear all lines and polygons
			document.querySelectorAll('line').forEach(function(line) {
				return line.remove();
			});
			document.querySelectorAll('polygon').forEach(function(polygon) {
				return polygon.remove();
			});
			
			// Reset all states back to default mode
			isDrawing = false;
			lastDotCoords = null;
		});

		// Undo button Logic
		undoBtn.addEventListener('click', function() {
			if( undoStack.length > 0 ) {
				// Force drawing to stop to prevent edge cases
				isDrawing = false;
				lastDotCoords = null;

				// Extract the last line/polygon from undo stack (line to remove)
				var elementToRemove = undoStack.pop();

				// Remove them from the SVG canvas
				svgCanvas.removeChild(elementToRemove);

				// Save to redo Stack if user want to redo
				redoStack.push(lineToRemove);
			}
		});

		// Redo button Logic
		redoBtn.addEventListener('click', function() {
			if ( redoStack.length > 0 ) {
				// Also force drawing to stop to preven edge cases
				isDrawing = false;
				lastDotCoords = null;

				// Extract the last line/polygon from redo stack (closest one to redo)
				var elementToRecreate = redoStack.pop();

				// Add them to the SVG canvas
				svgCanvas.appendChild(elementToRecreate);

				// Save to undo stack if user want to undo
				undoStack.push(elementToRecreate);
			}
		});

	});

});

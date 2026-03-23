define(["sugar-web/activity/activity"], function (activity) {

	// Manipulate the DOM only when it is ready.
	requirejs(['domReady!'], function () {

		// Initialize the activity.
		activity.setup();

		const gridContainer = document.getElementById('grid-container');
		const svgCanvas = document.getElementById('line-canvas');

		//BUTTONS
		const undoBtn = document.getElementById('undo-button');
		const redoBtn = document.getElementById('redo-button');
		const clearBtn = document.getElementById('clear-button');

		//State variables
		var isDrawing = false;
		var lastDotCoords = null;

		// History arrays to store drawing history
		var undoStack = [];
		var redoStack = [];

		//calculate how many dots we need to fill the screen
		//Idea: we create many square wrappers (div) limited to 40x40px -> then put the dots inside (dot: styled divs)
		const columns = Math.floor(window.innerWidth / 40);
		const rows = Math.floor(window.innerHeight / 40);
		const totalDots = columns * rows;

		// Function to find exact coordinates (x, y) of a dot
		function getCoordinates(element) {
			const dotRect = element.getBoundingClientRect();

			//Get coordinates of the SVG  canvas itself
			const svgRect = svgCanvas.getBoundingClientRect();

			return {
				x: (dotRect.left - svgRect.left) + dotRect.width / 2,
				y: (dotRect.top - svgRect.top) + dotRect.height / 2
			};
		}

		// Function to draw the connecting line (SVG line)
		function drawLine(startCoords, endCoords) {
			//Create an SVG line element
			const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');

			// Set the starting and ending coordinates
			line.setAttribute('x1', startCoords.x);
			line.setAttribute('y1', startCoords.y);
			line.setAttribute('x2', endCoords.x);
			line.setAttribute('y2', endCoords.y);

			// Add it to the screen
			svgCanvas.appendChild(line);

			// Drawing history logic
			undoStack.push(line); // Every time we draw a new line, save this to undoStack so to undo, just need to delete the latest line
			redoStack = []; // When draw a new line, can not redo 

			console.log(undoStack);
		}

		//Genera the dots
		for(var i = 0; i < totalDots; i++) {
			//Create invisible wrappers
			const wrapper = document.createElement('div');
			wrapper.classList.add('dot-wrapper');

			//Create visibile dots
			const dot = document.createElement('div');
			dot.classList.add('dot');

			// Drawing connecting straight lines logic

			// Click to start/stop drawing
			dot.addEventListener('click', () => {
				isDrawing = !isDrawing;

				if(isDrawing) {
					lastDotCoords = getCoordinates(dot);
					dot.classList.add('active');
				} else {
					lastDotCoords = null;

					//Remove highlighting dots when stop drawing
					document.querySelectorAll('.dot.active').forEach(activeDots => {
						activeDots.classList.remove('active');
					});
				}
			});

			// Drag to another dot to draw lines
			dot.addEventListener('mouseenter', () => {
				// If we're not in drawing mode, we ignore and don't do anything
				if(!isDrawing) return;
				
				// Get coordinates of the wrapper we just enter;
				const currentDotCoords = getCoordinates(dot);

				//Draw line from the last remembered dot to this new dot
				drawLine(lastDotCoords, currentDotCoords);

				//Update the latest dot to continue the drawing
				lastDotCoords = currentDotCoords;

				// highlight the dots
				dot.classList.add('active');
			});

			//Put dot inside wrapper, wrappper into the grid
			wrapper.appendChild(dot);
			gridContainer.appendChild(wrapper);
		}

		// Clear button Logic
		clearBtn.addEventListener('click', () => {
			document.querySelectorAll('line').forEach(line => line.remove());
			
			// Reset all states back to default mode
			isDrawing = false;
			lastDotCoords = null;
		});

		// Undo button Logic
		undoBtn.addEventListener('click', () => {
			if( undoStack.length > 0 ) {
				// Force drawing to stop to prevent edge cases
				isDrawing = false;
				lastDotCoords = null;

				// Extract the last line from undo stack (line to remove)
				const lineToRemove = undoStack.pop();

				// Remove it from the SVG canvas
				svgCanvas.removeChild(lineToRemove);

				// Save to redo Stack if user want to redo
				redoStack.push(lineToRemove);
			}
		});

		// Redo button Logic
		redoBtn.addEventListener('click', () => {
			if ( redoStack.length > 0 ) {
				// Also force drawing to stop to preven edge cases
				isDrawing = false;
				lastDotCoords = null;

				// Extract the last line from redo stack (closest one to redo)
				const lineToRecreate = redoStack.pop();

				// Add it to the SVG canvas
				svgCanvas.appendChild(lineToRecreate);

				// Save to undo stack if user want to undo
				undoStack.push(lineToRecreate);
			}
		});

	});

});

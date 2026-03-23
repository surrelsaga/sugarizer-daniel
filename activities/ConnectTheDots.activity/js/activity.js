define(["sugar-web/activity/activity"], function (activity) {

	// Manipulate the DOM only when it is ready.
	requirejs(['domReady!'], function () {

		// Initialize the activity.
		activity.setup();

		const gridContainer = document.getElementById('grid-container');
		const svgCanvas = document.getElementById('line-canvas');

		//State variables
		var isDrawing = false;
		var lastDotCoords = null;

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
			wrapper.addEventListener('click', () => {
				isDrawing = !isDrawing;

				if(isDrawing) {
					lastDotCoords = getCoordinates(wrapper);
					dot.classList.add('active');
				} else {
					lastDotCoords = null;

					//Remove highlighting dots
					document.querySelectorAll('.dot.active').forEach(activeDots => {
						activeDots.classList.remove('active');
					});
				}
			});

			// Drag to another dot to draw lines
			wrapper.addEventListener('mouseenter', () => {
				// If we're not in drawing mode, we ignore and don't do anything
				if(!isDrawing) return;
				
				// Get coordinates of the wrapper we just enter;
				const currentDotCoords = getCoordinates(wrapper);

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
	});

});

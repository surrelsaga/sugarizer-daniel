define(["sugar-web/activity/activity"], function (activity) {

	// Manipulate the DOM only when it is ready.
	requirejs(['domReady!'], function () {

		// Initialize the activity.
		activity.setup();

		const gridContainer = document.getElementById('grid-container')

		//calculate how many dots we need to fill the screen
		//Idea: we create many square wrappers (div) limited to 40x40px -> then put the dots inside (dot: styled divs)
		const columns = Math.floor(window.innerWidth / 40);
		const rows = Math.floor(window.innerHeight / 40);
		const totalDots = columns * rows;

		//Genera the dots
		for(var i = 0; i < totalDots; i++) {
			//Create invisible wrappers
			const wrapper = document.createElement('div');
			wrapper.classList.add('dot-wrapper');

			//Create visibile dots
			const dot = document.createElement('div');
			dot.classList.add('dot');

			//Add interaction (hover effect a bit)
			dot.addEventListener('mouseenter', () => {
				dot.classList.add('active');
			});

			//Remove effect after mouse leaves
			dot.addEventListener('mouseleave', () => {
				setTimeout( () => {
					dot.classList.remove('active');
				}, 300); // 300 ms delay
			});

			//Put dot inside wrapper, wrappper into the grid
			wrapper.appendChild(dot);
			gridContainer.appendChild(wrapper);
		}
	});

});

# TUTORIAL STRUGGLES AND LESSONS LEARNT

Start the app: open -n /Applications/Google\ Chrome.app --args --allow-file-access-from-files "file:///Users/nguyenducanh/Desktop/sugarizer-daniel/index.html"

# Step 1: Create the activity from a template<br>
 The part which involves updating activities.json with ids, names and icons of a new activity did not work at first.<br>

 Reasons:<br>
 1. When I add a new line to the bottom of activities.json, I didn't remove the comma since this is the last line so system can not read the pawn activity
 2. Later on when everything worked, I still couldn't see the new icon of the pawn activity shown.<br>
 -> I researched online and consulted AI then found out that I already created my user profile. The application read the `activities.json` file to know what my home screen should look like then it saved it to my browser's local storage permanently. So even if I already update the pawn activity, the icon still can not show up. This is mainly because every time I refresh or open the index.html, sugarizer sees my login cookie so it knows who I am already then it just ignore `activities.json` and loaded my old home screen layout in `localStorage` in my chrome browser.<br>
 -> I then used list view (3 horizontal lines button) to star the activity, which forces sugarizer to update localStorage with latest homescreen layout

# Step 2: Customize icon and content
* Lessons learnt:
 1. `define` and `requirejs` (framework) here is a way to import code from a libraries. In modern context nowadays, we use `import`
 2. `define` makes sure that Sugar-web library is successfully loaded before the code inside function is run
 3. `requirejs` makes sure that all dependencies are loaded before the code inside function is run also
 4. Most precious line: `activity.setup()` -> to initialize everything: datastore, sugarizer UI

# Step 3: Add a toolbar button <br>
* Lessons learnt: <br>
 At this point, I kinda know the sugarizer architecture. We'll add dependences from sugar-web libraries (activity, env -> retrieve user info, icon -> to edit icon) and then call methods from these dependencies. Then everything is still Vanilla JS

# Step 4: Handle journal and datastore
* Lessons learnt:
1. What the pawns array store is actually colors of pawns in an order. It will be something like this <br>
[ <br>
  { "stroke": "#005FE4", "fill": "#FF2B34" },  // Pawn 1 <br>
  { "stroke": "#005FE4", "fill": "#FF2B34" },  // Pawn 2 <br>
  { "stroke": "#005FE4", "fill": "#FF2B34" }   // Pawn 3 <br>
] <br>
=> Based on number of colors, system will know what color to paint each pawn and how many pawns are there <br>

2. How we store user progress in journal?<br>
Where to store? -> the JSON is stored in local browser storage <br>
* PATTERN <br>
1st: need to turn pawns array -> JSON <br>
2nd: activity.getDatastoreObject().setDataAsText(json) -> store text string inside this data object <br>
3rd: sstore the object inside browser storage -> activity.getDatastoreObject().save() <br>

3. How does system know whether an activity is existing or a newly-launched one? <br>
Sugar-web environment what it does is that after user clicks stop <br>-> It stores the JSON in the browser storage and generates a random ObjectId key for this (it's like a dictionary) <br>
Whenever it checks what is the ObjectId, it will pass back the corresponding JSON data <br>
If ObjectId is new, then this is a new instance <br>

4. So the journal is a html page the display data from the datastoreObject? (unanswered)

# Step 5: Localize the activity <br>
* Lesson learnt: i18next to handle localization (language translation)<br>
1. We take default language from user's browser (specifically chrome here) <br>
Then, if the user has signed up for an account, we change language base on their setting. Otherwise, we use user's browser language setting <br>
2. window is another JS built-in object which refers to the whole browser tab (which is broader than document and navigator) <br>
-> `localized` event is an event from l10n library that happens when computer has successfully founded and loaded the language JSON file inside locales/ <br>
-> This ensure that everything is loaded before the code tries to translate text
3. `title` attribute in html helps to show message when user hover at the `Add Pawn` button

# Step 6: Handle multi-user with presence (toughest)
1. Client-Server architecture and the remote whitelist
The tutorial suggests connecting to https://dev.sugarizer.org to test presence, but this breaks local apps. <br>

Why: When offline, Sugarizer reads the local hard drive to build the home screen. The millisecond it connects to a remote server, it stops trusting the local drive. It asks the server's MongoDB database for an official "whitelist" of approved apps. Because my local Pawn activity wasn't registered in that remote database, the server omitted it, and the frontend hid the icon. <br>

2. The "Disguise" Hack (Routing vs. API)
To bypass the server whitelist without building a local backend, I had to trick two separate systems:

Tricking the Local Router: By renaming Pawn.activity to Clock.activity, I tricked my local browser. When the server approved the "Clock," my browser looked for the Clock folder but loaded my Pawn code instead.

Tricking the Backend API: By changing the bundle_id in activity.info to org.sugarlabs.Clock, I tricked the server. When I clicked the share button, my frontend sent a request for the Clock, so the server authorized the multiplayer room.

3. DOM Injection (How the palette buttons are created)
We only declared #network-button in the index.html file, but we wrote CSS for #private-button and #shared-button.

Why: The HTML for the sub-buttons is generated dynamically by JavaScript. When we initialize presencepalette.PresencePalette(...), the Sugar-Web library builds those extra buttons on the fly and injects them into the Document Object Model (DOM). The CSS just waits for them to exist.

Note: This is also why the palette initialization must be inside the requirejs block. The DOM must be fully loaded before the JavaScript tries to attach a palette to a button.

4. The "Dumb Pipe" Pub/Sub Model
The Sugarizer presence framework uses a Publish/Subscribe pattern.

The server doesn't know the rules of the Pawn game. It acts as a "dumb pipe" or mail carrier.

One user acts as the Host and creates a room (a "Topic"). When another user joins, the Host sends an init action containing the array of current pawns to sync the boards. Every click after that sends an update action, which the server blindly broadcasts to anyone subscribed to that room.

# Step 7: Use journal chooser dialog
The flow to choose image from journal to add in any activity:
1. When the callback function runs, the `entry` parameter contains the metadata for the specific item the user selected from the Journal chooser. If the user closes the dialog without picking anythiing, `entry` = null

2. `entry` object contains an `objectId` property also. This Id is the unique identifier for that specific file (image) inside the Journal.

3. the image is inside the Journal which means it's already stored inside datastore.
-line `var dataentry = new datastore.DatastoreObject(entry.objectId);` is to refer to that image inside datastore<br>
- we load base64 encoding of the image into `data` parameter then change the background of pawn.activity

# Step 8: Create your own palette
1. About the url when we call pawn-icon in pawnpalette.html, why don't need to go ../

2. How come when we never link css to pawnpalette.html, it still receives the styling. Same question with pawnpalette.js

3. How to create a custom event? (this thing need to know) -> that = this? (the palette library so weird)

4. ![alt text](image.png) -> How is the initCustomEvent deprecated here?

# Step 9: Integrate a tutorial
intro.js library to build default UI for tutorial
=> then customize the tutorial UI to match the sugarizer's theme
